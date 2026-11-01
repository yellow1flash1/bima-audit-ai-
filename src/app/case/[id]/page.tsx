"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BillRow } from "@/components/case/BillRow";
import { CaseDocuments, ShareWithFamily } from "@/components/case/CaseDocuments";
import { LineSheet } from "@/components/case/LineSheet";
import { ListenButton } from "@/components/case/ListenButton";
import { SlaPill } from "@/components/case/SlaPill";
import { WalletTrapCard } from "@/components/case/WalletTrapCard";
import { Button, Group, NavBar, Pill, Row, Sheet, Squircle } from "@/components/ios";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { capPerDay } from "@/lib/rules-engine/prorata";
import { evaluate } from "@/lib/rules-engine/evaluate";
import { buildRebuttal, formatINR } from "@/lib/rules-engine/rebuttal";
import type { Department, LineResult } from "@/lib/rules-engine/types";
import { useStore } from "@/lib/store";

/** Display sections in bill order; each department belongs to exactly one. */
const SECTIONS: { key: string; depts: Department[] }[] = [
  { key: "room", depts: ["room", "nursing"] },
  { key: "icu", depts: ["icu"] },
  { key: "ot", depts: ["ot", "surgeon", "procedure"] },
  { key: "consultation", depts: ["consultation"] },
  { key: "pharmacy", depts: ["pharmacy"] },
  { key: "implant", depts: ["implant", "device"] },
  { key: "diagnostics", depts: ["diagnostics"] },
  { key: "consumables", depts: ["consumables", "treatment"] },
  { key: "misc", depts: ["misc"] },
];

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useStore();
  const { t } = s;
  const c = s.getCase(id);
  const ev = useMemo(() => (c ? evaluate(c) : null), [c]);
  const [open, setOpen] = useState<string | null>(null);
  const [rebuttalOpen, setRebuttalOpen] = useState(false);
  const family = s.role === "family";
  const { refreshChain } = s;
  useEffect(() => {
    if (c?.id) refreshChain(c.id);
  }, [c?.id, refreshChain]);

  if (!c || !ev) {
    return (
      <main className="mx-auto max-w-3xl">
        <NavBar back={{ href: "/", label: t("nav.back") }} />
        <p className="px-4 pt-6 text-[15px] text-label-2">{t(s.loading ? "load.loading" : "load.empty")}</p>
      </main>
    );
  }

  const openLine = ev.lines.find((l) => l.item.id === open) ?? null;
  const points = buildRebuttal(ev);
  const amber = ev.lines.filter((l) => l.flag === "amber").length;
  const cap = capPerDay(c.policy.roomCap, c.policy.sumInsured);
  const { ok: chainOk, length: chainLen } = s.chain(c.id);
  const ref = c.ref ?? c.id;
  const disputableLines = ev.lines.filter((l) => l.disputable > 0);

  const speech = t("family.speech", {
    amount: formatINR(ev.totals.disputable),
    points: disputableLines.map((l) => `${l.item.description}: ${formatINR(l.disputable)}. ${t(`status.${l.status}`)}`).join(" "),
  });
  const wa = `https://wa.me/?text=${encodeURIComponent(t("family.whatsapp", { caseId: ref, amount: formatINR(ev.totals.disputable) }))}`;

  return (
    <main className="mx-auto max-w-3xl">
      <NavBar back={{ href: "/", label: t("nav.back") }} title={ref} right={<LocaleSwitch id="case" />} />
      <div className="pt-2">
        <SlaPill requestedAt={c.dischargeRequestedAt} />
      </div>

      {family && (
        <section className="mx-4 mt-4 rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className={`num text-[28px] font-bold leading-tight ${ev.totals.disputable > 0 ? "text-green-text" : ""}`}>
            {ev.totals.disputable > 0 ? t("family.hero", { amount: formatINR(ev.totals.disputable) }) : t("family.heroNone")}
          </div>
          <p className="mt-1.5 text-[15px] text-label-2">{t("family.heroSub")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ListenButton text={speech} />
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center rounded-full bg-surface-2 px-3 py-1.5 text-[15px] font-medium text-accent">
              {t("family.share")}
            </a>
          </div>
        </section>
      )}

      <WalletTrapCard c={c} ev={ev} />

      <Group header={t("case.summary")}>
        <Row title={t("case.billed")} value={formatINR(ev.totals.billed)} />
        <Row title={t("case.payable")} value={formatINR(ev.totals.payable)} />
        <Row title={t("case.tpaDeducted")} value={formatINR(ev.totals.tpaDeducted)} />
        <Row title={t("case.outOfPocket")} value={formatINR(ev.totals.outOfPocket)} />
        <Row
          last
          icon={<Squircle tone={ev.totals.disputable > 0 ? "green" : "grey"} glyph="shield" />}
          title={<span className="font-semibold">{t("case.disputable")}</span>}
          value={<span className="font-semibold text-green-text">{formatINR(ev.totals.disputable)}</span>}
        />
      </Group>

      {SECTIONS.map(({ key, depts }) => {
        const lines = ev.lines.filter((l) => depts.includes(l.item.department));
        if (!lines.length) return null;
        return (
          <Group key={key} header={t(`dept.${key}`)} footer={key === "consumables" && amber > 0 && !family ? t("case.swipeHint") : undefined}>
            {lines.map((l: LineResult, i) => (
              <BillRow key={l.item.id} l={l} last={i === lines.length - 1} readOnly={family} onOpen={() => setOpen(l.item.id)} onRemap={(to) => s.remap(c.id, l.item.id, to)} />
            ))}
          </Group>
        );
      })}

      <div className="mx-4 mt-6">
        <Button onClick={() => setRebuttalOpen(true)}>{t("case.rebuttal")}</Button>
      </div>

      <CaseDocuments caseId={c.id} />
      {!family && <ShareWithFamily caseId={c.id} caseRef={ref} />}

      <Group header={t("case.info")}>
        <Row title={t("case.hospital")} value={<span className="text-[15px]">{c.hospital.name}</span>} />
        <Row title={t("case.insurer")} value={c.policy.insurer} />
        {c.policy.tpa && <Row title={t("case.tpa")} value={c.policy.tpa} />}
        <Row title={t("case.policy")} value={c.policy.policyRefAlias} />
        <Row title={t("case.sumInsured")} value={formatINR(c.policy.sumInsured)} />
        <Row title={t("case.roomCap")} value={cap ? t("wallet.perDay", { amount: formatINR(cap) }) : "—"} />
        <Row title={t("case.addon")} value={t(c.policy.consumablesAddon ? "case.yes" : "case.no")} />
        <Row title={t("case.package")} value={t(c.isPackageBilling ? "case.yes" : "case.no")} />
        <Row
          last
          icon={<Squircle tone={chainOk === false ? "red" : "green"} glyph="shield" />}
          title={t(chainOk === false ? "case.chainBroken" : "case.chainVerified")}
          value={<span className="text-[15px]">{chainOk === false ? "✕" : "✓"} {t("case.chainEvents", { count: chainLen })}</span>}
        />
      </Group>

      <div className="mx-4 mt-6">
        <Button
          tone="destructive"
          onClick={() => {
            void s.deleteCase(c.id).then(() => router.push("/"));
          }}
        >
          {t("case.deleteNow")}
        </Button>
      </div>

      <LineSheet caseId={c.id} line={openLine} onClose={() => setOpen(null)} readOnly={family} />

      <Sheet open={rebuttalOpen} onClose={() => setRebuttalOpen(false)} title={t("rebuttal.sheetTitle")} closeLabel={t("nav.cancel")}>
        <Group footer={points.length ? `${points.length} · ${formatINR(ev.totals.disputable)}` : t("rebuttal.none")}>
          {(["en", "hi", "dual"] as const).map((m, i) => (
            <Row
              key={m}
              chevron
              last={i === 2}
              href={`/case/${c.id}/rebuttal?mode=${m}`}
              icon={<Squircle tone="blue" glyph="doc" />}
              title={t(`rebuttal.mode${m === "en" ? "En" : m === "hi" ? "Hi" : "Dual"}`)}
              subtitle={t(`rebuttal.mode${m === "en" ? "En" : m === "hi" ? "Hi" : "Dual"}Sub`)}
            />
          ))}
        </Group>
        {amber > 0 && (
          <p className="mx-8 mt-3 text-[13px] text-amber-text">
            <Pill tone="amber">{amber}</Pill> {t("case.swipeHint")}
          </p>
        )}
        <div className="h-4" />
      </Sheet>
    </main>
  );
}
