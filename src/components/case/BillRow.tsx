"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Chevron, Pill, SPRING, Squircle } from "@/components/ios";
import { formatINR } from "@/lib/rules-engine/rebuttal";
import type { LineResult, RemapTarget } from "@/lib/rules-engine/types";
import { useStore } from "@/lib/store";

const THRESHOLD = 96;

export function citationOf(l: LineResult, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (l.list !== "NONE") return t("rule.list", { list: l.list });
  if (l.status === "prorata_exempt") return t("rule.prorata_exempt");
  if (l.status === "prorata_trap" || l.status === "room_excess") return t(`status.${l.status}`);
  if (l.reasons.includes("prorata_waived_non_differential")) return t("rule.waived_non_differential");
  if (l.reasons.includes("prorata_waived_package")) return t("rule.waived_package");
  return t("rule.none");
}

/**
 * Grouped-list bill row. Amber (subsumed) rows can be swiped right to absorb
 * them into their natural bucket, with a spring snap-back.
 */
export function BillRow({ l, onOpen, onRemap, last, readOnly }: { l: LineResult; onOpen: () => void; onRemap: (to: RemapTarget) => void; last?: boolean; readOnly?: boolean }) {
  const { t } = useStore();
  const x = useMotionValue(0);
  const canSwipe = !readOnly && l.remapOptions.length > 0;
  const target = l.remapOptions[0];
  const reveal = useTransform(x, [0, THRESHOLD], [0, 1]);
  const actionBg = target === "room" ? "bg-green-icon" : "bg-amber-icon";

  const deduction = l.item.amount - l.payable;

  return (
    <div className="relative overflow-hidden">
      {canSwipe && (
        <motion.div style={{ opacity: reveal }} className={`absolute inset-0 flex items-center pl-4 text-[15px] font-semibold text-white ${actionBg}`}>
          {t(`remap.${target}`)}
        </motion.div>
      )}
      <motion.div
        drag={canSwipe ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.9 }}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > THRESHOLD) onRemap(target);
          animate(x, 0, SPRING);
        }}
        className="relative bg-surface"
      >
        <button type="button" onClick={onOpen} className="block w-full text-left active:bg-surface-2">
          <div className="relative flex min-h-11 items-center gap-3 px-4 py-2.5">
            <Squircle tone={l.flag} dept={l.effectiveDepartment} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[17px] leading-snug">{l.item.description}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] leading-snug text-label-2">
                <span>{citationOf(l, t)}</span>
                {l.item.suggestedList && l.item.suggestedList !== "NONE" && <Pill tone="grey">{t("case.suggested", { list: l.item.suggestedList })}</Pill>}
                {l.item.ocrConfidence !== undefined && <Pill tone="grey">{t("case.ocr", { pct: `${Math.round(l.item.ocrConfidence * 100)}%` })}</Pill>}
              </div>
            </div>
            <div className="num shrink-0 text-right">
              <div className="text-[17px]">{formatINR(l.item.amount)}</div>
              {deduction > 0.004 && <div className={`text-[13px] ${l.flag === "amber" ? "text-amber-text" : "text-red-text"}`}>−{formatINR(deduction)}</div>}
              {l.disputable > 0 && <div className="text-[13px] font-medium text-green-text">↺ {formatINR(l.disputable)}</div>}
            </div>
            <Chevron className="h-4 w-4 shrink-0 text-[#c4c4c6]" />
            {!last && <span className="pointer-events-none absolute bottom-0 left-4 right-0 h-px scale-y-50 bg-hairline" />}
          </div>
        </button>
      </motion.div>
    </div>
  );
}
