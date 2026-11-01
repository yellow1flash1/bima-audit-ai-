"use client";

import { Button, Group, Row, Sheet, Squircle } from "@/components/ios";
import { useStore } from "@/lib/store";

export function ConsentSheet({ open, onClose, onAgree, onDelete }: { open: boolean; onClose: () => void; onAgree: () => void; onDelete?: () => void }) {
  const { t, locale, setPrefs } = useStore();
  return (
    <Sheet open={open} onClose={onClose} title={t("consent.title")} closeLabel={t("nav.cancel")}>
      <div className="flex justify-center pt-4">
        <div className="flex gap-1 rounded-[9px] bg-[rgba(118,118,128,0.12)] p-0.5 text-[13px]">
          {(["en-IN", "hi-IN"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setPrefs({ locale: l })} className={`rounded-[7px] px-3 py-0.5 font-medium ${locale === l ? "bg-surface shadow-sm" : ""}`}>
              {t(l === "en-IN" ? "locale.en" : "locale.hi")}
            </button>
          ))}
        </div>
      </div>
      <Group>
        <Row icon={<Squircle tone="blue" glyph="doc" />} title={<span className="text-[15px]">{t("consent.p1")}</span>} />
        <Row icon={<Squircle tone="green" glyph="shield" />} title={<span className="text-[15px]">{t("consent.p2")}</span>} />
        <Row icon={<Squircle tone="grey" glyph="trash" />} title={<span className="text-[15px]">{t("consent.p3")}</span>} />
        <Row last icon={<Squircle tone="red" glyph="trash" />} title={<span className="text-[15px]">{t("consent.p4")}</span>} />
      </Group>
      <div className="mx-4 mt-6 space-y-3">
        <Button
          onClick={() => {
            setPrefs({ consented: true });
            onAgree();
          }}
        >
          {t("consent.agree")}
        </Button>
        {onDelete && (
          <Button tone="destructive" onClick={onDelete}>
            {t("consent.deleteNow")}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
