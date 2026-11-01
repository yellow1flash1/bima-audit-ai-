import type { BillItem, Case, Department, IrdaiList, RemapTarget, RoomCap } from "../rules-engine/types";

/** Columns selected for a case, with its policy, hospital and lines embedded. */
export const CASE_SELECT = `
  id, case_ref, patient_alias, is_package_billing, differential_billing, admitted_at,
  discharge_requested_at, room_rent_per_day, room_days, hospital_id,
  hospitals ( name, differential_billing ),
  policies ( insurer, tpa, policy_ref_alias, sum_insured, room_cap_type, room_cap_value,
             icu_cap_type, icu_cap_value, consumables_addon, sub_limits ),
  bill_items ( id, line_no, description, department, quantity, unit_rate, amount, tpa_deducted,
               ocr_confidence, suggested_list, confirmed_list, remapped_to )
`;

type Num = number | string | null;

export interface CaseRow {
  id: string;
  case_ref: string | null;
  patient_alias: string;
  is_package_billing: boolean;
  differential_billing: boolean | null;
  admitted_at: string;
  discharge_requested_at: string | null;
  room_rent_per_day: Num;
  room_days: number;
  hospital_id: string;
  hospitals: { name: string; differential_billing: boolean } | null;
  policies: {
    insurer: string;
    tpa: string | null;
    policy_ref_alias: string;
    sum_insured: Num;
    room_cap_type: "fixed" | "percent_si" | "none";
    room_cap_value: Num;
    icu_cap_type: "fixed" | "percent_si" | "none" | null;
    icu_cap_value: Num;
    consumables_addon: boolean;
    sub_limits: Partial<Record<Department, number>> | null;
  } | null;
  bill_items: {
    id: string;
    line_no: number;
    description: string;
    department: Department;
    quantity: Num;
    unit_rate: Num;
    amount: Num;
    tpa_deducted: Num;
    ocr_confidence: Num;
    suggested_list: IrdaiList | null;
    confirmed_list: IrdaiList | null;
    remapped_to: RemapTarget | null;
  }[];
}

// numeric columns arrive as strings from PostgREST
const n = (v: Num): number => (v === null ? 0 : Number(v));
const opt = (v: Num): number | undefined => (v === null ? undefined : Number(v));

function cap(type: string | null, value: Num): RoomCap {
  if (type === "fixed") return { type: "fixed", perDay: n(value) };
  if (type === "percent_si") return { type: "percent_si", percent: n(value) };
  return { type: "none" };
}

export function toCase(r: CaseRow): Case & { hospitalId: string } {
  const p = r.policies;
  if (!p) throw new Error(`case ${r.id} has no readable policy`);
  const items: BillItem[] = [...r.bill_items]
    .sort((a, b) => a.line_no - b.line_no)
    .map((i) => ({
      id: i.id,
      description: i.description,
      department: i.department,
      quantity: n(i.quantity),
      unitRate: opt(i.unit_rate),
      amount: n(i.amount),
      tpaDeducted: n(i.tpa_deducted),
      ocrConfidence: opt(i.ocr_confidence),
      suggestedList: i.suggested_list ?? undefined,
      confirmedList: i.confirmed_list ?? undefined,
      remappedTo: i.remapped_to ?? undefined,
    }));
  return {
    id: r.id,
    ref: r.case_ref ?? undefined,
    hospitalId: r.hospital_id,
    patientAlias: r.patient_alias,
    hospital: {
      name: r.hospitals?.name ?? "",
      differentialBilling: r.differential_billing ?? r.hospitals?.differential_billing ?? true,
    },
    policy: {
      insurer: p.insurer,
      tpa: p.tpa ?? undefined,
      policyRefAlias: p.policy_ref_alias,
      sumInsured: n(p.sum_insured),
      roomCap: cap(p.room_cap_type, p.room_cap_value),
      icuCap: p.icu_cap_type ? cap(p.icu_cap_type, p.icu_cap_value) : undefined,
      consumablesAddon: p.consumables_addon,
      subLimits: p.sub_limits ?? undefined,
    },
    isPackageBilling: r.is_package_billing,
    admittedAt: r.admitted_at,
    dischargeRequestedAt: r.discharge_requested_at ?? undefined,
    roomRentPerDay: n(r.room_rent_per_day),
    roomDays: r.room_days,
    items,
  };
}
