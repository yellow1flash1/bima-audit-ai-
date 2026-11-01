import { NextResponse, type NextRequest } from "next/server";
import { evaluateAndStore, requireStaff } from "@/lib/server/evaluate-case";
import { userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await userClient();
  const staff = await requireStaff(db);
  if (!staff.ok) return NextResponse.json({ error: staff.status === 401 ? "unauthenticated" : "forbidden" }, { status: staff.status });

  const r = await evaluateAndStore(db, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, totals: r.ev.totals });
}
