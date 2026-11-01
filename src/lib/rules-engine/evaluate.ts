import { matchItem } from "./match";
import { capPerDay, computeProportion, isProrataExempt, round2, roomRatio } from "./prorata";
import type {
  BillItem,
  Case,
  Department,
  Evaluation,
  IrdaiList,
  LineResult,
  ReasonKey,
  RemapTarget,
} from "./types";

/**
 * The only place in the system that assigns flags and rupee amounts.
 * Machine suggestions (`suggestedList`) are deliberately ignored here; a list
 * only takes effect once a human confirms it (`confirmedList`) or the
 * deterministic catalogue matches the description.
 */
export function evaluate(c: Case, opts: { roomRentPerDay?: number } = {}): Evaluation {
  const roomRentPerDay = opts.roomRentPerDay ?? c.roomRentPerDay;
  const { proportion, roomCapPerDay, waiver } = computeProportion(c, roomRentPerDay);
  const icuCapPerDay = capPerDay(c.policy.icuCap, c.policy.sumInsured);

  const lines = c.items.map((raw) => {
    const item = withRoomRate(raw, c, opts.roomRentPerDay);
    return evaluateLine(item, c, { proportion, waiver, roomCapPerDay, roomRentPerDay, icuCapPerDay });
  });

  applySubLimits(lines, c.policy.subLimits);

  for (const l of lines) {
    l.payable = round2(l.payable);
    l.legallyDeductible = round2(l.item.amount - l.payable);
    l.disputable = round2(Math.max(0, l.item.tpaDeducted - l.legallyDeductible));
  }

  const sum = (f: (l: LineResult) => number, filter: (l: LineResult) => boolean = () => true) =>
    round2(lines.filter(filter).reduce((a, l) => a + f(l), 0));

  const isProtected = (l: LineResult) => l.list === "NONE" && isProrataExempt(l.effectiveDepartment);
  const isExposed = (l: LineResult) =>
    (l.list === "NONE" || l.status === "remapped") && !isProrataExempt(l.effectiveDepartment);

  const billed = sum((l) => l.item.amount);
  const payable = sum((l) => l.payable);

  return {
    caseId: c.id,
    roomCapPerDay,
    proportion: round4(proportion),
    proportionWaiver: waiver,
    lines,
    totals: {
      billed,
      payable,
      outOfPocket: round2(billed - payable),
      tpaDeducted: sum((l) => l.item.tpaDeducted),
      disputable: sum((l) => l.disputable),
      protectedBucket: sum((l) => l.item.amount, isProtected),
      exposedBucket: sum((l) => l.item.amount, isExposed),
      exposedPayable: sum((l) => l.payable, isExposed),
    },
  };
}

interface Ctx {
  proportion: number;
  waiver?: "non_differential" | "package";
  roomCapPerDay: number | null;
  roomRentPerDay: number;
  icuCapPerDay: number | null;
}

const REMAP_DEPARTMENT: Record<RemapTarget, Department> = {
  room: "room",
  procedure: "procedure",
  treatment: "treatment",
};

const LIST_REMAP: Partial<Record<IrdaiList, RemapTarget>> = {
  II: "room",
  III: "procedure",
  IV: "treatment",
};

