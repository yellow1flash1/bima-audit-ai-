import { RULES } from "./catalogue";
import type { BillItem, Department, Rule } from "./types";

/** Lines under these departments are never matched against Lists I–IV. */
const UNMATCHED_DEPARTMENTS: ReadonlySet<Department> = new Set([
  "room",
  "icu",
  "surgeon",
  "consultation",
  "diagnostics",
  "implant",
]);

export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

interface Phrase {
  text: string;
  rule: Rule;
}

function phrasesFor(rule: Rule): string[] {
  const fromName = rule.itemName
    .replace(/\(.*?\)/g, " ")
    .split(/[\/,]| - | or /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return [rule.itemName, ...fromName, ...rule.synonyms];
}

/** Longest phrase first so "face mask" (List II) beats "mask" (List I). */
const INDEX: Phrase[] = RULES.flatMap((rule) =>
  phrasesFor(rule).map((p) => ({ text: normalise(p), rule })),
)
  .filter((p) => p.text.trim().length > 0)
  .sort((a, b) => b.text.length - a.text.length);

export function matchRule(description: string, rules: Phrase[] = INDEX): Rule | undefined {
  const hay = normalise(description);
  // plural tolerance: "shoe covers" → also try singular forms word by word
  const singular = hay.replace(/([a-z]{3,})s /g, "$1 ");
  for (const p of rules) {
    if (hay.includes(p.text) || singular.includes(p.text)) return p.rule;
  }
  return undefined;
}

export function matchItem(item: BillItem): Rule | undefined {
  if (UNMATCHED_DEPARTMENTS.has(item.department)) return undefined;
  return matchRule(item.description);
}
