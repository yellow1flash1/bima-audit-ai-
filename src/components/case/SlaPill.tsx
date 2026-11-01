"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

const WINDOW_MS = 3 * 3600_000;
const AMBER_AT_MS = 2 * 3600_000;

export function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export type SlaState = "idle" | "calm" | "warn" | "breach";

export function slaState(requestedAt: string | undefined, now: number): { state: SlaState; elapsed: number } {
  if (!requestedAt) return { state: "idle", elapsed: 0 };
  const elapsed = now - new Date(requestedAt).getTime();
  return { state: elapsed >= WINDOW_MS ? "breach" : elapsed >= AMBER_AT_MS ? "warn" : "calm", elapsed };
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** iOS Live-Activity style capsule for the IRDAI 3-hour final-authorisation window. */
export function SlaPill({ requestedAt, compact }: { requestedAt?: string; compact?: boolean }) {
  const { t } = useStore();
  const now = useNow();
  const { state, elapsed } = slaState(requestedAt, now);

  const tone =
    state === "breach"
      ? "bg-red-icon text-white sla-pulse"
      : state === "warn"
        ? "bg-amber-icon text-white"
        : "bg-[#1c1c1e] text-white dark:bg-surface-2";

  const text =
    state === "idle"
      ? t("sla.notStarted")
      : state === "breach"
        ? `${t("sla.delay_alert")} · ${t("sla.over", { time: hms(elapsed - WINDOW_MS) })}`
        : t("sla.remaining", { time: hms(WINDOW_MS - elapsed) });

  if (compact) {
    if (state === "idle") return <span className="text-[13px] text-label-3">{t("queue.noClock")}</span>;
    return (
      <span className={`num inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold transition-colors duration-700 ${tone}`}>
        {state === "breach" ? `+${hms(elapsed - WINDOW_MS)}` : hms(WINDOW_MS - elapsed)}
      </span>
    );
  }

  return (
    <div className="pointer-events-none sticky top-[52px] z-20 flex justify-center px-4 no-print">
      <div role="timer" aria-live="off" className={`num pointer-events-auto flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-[15px] font-semibold shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition-colors duration-700 ${tone}`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2M9 2h6" />
          </svg>
        </span>
        <span className="text-[12px] font-medium uppercase opacity-75">{t("sla.label")}</span>
        <span>{text}</span>
      </div>
    </div>
  );
}
