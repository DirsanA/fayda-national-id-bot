"use client";

import { ChangeEvent, DragEvent, useId, useRef, useState } from "react";
import { MAX_PDF_BYTES, PdfValidationError, validatePdf } from "@/lib/pdf/validate";
import type { UploadStatus, ValidatedPdf } from "@/types/pdf";
import { ValidationMessage } from "./ValidationMessage";

type PdfUploaderProps = { file?: File; onReady: (file: File) => void; onClear: () => void };

const formatBytes = (bytes: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 1, style: "unit", unit: bytes < 1024 * 1024 ? "kilobyte" : "megabyte" }).format(bytes < 1024 * 1024 ? bytes / 1024 : bytes / (1024 * 1024));

export function PdfUploader({ file: externalFile, onReady, onClear }: PdfUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string>();
  const [document, setDocument] = useState<ValidatedPdf>();
  const [isDragging, setIsDragging] = useState(false);
  const activeDocument = document ?? (externalFile ? { file: externalFile, pageCount: 1, size: externalFile.size } : undefined);
  const busy = status === "reading" || status === "validating";

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(undefined); setDocument(undefined); setStatus("reading"); setProgress(0);
    try {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 70)); };
        reader.onerror = () => reject(new PdfValidationError("The selected file could not be read."));
        reader.onload = () => resolve();
        reader.readAsArrayBuffer(file);
      });
      setStatus("validating"); setProgress(80);
      const { pageCount } = await validatePdf(file);
      setDocument({ file, pageCount, size: file.size }); setProgress(100); setStatus("ready"); onReady(file);
    } catch (caught) {
      setStatus("error"); setProgress(0); setError(caught instanceof Error ? caught.message : "The file could not be validated.");
    }
  };

  const clearDocument = () => { setDocument(undefined); setError(undefined); setProgress(0); setStatus("idle"); if (inputRef.current) inputRef.current.value = ""; onClear(); };
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => void handleFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setIsDragging(false); void handleFile(event.dataTransfer.files[0]); };

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="upload-heading">
    <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="upload-heading" className="text-xl font-semibold">Upload original PDF</h2><p className="mt-1 text-sm leading-6 text-slate-600">PDF only, one page, maximum {formatBytes(MAX_PDF_BYTES)}. Files remain in your browser and are not stored by this application.</p></div><span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Step 1 of 6</span></div>
    {!activeDocument && <label htmlFor={inputId} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className={`mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"}`}><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-2xl text-blue-700" aria-hidden="true">↑</span><span className="text-base font-semibold">Drag and drop the original PDF</span><span className="mt-1 text-sm text-slate-600">or choose a file from this device</span><input ref={inputRef} id={inputId} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onInputChange} disabled={busy} /></label>}
    {busy && <div className="mt-6" aria-live="polite"><div className="mb-2 flex justify-between text-sm font-medium text-slate-700"><span>{status === "reading" ? "Reading file locally" : "Validating PDF"}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
    {error && <div className="mt-6"><ValidationMessage tone="error">{error}</ValidationMessage></div>}
    {activeDocument && <div className="mt-6 space-y-4"><ValidationMessage tone="success">PDF validated successfully. It contains {activeDocument.pageCount} page and is ready for preview.</ValidationMessage><div className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium text-slate-900">{activeDocument.file.name}</p><p className="mt-1 text-sm text-slate-600">{formatBytes(activeDocument.size)} · PDF · {activeDocument.pageCount} page</p></div><button type="button" onClick={clearDocument} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Remove file</button></div><ValidationMessage tone="info">The source stays in this browser session. The next stages render and crop pixels only; they do not OCR, reconstruct, or expose editable identity fields.</ValidationMessage></div>}
  </section>;
}
