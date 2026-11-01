import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CASE_SELECT, toCase, type CaseRow } from "../data/map";
import { evaluate } from "../rules-engine/evaluate";
import type { Evaluation } from "../rules-engine/types";
import { serviceClient } from "../supabase/server";

export type StaffCheck = { ok: true; userId: string } | { ok: false; status: 401 | 403 };

/** Signed-in desk or manager, judged from the verified JWT claims. */
export async function requireStaff(db: SupabaseClient): Promise<StaffCheck> {
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { ok: false, status: 401 };
  const role = claims.app_role as string | undefined;
  if (role !== "desk" && role !== "manager") return { ok: false, status: 403 };
  return { ok: true, userId: claims.sub };
}

/**
 * Runs the deterministic engine for one case and stores flag / payable_amount /
 * matched_rule_id on each line. The case is read with the caller's RLS-scoped client;
 * only then does the service role write the engine-owned columns.
 */
export async function evaluateAndStore(db: SupabaseClient, caseId: string): Promise<{ ok: true; ev: Evaluation } | { ok: false; status: number; error: string }> {
  const { data: row, error } = await db.from("cases").select(CASE_SELECT).eq("id", caseId).maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!row) return { ok: false, status: 404, error: "not_found" };

  const c = toCase(row as unknown as CaseRow);
  const ev = evaluate(c);

  const admin = serviceClient();
  const codes = [...new Set(ev.lines.flatMap((l) => (l.rule ? [l.rule.code] : [])))];
  const { data: rules } = codes.length
    ? await admin.from("irdai_rules").select("id, code").in("code", codes).is("effective_to", null)
    : { data: [] as { id: string; code: string }[] };
  const ruleId = new Map((rules ?? []).map((r) => [r.code, r.id]));

  const now = new Date().toISOString();
  const results = await Promise.all(
    ev.lines.map((l) =>
      admin
        .from("bill_items")
        .update({ flag: l.flag, payable_amount: l.payable, matched_rule_id: l.rule ? (ruleId.get(l.rule.code) ?? null) : null, evaluated_at: now })
        .eq("id", l.item.id)
        .eq("case_id", c.id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, status: 500, error: failed.error.message };
  return { ok: true, ev };
}
