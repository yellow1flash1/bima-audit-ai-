import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AllowedMime } from "../security/magic-bytes";
import { scrubPII } from "../security/pii-scrubber";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { DEPARTMENTS, type Department } from "../rules-engine/types";
import { ExtractedBill, ExtractionFormat, LISTS } from "./schema";

export const BILL_MODEL = "claude-opus-5-5";

/** Text PDFs are sent as scrubbed text only; photos (already blurred on the device) as images. */
export type BillInput =
  | { kind: "text"; text: string }
  | { kind: "image"; mime: "image/jpeg" | "image/png"; base64: string };

export type ReadWarning = "contains_instructions" | "total_mismatch" | "low_confidence";

export type ReadResult =
  | { ok: true; bill: ExtractedBill; model: string; warnings: ReadWarning[] }
  | { ok: false; reason: "refused" | "too_long" | "invalid_output" | "no_lines" };

/** Smallest text layer we accept as a real (non-scanned) PDF. */
const MIN_PDF_TEXT = 40;
const MAX_TEXT_CHARS = 200_000;

export type PrepareResult = { ok: true; input: BillInput } | { ok: false; reason: "scanned_pdf" | "too_long" };

/**
 * PDFs never reach the model as files: their text layer is extracted here and
 * scrubbed in buildUserMessage. A PDF with no text layer is a scan, and a scan's
 * header can only be blurred on the device, so it must be uploaded as a photo.
 */
export async function prepareBill(bytes: Uint8Array, mime: AllowedMime): Promise<PrepareResult> {
  if (mime === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.replace(/\s+/g, "").length < MIN_PDF_TEXT) return { ok: false, reason: "scanned_pdf" };
    if (text.length > MAX_TEXT_CHARS) return { ok: false, reason: "too_long" };
    return { ok: true, input: { kind: "text", text } };
  }
  return { ok: true, input: { kind: "image", mime, base64: Buffer.from(bytes).toString("base64") } };
}

/**
 * One structured-output call. The model only suggests: everything it returns is
 * re-validated against bounded enums, descriptions are PII-scrubbed again, and flags
 * and payable amounts are still computed by src/lib/rules-engine/evaluate.ts.
 */
export async function readBill(input: BillInput, client: Anthropic = new Anthropic()): Promise<ReadResult> {
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    input.kind === "text"
      ? [{ type: "text", text: buildUserMessage(input.text) }]
      : [
          { type: "image", source: { type: "base64", media_type: input.mime, data: input.base64 } },
          { type: "text", text: "Transcribe the billed lines of this hospital bill image." },
        ];

  let response;
  try {
    response = await client.beta.messages.parse({
    model: BILL_MODEL,
    max_tokens: 16000,
    // on a safety decline the API re-runs the request on a fallback model it picks
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionFormat) },
    messages: [{ role: "user", content }],
    });
  } catch (e) {
    // the SDK's own structured-output parse failed; API errors propagate to the caller
    if (e instanceof Anthropic.AnthropicError && !(e instanceof Anthropic.APIError)) return { ok: false, reason: "invalid_output" };
    throw e;
  }

  if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
  if (response.stop_reason === "max_tokens") return { ok: false, reason: "too_long" };
  if (!response.parsed_output) return { ok: false, reason: "invalid_output" };

  const cleaned = {
    ...response.parsed_output,
    lines: response.parsed_output.lines.map((l) => ({
      ...l,
      ...coerceEnums(l.department_code, l.suggested_list, l.ocr_confidence),
      description: scrubPII(l.description).text.slice(0, 160),
      amount: round2(l.amount),
      unit_rate: l.unit_rate === null ? null : round2(l.unit_rate),
    })),
  };
  if (cleaned.lines.length === 0) return { ok: false, reason: "no_lines" };
  const checked = ExtractedBill.safeParse(cleaned);
  if (!checked.success) return { ok: false, reason: "invalid_output" };

  return { ok: true, bill: checked.data, model: response.model, warnings: warningsFor(checked.data) };
}

export function warningsFor(bill: ExtractedBill): ReadWarning[] {
  const w: ReadWarning[] = [];
  if (bill.contains_instructions) w.push("contains_instructions");
  if (bill.printed_total !== null) {
    const sum = bill.lines.reduce((a, l) => a + l.amount, 0);
    // allow rounding across many lines, nothing more
    if (Math.abs(sum - bill.printed_total) > Math.max(1, bill.lines.length * 0.5)) w.push("total_mismatch");
  }
  if (bill.lines.some((l) => l.ocr_confidence < 0.7)) w.push("low_confidence");
  return w;
}

/** Out-of-set enum values fall back to the most neutral choice and are marked hard to read. */
function coerceEnums(dept: string, list: string, confidence: number) {
  const deptOk = (DEPARTMENTS as readonly string[]).includes(dept);
  const listOk = (LISTS as readonly string[]).includes(list);
  return {
    department_code: (deptOk ? dept : "misc") as Department,
    suggested_list: (listOk ? list : "NONE") as (typeof LISTS)[number],
    ocr_confidence: deptOk && listOk ? confidence : Math.min(confidence, 0.5),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
