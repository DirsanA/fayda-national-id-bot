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

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl sm:p-8" aria-labelledby="upload-heading">
      <div className="flex flex-col gap-2 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="upload-heading" className="text-xl font-bold tracking-tight text-white">Upload original PDF</h2>
          <p className="mt-1 text-sm text-slate-400">PDF only, single page, max {formatBytes(MAX_PDF_BYTES)}. Operations run entirely in browser.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
          Step 1 of 6
        </span>
      </div>

      {!activeDocument && (
        <label
          htmlFor={inputId}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`group mt-6 flex min-h-60 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-all duration-300 ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
              : "border-slate-700/80 bg-slate-950/40 hover:border-blue-500/50 hover:bg-slate-800/40"
          }`}
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-2xl text-blue-400 shadow-inner group-hover:scale-110 group-hover:bg-blue-500/20 transition-transform duration-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <span className="text-base font-semibold text-slate-200 group-hover:text-white transition-colors">
            Drag and drop the original PDF
          </span>
          <span className="mt-1 text-sm text-slate-400">or click to browse from device</span>
          <input ref={inputRef} id={inputId} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onInputChange} disabled={busy} />
        </label>
      )}

      {busy && (
        <div className="mt-6 space-y-2" aria-live="polite">
          <div className="flex justify-between text-sm font-semibold text-slate-300">
            <span>{status === "reading" ? "Reading file locally..." : "Validating PDF template..."}</span>
            <span className="text-blue-400 font-mono">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-800 p-0.5 shadow-inner">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-300 shadow-sm" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <div className="mt-6"><ValidationMessage tone="error">{error}</ValidationMessage></div>}

      {activeDocument && (
        <div className="mt-6 space-y-4">
          <ValidationMessage tone="success">PDF validated. {activeDocument.pageCount} page ready for processing.</ValidationMessage>
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between shadow-inner">
            <div className="min-w-0 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 font-bold text-xs uppercase">
                PDF
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-100">{activeDocument.file.name}</p>
                <p className="mt-0.5 text-xs text-slate-400 font-mono">{formatBytes(activeDocument.size)} • {activeDocument.pageCount} page</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearDocument}
              className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all shadow-xs"
            >
              Remove file
            </button>
          </div>
        </div>
      )}
    </section>
  );

}
