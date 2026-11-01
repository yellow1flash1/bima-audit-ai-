"use client";

import { Group, LargeTitle, NavBar, Pill, Row, Segmented, Squircle, Toggle } from "@/components/ios";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { SlaPill, slaState, useNow } from "@/components/case/SlaPill";
import { evaluate } from "@/lib/rules-engine/evaluate";
import { formatINR } from "@/lib/rules-engine/rebuttal";
import { useStore, type Role } from "@/lib/store";

export default function QueuePage() {
  const s = useStore();
  const { t } = s;
  const now = useNow(30_000);
  const demo = s.backend === "demo";

  const rows = s.cases
    .map((c) => ({ c, ev: evaluate(c), sla: slaState(c.dischargeRequestedAt, now) }))
    .sort((a, b) => b.sla.elapsed - a.sla.elapsed);

  return (
    <main className="mx-auto max-w-3xl">
      <NavBar right={<LocaleSwitch id="nav" />} />
      <LargeTitle>{t("nav.queue")}</LargeTitle>

      {s.error && <p className="mx-8 mt-4 text-[13px] text-red-text">{t("load.error", { message: s.error })}</p>}

      <Group header={t("queue.active")}>
        {rows.length === 0 && <Row last title={<span className="text-label-2">{t(s.loading ? "load.loading" : "load.empty")}</span>} />}
        {rows.map(({ c, ev, sla }, i) => (
          <Row
            key={c.id}
            href={`/case/${c.id}`}
            chevron
            last={i === rows.length - 1}
            icon={<Squircle tone={sla.state === "breach" ? "red" : sla.state === "warn" ? "amber" : "grey"} glyph="case" />}
            title={<span className="num font-medium">{c.ref ?? c.id}</span>}
            subtitle={
              <span className="block">
                <span className="num block truncate">
                  {c.patientAlias} · {c.policy.insurer}
                  {c.policy.tpa ? ` · ${c.policy.tpa}` : ""}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <SlaPill compact requestedAt={c.dischargeRequestedAt} />
                  {ev.totals.disputable > 0 && <Pill tone="green">{t("queue.atRisk", { amount: formatINR(ev.totals.disputable) })}</Pill>}
                </span>
              </span>
            }
          />
        ))}
      </Group>


      <Group
        header={t("settings.title")}
        footer={demo ? t("settings.demo") : t("load.connected", { role: s.session?.role ?? "" })}
      >
        <Row icon={<Squircle tone="blue" glyph="globe" />} title={t("settings.language")} accessory={<LocaleSwitch id="settings" />} />
        {demo && (
        <Row
          icon={<Squircle tone="grey" glyph="person" />}
          title={t("settings.view")}
          accessory={
            <Segmented<Role>
              label="role"
              size="sm"
              value={s.role}
              onChange={(role) => s.setPrefs({ role })}
              options={[
                { value: "desk", label: t("settings.roleDesk") },
                { value: "family", label: t("settings.roleFamily") },
              ]}
            />
          }
        />
        )}
        <Row
          last
          icon={<Squircle tone="green" glyph="text" />}
          title={t("settings.plain")}
          subtitle={t("settings.plainHint")}
          accessory={<Toggle label={t("settings.plain")} checked={s.plain || s.role === "family"} onChange={(plain) => s.setPrefs({ plain })} />}
        />
      </Group>

      {s.session && (
        <Group header={t("auth.account")}>
          <Row icon={<Squircle tone="grey" glyph="person" />} title={<span className="text-[15px]">{t("auth.signedIn", { email: s.session.email ?? "" })}</span>} />
          <Row last title={<span className="text-red-icon">{t("auth.signOut")}</span>} onClick={() => void s.signOut()} />
        </Group>
      )}
    </main>
  );
}
