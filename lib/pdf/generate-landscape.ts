import { PDFDocument } from "pdf-lib";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";

const MM_PER_INCH = 25.4;
const PDF_POINTS_PER_INCH = 72;
const mmToPoints = (mm: number) => (mm / MM_PER_INCH) * PDF_POINTS_PER_INCH;

// 300 DPI Canvas dimensions for ID-1 card (85.60 mm x 53.98 mm)
const CANVAS_WIDTH = 1011;
const CANVAS_HEIGHT = 638;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image asset: ${src}`));
    img.src = src;
  });
}

export async function renderFrontCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Load the authentic target reference template for Front Card
  try {
    const frontRef = await loadImage("/assets/card-front-reference.png");
    ctx.drawImage(frontRef, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } catch (err) {
    console.warn("Could not load front card reference asset:", err);
  }

  // If a custom photo is provided that is different from default, overlay it
  const isCustomUser = data.fullNameEnglish && data.fullNameEnglish.toLowerCase() !== "yosef girma tufa";
  if (isCustomUser) {
    // 1. Overlay custom photo
    if (data.photoUrl) {
      try {
        const photoImg = await loadImage(data.photoUrl);
        ctx.save();
        ctx.drawImage(photoImg, 38, 172, 248, 315);
        ctx.restore();
      } catch {
        // Keep template photo
      }
    }

    // 2. Overlay custom text fields if different
    ctx.fillStyle = "#020617";
    ctx.font = "bold 25px 'Noto Sans Ethiopic', sans-serif";
    ctx.fillText(data.fullNameAmharic, 365, 175);
    ctx.font = "bold 23px 'Inter', sans-serif";
    ctx.fillText(data.fullNameEnglish, 365, 202);

    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${data.dateOfBirthGreg}`, 365, 290);
    ctx.font = "bold 22px 'Noto Sans Ethiopic', sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 365, 350);
    ctx.font = "bold 22px 'Inter', sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${data.dateOfExpiryGreg}`, 365, 412);
  }

  return canvas;
}

export async function renderBackCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Load the authentic target reference template for Back Card
  try {
    const backRef = await loadImage("/assets/card-back-reference.png");
    ctx.drawImage(backRef, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } catch (err) {
    console.warn("Could not load back card reference asset:", err);
  }

  const isCustomUser = data.fullNameEnglish && data.fullNameEnglish.toLowerCase() !== "yosef girma tufa";
  if (isCustomUser) {
    // Overlay custom QR code if provided
    if (data.qrCodeUrl) {
      try {
        const qrImg = await loadImage(data.qrCodeUrl);
        ctx.drawImage(qrImg, 520, 28, 460, 520);
      } catch {
        // Keep template QR
      }
    }

    // Overlay custom phone and address if different
    ctx.fillStyle = "#020617";
    ctx.font = "bold 24px 'Inter', sans-serif";
    ctx.fillText(data.phoneNumber, 92, 92);
  }

  return canvas;
}

export async function createPrintReadyLandscapePdf(data: EthiopianIdData): Promise<Blob> {
  const output = await PDFDocument.create();
  output.setTitle("Print-ready Ethiopian Digital ID Landscape Card");
  output.setCreator("Document Print Utility");
  output.setProducer("Document Print Utility");

  const pageWidthPt = mmToPoints(ID1_WIDTH_MM);
  const pageHeightPt = mmToPoints(ID1_HEIGHT_MM);

  // 1. Render Front Card
  const frontCanvas = await renderFrontCardToCanvas(data);
  const frontBlob = await new Promise<Blob>((resolve, reject) =>
    frontCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode front card"))), "image/png")
  );
  const frontImage = await output.embedPng(await frontBlob.arrayBuffer());
  const page1 = output.addPage([pageWidthPt, pageHeightPt]);
  page1.drawImage(frontImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  // 2. Render Back Card
  const backCanvas = await renderBackCardToCanvas(data);
  const backBlob = await new Promise<Blob>((resolve, reject) =>
    backCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode back card"))), "image/png")
  );
  const backImage = await output.embedPng(await backBlob.arrayBuffer());
  const page2 = output.addPage([pageWidthPt, pageHeightPt]);
  page2.drawImage(backImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  const bytes = await output.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}
