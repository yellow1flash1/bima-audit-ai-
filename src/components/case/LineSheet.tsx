"use client";

import { Group, Pill, Row, Segmented, Sheet } from "@/components/ios";
import { formatINR } from "@/lib/rules-engine/rebuttal";
import type { LineResult } from "@/lib/rules-engine/types";
import { useStore } from "@/lib/store";
import { citationOf } from "./BillRow";

export function LineSheet({ caseId, line, onClose, readOnly }: { caseId: string; line: LineResult | null; onClose: () => void; readOnly?: boolean }) {
  const s = useStore();
  const { t, locale } = s;
  const l = line;

  return (
    <Sheet open={!!l} onClose={onClose} title={t("detail.why")} closeLabel={t("nav.done")}>
      {l && (
        <div className="pb-6">
          <div className="px-4 pt-3">
            <div className="text-[22px] font-semibold leading-tight">{l.item.description}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone={l.flag}>{s.t(`status.${l.status}`)}</Pill>
              <Pill tone="grey">{citationOf(l, t)}</Pill>
            </div>
          </div>

          <Group header={t("detail.classification")}>
            <div className="px-4 py-3 text-[15px] leading-relaxed">
              {l.rule ? (locale === "hi-IN" ? l.rule.explanationHi : l.rule.explanationEn) : t(`status.${l.status}`)}
              <ul className="mt-2 space-y-1 text-[13px] text-label-2">
                {[...new Set(l.reasons)].map((r) => (
                  <li key={r}>· {t(`reason.${r}`)}</li>
                ))}
              </ul>
            </div>
          </Group>

          <Group>
            <Row title={t("detail.billed")} value={formatINR(l.item.amount)} />
            <Row title={t("detail.proportion")} value={`${Math.round(l.proportionApplied * 1000) / 10}%`} />
            <Row title={t("detail.admissible")} value={formatINR(l.payable)} />
            <Row title={t("detail.legallyDeductible")} value={formatINR(l.legallyDeductible)} />
            <Row title={t("detail.tpaDeducted")} value={formatINR(l.item.tpaDeducted)} />
            <Row last title={<span className="font-semibold">{t("detail.disputable")}</span>} value={<span className={l.disputable > 0 ? "font-semibold text-green-text" : ""}>{formatINR(l.disputable)}</span>} />
          </Group>

          {!readOnly && l.item.suggestedList && l.item.suggestedList !== "NONE" && (
            <Group header={t("detail.confirmList")} footer={t("case.suggested", { list: l.item.suggestedList })}>
              <div className="flex items-center justify-between px-4 py-2.5">
                <Pill tone="grey">{t("case.suggested", { list: l.item.suggestedList })}</Pill>
                <Segmented
                  label="confirm-suggestion"
                  size="sm"
                  value={"pending" as string}
                  options={[
                    { value: "confirm", label: t("case.confirm") },
                    { value: "dismiss", label: t("case.dismiss") },
                  ]}
                  onChange={(v) => {
                    if (v === "confirm") s.confirmList(caseId, l.item.id, l.item.suggestedList);
                    else s.dismissSuggestion(caseId, l.item.id);
                    onClose();
                  }}
                />
              </div>
            </Group>
          )}

          {!readOnly && (l.remapOptions.length > 0 || l.status === "remapped") && (
            <Group>
              {l.remapOptions.map((o, i) => (
                <Row
                  key={o}
                  last={i === l.remapOptions.length - 1}
                  title={<span className="text-accent">{t(`remap.${o}`)}</span>}
                  onClick={() => {
                    s.remap(caseId, l.item.id, o);
                    onClose();
                  }}
                />
              ))}
              {l.status === "remapped" && (
                <Row
                  last
                  title={<span className="text-red-icon">{t("remap.undo")}</span>}
                  onClick={() => {
                    s.remap(caseId, l.item.id, undefined);
                    onClose();
                  }}
                />
              )}
            </Group>
          )}

          {l.rule && (
            <Group header={t("detail.citation")}>
              <div className="num px-4 py-3 text-[13px] leading-relaxed text-label-2">
                {l.rule.source}
                <br />
                {l.rule.circularRef} · {l.rule.clause} · {l.rule.code}
              </div>
            </Group>
          )}
        </div>
      )}
    </Sheet>
  );
}
