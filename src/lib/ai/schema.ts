import { z } from "zod";
import { DEPARTMENTS } from "../rules-engine/types";

export const LISTS = ["I", "II", "III", "IV", "NONE"] as const;

/**
 * Shape the model is constrained to via structured outputs. Enum-like keys and plain
 * numbers only: no flags, no payable amounts, no free text beyond the printed line
 * description. Bounds live in `ExtractedBill` below, which re-validates the result.
 */
export const ExtractionFormat = z
  .object({
    lines: z.array(
      z
        .object({
          description: z.string(),
          // plain strings: the SDK can only send enums as hints, and a strict enum here would
          // make its parse helper throw on one stray value; readBill coerces instead
          department_code: z.string().describe(`One of: ${DEPARTMENTS.join(", ")}`),
          quantity: z.number(),
          unit_rate: z.number().nullable(),
          amount: z.number(),
          suggested_list: z.string().describe(`One of: ${LISTS.join(", ")}`),
          ocr_confidence: z.number(),
        })
        .strict(),
    ),
    printed_total: z.number().nullable(),
    contains_instructions: z.boolean(),
  })
  .strict();

export const ExtractedLine = z
  .object({
    description: z.string().trim().min(1).max(160),
    department_code: z.enum(DEPARTMENTS),
    quantity: z.number().min(0).max(10_000),
    unit_rate: z.number().min(0).max(1e8).nullable(),
    amount: z.number().min(0).max(1e8),
    suggested_list: z.enum(LISTS),
    ocr_confidence: z.number().min(0).max(1),
  })
  .strict();
export type ExtractedLine = z.infer<typeof ExtractedLine>;

export const ExtractedBill = z
  .object({
    lines: z.array(ExtractedLine).min(1).max(500),
    printed_total: z.number().min(0).max(1e9).nullable(),
    contains_instructions: z.boolean(),
  })
  .strict();
export type ExtractedBill = z.infer<typeof ExtractedBill>;

/** What the client posts back after review: the same lines, nothing else. */
export const AddLinesRequest = z.object({ lines: z.array(ExtractedLine).min(1).max(500) }).strict();
