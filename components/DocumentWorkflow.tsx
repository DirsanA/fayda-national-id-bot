"use client";

import { useCallback, useEffect, useState } from "react";
import { cropRenderedArtwork } from "@/lib/pdf/crop";
import { createPrintReadyPdf } from "@/lib/pdf/generate";
import { createRedactedSamplePdf } from "@/lib/pdf/sample";
import { REDACTED_TEMPLATE, topLeftPointsToCrop, type TemplateRegion } from "@/lib/pdf/template-config";
import { validateConfiguredTemplate } from "@/lib/pdf/validate-template";
import type { CroppedArtwork, RenderedPdf } from "@/types/print";
import { PdfUploader } from "./PdfUploader";
import { PdfViewer } from "./PdfViewer";
import { PrintPreview } from "./PrintPreview";
import { ValidationMessage } from "./ValidationMessage";

type ExtractedRegion = { region: TemplateRegion; artwork: CroppedArtwork };

export function DocumentWorkflow() {
  const [file, setFile] = useState<File>();
  const [cards, setCards] = useState<ExtractedRegion[]>([]);
  const [processing, setProcessing] = useState(false);
  const [output, setOutput] = useState<Blob>();
  const [error, setError] = useState<string>();

  const clearCards = useCallback(() => {
    setCards((previous) => {
      previous.forEach(({ artwork }) => URL.revokeObjectURL(artwork.imageUrl));
      return [];
    });
  }, []);

  const resetDocument = useCallback(() => {
    setFile(undefined); clearCards(); setOutput(undefined); setError(undefined); setProcessing(false);
  }, [clearCards]);

  useEffect(() => () => { cards.forEach(({ artwork }) => URL.revokeObjectURL(artwork.imageUrl)); }, [cards]);

  const processTemplate = useCallback(async (source: RenderedPdf) => {
    clearCards(); setOutput(undefined); setError(undefined);
    const errors = validateConfiguredTemplate(source);
    if (errors.length) { setError(errors.join(" ")); return; }

    setProcessing(true);
    try {
      const extracted = await Promise.all(REDACTED_TEMPLATE.regions.map(async (region) => ({ region, artwork: await cropRenderedArtwork(source, topLeftPointsToCrop(region)) })));
      setCards(extracted);
      setOutput(await createPrintReadyPdf(extracted.map(({ artwork }) => artwork.blob)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not extract the configured artwork regions.");
    } finally {
      setProcessing(false);
    }
  }, [clearCards]);

  const selectFile = useCallback((next: File) => { setFile(next); clearCards(); setOutput(undefined); setError(undefined); }, [clearCards]);
  const loadSample = async () => selectFile(await createRedactedSamplePdf());
  const handleRendered = useCallback((source: RenderedPdf) => { void processTemplate(source); }, [processTemplate]);

  return <div className="space-y-6">
    <PdfUploader file={file} onReady={selectFile} onClear={resetDocument} />
    {!file && <div className="flex justify-center"><button type="button" onClick={() => void loadSample()} className="text-sm font-semibold text-blue-700 underline underline-offset-4">Load synthetic redacted template PDF for development</button></div>}
    {file && <PdfViewer file={file} onRendered={handleRendered} />}
    {processing && <ValidationMessage tone="info">Template verified. Extracting configured front and back regions and generating the print PDF...</ValidationMessage>}
    {error && <ValidationMessage tone="error">{error}</ValidationMessage>}
    {cards.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><h3 className="font-semibold">Automatically extracted artwork</h3><p className="mt-1 text-sm text-slate-600">Configured source regions were copied as pixels with no OCR, editable fields, or reconstructed content.</p></div><span className="text-sm font-medium text-slate-700">Print size: {REDACTED_TEMPLATE.output.widthMm.toFixed(2)} x {REDACTED_TEMPLATE.output.heightMm.toFixed(2)} mm</span></div><div className="mt-5 grid gap-5 md:grid-cols-2">{cards.map(({ region, artwork }) => <figure key={region.id} className="rounded-lg bg-slate-100 p-3"><figcaption className="mb-2 text-sm font-semibold text-slate-800">{region.label}</figcaption><img src={artwork.imageUrl} alt={`${region.label} extracted from the configured source region`} className="w-full border border-slate-300 bg-white shadow-sm" /><p className="mt-2 text-xs text-slate-600">{artwork.width} x {artwork.height} px</p></figure>)}</div></section>}
    {output && <PrintPreview pdf={output} />}
  </div>;
}
