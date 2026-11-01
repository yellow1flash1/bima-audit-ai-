"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { NavBar } from "@/components/ios";
import { translate } from "@/lib/i18n/dictionary";
import { evaluate } from "@/lib/rules-engine/evaluate";
import { buildRebuttal, formatINR } from "@/lib/rules-engine/rebuttal";
import { useStore } from "@/lib/store";

type Mode = "en" | "hi" | "dual";

export default function RebuttalPage() {
  return (
    <Suspense>
      <Rebuttal />
    </Suspense>
  );
}

/** Printable rule-cited rebuttal. "Save as PDF" from the print dialog produces the file. */
function Rebuttal() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const mode = (["en", "hi", "dual"].includes(params.get("mode") ?? "") ? params.get("mode") : "en") as Mode;
  const s = useStore();
  const c = s.getCase(id);
  const ev = useMemo(() => (c ? evaluate(c) : null), [c]);
  if (!c || !ev) return <NavBar back={{ href: "/", label: s.t("nav.back") }} />;

  const points = buildRebuttal(ev);
  const en = (k: string, v?: Record<string, string | number>) => translate("en-IN", k, v);
  const hi = (k: string, v?: Record<string, string | number>) => translate("hi-IN", k, v);
  const vars = { tpa: c.policy.tpa ?? c.policy.insurer, insurer: c.policy.insurer, caseId: c.ref ?? c.id, policy: c.policy.policyRefAlias, patient: c.patientAlias };
  const date = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const reversed = ev.totals.disputable;

  const single = (tr: typeof en, lang: "en" | "hi") => (
    <div lang={lang}>
      <h1 className="text-[20px] font-bold">{tr("rebuttal.title")}</h1>
      <p className="mt-3 text-[14px]">{tr("rebuttal.to", vars)}</p>
      <p className="num text-[14px]">{tr("rebuttal.re", vars)}</p>
      <p className="mt-3 text-[14px]">{tr("rebuttal.intro")}</p>
      {points.length === 0 ? (
        <p className="mt-4 text-[14px]">{tr("rebuttal.none")}</p>
      ) : (
        <table className="mt-4 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">{tr("rebuttal.point")}</th>
              <th className="py-1.5 pr-2 text-right">{tr("rebuttal.amount")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.lineId} className="border-b border-black/10 align-top">
                <td className="num py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">
                  <div className="font-semibold">{p.item}</div>
                  <div>{lang === "en" ? p.en : p.hi}</div>
                  <div className="num mt-0.5 text-[11px] text-black/55">
                    {tr("rebuttal.basis")}: {p.citation} · {p.code}
                  </div>
                </td>
                <td className="num whitespace-nowrap py-2 text-right">{formatINR(p.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="py-2 pr-2 font-semibold">{tr("rebuttal.total")}</td>
              <td className="num whitespace-nowrap py-2 text-right font-semibold">{formatINR(reversed)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  const dual = (
    <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 print:grid-cols-2">
      <div lang="en">
        <h1 className="text-[18px] font-bold">{en("rebuttal.title")}</h1>
        <p className="mt-2 text-[13px]">{en("rebuttal.to", vars)}</p>
        <p className="num text-[13px]">{en("rebuttal.re", vars)}</p>
        <p className="mt-2 text-[13px]">{en("rebuttal.intro")}</p>
      </div>
      <div lang="hi" className="leading-[1.65]">
        <h1 className="text-[18px] font-bold">{hi("rebuttal.title")}</h1>
        <p className="mt-2 text-[13px]">{hi("rebuttal.intro")}</p>
      </div>
      {points.map((p, i) => (
        <div key={p.lineId} className="contents">
          <div lang="en" className="border-t border-black/15 pt-2 text-[13px]">
            <div className="flex justify-between font-semibold">
              <span>
                {i + 1}. {p.item}
              </span>
              <span className="num">{formatINR(p.amount)}</span>
            </div>
            <div>{p.en}</div>
            <div className="num mt-0.5 text-[11px] text-black/55">
              {p.citation} · {p.code}
            </div>
          </div>
          <div lang="hi" className="border-t border-black/15 pt-2 text-[13px] leading-[1.65]">
            <div className="flex justify-between font-semibold">
              <span>
                {i + 1}. {p.item}
              </span>
              <span className="num">{formatINR(p.amount)}</span>
            </div>
            <div>{p.hi}</div>
          </div>
        </div>
      ))}
      <div className="num border-t border-black/30 pt-2 text-[14px] font-semibold">
        {en("rebuttal.total")}: {formatINR(reversed)}
      </div>
      <div lang="hi" className="num border-t border-black/30 pt-2 text-[14px] font-semibold">
        {hi("rebuttal.total")}: {formatINR(reversed)}
      </div>
    </div>
  );

  const tr = mode === "hi" ? hi : en;

  return (
    <main className="mx-auto max-w-3xl">
      <NavBar
        back={{ href: `/case/${c.id}`, label: c.ref ?? c.id }}
        right={
          <button type="button" onClick={() => window.print()} className="text-[17px] text-accent">
            {s.t("rebuttal.print")}
          </button>
        }
      />
      <article className="mx-4 my-4 rounded-xl bg-white p-6 text-black shadow-[0_1px_2px_rgba(0,0,0,0.04)] print:m-0 print:rounded-none print:p-0 print:shadow-none">
        {mode === "dual" ? dual : single(tr, mode === "hi" ? "hi" : "en")}

        <div className="mt-10 grid grid-cols-2 gap-8 text-[12px]">
          <div className="border-t border-black/40 pt-1.5">{mode === "hi" ? hi("rebuttal.signDesk") : en("rebuttal.signDesk")}</div>
          <div className="border-t border-black/40 pt-1.5">{mode === "en" ? en("rebuttal.signPatient") : hi("rebuttal.signPatient")}</div>
        </div>
        <p className="mt-6 text-[11px] text-black/50">{tr("rebuttal.generated", { date })}</p>
      </article>
    </main>
  );
}
