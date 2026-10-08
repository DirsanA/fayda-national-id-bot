import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { REDACTED_TEMPLATE, type TemplateRegion } from "./template-config";

function drawSampleRegion(page: PDFPage, region: TemplateRegion, font: PDFFont, bold: PDFFont) {
  const pageHeight = REDACTED_TEMPLATE.page.height;
  // pdf-lib uses a bottom-left origin. This is deliberately converted from the shared top-left config.
  const y = pageHeight - region.y - region.height;
  const { x, width, height } = region;
  const headerGreen = rgb(10 / 255, 115 / 255, 89 / 255);
  page.drawRectangle({ x, y, width, height, color: rgb(0.92, 0.98, 0.96), borderColor: headerGreen, borderWidth: 2 });
  page.drawRectangle({ x, y: y + height - 52, width, height: 52, color: headerGreen });
  page.drawText(`SAMPLE ${region.id.toUpperCase()} ARTWORK`, { x: x + 20, y: y + height - 33, size: 19, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: x + 22, y: y + 70, width: 110, height: 125, color: rgb(0.76, 0.82, 0.84) });
  page.drawText("REDACTED", { x: x + 35, y: y + 127, size: 14, font: bold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText(region.id === "front" ? "Sample Name" : "Sample details", { x: x + 155, y: y + 179, size: 19, font: bold, color: rgb(0.05, 0.12, 0.17) });
  page.drawText(region.id === "front" ? "0000 0000 0000" : "Synthetic reverse artwork", { x: x + 155, y: y + 148, size: 15, font, color: rgb(0.1, 0.2, 0.25) });
  page.drawText("Synthetic / redacted card region", { x: x + 155, y: y + 119, size: 12, font, color: rgb(0.2, 0.3, 0.35) });
  page.drawText("For development and layout testing only", { x: x + 155, y: y + 95, size: 10, font, color: rgb(0.3, 0.38, 0.42) });
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
