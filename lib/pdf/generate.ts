import { PDFDocument } from "pdf-lib";

const MM_PER_INCH = 25.4;
const PDF_POINTS_PER_INCH = 72;

// Landscape ID-1 card dimensions (wider than tall)
const LANDSCAPE_WIDTH_MM = 85.6;
const LANDSCAPE_HEIGHT_MM = 53.98;

const mmToPoints = (mm: number) => (mm / MM_PER_INCH) * PDF_POINTS_PER_INCH;

const PAGE_W = mmToPoints(LANDSCAPE_WIDTH_MM); // ~242.65 pt
const PAGE_H = mmToPoints(LANDSCAPE_HEIGHT_MM); // ~153.07 pt

export async function createPrintReadyPdf(artwork: readonly Blob[]): Promise<Blob> {
  const output = await PDFDocument.create();
  output.setTitle("Print-ready card artwork");
  output.setCreator("Document Print Utility");
  output.setProducer("Document Print Utility");
  output.setCreationDate(new Date(0));
  output.setModificationDate(new Date(0));

  for (const imageBlob of artwork) {
    // Create a landscape page (width > height)
    const page = output.addPage([PAGE_W, PAGE_H]);
    const image = await output.embedPng(await imageBlob.arrayBuffer());

    // scaleToFit preserves aspect ratio; artwork is never stretched.
    // Portrait artwork will be fitted into the landscape page with margins on the sides.
    const placed = image.scaleToFit(page.getWidth(), page.getHeight());
    page.drawImage(image, {
      x: (page.getWidth() - placed.width) / 2,
      y: (page.getHeight() - placed.height) / 2,
      width: placed.width,
      height: placed.height,
    });
  }

  const bytes = await output.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}
