"use client";

import { useEffect, useState } from "react";
import { renderFirstPage } from "@/lib/pdf/render";
import type { RenderedPdf } from "@/types/print";
import { ValidationMessage } from "./ValidationMessage";

type PdfViewerProps = {
  file: File;
  onRendered: (rendered: RenderedPdf) => void;
};

export function PdfViewer({ file, onRendered }: PdfViewerProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [rendered, setRendered] = useState<RenderedPdf>();

  useEffect(() => {
    let live = true;
    setState("loading");
    setError(undefined);
    setRendered(undefined);
    void renderFirstPage(file)
      .then((result) => {
        if (!live) return;
        setRendered(result);
        setState("ready");
        onRendered(result);
      })
      .catch((caught) => {
        if (!live) return;
        setState("error");
        setError(caught instanceof Error ? caught.message : "The PDF could not be rendered.");
      });
    return () => { live = false; };
  }, [file, onRendered]);

  if (state === "loading") return <ValidationMessage tone="info">Rendering source PDF at high resolution…</ValidationMessage>;
  if (state === "error") return <ValidationMessage tone="error">{error}</ValidationMessage>;
  if (!rendered) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">PDF source rendered</h3><span className="text-xs text-slate-600">{rendered.width} × {rendered.height} px · {Math.round(rendered.effectiveDpi)} DPI</span></div>
      <p className="mt-1 text-sm text-slate-600">Select card artwork directly from this rendered source. No OCR or editable fields are used.</p>
    </div>
  );
}
