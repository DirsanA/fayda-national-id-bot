import { PDFDocument } from "pdf-lib";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";
import { removePhotoBackground } from "@/lib/pdf/extract";

const MM_PER_INCH = 25.4;
const PDF_POINTS_PER_INCH = 72;
const mmToPoints = (mm: number) => (mm / MM_PER_INCH) * PDF_POINTS_PER_INCH;

// Native 300 DPI Canvas dimensions for ID-1 card (85.60 mm x 53.98 mm)
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

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawGuillocheBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // 1. Base mint-green gradient
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, "#C2F2E7");
  grad.addColorStop(0.5, "#D8F8F0");
  grad.addColorStop(1, "#BFEFE4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // 2. Central warm golden starburst glow
  const radial = ctx.createRadialGradient(
    width * 0.52,
    height * 0.48,
    30,
    width * 0.52,
    height * 0.48,
    width * 0.45
  );
  radial.addColorStop(0, "rgba(254, 240, 138, 0.75)");
  radial.addColorStop(0.35, "rgba(253, 230, 138, 0.4)");
  radial.addColorStop(0.7, "rgba(204, 251, 241, 0.15)");
  radial.addColorStop(1, "transparent");
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  // 3. Dense Guilloche micro-waves
  ctx.save();
  ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
  ctx.lineWidth = 0.8;
  for (let y = -20; y < height + 40; y += 14) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.sin(x * 0.04) * 8 + Math.cos((x + y) * 0.02) * 5;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(8, 145, 178, 0.2)";
  ctx.lineWidth = 0.6;
  for (let y = -10; y < height + 40; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 10) {
      const wave = Math.cos(x * 0.035) * 7 - Math.sin((x - y) * 0.025) * 6;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 4. Seal of Solomon 12-point star watermark in center-right
  ctx.save();
  ctx.translate(width * 0.56, height * 0.48);
  ctx.strokeStyle = "rgba(202, 138, 4, 0.35)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 105, 0, Math.PI * 2);
  ctx.stroke();

  // 12-point star lines
  for (let i = 0; i < 12; i++) {
    const angle1 = (i * Math.PI) / 6;
    const angle2 = ((i + 4) * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle1) * 115, Math.sin(angle1) * 115);
    ctx.lineTo(Math.cos(angle2) * 115, Math.sin(angle2) * 115);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEthiopianFlag(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, 6);
  ctx.clip();

  const stripeH = h / 3;
  // Green
  ctx.fillStyle = "#009A44";
  ctx.fillRect(x, y, w, stripeH);
  // Yellow
  ctx.fillStyle = "#FED100";
  ctx.fillRect(x, y + stripeH, w, stripeH);
  // Red
  ctx.fillStyle = "#EF3340";
  ctx.fillRect(x, y + stripeH * 2, w, stripeH);

  // Blue central emblem disc
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = stripeH * 0.85;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#0F47AF";
  ctx.fill();

  // Yellow central star
  ctx.fillStyle = "#FED100";
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a1 + Math.PI / 5;
    const r1 = r * 0.75;
    const r2 = r * 0.35;
    if (i === 0) ctx.moveTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    else ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    ctx.lineTo(cx + Math.cos(a2) * r2, cy + Math.sin(a2) * r2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCode128Barcode(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const digits = value.replace(/\s+/g, "");
  const bars: { width: number; isBlack: boolean }[] = [];

  bars.push({ width: 3, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10) || 0;
    const w1 = (d % 3) + 1;
    const w2 = ((d + 1) % 2) + 1;
    const w3 = ((d + 2) % 3) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: w2, isBlack: false });
    bars.push({ width: w3, isBlack: true });
    bars.push({ width: 1, isBlack: false });
  }

  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 3, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 3, isBlack: false });

  let totalUnitWidth = 0;
  bars.forEach((b) => (totalUnitWidth += b.width));

  const scale = width / totalUnitWidth;
  let currX = x;

  ctx.fillStyle = "#020617";
  bars.forEach((b) => {
    const barW = b.width * scale;
    if (b.isBlack) {
      ctx.fillRect(currX, y, barW, height);
    }
    currX += barW;
  });
}

export function formatGregorianDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/[a-zA-Z]/.test(dateStr)) return dateStr;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Pattern DD/MM/YYYY
  const dmy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const monthIdx = parseInt(dmy[2], 10) - 1;
    const year = dmy[3];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}/${MONTHS[monthIdx]}/${year}`;
    }
  }

  // Pattern YYYY/MM/DD
  const ymd = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymd) {
    const year = ymd[1];
    const monthIdx = parseInt(ymd[2], 10) - 1;
    const day = ymd[3].padStart(2, "0");
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${year}/${MONTHS[monthIdx]}/${day}`;
    }
  }

  return dateStr;
}

