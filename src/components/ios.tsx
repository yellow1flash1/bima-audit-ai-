"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import type { Department, Flag } from "@/lib/rules-engine/types";

export const SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/* ───────── navigation ───────── */

export function NavBar({ title, back, right }: { title?: string; back?: { href: string; label: string }; right?: ReactNode }) {
  return (
    <header className="glass hairline-b sticky top-0 z-30 no-print">
      <div className="mx-auto flex h-11 max-w-3xl items-center justify-between gap-2 px-4">
        <div className="min-w-0 flex-1">
          {back && (
            <Link href={back.href} className="-ml-2 flex items-center text-[17px] text-accent">
              <Chevron className="h-[22px] w-[22px] rotate-180" />
              <span className="truncate">{back.label}</span>
            </Link>
          )}
        </div>
        {title && <h1 className="num truncate text-[17px] font-semibold">{title}</h1>}
        <div className="flex min-w-0 flex-1 justify-end">{right}</div>
      </div>
    </header>
  );
}

export function LargeTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-4 pb-2 pt-3 text-[34px] font-bold leading-tight tracking-tight">{children}</h1>;
}

/* ───────── grouped inset list ───────── */

export function Group({ header, footer, children, className = "" }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mx-4 mt-6 ${className}`}>
      {header && <h2 className="px-4 pb-1.5 text-[13px] uppercase text-label-2">{header}</h2>}
      <div className="overflow-hidden rounded-xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] text-label-2">{footer}</p>}
    </section>
  );
}

export function Row({
  icon,
  title,
  subtitle,
  value,
  chevron,
  onClick,
  href,
  accessory,
  last,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  accessory?: ReactNode;
  last?: boolean;
}) {
  const body = (
    <div className="relative flex min-h-11 items-center gap-3 px-4 py-2.5 text-left">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="text-[17px] leading-snug">{title}</div>
        {subtitle && <div className="mt-0.5 text-[13px] leading-snug text-label-2">{subtitle}</div>}
      </div>
      {value !== undefined && <div className="num shrink-0 text-right text-[17px] text-label-2">{value}</div>}
      {accessory}
      {chevron && <Chevron className="h-4 w-4 shrink-0 text-[#c4c4c6]" />}
      {!last && <span className="pointer-events-none absolute bottom-0 left-4 right-0 h-px scale-y-50 bg-hairline" />}
    </div>
  );
  if (href) return <Link href={href} className="block active:bg-surface-2">{body}</Link>;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="block w-full active:bg-surface-2">
        {body}
      </button>
    );
  return body;
}

export function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/* ───────── squircle icons ───────── */

const FLAG_BG: Record<Flag | "grey" | "blue", string> = {
  green: "bg-green-icon",
  amber: "bg-amber-icon",
  red: "bg-red-icon",
  grey: "bg-grey-icon",
  blue: "bg-accent",
};

const GLYPH: Record<string, ReactNode> = {
  room: <path d="M3 18v-6a2 2 0 012-2h14a2 2 0 012 2v6M3 14h18M7 10V7h4v3" />,
  icu: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  pharmacy: <path d="M10.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7zM7 7l10 10" />,
  implant: <path d="M12 3v18M8 7h8M8 11h8M8 15h8" />,
  diagnostics: <path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3" />,
  ot: <path d="M6 6l12 12M6 18L18 6M4 4h4v4H4zM16 16h4v4h-4z" />,
  consultation: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />,
  procedure: <path d="M12 5v14M5 12h14" />,
  consumables: <path d="M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8" />,
  treatment: <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10z" />,
  misc: <path d="M5 12h.01M12 12h.01M19 12h.01" />,
  case: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  globe: <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />,
  person: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" />,
  text: <path d="M5 6h14M5 12h10M5 18h7" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4" />,
  camera: <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z" />,
  doc: <path d="M7 3h7l5 5v13H7zM14 3v5h5" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />,
};

const DEPT_GLYPH: Record<Department, string> = {
  room: "room",
  nursing: "room",
  icu: "icu",
  pharmacy: "pharmacy",
  implant: "implant",
  device: "implant",
  diagnostics: "diagnostics",
  ot: "ot",
  surgeon: "ot",
  consultation: "consultation",
  procedure: "procedure",
  consumables: "consumables",
  treatment: "treatment",
  misc: "misc",
};

export function Squircle({ tone, glyph, dept }: { tone: Flag | "grey" | "blue"; glyph?: string; dept?: Department }) {
  const g = GLYPH[glyph ?? (dept ? DEPT_GLYPH[dept] : "misc")];
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-white ${FLAG_BG[tone]}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {g}
      </svg>
    </span>
  );
}

/* ───────── pills ───────── */

const PILL: Record<Flag | "grey", string> = {
  green: "bg-green-pill text-green-text",
  amber: "bg-amber-pill text-amber-text",
  red: "bg-red-pill text-red-text",
  grey: "bg-surface-2 text-label-3",
};

export function Pill({ tone, children }: { tone: Flag | "grey"; children: ReactNode }) {
  return <span className={`num inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ${PILL[tone]}`}>{children}</span>;
}

/* ───────── controls ───────── */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`relative inline-flex rounded-[9px] bg-[rgba(118,118,128,0.12)] p-0.5 ${size === "sm" ? "text-[13px]" : "text-[15px]"}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative z-10 whitespace-nowrap rounded-[7px] font-medium ${size === "sm" ? "px-2.5 py-0.5" : "px-3.5 py-1"}`}
          >
            {active && (
              <motion.span layoutId={`seg-${label}`} transition={SPRING} className="absolute inset-0 -z-10 rounded-[7px] bg-surface shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366]" />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? "bg-green-icon" : "bg-[rgba(120,120,128,0.32)]"}`}
    >
      <motion.span transition={SPRING} animate={{ x: checked ? 20 : 0 }} className="absolute left-0.5 top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15)]" />
    </button>
  );
}

export function Button({ children, onClick, tone = "accent", disabled }: { children: ReactNode; onClick?: () => void; tone?: "accent" | "destructive" | "plain"; disabled?: boolean }) {
  const cls =
    tone === "accent"
      ? "bg-accent text-white"
      : tone === "destructive"
        ? "bg-surface text-red-icon"
        : "bg-surface text-accent";
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`h-[50px] w-full rounded-xl text-[17px] font-semibold disabled:opacity-40 active:opacity-70 ${cls}`}>
      {children}
    </button>
  );
}

/* ───────── bottom sheet ───────── */

export function Sheet({ open, onClose, title, children, closeLabel }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; closeLabel: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true">
          <motion.div className="absolute inset-0 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-3xl overflow-y-auto rounded-t-[14px] bg-canvas pb-[max(env(safe-area-inset-bottom),24px)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
          >
            <div className="glass sticky top-0 z-10 rounded-t-[14px]">
              <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-[rgba(60,60,67,0.3)]" />
              <div className="flex items-center justify-between px-4 pb-2 pt-2">
                <span className="w-16" />
                <h2 className="text-[17px] font-semibold">{title}</h2>
                <button type="button" onClick={onClose} className="w-16 text-right text-[17px] font-semibold text-accent">
                  {closeLabel}
                </button>
              </div>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
