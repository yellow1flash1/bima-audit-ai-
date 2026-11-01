import type { Locale } from "../i18n/dictionary";
import type { IrdaiList, RemapTarget } from "../rules-engine/types";
import type { ChainEvent } from "../security/audit-chain";
import { browserClient, claimsOf } from "../supabase/client";
import type { Backend, CaseDocument, Session } from "./backend";
import { CASE_SELECT, toCase, type CaseRow } from "./map";

/**
 * Supabase-backed persistence. Every read and write runs as the signed-in user, so RLS
 * decides what is visible; flags and payable amounts are written only by the
 * /api/cases/[id]/evaluate route.
 */
export function supabaseBackend(): Backend {
  const db = browserClient();
  const hospitalOf = new Map<string, string>();

  const must = <T>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  const uid = async () => {
    const { data } = await db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error("not signed in");
    return id;
  };

  /** Human decision + chained audit event + server re-evaluation. */
  const decide = async (caseId: string, lineId: string, patch: Record<string, unknown>, type: string) => {
    must(await db.from("bill_items").update(patch).eq("id", lineId).eq("case_id", caseId).select("id").single());
    must(
      await db.from("events").insert({
        hospital_id: hospitalOf.get(caseId),
        case_id: caseId,
        actor: await uid(),
        type,
        payload: { line: lineId, ...patch },
      }),
    );
    const res = await fetch(`/api/cases/${caseId}/evaluate`, { method: "POST" });
    if (!res.ok) throw new Error(`evaluate failed: ${res.status}`);
  };

  return {
    kind: "supabase",

    session: async (): Promise<Session | null> => {
      const { data } = await db.auth.getSession();
      const s = data.session;
      if (!s) return null;
      const c = claimsOf(s.access_token);
      const { data: u } = await db.from("users").select("preferred_locale, plain_language").eq("id", s.user.id).maybeSingle();
      return {
        userId: s.user.id,
        email: s.user.email,
        role: c?.app_role ?? "family",
        hospitalId: c?.hospital_id,
        locale: (u?.preferred_locale as Locale | undefined) ?? undefined,
        plain: u?.plain_language ?? undefined,
      };
    },

    loadCases: async () => {
      const rows = must(
        await db.from("cases").select(CASE_SELECT).neq("status", "closed").order("discharge_requested_at", { ascending: true, nullsFirst: false }),
      ) as unknown as CaseRow[];
      return rows.map((r) => {
        const c = toCase(r);
        hospitalOf.set(c.id, c.hospitalId);
        return c;
      });
    },

    remap: (c, l, to: RemapTarget | undefined) => decide(c, l, { remapped_to: to ?? null }, to ? "item.remapped" : "item.remap_undone"),
    confirmList: (c, l, list: IrdaiList | undefined) => decide(c, l, { confirmed_list: list ?? null }, "item.list_confirmed"),
    dismissSuggestion: (c, l) => decide(c, l, { suggested_list: null }, "item.suggestion_dismissed"),

    uploadDocument: async (caseId, file, mime) => {
      const hospital = hospitalOf.get(caseId);
      if (!hospital) throw new Error("case not loaded");
      const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
      // our own name, never the user's file name; storage RLS checks the folder
      const path = `${hospital}/${caseId}/${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("bills").upload(path, file, { contentType: mime, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const row = await db
        .from("documents")
        .insert({ hospital_id: hospital, case_id: caseId, kind: "bill", storage_path: path, mime, bytes: file.size })
        .select("id")
        .single();
      if (row.error) {
        await db.storage.from("bills").remove([path]);
        throw new Error(row.error.message);
      }
      return (row.data as { id: string }).id;
    },

    addLines: async (id, lines) => {
      const res = await fetch(`/api/cases/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      if (!res.ok) throw new Error(`add lines failed: ${res.status}`);
    },

    deleteCase: async (id) => {
      must(await db.rpc("delete_case_now", { p_case: id }));
    },

    events: async (id) => must(await db.rpc("case_events", { p_case: id })) as ChainEvent[],

    documents: async (id): Promise<CaseDocument[]> => {
      const rows = must(await db.from("documents").select("id, kind, mime, bytes, created_at").eq("case_id", id).order("created_at"));
      return (rows as { id: string; kind: CaseDocument["kind"]; mime: string; bytes: number; created_at: string }[]).map((d) => ({
        id: d.id,
        kind: d.kind,
        mime: d.mime,
        bytes: d.bytes,
        createdAt: d.created_at,
      }));
    },

    savePrefs: async (p) => {
      const patch: Record<string, unknown> = {};
      if (p.locale) patch.preferred_locale = p.locale;
      if (p.plain !== undefined) patch.plain_language = p.plain;
      if (Object.keys(patch).length) must(await db.from("users").update(patch).eq("id", await uid()));
    },

    issueClaimLink: async (caseId) => {
      const token = must(await db.rpc("issue_claim_token", { p_case: caseId })) as string;
      return `${location.origin}/claim?t=${encodeURIComponent(token)}`;
    },

    signOut: async () => {
      await db.auth.signOut();
    },
  };
}
