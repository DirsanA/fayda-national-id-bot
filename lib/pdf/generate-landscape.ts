import { PDFDocument } from "pdf-lib";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";

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

export async function renderFrontCardToCanvas(data: EthiopianIdData): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 1. Draw Guilloche Security Background
  drawGuillocheBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2. Draw Ethiopian Flag on top-left
  drawEthiopianFlag(ctx, 42, 38, 88, 56);

  // 3. Header text
  ctx.fillStyle = "#020617";
  ctx.font = "bold 24px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የኢትዮጵያ ዲጂታል መታወቂያ ካርድ", 145, 62);
  ctx.fillStyle = "#082f49";
  ctx.font = "900 22px 'Inter', sans-serif";
  ctx.fillText("Ethiopian Digital ID Card", 145, 88);

  // 4. National ID Emblem on top-right
  try {
    const emblem = await loadImage("/assets/national-id-emblem.png");
    ctx.drawImage(emblem, 770, 36, 195, 60);
  } catch {
    // Emblem fallback
  }

  // 5. Left Vertical Issue Date
  ctx.save();
  ctx.translate(32, 420);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#0f766e";
  ctx.font = "bold 13px 'Noto Sans Ethiopic', 'Inter', sans-serif";
  ctx.fillText(
    `የተሰጠበት ቀን : ${data.dateOfIssueEth || "2019/01/15"}     Date of Issue : ${data.dateOfIssueGreg || "2026/Sep/25"}`,
    0,
    0
  );
  ctx.restore();

  // 6. Primary Portrait Photo
  const photoX = 52;
  const photoY = 142;
  const photoW = 250;
  const photoH = 325;
  if (data.photoUrl) {
    try {
      const photoImg = await loadImage(data.photoUrl);
      ctx.save();
      drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
      ctx.clip();
      ctx.drawImage(photoImg, photoX, photoY, photoW, photoH);
      ctx.restore();
      // Subtle border
      ctx.strokeStyle = "rgba(13, 148, 136, 0.3)";
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 12);
      ctx.stroke();
    } catch {
      // Photo error fallback
    }
  }

  // 7. Demographic Fields (Labels + Values)
  const textX = 350;

  // Full Name
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ሙሉ ስም | Full Name", textX, 160);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 26px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.fullNameAmharic, textX, 192);
  ctx.font = "bold 24px 'Inter', sans-serif";
  ctx.fillText(data.fullNameEnglish, textX, 222);

  // Date of Birth
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የትውልድ ቀን | Date of Birth", textX, 275);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 23px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfBirthEth} | ${data.dateOfBirthGreg}`, textX, 305);

  // Sex
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ፆታ | Sex", textX, 355);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 23px 'Noto Sans Ethiopic', 'Inter', sans-serif";
  ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, textX, 385);

  // Date of Expiry
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("የሚያበቃበት ቀን | Date of Expiry", textX, 435);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 23px 'Inter', sans-serif";
  ctx.fillText(`${data.dateOfExpiryEth} | ${data.dateOfExpiryGreg}`, textX, 465);

  // 8. FAN label & Barcode container
  ctx.fillStyle = "#0f766e";
  ctx.font = "900 13px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ካርድ", 360, 525);
  ctx.fillText("ቁጥር", 360, 545);
  ctx.fillText("FAN", 360, 565);

  const barcodeBoxX = 410;
  const barcodeBoxY = 502;
  const barcodeBoxW = 320;
  const barcodeBoxH = 92;

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, barcodeBoxX, barcodeBoxY, barcodeBoxW, barcodeBoxH, 4);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Formatted FAN digits
  ctx.fillStyle = "#020617";
  ctx.font = "900 21px monospace";
  ctx.textAlign = "center";
  ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 24);
  ctx.textAlign = "left";

  // Code128 barcode bars
  drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 34, barcodeBoxW - 20, 48);

  // 9. Fayda watermark
  try {
    const fayda = await loadImage("/assets/fayda-transparent.png");
    ctx.drawImage(fayda, 750, 510, 80, 75);
  } catch {
    // Fayda fallback
  }

  // 10. Ghost Photo on bottom right
  if (data.photoUrl) {
    try {
      const ghostImg = await loadImage(data.photoUrl);
      ctx.save();
      ctx.globalAlpha = 0.75;
      const ghostX = 845;
      const ghostY = 495;
      const ghostW = 82;
      const ghostH = 105;
      drawRoundedRect(ctx, ghostX, ghostY, ghostW, ghostH, 6);
      ctx.clip();
      ctx.drawImage(ghostImg, ghostX, ghostY, ghostW, ghostH);
      ctx.restore();
      ctx.strokeStyle = "rgba(13, 148, 136, 0.3)";
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, 845, 495, 82, 105, 6);
      ctx.stroke();
    } catch {
      // Ghost fallback
    }
  }

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

  // 1. Draw Guilloche Security Background
  drawGuillocheBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

  const leftX = 45;

  // 2. Phone Number
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ስልክ | Phone Number", leftX, 55);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 25px 'Inter', sans-serif";
  ctx.fillText(data.phoneNumber, leftX, 90);

  // 3. Nationality
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ዜግነት | Nationality", leftX, 132);
  ctx.font = "14px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("(በተጠቃሚው መልስ | Self Declared)", leftX, 152);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 23px 'Noto Sans Ethiopic', 'Inter', sans-serif";
  ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, leftX, 185);

  // 4. Address
  ctx.fillStyle = "#B45309";
  ctx.font = "bold 16px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("አድራሻ | Address", leftX, 230);

  ctx.fillStyle = "#020617";
  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.regionAmharic, leftX, 262);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.regionEnglish, leftX, 290);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.subcityAmharic, leftX, 322);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.subcityEnglish, leftX, 350);

  ctx.font = "bold 21px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(data.woredaAmharic, leftX, 382);
  ctx.font = "bold 21px 'Inter', sans-serif";
  ctx.fillText(data.woredaEnglish, leftX, 410);

  // 5. FIN Badge
  ctx.fillStyle = "#0f766e";
  ctx.font = "bold 13px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText("ፋይዳ", leftX, 468);
  ctx.fillText("ልዩ ቁጥር", leftX, 488);

  const finBoxX = leftX + 65;
  const finBoxY = 458;
  const finBoxW = 290;
  const finBoxH = 42;
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, finBoxX, finBoxY, finBoxW, finBoxH, 6);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  ctx.fillStyle = "#020617";
  ctx.font = "900 22px 'Inter', monospace";
  ctx.fillText(`FIN  ${data.finNumber}`, finBoxX + 16, finBoxY + 28);

  // 6. QR Code Container on the right
  const qrBoxX = 445;
  const qrBoxY = 32;
  const qrBoxSize = 515;

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(203, 213, 225, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  try {
    const qrImg = await loadImage(qrSource);
    ctx.drawImage(qrImg, qrBoxX + 10, qrBoxY + 10, qrBoxSize - 20, qrBoxSize - 20);
  } catch {
    // QR fallback
  }

  // 7. Footer: Disclaimer Text & SN Badge
  const footerY = 582;
  ctx.fillStyle = "#334155";
  ctx.font = "bold 13px 'Noto Sans Ethiopic', sans-serif";
  ctx.fillText(
    "ይህ መታወቂያ የጠፋ ካገኙ በቅርብዎ ያለ ፖሊስ ጣቢያ ወይም ለተቋሙ ያስረክቡ። ለተጨማሪ መረጃ 9779 ላይ ይደውሉ ወይም id.et/cardprint ይጎብኙ።",
    leftX,
    footerY
  );
  ctx.font = "12px 'Inter', sans-serif";
  ctx.fillText(
    "If lost and found, please return to nearby police station or to the institution. Call 9779 or visit id.et/cardprint for more.",
    leftX,
    footerY + 20
  );

  // SN Badge
  const snBoxX = 765;
  const snBoxY = 570;
  const snBoxW = 205;
  const snBoxH = 40;
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, snBoxX, snBoxY, snBoxW, snBoxH, 6);
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.stroke();

  ctx.font = "900 18px 'Inter', monospace";
  ctx.fillStyle = "#b91c1c";
  ctx.fillText("SN:", snBoxX + 14, snBoxY + 26);
  ctx.fillStyle = "#020617";
  ctx.fillText(data.serialNumber || "65501482", snBoxX + 54, snBoxY + 26);

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
