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

async function ensureFontsReady() {
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('24px "Noto Sans Ethiopic"'),
        document.fonts.load('bold 24px "Noto Sans Ethiopic"'),
        document.fonts.load('bold 22px "Inter"'),
      ]);
      await document.fonts.ready;
    } catch (e) {
      console.warn("Fonts ready check:", e);
    }
  }
}

function drawHighDensityGuilloche(ctx: CanvasRenderingContext2D) {
  // Base cyan-mint gradient
  const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  grad.addColorStop(0, "#C2F2E7");
  grad.addColorStop(0.5, "#D8F8F0");
  grad.addColorStop(1, "#BFEFE4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Central radiant golden starburst glow
  const glow = ctx.createRadialGradient(
    CANVAS_WIDTH * 0.49,
    CANVAS_HEIGHT * 0.46,
    20,
    CANVAS_WIDTH * 0.49,
    CANVAS_HEIGHT * 0.46,
    380
  );
  glow.addColorStop(0, "rgba(254, 240, 138, 0.85)");
  glow.addColorStop(0.35, "rgba(253, 230, 138, 0.5)");
  glow.addColorStop(0.7, "rgba(204, 251, 241, 0.15)");
  glow.addColorStop(1, "rgba(204, 251, 241, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Intricate Guilloche micro-waves
  ctx.save();
  ctx.lineWidth = 0.7;
  for (let y = 10; y < CANVAS_HEIGHT; y += 18) {
    ctx.strokeStyle = y % 36 === 0 ? "rgba(13, 148, 136, 0.4)" : "rgba(8, 145, 178, 0.3)";
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += 5) {
      const cy = y + Math.sin(x * 0.045) * 11 + Math.cos(x * 0.02) * 7;
      if (x === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x, cy);
    }
    ctx.stroke();
  }

  // Intersecting counter-phase waves
  ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
  ctx.lineWidth = 0.5;
  for (let y = 15; y < CANVAS_HEIGHT; y += 24) {
    ctx.beginPath();
    for (let x = 0; x <= CANVAS_WIDTH; x += 6) {
      const cy = y + Math.sin(x * 0.04 + Math.PI) * 9 + Math.cos(x * 0.025) * 5;
      if (x === 0) ctx.moveTo(x, cy);
      else ctx.lineTo(x, cy);
    }
    ctx.stroke();
  }

  // Interlocking 12-point star watermark in the center
  const scx = CANVAS_WIDTH * 0.49;
  const scy = CANVAS_HEIGHT * 0.46;
  ctx.strokeStyle = "rgba(202, 138, 4, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(scx, scy, 148, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(scx, scy, 132, 0, Math.PI * 2);
  ctx.stroke();

  const numPoints = 12;
  const outerR = 142;
  const innerR = 82;
  ctx.beginPath();
  for (let i = 0; i < numPoints * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / numPoints - Math.PI / 2;
    const x = scx + Math.cos(a) * r;
    const y = scy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Bottom yellow security ribbon
  ctx.fillStyle = "rgba(253, 224, 71, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, CANVAS_HEIGHT - 35);
  ctx.bezierCurveTo(250, CANVAS_HEIGHT - 65, 500, CANVAS_HEIGHT - 10, CANVAS_WIDTH, CANVAS_HEIGHT - 35);
  ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.lineTo(0, CANVAS_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawNationalIdEmblemVector(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  // Deep blue circle
  ctx.fillStyle = "#104E70";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner sky-blue ring
  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  // White flight / dove motif
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#38BDF8";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFlagVector(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const stripeH = h / 3;
  ctx.fillStyle = "#078930";
  ctx.fillRect(x, y, w, stripeH);
  ctx.fillStyle = "#FCD116";
  ctx.fillRect(x, y + stripeH, w, stripeH);
  ctx.fillStyle = "#DA121A";
  ctx.fillRect(x, y + stripeH * 2, w, stripeH);

  // Center blue disc
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = stripeH * 0.85;
  ctx.fillStyle = "#0F47AF";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Golden star
  ctx.fillStyle = "#FCD116";
  ctx.font = `bold ${Math.round(r * 1.4)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("★", cx, cy);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export async function renderFrontCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  drawHighDensityGuilloche(ctx);

  // 1. Top Header: Vector Flag (zero sticker background)
  drawFlagVector(ctx, 35, 24, 78, 48);

  // Header Titles
  ctx.fillStyle = "#020617";
  ctx.font = "bold 25px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የኢትዮጵያ ዲጂታል መታወቂያ ካርድ", 125, 46);

  ctx.fillStyle = "#083344";
  ctx.font = "900 23px 'Inter', sans-serif";
  ctx.fillText("Ethiopian Digital ID Card", 125, 71);

  // Right Official National ID Logo (pure vector emblem + text, zero background box)
  drawNationalIdEmblemVector(ctx, CANVAS_WIDTH - 65, 48, 24);
  ctx.fillStyle = "#104E70";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ብሔራዊ መታወቂያ", CANVAS_WIDTH - 192, 42);
  ctx.font = "900 17px 'Inter', sans-serif";
  ctx.fillText("National ID", CANVAS_WIDTH - 192, 64);

  // 2. Left vertical Date of Issue text
  ctx.save();
  ctx.translate(28, CANVAS_HEIGHT - 170);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#0D9488";
  ctx.font = "bold 13px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(`የተሰጠበት ቀን : ${data.dateOfIssueEth}    Date of Issue : ${data.dateOfIssueGreg}`, 0, 0);
  ctx.restore();

  // 3. Portrait Photo
  if (data.photoUrl) {
    try {
      const photoImg = await loadImage(data.photoUrl);
      ctx.save();
      ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(48, 92, 215, 270);
      ctx.drawImage(photoImg, 48, 92, 215, 270);
      ctx.restore();
    } catch {
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(48, 92, 215, 270);
    }
  }

  // 4. Center Demographic Fields
  const textX = 295;
  let textY = 120;

  // Full Name
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ሙሉ ስም | Full Name", textX, textY);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 25px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.fullNameAmharic, textX, textY + 28);
  ctx.font = "bold 23px 'Inter', sans-serif";
  ctx.fillText(data.fullNameEnglish, textX, textY + 54);

  // Date of Birth
  textY += 84;
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የትውልድ ቀን | Date of Birth", textX, textY);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 22px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfBirthEth} | ${data.dateOfBirthGreg}`, textX, textY + 26);

  // Sex
  textY += 60;
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ፆታ | Sex", textX, textY);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 22px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, textX, textY + 26);

  // Date of Expiry
  textY += 60;
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የሚያበቃበት ቀን | Date of Expiry", textX, textY);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 22px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfExpiryEth} | ${data.dateOfExpiryGreg}`, textX, textY + 26);

  // 5. FAN Barcode Section (Matching Image 3 Target)
  const barcodeX = 135;
  const barcodeY = CANVAS_HEIGHT - 105;
  const barcodeW = 430;
  const barcodeH = 78;

  // Stacked FAN label on left
  ctx.fillStyle = "#059669";
  ctx.font = "bold 13px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ካርድ", barcodeX - 55, barcodeY + 22);
  ctx.fillText("ቁጥር", barcodeX - 55, barcodeY + 42);
  ctx.font = "900 14px 'Inter', sans-serif";
  ctx.fillText("FAN", barcodeX - 55, barcodeY + 62);

  // Single Clean White Barcode Box
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(barcodeX, barcodeY, barcodeW, barcodeH);
  ctx.strokeRect(barcodeX, barcodeY, barcodeW, barcodeH);

  // Digits on top of the box
  ctx.fillStyle = "#020617";
  ctx.font = "900 23px 'Inter', monospace";
  ctx.textAlign = "center";
  ctx.fillText(data.fanNumber, barcodeX + barcodeW / 2, barcodeY + 26);
  ctx.textAlign = "left";

  // Crisp 1D Barcode bars inside the white box
  const digits = data.fanNumber.replace(/\s+/g, "");
  let barX = barcodeX + 16;
  const barY = barcodeY + 34;
  const barH = 38;
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10) || 0;
    const w1 = (d % 3) + 2;
    const w2 = ((d + 1) % 2) + 2;
    const w3 = ((d + 2) % 3) + 2;
    ctx.fillStyle = "#020617";
    ctx.fillRect(barX, barY, w1, barH);
    barX += w1 + w2;
    ctx.fillRect(barX, barY, w3, barH);
    barX += w3 + 2;
  }

  // 6. Transparent "ፋ ይ ዳ" Logomark (Zero background box)
  try {
    const faydaImg = await loadImage("/assets/fayda-transparent.png");
    ctx.drawImage(faydaImg, 620, CANVAS_HEIGHT - 105, 140, 75);
  } catch {
    ctx.fillStyle = "#B45309";
    ctx.font = "bold 65px 'Noto Sans Ethiopic', sans-serif";
    ctx.fillText("ፋ ይ ዳ", 630, CANVAS_HEIGHT - 45);
  }

  // 7. Ghost Photo on far bottom right
  if (data.photoUrl) {
    try {
      const photoImg = await loadImage(data.photoUrl);
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(CANVAS_WIDTH - 120, CANVAS_HEIGHT - 120, 76, 96);
      ctx.drawImage(photoImg, CANVAS_WIDTH - 120, CANVAS_HEIGHT - 120, 76, 96);
      ctx.restore();
    } catch {
      // Ignore
    }
  }

  return canvas;
}

