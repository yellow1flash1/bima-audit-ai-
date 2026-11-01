import type { BillItem, Case } from "../rules-engine/types";

let n = 0;
const line = (p: Omit<BillItem, "id" | "tpaDeducted" | "quantity"> & Partial<BillItem>): BillItem => ({
  id: `L${++n}`,
  quantity: 1,
  tpaDeducted: 0,
  ...p,
});

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

/**
 * Seeded demo cases used until Supabase is connected. All names are fictional. Case 1 reproduces the
 * classic trap: 1% of ₹5 L cap (₹5,000/day) vs. an ₹8,000 single room → 62.5%,
 * with the TPA scaling pharmacy and implants as well.
 */
export function demoCases(): Case[] {
  n = 0;
  return [
    {
      id: "BA-24117",
      patientAlias: "PATIENT_ALIAS_89A",
      hospital: { name: "Demo Multispeciality Hospital, Pune", differentialBilling: true },
      policy: {
        insurer: "Alpha Health Insurance",
        tpa: "Alpha TPA",
        policyRefAlias: "POLICY_REF_01",
        sumInsured: 500000,
        roomCap: { type: "percent_si", percent: 1 },
        icuCap: { type: "percent_si", percent: 2 },
        consumablesAddon: false,
      },
      isPackageBilling: false,
      admittedAt: hoursAgo(98),
      dischargeRequestedAt: hoursAgo(1 + 18 / 60),
      roomRentPerDay: 8000,
      roomDays: 4,
      items: [
        line({ description: "Single Room Rent (4 days @ ₹8,000)", department: "room", quantity: 4, unitRate: 8000, amount: 32000, tpaDeducted: 12000 }),
        line({ description: "Nursing Charges", department: "nursing", quantity: 4, unitRate: 1500, amount: 6000, tpaDeducted: 2250 }),
        line({ description: "Surgeon Fee — Lap. Cholecystectomy", department: "surgeon", amount: 45000, tpaDeducted: 16875 }),
        line({ description: "Anaesthetist Fee", department: "surgeon", amount: 12000, tpaDeducted: 4500 }),
        line({ description: "OT Charges", department: "ot", amount: 22000, tpaDeducted: 8250 }),
        line({ description: "Consultation — Dr. Kulkarni (4 visits)", department: "consultation", quantity: 4, unitRate: 1200, amount: 4800, tpaDeducted: 1800 }),
        line({ description: "ICU Charges (1 day)", department: "icu", quantity: 1, unitRate: 9500, amount: 9500, tpaDeducted: 3562.5 }),
        line({ description: "Pharmacy — IV antibiotics & analgesics", department: "pharmacy", amount: 18650, tpaDeducted: 6993.75 }),
        line({ description: "Endo-clips & Trocar set", department: "implant", amount: 14200, tpaDeducted: 5325 }),
        line({ description: "CBC, LFT, USG Abdomen", department: "diagnostics", amount: 7400, tpaDeducted: 2775 }),
        line({ description: "Shoe Covers (12)", department: "consumables", quantity: 12, amount: 480, tpaDeducted: 480, ocrConfidence: 0.94 }),
        line({ description: "Hand Wash Liquid", department: "consumables", amount: 210, tpaDeducted: 210, ocrConfidence: 0.91 }),
        line({ description: "Bed Pan", department: "consumables", amount: 350, tpaDeducted: 350, ocrConfidence: 0.97 }),
        line({ description: "Surgical Tape (Micropore)", department: "consumables", amount: 640, tpaDeducted: 640, ocrConfidence: 0.88 }),
        line({ description: "Gauze Swabs", department: "consumables", amount: 920, tpaDeducted: 920, ocrConfidence: 0.9 }),
        line({ description: "Disposable Razor", department: "consumables", amount: 90, tpaDeducted: 90, ocrConfidence: 0.86 }),
        line({ description: "Glucometer Strips", department: "consumables", amount: 760, tpaDeducted: 760, ocrConfidence: 0.92 }),
        line({ description: "Urine Bag", department: "consumables", amount: 180, tpaDeducted: 180, ocrConfidence: 0.95 }),
        line({ description: "Admission Kit", department: "consumables", amount: 1200, tpaDeducted: 1200, ocrConfidence: 0.83 }),
        line({ description: "Mineral Water (24)", department: "misc", quantity: 24, amount: 480, tpaDeducted: 480, ocrConfidence: 0.96 }),
        line({ description: "Attendant Food", department: "misc", amount: 2400, tpaDeducted: 2400, ocrConfidence: 0.93 }),
        line({ description: "Diapers (adult)", department: "consumables", amount: 650, tpaDeducted: 650, ocrConfidence: 0.89 }),
        line({ description: "Disposable kit — ward", department: "consumables", amount: 1450, tpaDeducted: 1450, ocrConfidence: 0.61, suggestedList: "III" }),
      ],
    },
    {
      id: "BA-24121",
      patientAlias: "PATIENT_ALIAS_3C1",
      hospital: { name: "Demo Multispeciality Hospital, Pune", differentialBilling: true },
      policy: {
        insurer: "Beta General Insurance",
        tpa: "Beta TPA",
        policyRefAlias: "POLICY_REF_02",
        sumInsured: 1000000,
        roomCap: { type: "fixed", perDay: 6000 },
        consumablesAddon: true,
      },
      isPackageBilling: true,
      admittedAt: hoursAgo(50),
      dischargeRequestedAt: hoursAgo(2.4),
      roomRentPerDay: 6000,
      roomDays: 2,
      items: [
        line({ description: "Twin Sharing Room (2 days)", department: "room", quantity: 2, unitRate: 6000, amount: 12000 }),
        line({ description: "Cataract Package — Phaco + IOL", department: "procedure", amount: 48000, tpaDeducted: 6000 }),
        line({ description: "Eye Drape", department: "consumables", amount: 300, tpaDeducted: 300 }),
        line({ description: "Pharmacy — eye drops", department: "pharmacy", amount: 2100 }),
        line({ description: "Gloves", department: "consumables", amount: 420, tpaDeducted: 420 }),
      ],
    },
    {
      id: "BA-24098",
      patientAlias: "PATIENT_ALIAS_E07",
      hospital: { name: "Demo Multispeciality Hospital, Pune", differentialBilling: false },
      policy: {
        insurer: "Gamma Health Insurance",
        tpa: "In-house",
        policyRefAlias: "POLICY_REF_03",
        sumInsured: 300000,
        roomCap: { type: "fixed", perDay: 3000 },
        consumablesAddon: false,
      },
      isPackageBilling: false,
      admittedAt: hoursAgo(76),
      dischargeRequestedAt: hoursAgo(3.3),
      roomRentPerDay: 4500,
      roomDays: 3,
      items: [
        line({ description: "Semi-private Room (3 days)", department: "room", quantity: 3, unitRate: 4500, amount: 13500, tpaDeducted: 4500 }),
        line({ description: "Physician Visits", department: "consultation", amount: 6000, tpaDeducted: 2000 }),
        line({ description: "Nursing Charges", department: "nursing", amount: 4500, tpaDeducted: 1500 }),
        line({ description: "Pharmacy", department: "pharmacy", amount: 9800, tpaDeducted: 3266.67 }),
        line({ description: "Chest X-ray, CRP", department: "diagnostics", amount: 2600 }),
        line({ description: "Telephone Charges", department: "misc", amount: 150, tpaDeducted: 150 }),
      ],
    },
  ];
}
