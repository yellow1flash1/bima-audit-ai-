"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Group, LargeTitle, NavBar } from "@/components/ios";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { browserClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

/** Only allow same-origin relative redirects after sign-in. */
function safeNext(v: string | null): string {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

function Login() {
  const { t } = useStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const signIn = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: t("auth.failed") });
    router.replace(next);
    router.refresh();
  };

  const sendLink = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    setMsg(error ? { tone: "error", text: t("auth.failed") } : { tone: "info", text: t("auth.linkSent", { email }) });
  };

  const field = "w-full bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-3";

  return (
    <main className="mx-auto max-w-md">
      <NavBar right={<LocaleSwitch id="login" />} />
      <LargeTitle>{t("auth.title")}</LargeTitle>
      <p className="px-4 text-[15px] text-label-2">{t("app.tagline")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <Group>
          <input className={field} type="email" autoComplete="email" inputMode="email" placeholder={t("auth.email")} aria-label={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="ml-4 h-px scale-y-50 bg-hairline" />
          <input className={field} type="password" autoComplete="current-password" placeholder={t("auth.password")} aria-label={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Group>
        {msg && <p className={`px-8 pt-2 text-[13px] ${msg.tone === "error" ? "text-red-text" : "text-label-2"}`}>{msg.text}</p>}
        <div className="mx-4 mt-6 space-y-3">
          <button type="submit" disabled={busy || !email || !password} className="h-[50px] w-full rounded-xl bg-accent text-[17px] font-semibold text-white disabled:opacity-40">
            {t("auth.signIn")}
          </button>
          <Button tone="plain" disabled={busy || !email} onClick={() => void sendLink()}>
            {t("auth.magicLink")}
          </Button>
        </div>
      </form>
      <p className="px-8 pt-3 text-[13px] text-label-2">{t("auth.familyHint")}</p>
    </main>
  );
}
