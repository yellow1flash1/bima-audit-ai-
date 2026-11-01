import type { ExtractedLine } from "../ai/schema";
import type { Locale } from "../i18n/dictionary";
import type { Case, IrdaiList, RemapTarget } from "../rules-engine/types";
import type { ChainEvent } from "../security/audit-chain";

export interface CaseDocument {
  id: string;
  kind: "bill" | "policy_schedule";
  mime: string;
  bytes: number;
  createdAt: string;
}

export interface Session {
  userId: string;
  email?: string;
  role: "desk" | "family" | "manager" | "rules_admin";
  hospitalId?: string;
  locale?: Locale;
  plain?: boolean;
}

/** Everything the UI needs from persistence. Demo (browser) and Supabase implement it. */
export interface Backend {
  readonly kind: "demo" | "supabase";
  session(): Promise<Session | null>;
  loadCases(): Promise<Case[]>;
  remap(caseId: string, lineId: string, to: RemapTarget | undefined): Promise<void>;
  confirmList(caseId: string, lineId: string, list: IrdaiList | undefined): Promise<void>;
  dismissSuggestion(caseId: string, lineId: string): Promise<void>;
  /**
   * Stores a bill in the private bucket straight from the browser and records it;
   * returns the document id, or null where nothing is stored (demo).
   */
  uploadDocument(caseId: string, file: Blob, mime: "application/pdf" | "image/jpeg" | "image/png"): Promise<string | null>;
  /** Reviewed lines from a scan; the case is re-evaluated afterwards. */
  addLines(caseId: string, lines: ExtractedLine[]): Promise<void>;
  deleteCase(caseId: string): Promise<void>;
  events(caseId: string): Promise<ChainEvent[]>;
  documents(caseId: string): Promise<CaseDocument[]>;
  savePrefs(p: { locale?: Locale; plain?: boolean }): Promise<void>;
  issueClaimLink(caseId: string): Promise<string>;
  signOut(): Promise<void>;
}
