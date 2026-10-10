"use client";

import { useCallback, useEffect, useState } from "react";
import { mapFaydaJsonResponseToIdData } from "@/lib/fayda-mapper";
import { createPrintReadyLandscapePdf } from "@/lib/pdf/generate-landscape";
import type { EthiopianIdData } from "@/types/id-card";

import { PrintPreview } from "./PrintPreview";
import { ValidationMessage } from "./ValidationMessage";
import { FaydaApiForm } from "./FaydaApiForm";

export function DocumentWorkflow() {
  const [mounted, setMounted] = useState(false);
  const [idData, setIdData] = useState<EthiopianIdData>();
  const [processing, setProcessing] = useState(false);
  const [output, setOutput] = useState<Blob>();
  const [error, setError] = useState<string>();


  useEffect(() => {
    setMounted(true);
  }, []);


  const resetDocument = useCallback(() => {
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


  if (!mounted) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FaydaApiForm
        onSuccess={(data) => void handleApiSuccess(data)}
        onError={(msg) => setError(msg || undefined)}
      />

      {processing && (
        <div className="space-y-4 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 backdrop-blur-xl">
          <ValidationMessage tone="info">
            Fetching Fayda identity data and constructing print-ready landscape cards...
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



