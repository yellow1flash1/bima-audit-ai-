"use client";

import { Segmented } from "@/components/ios";
import type { Locale } from "@/lib/i18n/dictionary";
import { useStore } from "@/lib/store";

export function LocaleSwitch({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const { locale, setPrefs, t } = useStore();
  return (
    <Segmented<Locale>
      label={`locale-${id}`}
      size={size}
      value={locale}
      onChange={(l) => setPrefs({ locale: l })}
      options={[
        { value: "en-IN", label: t("locale.en") },
        { value: "hi-IN", label: t("locale.hi") },
      ]}
    />
  );
}
