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
      <h3 className="font-semibold text-emerald-950">Print-ready PDF created</h3>
      <p className="mt-1 text-sm text-emerald-900">The file contains only the selected source artwork on an ID-1-sized page. In the print dialog, choose “Actual size” or 100%—never “Fit to page.”</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={url} download="print-ready-card.pdf" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Download print PDF</a>
        <a href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100">Open print preview</a>
      </div>
    </section>
  );
}
