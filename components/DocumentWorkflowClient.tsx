"use client";

import dynamic from "next/dynamic";

// ssr: false prevents pdfjs-dist from being required on the server.
const DocumentWorkflow = dynamic(
  () => import("@/components/DocumentWorkflow").then((m) => m.DocumentWorkflow),
  {
    ssr: false,
    loading: () => (
      <p className="py-8 text-sm text-slate-500">Loading document workflow…</p>
    ),
  }
);

export function DocumentWorkflowClient() {
  return <DocumentWorkflow />;
}
