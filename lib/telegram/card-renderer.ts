import path from "path";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts, Image } from "@napi-rs/canvas";
import type { EthiopianIdData } from "@/types/id-card";
import { formatGregorianDate } from "@/lib/pdf/generate-landscape";

// Ensure Ethiopic fonts are registered in @napi-rs/canvas if available
try {
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansEthiopic.ttf");
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, "NotoSansEthiopic");
  }
} catch (e) {
  console.warn("Failed to register server Ethiopic font:", e);
}

const CANVAS_WIDTH = 1011;
const CANVAS_HEIGHT = 638;

function drawRoundedRect(
  ctx: any,
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

function drawCode128Barcode(
  ctx: any,
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

async function loadServerImage(src: string): Promise<any> {
  if (!src) return null;
  try {
    if (src.startsWith("data:")) {
      const parts = src.split(",");
      if (parts.length > 1) {
        const buf = Buffer.from(parts[1], "base64");
        return await loadImage(buf);
      }
    } else if (src.startsWith("/")) {
      const localPath = path.join(process.cwd(), "public", src.slice(1));
      if (fs.existsSync(localPath)) {
        return await loadImage(localPath);
      }
    } else if (fs.existsSync(src)) {
      return await loadImage(src);
    }
  } catch (err) {
    console.warn(`Failed to load server image asset: ${src.slice(0, 40)}`, err);
  }
  return null;
}

export async function renderFrontCardBuffer(data: EthiopianIdData): Promise<Buffer> {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // 1. Draw front template
  const templatePath = path.join(process.cwd(), "public", "assets", "card-front-template.png");
  if (fs.existsSync(templatePath)) {
    const templateImg = await loadImage(templatePath);
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 2. Primary Portrait Photo
  if (data.photoUrl) {
    const photoImg = await loadServerImage(data.photoUrl);
    if (photoImg) {
      ctx.save();
      drawRoundedRect(ctx, 73, 138, 302, 430, 10);
      ctx.clip();
      ctx.drawImage(photoImg, 73, 138, 302, 430);
      ctx.restore();
    }
  }

  // 3. Demographic text - Clean and sharp with NotoSansEthiopic
  ctx.fillStyle = "#020617";
  ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(data.fullNameAmharic, 418, 207);

  ctx.font = "bold 24px Arial, sans-serif";
  ctx.fillText(data.fullNameEnglish, 418, 250);

  const dobGregFormatted = formatGregorianDate(data.dateOfBirthGreg);
  ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 334);

  ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 405);

  const expiryGregFormatted = formatGregorianDate(data.dateOfExpiryGreg);
  ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 468);

  // 4. Barcode box and FAN
  const barcodeBoxX = 456;
  const barcodeBoxY = 496;
  const barcodeBoxW = 328;

  ctx.fillStyle = "#020617";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
  ctx.textAlign = "left";

  drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 34, barcodeBoxW - 20, 52);

  // 5. Ghost photo
  if (data.photoUrl) {
    const ghostImg = await loadServerImage(data.photoUrl);
    if (ghostImg) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawRoundedRect(ctx, 830, 460, 113, 134, 8);
      ctx.clip();
      ctx.drawImage(ghostImg, 830, 460, 113, 134);
      ctx.restore();
    }
  }

  // 6. Vertical issue date on left margin
  ctx.save();
  ctx.translate(38, 605);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "bold 14px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillStyle = "#C68932";
  ctx.fillText("የተሰጠበት ቀን: ", 0, 0);
  const w1 = ctx.measureText("የተሰጠበት ቀን: ").width;

  ctx.fillStyle = "#020617";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText(data.dateOfIssueEth, w1, 0);
  const w2 = w1 + ctx.measureText(data.dateOfIssueEth).width;

  ctx.fillStyle = "#C68932";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("   Date of Issue: ", w2, 0);
  const w3 = w2 + ctx.measureText("   Date of Issue: ").width;

  ctx.fillStyle = "#020617";
  ctx.fillText(formatGregorianDate(data.dateOfIssueGreg), w3, 0);
  ctx.restore();

  return canvas.toBuffer("image/png");
}

export async function renderBackCardBuffer(data: EthiopianIdData): Promise<Buffer> {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // 1. Draw back template
  const templatePath = path.join(process.cwd(), "public", "assets", "card-back-template.png");
  if (fs.existsSync(templatePath)) {
    const templateImg = await loadImage(templatePath);
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 2. Demographic text - Clean and sharp with NotoSansEthiopic
  ctx.fillStyle = "#020617";
  ctx.font = "bold 25px Arial, sans-serif";
  ctx.fillText(data.phoneNumber, 40, 110);

  ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 40, 194);

  ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(data.regionAmharic, 40, 258);
  ctx.font = "bold 21px Arial, sans-serif";
  ctx.fillText(data.regionEnglish, 40, 293);

  ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(data.subcityAmharic, 40, 330);
  ctx.font = "bold 21px Arial, sans-serif";
  ctx.fillText(data.subcityEnglish, 40, 359);

  ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText(data.woredaAmharic, 40, 395);
  ctx.font = "bold 21px Arial, sans-serif";
  ctx.fillText(data.woredaEnglish, 40, 430);

  // 3. FIN Number inside the FIN box
  ctx.fillStyle = "#020617";
  ctx.font = "bold 22px Arial, monospace";
  ctx.fillText(`FIN  ${data.finNumber}`, 104, 546);

  // 4. SN Number inside SN badge
  ctx.fillStyle = "#020617";
  ctx.font = "bold 19px Arial, monospace";
  ctx.fillText(data.serialNumber || "65501482", 835, 597);

  // 5. QR Code
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  const qrImg = await loadServerImage(qrSource);
  if (qrImg) {
    ctx.drawImage(qrImg, 462, 47, 490, 490);
  }

  return canvas.toBuffer("image/png");
}
