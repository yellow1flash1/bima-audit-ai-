"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { LargeTitle, NavBar } from "@/components/ios";
import { browserClient } from "@/lib/supabase/client";
import { useStore } from "@/lib/store";

export default function ClaimPage() {
  return (
    <Suspense>
      <Claim />
    </Suspense>
  );
}

/** Family member opens the link the desk shared; the token binds the case to their account. */
function Claim() {
  const { t, reload } = useStore();
  const router = useRouter();
  const token = useSearchParams().get("t");
  const [failed, setFailed] = useState(false);
  const once = useRef(false);

  useEffect(() => {
    if (!token || once.current) return;
    once.current = true;
    void browserClient()
      .rpc("claim_case", { p_token: token })
      .then(async ({ data, error }) => {
        if (error || !data) return setFailed(true);
        await reload();
        router.replace(`/case/${data as string}`);
      });
  }, [token, reload, router]);

  return (
    <main className="mx-auto max-w-md">
      <NavBar back={{ href: "/", label: t("nav.back") }} />
      <LargeTitle>{t("claim.title")}</LargeTitle>
      <p className={`px-4 text-[15px] ${failed || !token ? "text-red-text" : "text-label-2"}`}>{failed || !token ? t("claim.failed") : t("claim.claiming")}</p>
    </main>
  );
}
