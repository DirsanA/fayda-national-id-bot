"use client";

import { useCallback, useState } from "react";
import { extractIdDataFromPdf, mapFaydaJsonResponseToIdData } from "@/lib/pdf/extract";
import { createPrintReadyLandscapePdf } from "@/lib/pdf/generate-landscape";
import { createRedactedSamplePdf } from "@/lib/pdf/sample";
import { validateConfiguredTemplate } from "@/lib/pdf/validate-template";
import type { RenderedPdf } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";
import { PdfUploader } from "./PdfUploader";
import { PdfViewer } from "./PdfViewer";
import { PrintPreview } from "./PrintPreview";
import { ValidationMessage } from "./ValidationMessage";
import { FaydaApiForm } from "./FaydaApiForm";

export function DocumentWorkflow() {
  const [activeTab, setActiveTab] = useState<"pdf" | "api">("pdf");
  const [file, setFile] = useState<File>();
  const [idData, setIdData] = useState<EthiopianIdData>();
  const [processing, setProcessing] = useState(false);
  const [output, setOutput] = useState<Blob>();
  const [error, setError] = useState<string>();

  const resetDocument = useCallback(() => {
    setFile(undefined);
    setIdData(undefined);
    setOutput(undefined);
    setError(undefined);
    setProcessing(false);
  }, []);

  const handleApiSuccess = useCallback(async (jsonResponseData: Record<string, any>) => {
    setProcessing(true);
    setError(undefined);
    try {
      const mappedData = mapFaydaJsonResponseToIdData(jsonResponseData);
      setIdData(mappedData);

      const printPdf = await createPrintReadyLandscapePdf(mappedData);
      setOutput(printPdf);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate card preview from API data.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const processTemplate = useCallback(async (currentFile: File, source: RenderedPdf) => {
    setIdData(undefined);
    setOutput(undefined);
    setError(undefined);

    const errors = validateConfiguredTemplate(source);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }

    setProcessing(true);
    try {
      // 1. Extract structured data and high-res visual assets from PDF
      const extracted = await extractIdDataFromPdf(currentFile, source);
      setIdData(extracted);

      // 2. Generate 300 DPI physical print-ready landscape ID-1 PDF (Front + Back)
      const printPdf = await createPrintReadyLandscapePdf(extracted);
      setOutput(printPdf);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reconstruct the landscape card layout.");
    } finally {
      setProcessing(false);
    }
  }, []);

  const selectFile = useCallback((next: File) => {
    setFile(next);
    setIdData(undefined);
    setOutput(undefined);
    setError(undefined);
  }, []);

  const loadSample = async () => selectFile(await createRedactedSamplePdf());

  const handleRendered = useCallback(
    (source: RenderedPdf) => {
      if (file) {
        void processTemplate(file, source);
      }
    },
    [file, processTemplate]
  );

  return (
    <div className="space-y-6">
      {/* Workflow Tabs */}
      <div className="flex border-b border-slate-800/80 bg-slate-900/40 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab("pdf");
            resetDocument();
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "pdf"
              ? "bg-slate-800 text-teal-400 shadow-xs border border-slate-700/60"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-teal-400" />
          PDF Upload &amp; Extraction
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("api");
            resetDocument();
          }}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "api"
              ? "bg-slate-800 text-teal-400 shadow-xs border border-slate-700/60"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Fayda API Verification (JSON)
        </button>
      </div>

      {activeTab === "api" ? (
        <FaydaApiForm
          onSuccess={(data) => void handleApiSuccess(data)}
          onError={(msg) => setError(msg || undefined)}
        />
      ) : (
        <>
          <PdfUploader file={file} onReady={selectFile} onClear={resetDocument} />

          {!file && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => void loadSample()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2 text-xs font-semibold text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-200 transition-all shadow-xs"
              >
                <span>✨</span> Load sample test PDF template
              </button>
            </div>
          )}

          {file && <PdfViewer file={file} onRendered={handleRendered} />}
        </>
      )}

      {processing && (
        <div className="space-y-4 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 backdrop-blur-xl">
          <ValidationMessage tone="info">
            {activeTab === "api"
              ? "Fetching Fayda identity data and constructing print-ready landscape cards..."
              : "Source PDF verified. Extracting identity assets and reconstructing true landscape ID-1 cards..."}
          </ValidationMessage>
          <div className="relative h-24 w-full overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <div className="flex h-full items-center justify-center space-x-3">
              <div className="h-6 w-6 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
              <span className="text-xs sm:text-sm font-semibold text-blue-300 animate-pulse">
                Processing high-resolution card layout transformation...
              </span>
            </div>
          </div>
        </div>
      )}

      {error && <ValidationMessage tone="error">{error}</ValidationMessage>}

      {output && <PrintPreview pdf={output} />}
    </div>
  );
}

