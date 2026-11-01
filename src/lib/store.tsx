"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ExtractedLine } from "./ai/schema";
import type { Backend, CaseDocument, Session } from "./data/backend";
import { demoBackend } from "./data/demo-backend";
import { supabaseBackend } from "./data/supabase-backend";
import { translate, type Locale, type Vars } from "./i18n/dictionary";
import type { Case, IrdaiList, RemapTarget } from "./rules-engine/types";
import { verifyChain } from "./security/audit-chain";
import { browserClient } from "./supabase/client";
import { supabaseEnabled } from "./supabase/env";

export type Role = "desk" | "family";

interface Prefs {
  locale: Locale;
  role: Role;
  plain: boolean;
  consented: boolean;
}

export interface ChainStatus {
  ok: boolean | null;
  length: number;
}

interface Store extends Prefs {
  backend: Backend["kind"];
  session: Session | null;
  loading: boolean;
  error: string | null;
  setPrefs: (p: Partial<Prefs>) => void;
  t: (key: string, vars?: Vars) => string;
  cases: Case[];
  getCase: (id: string) => Case | undefined;
  remap: (caseId: string, lineId: string, to: RemapTarget | undefined) => void;
  confirmList: (caseId: string, lineId: string, list: IrdaiList | undefined) => void;
  dismissSuggestion: (caseId: string, lineId: string) => void;
  addLines: (caseId: string, lines: ExtractedLine[]) => Promise<void>;
  uploadDocument: Backend["uploadDocument"];
  deleteCase: (caseId: string) => Promise<void>;
  chain: (caseId: string) => ChainStatus;
  refreshChain: (caseId: string) => void;
  documents: (caseId: string) => Promise<CaseDocument[]>;
  issueClaimLink: (caseId: string) => Promise<string>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const PREFS_KEY = "bima.prefs.v1";

function readPrefs(fallback: Prefs): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const backend = useMemo<Backend>(() => (supabaseEnabled ? supabaseBackend() : demoBackend()), []);
  const [prefs, setPrefsState] = useState<Prefs>({ locale: "en-IN", role: "desk", plain: false, consented: false });
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chains, setChains] = useState<Record<string, ChainStatus>>({});

  const reload = useCallback(async () => {
    try {
      setCases(await backend.loadCases());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [backend]);

  const refreshChain = useCallback(
    (caseId: string) => {
      void backend
        .events(caseId)
        .then(async (ev) => {
          const v = await verifyChain(ev);
          setChains((c) => ({ ...c, [caseId]: { ok: v.ok, length: ev.length } }));
        })
        .catch(() => setChains((c) => ({ ...c, [caseId]: { ok: false, length: 0 } })));
    },
    [backend],
  );

  // session → role & saved preferences, then cases
  useEffect(() => {
    setPrefsState((p) => readPrefs(p));
    const boot = async () => {
      const s = await backend.session();
      setSession(s);
      if (s) {
        setPrefsState((p) => ({
          ...p,
          role: s.role === "family" ? "family" : "desk",
          locale: s.locale ?? p.locale,
          plain: s.plain ?? p.plain,
        }));
      }
      if (backend.kind === "demo" || s) await reload();
      else setLoading(false);
    };
    void boot();
    if (backend.kind !== "supabase") return;
    const { data } = browserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void boot();
    });
    return () => data.subscription.unsubscribe();
  }, [backend, reload]);

  useEffect(() => {
    document.documentElement.lang = prefs.locale === "hi-IN" ? "hi" : "en";
  }, [prefs.locale]);

  const setPrefs = useCallback(
    (p: Partial<Prefs>) => {
      setPrefsState((cur) => {
        // with Supabase the role comes from the token, never from the client
        const next = { ...cur, ...p, ...(backend.kind === "supabase" && session ? { role: cur.role } : {}) };
        try {
          localStorage.setItem(PREFS_KEY, JSON.stringify(next));
        } catch {
          /* private mode */
        }
        return next;
      });
      if (session && (p.locale || p.plain !== undefined)) void backend.savePrefs({ locale: p.locale, plain: p.plain });
    },
    [backend, session],
  );

  /** Optimistic line patch, then persist, re-read and re-verify the chain. */
  const act = useCallback(
    (caseId: string, lineId: string, patch: Partial<Case["items"][number]>, run: () => Promise<void>) => {
      setCases((cs) =>
        cs.map((c) => (c.id !== caseId ? c : { ...c, items: c.items.map((i) => (i.id === lineId ? { ...i, ...patch } : i)) })),
      );
      void run()
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .then(reload)
        .then(() => refreshChain(caseId));
    },
    [reload, refreshChain],
  );

  const value: Store = {
    ...prefs,
    backend: backend.kind,
    session,
    loading,
    error,
    setPrefs,
    t: (key, vars) => translate(prefs.locale, key, vars, prefs.plain || prefs.role === "family"),
    cases,
    getCase: (id) => cases.find((c) => c.id === id),
    remap: (c, l, to) => act(c, l, { remappedTo: to }, () => backend.remap(c, l, to)),
    confirmList: (c, l, list) => act(c, l, { confirmedList: list, suggestedList: undefined }, () => backend.confirmList(c, l, list)),
    dismissSuggestion: (c, l) => act(c, l, { suggestedList: undefined }, () => backend.dismissSuggestion(c, l)),
    uploadDocument: (id, file, mime) => backend.uploadDocument(id, file, mime),
    addLines: async (id, lines) => {
      await backend.addLines(id, lines);
      await reload();
      refreshChain(id);
    },
    deleteCase: async (id) => {
      await backend.deleteCase(id);
      await reload();
    },
    chain: (id) => chains[id] ?? { ok: null, length: 0 },
    refreshChain,
    documents: (id) => backend.documents(id),
    issueClaimLink: (id) => backend.issueClaimLink(id),
    reload,
    signOut: async () => {
      await backend.signOut();
      setCases([]);
      setSession(null);
      location.assign("/login");
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
