import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function createRedactedSamplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawText("REDACTED TRAINING DOCUMENT", { x: 48, y: 790, size: 16, font: bold, color: rgb(0.08, 0.18, 0.3) });
  page.drawText("Synthetic artwork only — no real identity data", { x: 48, y: 766, size: 10, font, color: rgb(0.28, 0.35, 0.43) });
  const x = 70; const y = 335; const width = 455; const height = 287;
  page.drawRectangle({ x, y, width, height, color: rgb(0.92, 0.98, 0.96), borderColor: rgb(0.04, 0.45, 0.35), borderWidth: 2 });
  page.drawRectangle({ x, y: y + height - 52, width, height: 52, color: rgb(0.04, 0.45, 0.35) });
  page.drawText("SAMPLE CARD ARTWORK", { x: x + 20, y: y + height - 33, size: 19, font: bold, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: x + 22, y: y + 70, width: 110, height: 125, color: rgb(0.76, 0.82, 0.84) });
  page.drawText("REDACTED", { x: x + 35, y: y + 127, size: 14, font: bold, color: rgb(0.2, 0.25, 0.3) });
  page.drawText("Sample Name", { x: x + 155, y: y + 179, size: 19, font: bold, color: rgb(0.05, 0.12, 0.17) });
  page.drawText("0000 0000 0000", { x: x + 155, y: y + 148, size: 15, font, color: rgb(0.1, 0.2, 0.25) });
  page.drawText("Synthetic / redacted card region", { x: x + 155, y: y + 119, size: 12, font, color: rgb(0.2, 0.3, 0.35) });
  page.drawText("For development and layout testing only", { x: x + 155, y: y + 95, size: 10, font, color: rgb(0.3, 0.38, 0.42) });
  page.drawText("Select the complete green-bordered region", { x: 70, y: 290, size: 11, font, color: rgb(0.28, 0.35, 0.43) });
  const bytes = await pdf.save();
  return new File([bytes], "redacted-training-sample.pdf", { type: "application/pdf" });
}
