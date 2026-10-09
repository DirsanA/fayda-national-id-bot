"use client";

import { useEffect, useState } from "react";

type PrintPreviewProps = { pdf: Blob };

export function PrintPreview({ pdf }: PrintPreviewProps) {
  const [url, setUrl] = useState("");
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(pdf);
    setUrl(objectUrl);
    setIsIframeLoaded(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf]);

  if (!url) return null;

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-4 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-emerald-500/20 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Print Ready
          </div>
          <h3 className="mt-2 font-bold text-white text-base sm:text-xl">Print-Ready Landscape Sheet (Side-by-Side Cards)</h3>
          <p className="mt-1 text-xs sm:text-sm text-emerald-200/80 leading-relaxed">
            Front Card (Left) &amp; Back Card (Right) aligned horizontally side-by-side on 1 print sheet (ID-1 dimensions: 85.60 × 53.98 mm each). Set printer scale to 100%.
          </p>
        </div>
      </div>

      <div className="relative h-[360px] sm:h-[480px] w-full overflow-hidden rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {!isIframeLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 space-y-4 bg-slate-900/90 backdrop-blur-sm">
            <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-800/60">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-slate-700/40 to-transparent" />
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-400/30 border-t-emerald-400 animate-spin" />
                <span className="text-xs sm:text-sm font-semibold text-emerald-300/90 tracking-wide animate-pulse">
                  Rendering high-resolution print PDF...
                </span>
              </div>
            </div>
          </div>
        )}

        <iframe
          title="Generated print-ready PDF preview"
          src={url}
          onLoad={() => setIsIframeLoaded(true)}
          className={`h-full w-full border-0 transition-opacity duration-500 ${isIframeLoaded ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <a
          href={url}
          download="ethiopian-id-landscape-card.pdf"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download Print PDF</span>
        </a>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all active:scale-[0.99]"
        >
          <span>Open in New Tab ↗</span>
        </a>
      </div>
    </section>
  );
}

