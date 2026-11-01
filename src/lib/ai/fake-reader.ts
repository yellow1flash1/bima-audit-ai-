import "server-only";
import type { BillInput, ReadResult } from "./bill-reader";
import { warningsFor } from "./bill-reader";
import type { ExtractedBill } from "./schema";

/**
 * Development stand-in for readBill, enabled with BIMA_FAKE_OCR=1 (never in production).
 * Lets the scan → review → add flow be exercised without model credentials.
 */
export async function fakeReadBill(input: BillInput): Promise<ReadResult> {
  const injected = input.kind === "text" && /ignore (all |previous )?instructions/i.test(input.text);
  const bill: ExtractedBill = {
    lines: [
      { description: "Pharmacy — Inj. Pantoprazole 40 mg", department_code: "pharmacy", quantity: 6, unit_rate: 85, amount: 510, suggested_list: "NONE", ocr_confidence: 0.96 },
      { description: "Sputum Cup", department_code: "consumables", quantity: 2, unit_rate: 45, amount: 90, suggested_list: "II", ocr_confidence: 0.91 },
      { description: "Cotton Roll", department_code: "consumables", quantity: 1, unit_rate: null, amount: 140, suggested_list: "III", ocr_confidence: 0.88 },
      { description: "Physiotherapy session", department_code: "treatment", quantity: 2, unit_rate: 600, amount: 1200, suggested_list: "NONE", ocr_confidence: 0.64 },
    ],
    printed_total: 1940,
    contains_instructions: injected,
  };
  return { ok: true, bill, model: "fake-ocr", warnings: warningsFor(bill) };
}

export const fakeOcrEnabled = process.env.BIMA_FAKE_OCR === "1" && process.env.NODE_ENV !== "production";
