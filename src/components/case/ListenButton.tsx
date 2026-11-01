"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

/** Reads the family summary aloud with the Web Speech API in hi-IN or en-IN. */
export function ListenButton({ text }: { text: string }) {
  const { t, locale } = useStore();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = locale;
    u.rate = 0.92;
    const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith(locale.slice(0, 2)));
    if (voice) u.voice = voice;
    u.onend = u.onerror = () => setSpeaking(false);
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <button type="button" onClick={toggle} aria-pressed={speaking} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[15px] font-medium text-accent">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5L6 9H3v6h3l5 4z" />
        {speaking ? <path d="M16 9v6M20 9v6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
      </svg>
      {speaking ? t("family.stop") : t("family.listen")}
    </button>
  );
}
