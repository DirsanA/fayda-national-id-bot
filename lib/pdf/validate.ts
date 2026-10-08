import { PDFDocument } from "pdf-lib";

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export class PdfValidationError extends Error {}

function hasPdfExtension(file: File) {
  return /\.pdf$/i.test(file.name);
}

function hasPdfMimeType(file: File) {
  // Some browsers omit File.type for local files, so it is checked alongside—not instead of—the signature.
  return file.type === "" || file.type === "application/pdf" || file.type === "application/x-pdf";
}

export async function validatePdf(file: File): Promise<{ pageCount: number }> {
  if (!hasPdfExtension(file) || !hasPdfMimeType(file)) {
    throw new PdfValidationError("Select a PDF file (.pdf).")
  }

  if (file.size === 0) {
    throw new PdfValidationError("The selected PDF is empty.")
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new PdfValidationError("The PDF exceeds the 25 MB upload limit.")
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const pdfHeader = String.fromCharCode(...signature);
  if (pdfHeader !== "%PDF-") {
    throw new PdfValidationError("This file does not have a valid PDF signature.")
  }

  try {
    const source = await file.arrayBuffer();
    const document = await PDFDocument.load(source, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    const pageCount = document.getPageCount();

    if (pageCount !== 1) {
      throw new PdfValidationError("This version supports one-page source PDFs only.")
    }

    return { pageCount };
  } catch (error) {
    if (error instanceof PdfValidationError) throw error;
    throw new PdfValidationError("The PDF could not be read. It may be corrupted, encrypted, or unsupported.");
  }
}