export async function renderFrontCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Draw authentic high-resolution pristine blank template background
  try {
    const templateImg = await loadImage("/assets/card-front-template.png");
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } catch (err) {
    console.warn("Could not load front template:", err);
  }

  // 2. Primary Portrait Photo without background (fits photo slot perfectly: x: 73, y: 138, w: 302, h: 430)
  if (data.photoUrl) {
    try {
      const cleanPhotoUrl = await removePhotoBackground(data.photoUrl);
      const photoImg = await loadImage(cleanPhotoUrl);
      ctx.save();
      drawRoundedRect(ctx, 73, 138, 302, 430, 10);
      ctx.clip();
      ctx.drawImage(photoImg, 73, 138, 302, 430);
      ctx.restore();
    } catch {
      // Photo error fallback
    }
  }

  // 3. Extracted demographic text positioned with exact pixel accuracy
  ctx.fillStyle = "#020617";
  ctx.font = "bold 26px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.fullNameAmharic, 418, 207);

  ctx.font = "bold 24px 'Inter', sans-serif";
  ctx.fillText(data.fullNameEnglish, 418, 250);

  const dobGregFormatted = formatGregorianDate(data.dateOfBirthGreg);
  ctx.font = "bold 23px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 334);

  ctx.font = "bold 23px 'Noto Sans Ethiopic', 'Inter', sans-serif";
  ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 405);

  const expiryGregFormatted = formatGregorianDate(data.dateOfExpiryGreg);
  ctx.font = "bold 23px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 468);

  // 4. White Barcode Container with extracted FAN and Code128 bars
  const barcodeBoxX = 456;
  const barcodeBoxY = 496;
  const barcodeBoxW = 328;
  const barcodeBoxH = 96;

  ctx.fillStyle = "#020617";
  ctx.font = "900 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
  ctx.textAlign = "left";

  drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 34, barcodeBoxW - 20, 52);

  // 5. Ghost Photo on bottom right (fits ghost slot below Fayda watermark: x: 830, y: 460, w: 113, h: 134)
  if (data.photoUrl) {
    try {
      const cleanPhotoUrl = await removePhotoBackground(data.photoUrl);
      const ghostImg = await loadImage(cleanPhotoUrl);
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawRoundedRect(ctx, 830, 460, 113, 134, 8);
      ctx.clip();
      ctx.drawImage(ghostImg, 830, 460, 113, 134);
      ctx.restore();
    } catch {
      // Ghost fallback
    }
  }

  // 6. Dynamic Vertical Issue Date on Left Margin
  ctx.save();
  ctx.translate(38, 605);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "bold 14px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillStyle = "#C68932";
  ctx.fillText("የተሰጠበት ቀን: ", 0, 0);
  const w1 = ctx.measureText("የተሰጠበት ቀን: ").width;

  ctx.fillStyle = "#020617";
  ctx.font = "bold 14px 'Inter', sans-serif";
  ctx.fillText(data.dateOfIssueEth, w1, 0);
  const w2 = w1 + ctx.measureText(data.dateOfIssueEth).width;

  ctx.fillStyle = "#C68932";
  ctx.font = "bold 14px 'Inter', sans-serif";
  ctx.fillText("   Date of Issue: ", w2, 0);
  const w3 = w2 + ctx.measureText("   Date of Issue: ").width;

  ctx.fillStyle = "#020617";
  ctx.fillText(formatGregorianDate(data.dateOfIssueGreg), w3, 0);
  ctx.restore();

  return canvas;
}

export async function renderBackCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Draw authentic high-resolution pristine blank template background
  try {
    const templateImg = await loadImage("/assets/card-back-template.png");
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } catch (err) {
    console.warn("Could not load back template:", err);
  }

  // 2. Draw extracted text on Left
  ctx.fillStyle = "#020617";
  ctx.font = "bold 25px 'Inter', sans-serif";
  ctx.fillText(data.phoneNumber, 40, 110);

  ctx.font = "bold 23px 'Noto Sans Ethiopic', 'Inter', sans-serif";
  ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 40, 194);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.regionAmharic, 40, 258);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.regionEnglish, 40, 293);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.subcityAmharic, 40, 330);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.subcityEnglish, 40, 359);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.woredaAmharic, 40, 395);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.woredaEnglish, 40, 430);

  // 3. Draw FIN digits inside the bottom-left white FIN box
  ctx.fillStyle = "#020617";
  ctx.font = "900 22px 'Inter', monospace";
  ctx.fillText(`FIN  ${data.finNumber}`, 104, 546);

  // 4. Draw SN inside the bottom-right white SN badge
  ctx.fillStyle = "#020617";
  ctx.font = "900 19px 'Inter', monospace";
  ctx.fillText(data.serialNumber || "65501482", 835, 597);

  // 5. Draw QR code cleanly inside the white QR container (square 490x490)
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  try {
    const qrImg = await loadImage(qrSource);
    ctx.drawImage(qrImg, 462, 47, 490, 490);
  } catch {
    // QR fallback
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

  // 1. Render Front Card dynamically from extracted data
  const frontCanvas = await renderFrontCardToCanvas(data);
  const frontBlob = await new Promise<Blob>((resolve, reject) =>
    frontCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode front card"))), "image/png")
  );
  const frontBytes = await frontBlob.arrayBuffer();
  const frontImage = await output.embedPng(frontBytes);

  const page1 = output.addPage([pageWidthPt, pageHeightPt]);
  page1.drawImage(frontImage, {
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
  });

  // 2. Render Back Card dynamically from extracted data
  const backCanvas = await renderBackCardToCanvas(data);
  const backBlob = await new Promise<Blob>((resolve, reject) =>
    backCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to encode back card"))), "image/png")
  );
  const backBytes = await backBlob.arrayBuffer();
  const backImage = await output.embedPng(backBytes);

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
