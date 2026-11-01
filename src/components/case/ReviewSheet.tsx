"use client";

import { useEffect, useState } from "react";
import { Button, Group, Pill, Sheet, Squircle } from "@/components/ios";
import { formatINR } from "@/lib/rules-engine/rebuttal";
import { useStore } from "@/lib/store";
import type { Scan } from "./UploadFlow";

const LOW_CONFIDENCE = 0.7;

/**
 * Human checkpoint between machine reading and the case: every suggested line is
 * shown with its read confidence, and only ticked lines are added. Flags and
 * payable amounts are computed afterwards by the rules engine, not here.
 */
export function ReviewSheet({ caseId, scan, onClose, onAdded }: { caseId: string; scan: Scan | null; onClose: () => void; onAdded: (n: number) => void }) {
  const s = useStore();
  const { t } = s;
  const [keep, setKeep] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setKeep(scan ? scan.lines.map(() => true) : []);
    setError(null);
  }, [scan]);

  const lines = scan?.lines ?? [];
  const chosen = lines.filter((_, i) => keep[i]);
  const sum = lines.reduce((a, l) => a + l.amount, 0);
  const desk = s.role === "desk";

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      await s.addLines(caseId, chosen);
      onAdded(chosen.length);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={!!scan} onClose={onClose} title={t("upload.reviewTitle")} closeLabel={t("nav.cancel")}>
      {scan && (
        <div className="pb-4">
          <p className="px-4 pt-3 text-[15px] text-label-2">{t("upload.reviewHint")}</p>

          {scan.warnings.includes("contains_instructions") && <Banner tone="red">{t("upload.warnInstructions")}</Banner>}
          {scan.warnings.includes("total_mismatch") && scan.printedTotal !== null && (
            <Banner tone="amber">{t("upload.warnTotal", { sum: formatINR(sum), total: formatINR(scan.printedTotal) })}</Banner>
          )}
          {scan.warnings.includes("low_confidence") && <Banner tone="amber">{t("upload.warnLowConfidence")}</Banner>}

          <Group
            header={t("upload.readSummary", { count: lines.length, amount: formatINR(sum) })}
            footer={scan.printedTotal !== null ? t("upload.printedTotal", { amount: formatINR(scan.printedTotal) }) : undefined}
          >
            {lines.map((l, i) => {
              const low = l.ocr_confidence < LOW_CONFIDENCE;
              return (
                <label key={i} className="relative flex min-h-11 cursor-pointer items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                    checked={keep[i] ?? false}
                    onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))}
                    aria-label={l.description}
                  />
                  <Squircle tone={low ? "amber" : "grey"} dept={l.department_code} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] leading-snug">{l.description}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-label-2">
                      <span>{t(`dept.${l.department_code}`)}</span>
                      {l.suggested_list !== "NONE" && <Pill tone="grey">{t("case.suggested", { list: l.suggested_list })}</Pill>}
                      <Pill tone={low ? "amber" : "grey"}>{t("case.ocr", { pct: `${Math.round(l.ocr_confidence * 100)}%` })}</Pill>
                    </span>
                  </span>
                  <span className="num shrink-0 text-right text-[17px]">{formatINR(l.amount)}</span>
                  {i < lines.length - 1 && <span className="pointer-events-none absolute bottom-0 left-4 right-0 h-px scale-y-50 bg-hairline" />}
                </label>
              );
            })}
          </Group>

          {error && <p className="px-8 pt-2 text-[13px] text-red-text">{error}</p>}
          {desk && (
            <div className="mx-4 mt-5">
              <Button disabled={saving || chosen.length === 0} onClick={() => void add()}>
                {t("upload.add", { count: chosen.length })}
              </Button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Banner({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  const cls = tone === "red" ? "bg-red-pill text-red-text" : "bg-amber-pill text-amber-text";
  return <div className={`mx-4 mt-3 rounded-xl px-4 py-3 text-[15px] leading-snug ${cls}`}>{children}</div>;
}
