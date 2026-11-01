import { demoCases } from "../demo/cases";
import type { ExtractedLine } from "../ai/schema";
import type { BillItem, Case, IrdaiList, RemapTarget } from "../rules-engine/types";
import { appendEvent, type ChainEvent } from "../security/audit-chain";
import type { Backend } from "./backend";

const DECISIONS_KEY = "bima.decisions.v1";
const DELETED_KEY = "bima.deleted.v1";
const ADDED_KEY = "bima.added.v1";
const DESK_ACTOR = "00000000-0000-4000-8000-00000000d35c";

type Decision = { remappedTo?: RemapTarget; confirmedList?: IrdaiList; dismissed?: boolean };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode — decisions just won't persist */
  }
}

/** In-browser backend over the seeded demo cases; decisions persist in localStorage. */
export function demoBackend(): Backend {
  const base = demoCases();
  const chains: Record<string, ChainEvent[]> = {};
  // events are appended strictly in order so each prev_hash is the true predecessor
  let queue: Promise<void> = Promise.resolve();

  const log = (caseId: string, type: string, payload: object) => {
    queue = queue.then(async () => {
      chains[caseId] = await appendEvent(chains[caseId] ?? [], {
        case_id: caseId,
        actor: DESK_ACTOR,
        type,
        payload_text: JSON.stringify(payload),
        created_at_text: new Date().toISOString(),
      });
    });
    return queue;
  };

  const decide = (caseId: string, lineId: string, patch: Decision, type: string) => {
    const all = read<Record<string, Decision>>(DECISIONS_KEY, {});
    const key = `${caseId}:${lineId}`;
    write(DECISIONS_KEY, { ...all, [key]: { ...all[key], ...patch } });
    return log(caseId, type, { line: lineId, ...patch });
  };

  return {
    kind: "demo",
    session: async () => null,
    loadCases: async (): Promise<Case[]> => {
      const decisions = read<Record<string, Decision>>(DECISIONS_KEY, {});
      const deleted = read<Record<string, true>>(DELETED_KEY, {});
      const added = read<Record<string, BillItem[]>>(ADDED_KEY, {});
      return base
        .filter((c) => !deleted[c.id])
        .map((c) => ({
          ...c,
          items: [...c.items, ...(added[c.id] ?? [])].map((i) => {
            const d = decisions[`${c.id}:${i.id}`];
            if (!d) return i;
            return {
              ...i,
              remappedTo: d.remappedTo,
              confirmedList: d.confirmedList,
              suggestedList: d.dismissed || d.confirmedList ? undefined : i.suggestedList,
            };
          }),
        }));
    },
    remap: (c, l, to) => decide(c, l, { remappedTo: to }, to ? "item.remapped" : "item.remap_undone"),
    confirmList: (c, l, list) => decide(c, l, { confirmedList: list }, "item.list_confirmed"),
    dismissSuggestion: (c, l) => decide(c, l, { dismissed: true }, "item.suggestion_dismissed"),
    uploadDocument: async () => null,
    addLines: async (caseId, lines: ExtractedLine[]) => {
      const added = read<Record<string, BillItem[]>>(ADDED_KEY, {});
      const items: BillItem[] = lines.map((l) => ({
        id: `S${crypto.randomUUID().slice(0, 8)}`,
        description: l.description,
        department: l.department_code,
        quantity: l.quantity,
        unitRate: l.unit_rate ?? undefined,
        amount: l.amount,
        tpaDeducted: 0,
        ocrConfidence: l.ocr_confidence,
        suggestedList: l.suggested_list === "NONE" ? undefined : l.suggested_list,
      }));
      write(ADDED_KEY, { ...added, [caseId]: [...(added[caseId] ?? []), ...items] });
      await log(caseId, "items.added_from_scan", { count: items.length });
    },
    deleteCase: async (id) => write(DELETED_KEY, { ...read<Record<string, true>>(DELETED_KEY, {}), [id]: true }),
    events: async (id) => {
      await queue;
      return chains[id] ?? [];
    },
    documents: async () => [],
    savePrefs: async () => {},
    issueClaimLink: async () => {
      throw new Error("Family links need Supabase");
    },
    signOut: async () => {},
  };
}
