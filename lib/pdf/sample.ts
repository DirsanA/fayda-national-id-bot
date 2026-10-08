import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { REDACTED_TEMPLATE, type TemplateRegion } from "./template-config";

function drawSampleRegion(page: PDFPage, region: TemplateRegion, font: PDFFont, bold: PDFFont) {
  const pageHeight = REDACTED_TEMPLATE.page.height;
  const y = pageHeight - region.y - region.height;
  const { x, width, height } = region;
  const headerGreen = rgb(10 / 255, 115 / 255, 89 / 255);
  page.drawRectangle({ x, y, width, height, color: rgb(0.92, 0.98, 0.96), borderColor: headerGreen, borderWidth: 1.5 });
  page.drawRectangle({ x, y: y + height - 30, width, height: 30, color: headerGreen });
  page.drawText(`${region.id.toUpperCase()}`, { x: x + 10, y: y + height - 20, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: x + 10, y: y + 40, width: width - 20, height: height - 80, color: rgb(0.76, 0.82, 0.84) });
  page.drawText("REDACTED", { x: x + 25, y: y + (height / 2), size: 14, font: bold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText("Synthetic artwork region", { x: x + 10, y: y + 15, size: 8, font, color: rgb(0.3, 0.38, 0.42) });
}

export async function createRedactedSamplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([REDACTED_TEMPLATE.page.width, REDACTED_TEMPLATE.page.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("REDACTED TRAINING DOCUMENT", { x: 48, y: 800, size: 14, font: bold, color: rgb(0.08, 0.18, 0.3) });
  page.drawText("Synthetic artwork only - no real identity data", { x: 48, y: 782, size: 9, font, color: rgb(0.28, 0.35, 0.43) });
  for (const region of REDACTED_TEMPLATE.regions) drawSampleRegion(page, region, font, bold);
  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], "redacted-training-template.pdf", { type: "application/pdf" });
}
