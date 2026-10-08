export type UploadStatus = "idle" | "reading" | "validating" | "ready" | "error";

export interface ValidatedPdf {
  file: File;
  pageCount: number;
  size: number;
}
