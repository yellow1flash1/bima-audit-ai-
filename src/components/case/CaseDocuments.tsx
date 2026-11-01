"use client";

import { useCallback, useEffect, useState } from "react";
import { Group, Row, Squircle } from "@/components/ios";
import type { CaseDocument } from "@/lib/data/backend";
import { useStore } from "@/lib/store";
import { UploadFlow } from "./UploadFlow";

/** Private documents for a case. Each tap fetches a fresh 60-second signed URL. */
export function CaseDocuments({ caseId }: { caseId: string }) {
  const s = useStore();
  const { t } = s;
  const [docs, setDocs] = useState<CaseDocument[]>([]);

  const load = useCallback(() => {
    void s.documents(caseId).then(setDocs).catch(() => setDocs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, s.backend]);
  useEffect(load, [load]);

  const open = async (id: string) => {
    const win = window.open("", "_blank", "noopener");
    const res = await fetch(`/api/documents/${id}`);
    const body = (await res.json()) as { url?: string };
    if (body.url && win) win.location.href = body.url;
    else win?.close();
  };

  return (
    <Group header={t("docs.title")}>
      {docs.map((d) => (
        <Row
          key={d.id}
          chevron
          icon={<Squircle tone="grey" glyph="doc" />}
          title={t(`docs.${d.kind}`)}
          subtitle={`${new Date(d.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · ${Math.max(1, Math.round(d.bytes / 1024))} KB`}
          onClick={() => void open(d.id)}
        />
      ))}
      <UploadFlow last caseId={caseId} onStored={load} />
    </Group>
  );
}

/** Desk-only: single-use, 24-hour claim link that binds the case to a family account. */
export function ShareWithFamily({ caseId, caseRef }: { caseId: string; caseRef: string }) {
  const { t, issueClaimLink, backend } = useStore();
  const [note, setNote] = useState<string | null>(null);
  if (backend !== "supabase") return null;

  const share = async () => {
    try {
      const url = await issueClaimLink(caseId);
      const text = t("claim.shareText", { caseId: caseRef, url });
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(url);
        setNote(t("claim.copied"));
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setNote(e.message);
    }
  };

  return (
    <Group>
      <Row last icon={<Squircle tone="green" glyph="person" />} title={<span className="text-accent">{t("claim.share")}</span>} subtitle={note ?? t("claim.shareSub")} onClick={() => void share()} />
    </Group>
  );
}