function evaluateLine(item: BillItem, c: Case, ctx: Ctx): LineResult {
  const matched = matchItem(item);
  const reasons: ReasonKey[] = [];
  let list: IrdaiList = "NONE";
  if (item.confirmedList) {
    list = item.confirmedList;
    reasons.push("confirmed_by_user");
  } else if (matched) {
    list = matched.list;
    reasons.push("list_match");
  }
  const rule = matched && matched.list === list ? matched : undefined;

  const base = {
    item,
    list,
    rule,
    reasons,
    legallyDeductible: 0,
    disputable: 0,
  };

  // Room rent itself: the excess above the cap is never payable, waiver or not.
  if (item.department === "room" && list === "NONE" && !item.remappedTo) {
    const ratio = roomRatio(ctx.roomCapPerDay, ctx.roomRentPerDay);
    if (ratio < 1) reasons.push("room_over_cap");
    return {
      ...base,
      effectiveDepartment: "room",
      flag: ratio < 1 ? "red" : "green",
      status: ratio < 1 ? "room_excess" : "payable",
      proportionApplied: ratio,
      payable: item.amount * ratio,
      remapOptions: [],
    };
  }

  if (item.department === "icu" && list === "NONE") {
    const days = item.quantity || 1;
    const rate = item.unitRate ?? item.amount / days;
    const ratio = roomRatio(ctx.icuCapPerDay, rate);
    if (ratio < 1) reasons.push("room_over_cap");
    reasons.push("exempt_from_prorata");
    return {
      ...base,
      effectiveDepartment: "icu",
      flag: ratio < 1 ? "red" : "green",
      status: ratio < 1 ? "room_excess" : "prorata_exempt",
      proportionApplied: 1,
      payable: item.amount * ratio,
      remapOptions: [],
    };
  }

  if (list === "I") {
    if (c.policy.consumablesAddon) {
      reasons.push("addon_covers");
      return { ...base, effectiveDepartment: item.department, flag: "green", status: "payable_addon", proportionApplied: 1, payable: item.amount, remapOptions: [] };
    }
    return { ...base, effectiveDepartment: item.department, flag: "red", status: "non_payable", proportionApplied: 0, payable: 0, remapOptions: [] };
  }

  if (list === "II" || list === "III" || list === "IV") {
    const natural = LIST_REMAP[list]!;
    if (item.remappedTo) {
      const dept = REMAP_DEPARTMENT[item.remappedTo];
      reasons.push("remapped_into_bucket", ...prorataReasons(ctx));
      return {
        ...base,
        effectiveDepartment: dept,
        flag: "green",
        status: "remapped",
        proportionApplied: ctx.proportion,
        payable: item.amount * ctx.proportion,
        remapOptions: [],
      };
    }
    return {
      ...base,
      effectiveDepartment: item.department,
      flag: "amber",
      status: "subsumed",
      proportionApplied: 0,
      payable: 0,
      remapOptions: natural === "room" ? ["room", "procedure"] : [natural],
    };
  }

  // Not on any list: medical expense.
  if (isProrataExempt(item.department)) {
    reasons.push("exempt_from_prorata");
    return { ...base, effectiveDepartment: item.department, flag: "green", status: "prorata_exempt", proportionApplied: 1, payable: item.amount, remapOptions: [] };
  }

  reasons.push(...prorataReasons(ctx));
  const scaled = ctx.proportion < 1;
  return {
    ...base,
    effectiveDepartment: item.department,
    flag: scaled ? "red" : "green",
    status: scaled ? "prorata_trap" : "payable",
    proportionApplied: ctx.proportion,
    payable: item.amount * ctx.proportion,
    remapOptions: [],
  };
}

function prorataReasons(ctx: Ctx): ReasonKey[] {
  if (ctx.waiver === "non_differential") return ["prorata_waived_non_differential"];
  if (ctx.waiver === "package") return ["prorata_waived_package"];
  return ctx.proportion < 1 ? ["prorata_scaled"] : [];
}

/** Recompute the room line when the Wallet slider previews a different category. */
function withRoomRate(item: BillItem, c: Case, override?: number): BillItem {
  if (override === undefined || item.department !== "room" || item.remappedTo || item.confirmedList) return item;
  const days = item.quantity || c.roomDays;
  return { ...item, unitRate: override, amount: round2(override * days) };
}

function applySubLimits(lines: LineResult[], limits: Case["policy"]["subLimits"]) {
  if (!limits) return;
  for (const [dept, max] of Object.entries(limits) as [Department, number][]) {
    const inDept = lines.filter((l) => l.effectiveDepartment === dept && l.payable > 0);
    const total = inDept.reduce((a, l) => a + l.payable, 0);
    if (total <= max || total === 0) continue;
    const k = max / total;
    for (const l of inDept) {
      l.payable *= k;
      l.reasons.push("sub_limit_applied");
    }
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
