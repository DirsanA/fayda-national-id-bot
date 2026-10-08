"use client";

import { useCallback, useState } from "react";
import { extractIdDataFromPdf } from "@/lib/pdf/extract";
import { createPrintReadyLandscapePdf } from "@/lib/pdf/generate-landscape";
import { createRedactedSamplePdf } from "@/lib/pdf/sample";
import { validateConfiguredTemplate } from "@/lib/pdf/validate-template";
import type { RenderedPdf } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";
import { PdfUploader } from "./PdfUploader";
import { PdfViewer } from "./PdfViewer";
import { LandscapeCardFront } from "./LandscapeCardFront";
import { LandscapeCardBack } from "./LandscapeCardBack";
import { PrintPreview } from "./PrintPreview";
import { ValidationMessage } from "./ValidationMessage";

export function DocumentWorkflow() {
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
      <PdfUploader file={file} onReady={selectFile} onClear={resetDocument} />

      {!file && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadSample()}
            className="text-sm font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-900 transition-colors"
          >
            Load synthetic redacted template PDF for development
          </button>
        </div>
      )}

      {file && <PdfViewer file={file} onRendered={handleRendered} />}

      {processing && (
        <ValidationMessage tone="info">
          Source PDF verified. Extracting identity assets and reconstructing true landscape ID-1 cards...
        </ValidationMessage>
      )}

      {error && <ValidationMessage tone="error">{error}</ValidationMessage>}

      {/* Main Landscape Cards Result Display (B) */}
      {idData && (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-6"
          aria-label="True Landscape ID Card Output"
        >
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  Target B
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Official Landscape ID-1 Cards (Front &amp; Back)
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                True horizontal reflow with preserved image aspect ratios and un-rotated typography.
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                Physical Print Size: {ID1_WIDTH_MM.toFixed(2)} × {ID1_HEIGHT_MM.toFixed(2)} mm (ID-1)
              </span>
            </div>
          </div>

          {/* Side-by-side Landscape Card Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Front Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Front Card (ፊት)
                </span>
                <span className="text-[11px] text-slate-500">85.60 × 53.98 mm</span>
              </div>
              <LandscapeCardFront data={idData} className="w-full" />
            </div>

            {/* Back Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Back Card (ጀርባ)
                </span>
                <span className="text-[11px] text-slate-500">85.60 × 53.98 mm</span>
              </div>
              <LandscapeCardBack data={idData} className="w-full" />
            </div>
          </div>
        </section>
      )}

      {output && <PrintPreview pdf={output} />}
    </div>
  );
}
