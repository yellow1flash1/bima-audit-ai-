import { NextResponse, type NextRequest } from "next/server";
import { userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TTL_SECONDS = 60;

/** Issues a 60-second signed URL, only after RLS has shown the caller can see the document. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await userClient();
  const { data: doc } = await db.from("documents").select("storage_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data, error } = await db.storage.from("bills").createSignedUrl(doc.storage_path, TTL_SECONDS);
  if (error || !data) return NextResponse.json({ error: "denied" }, { status: 403 });
  return NextResponse.json({ url: data.signedUrl, expiresIn: TTL_SECONDS }, { headers: { "Cache-Control": "no-store" } });
}
