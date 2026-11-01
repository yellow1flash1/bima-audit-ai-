/**
 * Deterministic PII redaction run before any bill text leaves the browser or
 * the edge function (DPDP Act 2023). The alias map never leaves the device that
 * produced it; only the scrubbed text is sent onward.
 */

export interface ScrubResult {
  text: string;
  /** alias → original value, kept locally so the UI can re-hydrate names */
  aliases: Record<string, string>;
  counts: Record<"aadhaar" | "pan" | "phone" | "email" | "policy" | "uhid" | "ipd" | "name", number>;
}

const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PAN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
const PHONE = /(?<![\d])(\+91[\-\s]?)?[6-9]\d{9}(?![\d])/g;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

/** "Label: value" identifiers that become stable ephemeral tokens. */
const LABELLED: { kind: "policy" | "uhid" | "ipd"; prefix: string; re: RegExp }[] = [
  { kind: "policy", prefix: "POLICY_REF", re: /\b(policy\s*(?:no|number|#)?\.?\s*[:\-]?\s*)([A-Z0-9\/\-]{6,})/gi },
  { kind: "uhid", prefix: "UHID_REF", re: /\b(uhid\s*(?:no|number)?\.?\s*[:\-]?\s*)([A-Z0-9\/\-]{4,})/gi },
  { kind: "ipd", prefix: "IPD_REF", re: /\b((?:ipd|ip|mrn|reg)\s*(?:no|number)?\.?\s*[:\-]\s*)([A-Z0-9\/\-]{4,})/gi },
];

/** Name after a patient/relation label, up to end of line or the next field. */
const NAME =
  /\b((?:patient(?:'s)?\s*name|name\s*of\s*(?:the\s*)?patient|patient|name|insured|proposer|s\/o|d\/o|w\/o|c\/o)\s*[:\-]\s*)((?:(?:mr|mrs|ms|smt|shri|dr|master|baby)\.?\s+)?[A-Za-z][A-Za-z.']*(?:\s+[A-Za-z][A-Za-z.']*){0,3})/gi;

function token(prefix: string, n: number, seed: string): string {
  // short, stable-within-document suffix so the same value maps to the same alias
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${prefix}_${String(n).padStart(2, "0")}${(h % 256).toString(16).toUpperCase().padStart(2, "0")}`;
}

export function scrubPII(input: string): ScrubResult {
  const aliases: Record<string, string> = {};
  const reverse = new Map<string, string>();
  const counts: ScrubResult["counts"] = { aadhaar: 0, pan: 0, phone: 0, email: 0, policy: 0, uhid: 0, ipd: 0, name: 0 };
  const seq: Record<string, number> = {};

  const alias = (prefix: string, value: string) => {
    const key = `${prefix}:${value.toLowerCase()}`;
    const existing = reverse.get(key);
    if (existing) return existing;
    seq[prefix] = (seq[prefix] ?? 0) + 1;
    const t = token(prefix, seq[prefix], value);
    reverse.set(key, t);
    aliases[t] = value;
    return t;
  };

  let text = input;

  // labelled identifiers and names first, so their digits aren't half-eaten by the phone/Aadhaar passes
  for (const { kind, prefix, re } of LABELLED) {
    text = text.replace(re, (_m, label: string, value: string) => {
      counts[kind]++;
      return label + alias(prefix, value);
    });
  }
  text = text.replace(NAME, (_m, label: string, value: string) => {
    counts.name++;
    return label + alias("PATIENT_ALIAS", value.trim());
  });

  text = text.replace(EMAIL, () => (counts.email++, "[REDACTED_EMAIL]"));
  text = text.replace(AADHAAR, () => (counts.aadhaar++, "[REDACTED_AADHAAR]"));
  text = text.replace(PAN, () => (counts.pan++, "[REDACTED_PAN]"));
  text = text.replace(PHONE, () => (counts.phone++, "[REDACTED_PHONE]"));

  return { text, aliases, counts };
}

export function rehydrate(text: string, aliases: Record<string, string>): string {
  return text.replace(/\b(?:PATIENT_ALIAS|POLICY_REF|UHID_REF|IPD_REF)_[0-9A-F]{4}\b/g, (t) => aliases[t] ?? t);
}
