"use client";

import { useEffect, useState } from "react";

type PrintPreviewProps = { pdf: Blob };

export function PrintPreview({ pdf }: PrintPreviewProps) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(pdf);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf]);
  if (!url) return null;

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
      <h3 className="font-semibold text-emerald-950">Print-Ready Landscape PDF Created (2 Pages)</h3>
      <p className="mt-1 text-sm text-emerald-900">
        Page 1 contains the Front Landscape Card; Page 2 contains the Back Landscape Card. Scaled to exact ID-1 physical dimensions (85.60 × 53.98 mm). In printer settings, select “Actual size” or 100%.
      </p>
      <iframe title="Generated print-ready PDF preview" src={url} className="mt-4 h-96 w-full rounded border border-emerald-200 bg-white" />
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={url} download="ethiopian-id-landscape-card.pdf" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors shadow-xs">
          Download Landscape Print PDF
        </a>
        <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors">
          Open in New Tab
        </a>
      </div>
    </section>
  );
}