export async function renderBackCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  await ensureFontsReady();

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  drawHighDensityGuilloche(ctx);

  const leftX = 45;
  let curY = 44;

  // Phone Number
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ስልክ | Phone Number", leftX, curY);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 24px 'Inter', sans-serif";
  ctx.fillText(data.phoneNumber, leftX, curY + 28);

  // Nationality
  curY += 66;
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ዜግነት | Nationality", leftX, curY);
  ctx.font = "bold 12px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("(በተጠቃሚው መልስ | Self Declared)", leftX, curY + 18);
  ctx.fillStyle = "#020617";
  ctx.font = "bold 23px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(`${data.nationalityAmharic}   |   ${data.nationalityEnglish}`, leftX, curY + 44);

  // Address
  curY += 76;
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 15px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("አድራሻ | Address", leftX, curY);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.regionAmharic, leftX, curY + 26);
  ctx.font = "600 20px 'Inter', sans-serif";
  ctx.fillText(data.regionEnglish, leftX, curY + 50);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.subcityAmharic, leftX, curY + 76);
  ctx.font = "600 20px 'Inter', sans-serif";
  ctx.fillText(data.subcityEnglish, leftX, curY + 100);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.woredaAmharic, leftX, curY + 126);
  ctx.font = "600 20px 'Inter', sans-serif";
  ctx.fillText(data.woredaEnglish, leftX, curY + 150);

  // FIN badge box
  curY += 175;
  ctx.fillStyle = "#0D9488";
  ctx.font = "bold 12px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ፋይዳ", leftX, curY - 10);
  ctx.fillText("ልዩ ቁጥር", leftX, curY + 6);

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(leftX + 75, curY - 24, 280, 38);
  ctx.strokeRect(leftX + 75, curY - 24, 280, 38);

  ctx.fillStyle = "#020617";
  ctx.font = "900 21px 'Inter', monospace";
  ctx.fillText(`FIN  ${data.finNumber}`, leftX + 90, curY + 3);

  // Right Column: Massive High-Res QR Code filling the right side
  const qrBoxX = 515;
  const qrBoxY = 25;
  const qrBoxSize = 455;

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

  const qrSrc = data.qrCodeUrl || "/assets/target-qr.png";
  try {
    const qrImg = await loadImage(qrSrc);
    ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
  } catch {
    ctx.fillStyle = "#020617";
    ctx.fillRect(qrBoxX + 20, qrBoxY + 20, qrBoxSize - 40, qrBoxSize - 40);
  }

  // Footer separator line
  ctx.strokeStyle = "rgba(13, 148, 136, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(35, CANVAS_HEIGHT - 65);
  ctx.lineTo(CANVAS_WIDTH - 35, CANVAS_HEIGHT - 65);
  ctx.stroke();

  // Disclaimer text
  ctx.fillStyle = "#334155";
  ctx.font = "12px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(
    "ይህ መታወቂያ የጠፋ ካገኙ በቅርብዎ ያለ ፖሊስ ጣቢያ ወይም ለተቋሙ ያስረክቡ። ለተጨማሪ መረጃ 9779 ላይ ይደውሉ ወይም id.et/cardprint ይጎብኙ።",
    38,
    CANVAS_HEIGHT - 45
  );
  ctx.font = "11px 'Inter', sans-serif";
  ctx.fillText(
    "If lost and found, please return to nearby police station or to the institution. Call 9779 or visit id.et/cardprint for more.",
    38,
    CANVAS_HEIGHT - 28
  );

  // SN Badge on bottom right
  const snW = 160;
  const snH = 32;
  const snX = CANVAS_WIDTH - snW - 35;
  const snY = CANVAS_HEIGHT - 54;

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.5;
  ctx.fillRect(snX, snY, snW, snH);
  ctx.strokeRect(snX, snY, snW, snH);

  ctx.font = "bold 15px 'Inter', sans-serif";
  ctx.fillStyle = "#B91C1C";
  ctx.fillText("SN:", snX + 10, snY + 22);
  ctx.fillStyle = "#0F172A";
  ctx.fillText(data.serialNumber, snX + 44, snY + 22);

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
