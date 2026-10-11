import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { REDACTED_TEMPLATE, type TemplateRegion } from "./template-config";

function drawSampleRegion(page: PDFPage, region: TemplateRegion, font: PDFFont, bold: PDFFont) {
  const pageHeight = REDACTED_TEMPLATE.page.height;
  const y = pageHeight - region.y - region.height;
  const { x, width, height } = region;
  const headerGreen = rgb(10 / 255, 115 / 255, 89 / 255);

  // Card outline
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(0.92, 0.98, 0.96),
    borderColor: headerGreen,
    borderWidth: 1.5,
  });

  // Top header banner
  page.drawRectangle({
    x,
    y: y + height - 25,
    width,
    height: 25,
    color: headerGreen,
  });

  page.drawText(
    region.id === "front" ? "ETHIOPIAN DIGITAL ID CARD" : "FAYDA DIGITAL BACK",
    {
      x: x + 8,
      y: y + height - 17,
      size: 7.5,
      font: bold,
      color: rgb(1, 1, 1),
    }
  );

  if (region.id === "front") {
    // Front portrait photo
    page.drawRectangle({
      x: x + 32,
      y: y + height - 115,
      width: 86,
      height: 85,
      color: rgb(0.72, 0.82, 0.86),
      borderColor: rgb(0.3, 0.5, 0.6),
      borderWidth: 1,
    });
    page.drawText("PHOTO", {
      x: x + 58,
      y: y + height - 75,
      size: 11,
      font: bold,
      color: rgb(0.2, 0.3, 0.4),
    });

    // Name & Details
    page.drawText("Yosef Girma Tufa", { x: x + 25, y: y + 95, size: 9, font: bold, color: rgb(0.05, 0.1, 0.15) });
    page.drawText("DOB: 02/04/1994 | 02/Jan/2002", { x: x + 12, y: y + 80, size: 7.5, font, color: rgb(0.1, 0.2, 0.25) });
    page.drawText("SEX: Male | Male", { x: x + 12, y: y + 68, size: 7.5, font, color: rgb(0.1, 0.2, 0.25) });
    page.drawText("EXP: 2027/01/13 | 2034/Sep/23", { x: x + 12, y: y + 56, size: 7.5, font, color: rgb(0.1, 0.2, 0.25) });

    // Barcode box at bottom
    page.drawRectangle({
      x: x + 12,
      y: y + 15,
      width: width - 24,
      height: 26,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.7, 0.75, 0.8),
      borderWidth: 1,
    });
    page.drawText("8029 5016 4312 4539", { x: x + 24, y: y + 30, size: 7.5, font: bold, color: rgb(0.1, 0.15, 0.2) });
    page.drawRectangle({ x: x + 20, y: y + 18, width: width - 40, height: 9, color: rgb(0.15, 0.15, 0.15) });
  } else {
    // Back card: QR Code on upper half
    page.drawRectangle({
      x: x + 22,
      y: y + height - 120,
      width: 105,
      height: 90,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.6, 0.65, 0.7),
      borderWidth: 1,
    });
    page.drawText("QR CODE", {
      x: x + 50,
      y: y + height - 78,
      size: 11,
      font: bold,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Details below QR
    page.drawText("Phone: 0917521765", { x: x + 15, y: y + 90, size: 8, font: bold, color: rgb(0.1, 0.15, 0.2) });
    page.drawText("Nationality: Ethiopian", { x: x + 15, y: y + 76, size: 7.5, font, color: rgb(0.15, 0.2, 0.25) });
    page.drawText("Address: Oromia, Ambo, Yahi Geda", { x: x + 15, y: y + 62, size: 7, font, color: rgb(0.2, 0.25, 0.3) });
    page.drawText("FIN: 214270390587", { x: x + 15, y: y + 38, size: 8.5, font: bold, color: rgb(0.05, 0.1, 0.2) });
    page.drawText("SN: 65501482", { x: x + 15, y: y + 18, size: 7, font, color: rgb(0.3, 0.35, 0.4) });
  }
}

export async function createRedactedSamplePdf(): Promise<File> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([REDACTED_TEMPLATE.page.width, REDACTED_TEMPLATE.page.height]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Demographic panel on the left
  page.drawText("ETHIOPIAN DIGITAL ID CARD", { x: 48, y: 800, size: 14, font: bold, color: rgb(0.08, 0.18, 0.3) });
  page.drawText("Demographic Data | Yosef Girma Tufa", { x: 48, y: 782, size: 9, font, color: rgb(0.28, 0.35, 0.43) });

  // Photo box on left
  page.drawRectangle({
    x: 65,
    y: 620,
    width: 100,
    height: 110,
    color: rgb(0.75, 0.83, 0.87),
    borderColor: rgb(0.4, 0.55, 0.65),
    borderWidth: 1.5,
  });
  page.drawText("PORTRAIT PHOTO", { x: 75, y: 670, size: 9, font: bold, color: rgb(0.15, 0.25, 0.35) });

  // Left demographics text
  page.drawText("Name: Yosef Girma Tufa", { x: 180, y: 710, size: 10, font: bold, color: rgb(0.05, 0.1, 0.15) });
  page.drawText("FCN: 8029 5016 4312 4539", { x: 180, y: 692, size: 9, font, color: rgb(0.1, 0.2, 0.25) });
  page.drawText("DOB: 02/04/1994 | 02/01/2002", { x: 180, y: 676, size: 8.5, font, color: rgb(0.15, 0.25, 0.3) });
  page.drawText("SEX: Male", { x: 180, y: 660, size: 8.5, font, color: rgb(0.15, 0.25, 0.3) });
  page.drawText("Phone: 0917521765", { x: 180, y: 644, size: 8.5, font, color: rgb(0.15, 0.25, 0.3) });
  page.drawText("UIN: 214270390587", { x: 180, y: 628, size: 8.5, font, color: rgb(0.15, 0.25, 0.3) });

  // Large QR code box on lower left
  page.drawRectangle({
    x: 100,
    y: 340,
    width: 180,
    height: 180,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.3, 0.35, 0.4),
    borderWidth: 1.5,
  });
  page.drawText("VERIFICATION QR CODE", { x: 130, y: 425, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });

  // Two vertical cards on the right
  for (const region of REDACTED_TEMPLATE.regions) {
    drawSampleRegion(page, region, font, bold);
  }

  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], "ethiopian-digital-id-sample.pdf", { type: "application/pdf" });
}
