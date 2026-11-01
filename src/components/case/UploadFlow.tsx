"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Row, Sheet, Squircle } from "@/components/ios";
import type { ReadWarning } from "@/lib/ai/bill-reader";
import type { ExtractedLine } from "@/lib/ai/schema";
import { sniff, type AllowedMime } from "@/lib/security/magic-bytes";
import { useStore } from "@/lib/store";
import { ConsentSheet } from "./ConsentSheet";
import { ReviewSheet } from "./ReviewSheet";

/** Fraction of the page height auto-blurred: the header block with name/phone/address. */
const HEADER_BAND = 0.22;
const MAX_EDGE = 1600;

type Stage = "idle" | "consent" | "redact";

type ScanResponse = {
  error?: string;
  retryAfterMs?: number;
  stored?: boolean;
  read?: "desk_review";
  lines?: ExtractedLine[];
  printedTotal?: number | null;
  warnings?: ReadWarning[];
};

export interface Scan {
  lines: ExtractedLine[];
  printedTotal: number | null;
  warnings: ReadWarning[];
}

const KNOWN_ERRORS = new Set(["scanned_pdf", "unreadable_pdf", "refused", "too_long", "invalid_output", "no_lines", "ocr_busy", "ocr_failed"]);

export function UploadFlow({ last, caseId, onStored }: { last?: boolean; caseId: string; onStored?: () => void }) {
  const { t, consented, uploadDocument } = useStore();
  const [stage, setStage] = useState<Stage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pick = () => input.current?.click();
  const start = () => (consented ? pick() : setStage("consent"));

  const send = useCallback(
    async (blob: Blob, name: string, mime: AllowedMime) => {
      setStage("idle");
      setFile(null);
      setBusy(true);
      setMessage(t("upload.reading"));
      try {
        // with Supabase the file goes straight to private storage; the server then reads it by id
        const documentId = await uploadDocument(caseId, blob, mime);
        let res: Response;
        if (documentId) {
          onStored?.();
          res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: documentId }) });
        } else {
          const fd = new FormData();
          fd.append("file", blob, name);
          res = await fetch("/api/scan", { method: "POST", body: fd });
        }
        const body = (await res.json().catch(() => ({}))) as ScanResponse;
        if (body.stored) onStored?.();
        const stored = body.stored ? ` ${t("upload.storedToo")}` : "";
        if (res.status === 429) setMessage(t("upload.rateLimited", { minutes: Math.ceil((body.retryAfterMs ?? 60_000) / 60_000) }));
        else if (res.status === 415 || (res.status === 413 && body.error === "too_large")) setMessage(t("upload.rejected", { reason: body.error ?? res.status }));
        else if (body.error === "ocr_not_configured") setMessage(t("upload.notConfigured") + stored);
        else if (body.error && KNOWN_ERRORS.has(body.error)) setMessage(t(`upload.err_${body.error}`) + stored);
        else if (res.status === 202 && body.read === "desk_review") setMessage(t("upload.deskReview"));
        else if (res.ok && body.lines) {
          setMessage(null);
          setScan({ lines: body.lines, printedTotal: body.printedTotal ?? null, warnings: body.warnings ?? [] });
        } else setMessage(t("upload.rejected", { reason: body.error ?? res.status }));
      } catch (e) {
        // storage refusals (wrong folder, size, type) surface here as well as network errors
        setMessage(t("upload.rejected", { reason: e instanceof Error ? e.message : "network" }));
      }
      setBusy(false);
    },
    [t, caseId, onStored, uploadDocument],
  );

  const onFile = async (f: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!f) return;
    const head = new Uint8Array(await f.slice(0, Math.min(f.size, 2 * 1024 * 1024)).arrayBuffer());
    // size is checked on the full file; the header slice is enough for type sniffing
    const verdict = f.size > 15 * 1024 * 1024 ? { ok: false as const, reason: "too_large" } : sniff(head);
    if (!verdict.ok) return setMessage(t("upload.rejected", { reason: verdict.reason }));
    if (verdict.mime === "application/pdf") return send(f, f.name, "application/pdf");
    setFile(f);
    setStage("redact");
  };

  return (
    <>
      <Row
        last={last}
        icon={<Squircle tone="blue" glyph="camera" />}
        title={<span className="text-accent">{t("docs.upload")}</span>}
        subtitle={message ?? t("docs.uploadSub")}
        onClick={busy ? undefined : start}
      />
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <ConsentSheet
        open={stage === "consent"}
        onClose={() => setStage("idle")}
        onAgree={() => {
          setStage("idle");
          pick();
        }}
      />
      <RedactionSheet file={stage === "redact" ? file : null} onClose={() => setStage("idle")} onSend={send} />
      <ReviewSheet caseId={caseId} scan={scan} onClose={() => setScan(null)} onAdded={(n) => setMessage(t("upload.added", { count: n }))} />
    </>
  );
}

/** Crop-modal redaction brush: header band blurred automatically, user paints the rest. */
function RedactionSheet({ file, onClose, onSend }: { file: File | null; onClose: () => void; onSend: (b: Blob, name: string, mime: AllowedMime) => void }) {
  const { t } = useStore();
  const canvas = useRef<HTMLCanvasElement>(null);
  const source = useRef<HTMLImageElement | null>(null);
  const drawing = useRef(false);
  const [brush, setBrush] = useState(36);

  const blurRect = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = "blur(18px)";
    ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    ctx.fillStyle = "rgba(142,142,147,0.35)";
    ctx.fillRect(x, y, w, h);
  };

  const reset = useCallback(() => {
    const c = canvas.current;
    const img = source.current;
    if (!c || !img) return;
    const k = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    blurRect(ctx, img, 0, 0, c.width, c.height * HEADER_BAND);
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      source.current = img;
      reset();
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, reset]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvas.current || !source.current) return;
    const c = canvas.current;
    const r = c.getBoundingClientRect();
    const sx = c.width / r.width;
    const x = (e.clientX - r.left) * sx;
    const y = (e.clientY - r.top) * sx;
    const size = brush * sx;
    blurRect(c.getContext("2d")!, source.current, x - size / 2, y - size / 2, size, size);
  };

  const submit = () =>
    canvas.current?.toBlob((b) => b && onSend(b, "bill.jpg", "image/jpeg"), "image/jpeg", 0.88);

  return (
    <Sheet open={!!file} onClose={onClose} title={t("upload.redactTitle")} closeLabel={t("nav.cancel")}>
      <p className="px-4 pt-3 text-[15px] text-label-2">{t("upload.redactHint")}</p>
      <div className="mx-4 mt-3 overflow-hidden rounded-xl bg-surface">
        <canvas
          ref={canvas}
          className="block h-auto w-full touch-none"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            paint(e);
          }}
          onPointerMove={paint}
          onPointerUp={() => (drawing.current = false)}
        />
      </div>
      <div className="mx-4 mt-4 flex items-center gap-3 text-[15px]">
        <span className="text-label-2">{t("upload.brush")}</span>
        <input type="range" min={16} max={96} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="ios-slider flex-1" style={{ ["--fill" as string]: `${((brush - 16) / 80) * 100}%` }} aria-label={t("upload.brush")} />
        <button type="button" onClick={reset} className="text-accent">
          {t("upload.reset")}
        </button>
      </div>
      <div className="mx-4 mt-5">
        <Button onClick={submit}>{t("upload.send")}</Button>
      </div>
    </Sheet>
  );
}
