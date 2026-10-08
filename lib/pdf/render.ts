"use client";

import type { RenderedPdf } from "@/types/print";

const RENDER_DPI = 300;
const PDF_POINTS_PER_INCH = 72;
const MAX_CANVAS_EDGE = 8192;

export async function renderFirstPage(file: File): Promise<RenderedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const requestedScale = RENDER_DPI / PDF_POINTS_PER_INCH;
    const edgeScale = Math.min(1, MAX_CANVAS_EDGE / Math.max(baseViewport.width * requestedScale, baseViewport.height * requestedScale));
    const viewport = page.getViewport({ scale: requestedScale * edgeScale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) throw new Error("This browser could not create the PDF rendering surface.");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    return {
      canvas,
      imageUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      pageWidthPoints: baseViewport.width,
      pageHeightPoints: baseViewport.height,
      effectiveDpi: RENDER_DPI * edgeScale,
    };
  } finally {
    await loadingTask.destroy();
  }
}
