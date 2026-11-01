import { NextResponse, type NextRequest } from "next/server";
import { AddLinesRequest } from "@/lib/ai/schema";
import { evaluateAndStore, requireStaff } from "@/lib/server/evaluate-case";
import { userClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Adds reviewed lines from a scan to a case. Writes run as the desk user, so RLS and
 * the bill_items column grants apply; the engine then evaluates the whole case.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await userClient();
  const staff = await requireStaff(db);
  if (!staff.ok) return NextResponse.json({ error: staff.status === 401 ? "unauthenticated" : "forbidden" }, { status: staff.status });

  const parsed = AddLinesRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_lines" }, { status: 400 });

  const { data: c } = await db.from("cases").select("id, hospital_id").eq("id", id).maybeSingle();
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: last } = await db.from("bill_items").select("line_no").eq("case_id", id).order("line_no", { ascending: false }).limit(1).maybeSingle();
  const start = (last?.line_no ?? 0) + 1;

  const rows = parsed.data.lines.map((l, i) => ({
    hospital_id: c.hospital_id,
    case_id: c.id,
    line_no: start + i,
    description: l.description,
    department: l.department_code,
    quantity: l.quantity,
    unit_rate: l.unit_rate,
    amount: l.amount,
    ocr_confidence: l.ocr_confidence,
    suggested_list: l.suggested_list === "NONE" ? null : l.suggested_list,
  }));
  const ins = await db.from("bill_items").insert(rows);
  if (ins.error) return NextResponse.json({ error: "insert_denied" }, { status: 403 });

  await db.from("events").insert({
    hospital_id: c.hospital_id,
    case_id: c.id,
    actor: staff.userId,
    type: "items.added_from_scan",
    payload: { count: rows.length, first_line: start },
  });

  const r = await evaluateAndStore(db, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, added: rows.length, totals: r.ev.totals });
}
