"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: SupabaseClient | null = null;

export function browserClient(): SupabaseClient {
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

export interface Claims {
  sub: string;
  email?: string;
  app_role?: "desk" | "family" | "manager" | "rules_admin";
  hospital_id?: string;
}

/** Reads the custom claims added by public.custom_access_token_hook. */
export function claimsOf(accessToken: string | undefined): Claims | null {
  if (!accessToken) return null;
  try {
    const part = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(part)))) as Claims;
  } catch {
    return null;
  }
}
