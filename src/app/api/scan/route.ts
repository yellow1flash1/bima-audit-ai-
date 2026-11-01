import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { prepareBill, readBill, type ReadResult } from "@/lib/ai/bill-reader";
import { anthropicCredentialsPresent } from "@/lib/ai/credentials";
import { fakeOcrEnabled, fakeReadBill } from "@/lib/ai/fake-reader";
import { requireStaff } from "@/lib/server/evaluate-case";
import { MAX_UPLOAD_BYTES, sniff, type AllowedMime } from "@/lib/security/magic-bytes";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { supabaseEnabled } from "@/lib/supabase/env";
import { serviceClient, userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// the cap for anonymous deployments; raise (Hobby allows 300 with Fluid compute) once the project is claimed
export const maxDuration = 60;

// single-node limiter; swap the store for Postgres/Redis when running on more than one instance
const limiter = createRateLimiter({ capacity: 10, windowMs: 15 * 60 * 1000 });

const fail = (status: number, error: string, extra: object = {}) => NextResponse.json({ error, ...extra }, { status });

/**
 * Validate → (desk only) read the bill. With Supabase the file is already in the private
 * bucket and is re-checked here; in demo mode it arrives as multipart and is never stored.
 * The response carries suggested lines for human review; nothing is added to the
 * case until the desk confirms them through /api/cases/[id]/lines.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const db = supabaseEnabled ? await userClient() : null;
  let userId = ip;
  let mayRead = true;
  if (db) {
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return fail(401, "unauthenticated");
    userId = user.id;
    // families can upload to their case; reading and adding lines is the desk's job
    mayRead = (await requireStaff(db)).ok;
  }

  const rl = limiter.check(userId, ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited", retryAfterMs: rl.retryAfterMs }, { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } });
  }

  let bytes: Uint8Array;
  let mime: AllowedMime;
  let documentId: string | undefined;

  if (db) {
    // Supabase mode: the browser already put the file in the private bucket (Vercel caps
    // request bodies at 4.5 MB), so only a document id arrives here.
    const body = (await req.json().catch(() => null)) as { document_id?: unknown } | null;
    const id = typeof body?.document_id === "string" ? body.document_id : "";
    // RLS: only staff of the case's hospital or its bound family user can see the row
    const { data: doc } = await db.from("documents").select("id, hospital_id, case_id, storage_path").eq("id", id).maybeSingle();
    if (!doc) return fail(404, "document_not_found");
    // the row is client-written; the object must sit in that case's own folder
    if (!doc.storage_path.startsWith(`${doc.hospital_id}/${doc.case_id}/`)) return fail(403, "bad_path");

    const dl = await db.storage.from("bills").download(doc.storage_path);
    if (dl.error || !dl.data) return fail(404, "file_not_found");
    bytes = new Uint8Array(await dl.data.arrayBuffer());

    const verdict = sniff(bytes);
    const admin = serviceClient();
    if (!verdict.ok) {
      // a disguised or oversized file never stays in the bucket
      await admin.storage.from("bills").remove([doc.storage_path]);
      await admin.from("documents").delete().eq("id", doc.id);
      return fail(verdict.reason === "too_large" ? 413 : 415, verdict.reason);
    }
    // record what the bytes really are, not what the client claimed
    await admin.from("documents").update({ mime: verdict.mime, bytes: bytes.length }).eq("id", doc.id);
    mime = verdict.mime;
    documentId = doc.id;
    if (!mayRead) return NextResponse.json({ stored: true, documentId, read: "desk_review" }, { status: 202 });
  } else {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) return fail(413, "too_large");
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return fail(400, "bad_form");
    }
    const f = form.get("file");
    if (!(f instanceof File)) return fail(400, "missing_file");
    bytes = new Uint8Array(await f.arrayBuffer());
    const verdict = sniff(bytes);
    if (!verdict.ok) return fail(verdict.reason === "too_large" ? 413 : 415, verdict.reason);
    mime = verdict.mime;
  }

  const prepared = await prepareBill(bytes, mime).catch(() => ({ ok: false as const, reason: "unreadable_pdf" as const }));
  if (!prepared.ok) return fail(422, prepared.reason, { stored: !!documentId, documentId });

  if (!fakeOcrEnabled && !anthropicCredentialsPresent()) return fail(503, "ocr_not_configured", { stored: !!documentId, documentId });

  let result: ReadResult;
  try {
    result = fakeOcrEnabled ? await fakeReadBill(prepared.input) : await readBill(prepared.input);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return fail(503, "ocr_not_configured", { stored: !!documentId, documentId });
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return fail(503, "ocr_busy", { stored: !!documentId, documentId });
    if (e instanceof Anthropic.APIError) return fail(502, "ocr_failed", { stored: !!documentId, documentId });
    throw e;
  }
  if (!result.ok) return fail(result.reason === "too_long" ? 413 : 422, result.reason, { stored: !!documentId, documentId });

  return NextResponse.json({
    stored: !!documentId,
    documentId,
    model: result.model,
    lines: result.bill.lines,
    printedTotal: result.bill.printed_total,
    warnings: result.warnings,
  });
}
