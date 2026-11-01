import { EXCESS_DEDUCTION_RULE, NON_DIFFERENTIAL_RULE, PRORATA_RULE } from "./catalogue";
import { isProrataExempt } from "./prorata";
import type { Evaluation, LineResult } from "./types";

export interface RebuttalPoint {
  lineId: string;
  item: string;
  amount: number;
  code: string;
  citation: string;
  en: string;
  hi: string;
}

export function formatINR(n: number): string {
  const paise = Math.round(n * 100) % 100 !== 0;
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: paise ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

/**
 * One rule-cited point per line that the TPA has over-deducted, plus every
 * List II–IV line the desk has absorbed into a bucket.
 */
export function buildRebuttal(ev: Evaluation): RebuttalPoint[] {
  const points: RebuttalPoint[] = [];
  for (const l of ev.lines) {
    const p = pointFor(l, ev);
    if (p) points.push(p);
  }
  return points;
}

function pointFor(l: LineResult, ev: Evaluation): RebuttalPoint | undefined {
  const item = l.item.description;
  const base = { lineId: l.item.id, item };

  if (l.status === "remapped" && l.rule) {
    return {
      ...base,
      amount: l.disputable,
      code: l.rule.code,
      citation: `${l.rule.circularRef} · ${l.rule.clause}`,
      en: l.rule.rebuttalEn,
      hi: l.rule.rebuttalHi,
    };
  }

  if (l.disputable <= 0) return undefined;
  const vars = {
    item,
    amount: formatINR(l.disputable),
    allowed: formatINR(l.legallyDeductible),
    deducted: formatINR(l.item.tpaDeducted),
  };

  if (l.status === "payable_addon" && l.rule) {
    return { ...base, amount: l.disputable, code: l.rule.code, citation: `${l.rule.circularRef} · ${l.rule.clause}`, en: l.rule.rebuttalEn, hi: l.rule.rebuttalHi };
  }

  const r =
    l.list === "NONE" && isProrataExempt(l.effectiveDepartment)
      ? PRORATA_RULE
      : ev.proportionWaiver
        ? NON_DIFFERENTIAL_RULE
        : EXCESS_DEDUCTION_RULE;

  return {
    ...base,
    amount: l.disputable,
    code: r.code,
    citation: `${r.circularRef} · ${r.clause}`,
    en: fill(r.rebuttalEn, vars),
    hi: fill(r.rebuttalHi, vars),
  };
}
