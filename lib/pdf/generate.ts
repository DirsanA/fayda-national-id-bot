import { PDFDocument } from "pdf-lib";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";

const MM_PER_INCH = 25.4;
const PDF_POINTS_PER_INCH = 72;

const mmToPoints = (millimetres: number) => (millimetres / MM_PER_INCH) * PDF_POINTS_PER_INCH;

export async function createPrintReadyPdf(artwork: Blob): Promise<Blob> {
  const output = await PDFDocument.create();
  output.setTitle("Print-ready card artwork");
  output.setCreator("Document Print Utility");
  output.setProducer("Document Print Utility");
  output.setCreationDate(new Date(0));
  output.setModificationDate(new Date(0));

  const page = output.addPage([mmToPoints(ID1_WIDTH_MM), mmToPoints(ID1_HEIGHT_MM)]);
  const image = await output.embedPng(await artwork.arrayBuffer());
  // scaleToFit preserves every source pixel's aspect ratio; artwork is never stretched.
  const placed = image.scaleToFit(page.getWidth(), page.getHeight());
  page.drawImage(image, {
    x: (page.getWidth() - placed.width) / 2,
    y: (page.getHeight() - placed.height) / 2,
    width: placed.width,
    height: placed.height,
  });
  return new Blob([await output.save()], { type: "application/pdf" });
}
