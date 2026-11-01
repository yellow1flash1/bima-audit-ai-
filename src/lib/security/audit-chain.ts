/**
 * Client-side verification of the `events` hash chain. Must mirror
 * `events_hash_chain()` in supabase/migrations/0001_init.sql byte for byte:
 *   sha256(coalesce(prev_hash,'GENESIS') || case_id || actor || type || payload::text || created_at::text)
 * `payload` and `created_at` are compared using the exact text Postgres returned.
 */
export interface ChainEvent {
  id: number | string;
  case_id: string;
  actor: string;
  type: string;
  /** jsonb rendered by Postgres (`payload::text`) */
  payload_text: string;
  /** timestamptz rendered by Postgres (`created_at::text`) */
  created_at_text: string;
  prev_hash: string | null;
  hash: string;
}

export type ChainVerdict = { ok: true; length: number } | { ok: false; brokenAt: ChainEvent["id"]; reason: "prev_mismatch" | "hash_mismatch" };

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function chainInput(e: Omit<ChainEvent, "hash" | "id">): string {
  return (e.prev_hash ?? "GENESIS") + e.case_id + e.actor + e.type + e.payload_text + e.created_at_text;
}

export async function verifyChain(events: ChainEvent[]): Promise<ChainVerdict> {
  let prev: string | null = null;
  for (const e of events) {
    if (e.prev_hash !== prev) return { ok: false, brokenAt: e.id, reason: "prev_mismatch" };
    if ((await sha256Hex(chainInput(e))) !== e.hash) return { ok: false, brokenAt: e.id, reason: "hash_mismatch" };
    prev = e.hash;
  }
  return { ok: true, length: events.length };
}

/** Append locally with the same rule the trigger uses (demo mode / tests). */
export async function appendEvent(
  chain: ChainEvent[],
  e: Omit<ChainEvent, "hash" | "prev_hash" | "id">,
): Promise<ChainEvent[]> {
  const prev_hash = chain.length ? chain[chain.length - 1].hash : null;
  const hash = await sha256Hex(chainInput({ ...e, prev_hash }));
  return [...chain, { ...e, id: chain.length + 1, prev_hash, hash }];
}
