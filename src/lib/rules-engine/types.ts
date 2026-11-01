export type IrdaiList = "I" | "II" | "III" | "IV" | "NONE";

export const DEPARTMENTS = [
  "room",
  "nursing",
  "icu",
  "pharmacy",
  "implant",
  "device",
  "diagnostics",
  "ot",
  "surgeon",
  "consultation",
  "procedure",
  "consumables",
  "treatment",
  "misc",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** IRDAI Health Insurance Regulations 2020: never scaled by room-rent proportion. */
export const PRORATA_EXEMPT: ReadonlySet<Department> = new Set([
  "pharmacy",
  "implant",
  "device",
  "diagnostics",
  "icu",
]);

export type RemapTarget = "room" | "procedure" | "treatment";

export type Flag = "green" | "amber" | "red";

export type Status =
  | "payable"
  | "payable_addon"
  | "prorata_exempt"
  | "subsumed"
  | "remapped"
  | "non_payable"
  | "prorata_trap"
  | "room_excess";

export interface Rule {
  code: string;
  list: Exclude<IrdaiList, "NONE">;
  itemName: string;
  synonyms: string[];
  source: string;
  circularRef: string;
  clause: string;
  effectiveFrom: string;
  explanationEn: string;
  explanationHi: string;
  rebuttalEn: string;
  rebuttalHi: string;
}

export type RoomCap =
  | { type: "fixed"; perDay: number }
  | { type: "percent_si"; percent: number }
  | { type: "none" };

export interface Policy {
  insurer: string;
  tpa?: string;
  policyRefAlias: string;
  sumInsured: number;
  roomCap: RoomCap;
  icuCap?: RoomCap;
  consumablesAddon: boolean;
  /** department → maximum payable ₹ for the whole stay */
  subLimits?: Partial<Record<Department, number>>;
}

export interface Hospital {
  name: string;
  differentialBilling: boolean;
}

export interface BillItem {
  id: string;
  description: string;
  department: Department;
  quantity: number;
  unitRate?: number;
  amount: number;
  /** What the TPA has proposed to deduct on this line. */
  tpaDeducted: number;
  ocrConfidence?: number;
  /** Machine suggestion. Shown to the user, never used for flags until confirmed. */
  suggestedList?: IrdaiList;
  /** Human-confirmed list (overrides the catalogue match). */
  confirmedList?: IrdaiList;
  remappedTo?: RemapTarget;
}

export interface Case {
  id: string;
  /** Human-facing case number (e.g. BA-24117); falls back to `id`. */
  ref?: string;
  patientAlias: string;
  hospital: Hospital;
  policy: Policy;
  isPackageBilling: boolean;
  admittedAt: string;
  dischargeRequestedAt?: string;
  /** Per-day rent of the room category actually occupied. */
  roomRentPerDay: number;
  roomDays: number;
  items: BillItem[];
}

export interface LineResult {
  item: BillItem;
  flag: Flag;
  status: Status;
  list: IrdaiList;
  rule?: Rule;
  /** Department the amount is evaluated under after any remap. */
  effectiveDepartment: Department;
  proportionApplied: number;
  payable: number;
  legallyDeductible: number;
  /** TPA deduction exceeding what the rules allow. */
  disputable: number;
  /** Line can be swiped into a bucket. */
  remapOptions: RemapTarget[];
  reasons: ReasonKey[];
}

export type ReasonKey =
  | "list_match"
  | "confirmed_by_user"
  | "addon_covers"
  | "exempt_from_prorata"
  | "prorata_scaled"
  | "prorata_waived_non_differential"
  | "prorata_waived_package"
  | "room_over_cap"
  | "sub_limit_applied"
  | "remapped_into_bucket";

export interface Evaluation {
  caseId: string;
  roomCapPerDay: number | null;
  proportion: number;
  proportionWaiver?: "non_differential" | "package";
  lines: LineResult[];
  totals: {
    billed: number;
    payable: number;
    outOfPocket: number;
    tpaDeducted: number;
    disputable: number;
    protectedBucket: number;
    exposedBucket: number;
    exposedPayable: number;
  };
}
