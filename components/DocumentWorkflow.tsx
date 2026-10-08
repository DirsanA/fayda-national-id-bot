"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cropRenderedArtwork } from "@/lib/pdf/crop";
import { createPrintReadyPdf } from "@/lib/pdf/generate";
import { createRedactedSamplePdf } from "@/lib/pdf/sample";
import { validateOutput } from "@/lib/pdf/validate-output";
import { ID1_ASPECT_RATIO, type CropRect, type CroppedArtwork, type RenderedPdf } from "@/types/print";
import { CardPreview } from "./CardPreview";
import { CropSelector } from "./CropSelector";
import { PdfUploader } from "./PdfUploader";
import { PdfViewer } from "./PdfViewer";
import { PrintPreview } from "./PrintPreview";
import { ValidationMessage } from "./ValidationMessage";

function defaultCrop(source: RenderedPdf): CropRect {
  const sourceRatio = source.width / source.height;
  const height = sourceRatio > ID1_ASPECT_RATIO ? 0.8 : 0.8 * sourceRatio / ID1_ASPECT_RATIO;
  const width = height * ID1_ASPECT_RATIO / sourceRatio;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

export function DocumentWorkflow() {
  const [file, setFile] = useState<File>();
  const [source, setSource] = useState<RenderedPdf>();
  const [crop, setCrop] = useState<CropRect>();
  const [artwork, setArtwork] = useState<CroppedArtwork>();
  const [isPreparingCrop, setIsPreparingCrop] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<Blob>();
  const [error, setError] = useState<string>();

  const resetDocument = useCallback(() => {
    setFile(undefined); setSource(undefined); setCrop(undefined); setArtwork(undefined); setOutput(undefined); setError(undefined); setConfirming(false);
  }, []);

  const handleRendered = useCallback((rendered: RenderedPdf) => {
    setSource(rendered); setCrop(defaultCrop(rendered)); setOutput(undefined); setError(undefined);
  }, []);

  useEffect(() => {
    let current = true;
    if (!source || !crop) return;
    setIsPreparingCrop(true); setError(undefined);
    void cropRenderedArtwork(source, crop).then((next) => {
      if (!current) { URL.revokeObjectURL(next.imageUrl); return; }
      setArtwork((previous) => { if (previous) URL.revokeObjectURL(previous.imageUrl); return next; });
    }).catch((caught) => current && setError(caught instanceof Error ? caught.message : "Could not extract the selected region.")).finally(() => current && setIsPreparingCrop(false));
    return () => { current = false; };
  }, [source, crop]);

  useEffect(() => () => { if (artwork) URL.revokeObjectURL(artwork.imageUrl); }, [artwork]);

  const validation = useMemo(() => validateOutput(source, crop), [source, crop]);
  const selectFile = useCallback((next: File) => { setFile(next); setSource(undefined); setCrop(undefined); setArtwork(undefined); setOutput(undefined); setError(undefined); setConfirming(false); }, []);
  const loadSample = async () => selectFile(await createRedactedSamplePdf());

  const generate = async () => {
    if (!artwork || !validation.canGenerate) return;
    setGenerating(true); setError(undefined);
    try { setOutput(await createPrintReadyPdf(artwork.blob)); setConfirming(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the print-ready PDF."); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <PdfUploader file={file} onReady={selectFile} onClear={resetDocument} />
      {!file && <div className="flex justify-center"><button type="button" onClick={() => void loadSample()} className="text-sm font-semibold text-blue-700 underline underline-offset-4">Load synthetic redacted sample PDF for development</button></div>}
      {file && <>
        <PdfViewer file={file} onRendered={handleRendered} />
        {source && crop && <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]"><CropSelector source={source} crop={crop} onChange={(next) => { setCrop(next); setOutput(undefined); setConfirming(false); }} onReset={() => { setCrop(defaultCrop(source)); setOutput(undefined); }} /><CardPreview artwork={artwork} validation={validation} /></div>}
        {isPreparingCrop && <ValidationMessage tone="info">Updating pixel-based card preview…</ValidationMessage>}
        {error && <ValidationMessage tone="error">{error}</ValidationMessage>}
        {source && <section className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold">Generate print-ready PDF</h3><p className="mt-1 text-sm text-slate-600">The output contains only the selected original pixels at {""}85.60 × 53.98 mm. Nothing is reconstructed or edited.</p>{!confirming ? <button type="button" disabled={!validation.canGenerate || !artwork || isPreparingCrop} onClick={() => setConfirming(true)} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">Generate print PDF</button> : <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-950">Confirm that the crop is the complete authorized source artwork and should print at actual size.</p><div className="mt-3 flex gap-3"><button type="button" onClick={() => void generate()} disabled={generating} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400">{generating ? "Generating…" : "Confirm and generate"}</button><button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button></div></div>}</section>}
        {output && <PrintPreview pdf={output} />}
      </>}
    </div>
  );
}
