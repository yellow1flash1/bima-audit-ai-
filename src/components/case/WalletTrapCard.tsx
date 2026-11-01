"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SPRING } from "@/components/ios";
import { evaluate } from "@/lib/rules-engine/evaluate";
import { formatINR } from "@/lib/rules-engine/rebuttal";
import type { Case, Evaluation } from "@/lib/rules-engine/types";
import { useStore } from "@/lib/store";

const PRESETS = [2500, 3000, 4000, 5000, 6000, 8000, 10000, 12000, 15000];

function pct(n: number) {
  return `${(n * 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

/**
 * Apple Wallet-style pass splitting the bill into the protected bucket (never
 * scaled) and the exposed bucket (scaled by the room-rent proportion), with a
 * slider that previews other room categories through the same engine.
 */
export function WalletTrapCard({ c, ev }: { c: Case; ev: Evaluation }) {
  const { t } = useStore();
  const stops = useMemo(() => {
    const s = new Set([...PRESETS, c.roomRentPerDay]);
    if (ev.roomCapPerDay) s.add(ev.roomCapPerDay);
    return [...s].sort((a, b) => a - b);
  }, [c.roomRentPerDay, ev.roomCapPerDay]);

  const actualIdx = stops.indexOf(c.roomRentPerDay);
  const [idx, setIdx] = useState(actualIdx);
  const rate = stops[idx];
  const preview = useMemo(() => (rate === c.roomRentPerDay ? ev : evaluate(c, { roomRentPerDay: rate })), [c, ev, rate]);
  const { totals } = preview;
  const saves = ev.totals.outOfPocket - totals.outOfPocket;

  const exposedRatio = totals.exposedBucket ? totals.exposedPayable / totals.exposedBucket : 1;
  const waiverText = preview.proportionWaiver
    ? t(preview.proportionWaiver === "package" ? "rule.waived_package" : "rule.waived_non_differential")
    : t("wallet.exposedSub", { pct: pct(preview.proportion) });

  return (
    <section className="mx-4 mt-4">
      <div className="relative">
        {/* stacked passes peeking behind */}
        <div className="absolute inset-x-6 -bottom-2 h-6 rounded-b-2xl bg-[var(--wallet-b)] opacity-40" />
        <div className="absolute inset-x-3 -bottom-1 h-6 rounded-b-2xl bg-[var(--wallet-b)] opacity-70" />

        <div className="relative overflow-hidden rounded-2xl bg-[var(--wallet-a)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          <div className="flex items-start justify-between px-5 pt-4">
            <div>
              <div className="text-[12px] font-medium uppercase tracking-wide text-white/55">{t("wallet.title")}</div>
              <div className="num mt-0.5 text-[34px] font-bold leading-none tracking-tight">{pct(preview.proportion)}</div>
            </div>
            <div className="text-right text-[13px] text-white/60">
              <div>{ev.roomCapPerDay ? t("wallet.cap", { amount: formatINR(ev.roomCapPerDay) }) : t("wallet.noCap")}</div>
              <div className="num mt-0.5">{c.policy.insurer}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-px bg-white/10">
            <Bucket
              label={t("wallet.protected")}
              sub={t("wallet.protectedSub")}
              billed={totals.protectedBucket}
              paid={totals.protectedBucket}
              color="var(--green-icon)"
            />
            <Bucket label={t("wallet.exposed")} sub={waiverText} billed={totals.exposedBucket} paid={totals.exposedPayable} ratio={exposedRatio} color={exposedRatio < 1 ? "var(--red-icon)" : "var(--green-icon)"} />
          </div>

          <div className="px-5 pb-4 pt-4">
            <div className="flex items-baseline justify-between text-[13px] text-white/60">
              <span>{t("wallet.room")}</span>
              <span className="num">
                {t("wallet.perDay", { amount: formatINR(rate) })}
                {idx === actualIdx && <span className="ml-1.5 rounded-full bg-white/15 px-1.5 py-px text-[11px] text-white/80">{t("wallet.actual")}</span>}
              </span>
            </div>
            <input
              type="range"
              className="ios-slider mt-1"
              min={0}
              max={stops.length - 1}
              step={1}
              value={idx}
              aria-label={t("wallet.room")}
              aria-valuetext={formatINR(rate)}
              style={{ ["--fill" as string]: `${(idx / (stops.length - 1)) * 100}%` }}
              onChange={(e) => setIdx(Number(e.target.value))}
            />
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-[13px] text-white/60">{t("wallet.oop")}</div>
                <motion.div key={totals.outOfPocket} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={SPRING} className="num text-[28px] font-semibold leading-tight">
                  {formatINR(totals.outOfPocket)}
                </motion.div>
              </div>
              {saves > 0 && <span className="num rounded-full bg-[var(--green-icon)] px-2.5 py-1 text-[13px] font-semibold text-white">{t("wallet.saves", { amount: formatINR(saves) })}</span>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bucket({ label, sub, billed, paid, ratio = 1, color }: { label: string; sub: string; billed: number; paid: number; ratio?: number; color: string }) {
  return (
    <div className="bg-[var(--wallet-a)] px-5 py-3">
      <div className="text-[12px] font-medium uppercase tracking-wide text-white/55">{label}</div>
      <div className="num mt-0.5 text-[20px] font-semibold">{formatINR(paid)}</div>
      <div className="num text-[12px] text-white/50">/ {formatINR(billed)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
        <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} transition={SPRING} />
      </div>
      <div className="mt-1.5 text-[11px] leading-snug text-white/55">{sub}</div>
    </div>
  );
}
