// Integration tests against a local Supabase (`npx supabase start`, freshly reset).
// Run: npm run test:it — skipped unless NEXT_PUBLIC_SUPABASE_URL is set.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_PASSWORD } from "../../scripts/demo-accounts";
import { verifyChain, type ChainEvent } from "../../src/lib/security/audit-chain";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const run = URL && ANON ? describe : describe.skip;

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  return c;
}

const claims = async (c: SupabaseClient) => {
  const { data } = await c.auth.getSession();
  return JSON.parse(Buffer.from(data.session!.access_token.split(".")[1], "base64url").toString());
};

run("RLS & audit chain (local Supabase)", () => {
  let desk: SupabaseClient;
  let family: SupabaseClient;
  let anon: SupabaseClient;

  beforeAll(async () => {
    desk = await signIn("desk@bima.test");
    family = await signIn("family@bima.test");
    anon = createClient(URL, ANON, { auth: { persistSession: false } });
  });

  it("puts hospital_id and app_role in the JWT", async () => {
    expect(await claims(desk)).toMatchObject({ app_role: "desk", hospital_id: expect.any(String) });
    const f = await claims(family);
    expect(f.app_role).toBe("family");
    expect(f.hospital_id).toBeUndefined();
  });

  it("scopes cases per tenant and per family user", async () => {
    expect((await desk.from("cases").select("id")).data).toHaveLength(3);
    const fam = (await family.from("cases").select("case_ref")).data ?? [];
    expect(fam.map((r) => r.case_ref)).toEqual(["BA-24117"]);
    expect((await anon.from("cases").select("id")).data ?? []).toHaveLength(0);
  });

  it("lets family read its case's policy and lines, but not write them", async () => {
    const { data } = await family.from("cases").select("policies(insurer), bill_items(id)").single();
    expect(data?.policies).toMatchObject({ insurer: "Alpha Health Insurance" });
    const line = (data?.bill_items as { id: string }[])[0];
    const upd = await family.from("bill_items").update({ remapped_to: "room" }).eq("id", line.id).select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("allows desk decisions but never flag or payable_amount writes", async () => {
    const { data: line } = await desk.from("bill_items").select("id").eq("description", "Shoe Covers (12)").single();
    const ok = await desk.from("bill_items").update({ remapped_to: "room" }).eq("id", line!.id).select("remapped_to");
    expect(ok.error).toBeNull();
    const bad = await desk.from("bill_items").update({ flag: "green", payable_amount: 999 }).eq("id", line!.id);
    expect(bad.error?.code).toBe("42501");
    await desk.from("bill_items").update({ remapped_to: null }).eq("id", line!.id);
  });

  it("hash-chains events, verifies client-side, and refuses edits", async () => {
    const { data: c } = await desk.from("cases").select("id, hospital_id").eq("case_ref", "BA-24117").single();
    const actor = (await claims(desk)).sub;
    for (const type of ["item.remapped", "item.list_confirmed"]) {
      const r = await desk.from("events").insert({ hospital_id: c!.hospital_id, case_id: c!.id, actor, type, payload: { n: type, nested: { a: 1 } } });
      expect(r.error).toBeNull();
    }
    const { data: ev } = await desk.rpc("case_events", { p_case: c!.id });
    expect((ev as ChainEvent[]).length).toBeGreaterThanOrEqual(2);
    expect(await verifyChain(ev as ChainEvent[])).toMatchObject({ ok: true });

    const tamper = await desk.from("events").update({ type: "x" }).eq("case_id", c!.id).select("id");
    expect(tamper.error?.code).toBe("42501");
    const del = await desk.from("events").delete().eq("case_id", c!.id).select("id");
    expect(del.error?.code).toBe("42501");

    const forged = await desk.from("events").insert({ hospital_id: c!.hospital_id, case_id: c!.id, actor: "00000000-0000-4000-8000-000000000000", type: "x", payload: {} });
    expect(forged.error).not.toBeNull();
  });

  it("issues a single-use family claim token", async () => {
    const { data: c } = await desk.from("cases").select("id").eq("case_ref", "BA-24121").single();
    const { data: token, error } = await desk.rpc("issue_claim_token", { p_case: c!.id });
    expect(error).toBeNull();
    expect((await family.from("case_claim_tokens").select("token_hmac")).data ?? []).toHaveLength(0);
    expect((await family.rpc("claim_case", { p_token: "wrong" })).error).not.toBeNull();
    expect((await family.rpc("claim_case", { p_token: token })).data).toBe(c!.id);
    expect((await family.rpc("claim_case", { p_token: token })).error).not.toBeNull();
    expect((await family.from("cases").select("id")).data).toHaveLength(2);
    expect((await family.rpc("issue_claim_token", { p_case: c!.id })).error).not.toBeNull();
  });

  it("keeps the HMAC key unreadable", async () => {
    expect((await desk.from("app_secrets").select("*")).data ?? []).toHaveLength(0);
    expect((await desk.rpc("claim_hmac", { token: "x" })).error).not.toBeNull();
  });

  it("stores uploads only under the caller's hospital/case path", async () => {
    const { data: c } = await desk.from("cases").select("id, hospital_id").eq("case_ref", "BA-24117").single();
    const pdf = new TextEncoder().encode("%PDF-1.4 test");
    const ok = await desk.storage.from("bills").upload(`${c!.hospital_id}/${c!.id}/it-${Date.now()}.pdf`, pdf, { contentType: "application/pdf" });
    expect(ok.error).toBeNull();
    const other = await desk.storage.from("bills").upload(`99999999-9999-4999-8999-999999999999/${c!.id}/x.pdf`, pdf, { contentType: "application/pdf" });
    expect(other.error).not.toBeNull();
    const svg = await desk.storage.from("bills").upload(`${c!.hospital_id}/${c!.id}/x.svg`, new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" });
    expect(svg.error).not.toBeNull();
    const signed = await desk.storage.from("bills").createSignedUrl(ok.data!.path, 60);
    expect(signed.data?.signedUrl).toContain("token=");
    expect((await anon.storage.from("bills").createSignedUrl(ok.data!.path, 60)).error).not.toBeNull();
  });
});
