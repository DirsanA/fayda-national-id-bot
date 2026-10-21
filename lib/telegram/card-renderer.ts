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

function isolateSubjectWithFeathering(srcCanvas: any, isMini: boolean = false) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const ctx = srcCanvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Sample background from top corners
  let bgR = 0, bgG = 0, bgB = 0, count = 0;
  const sampleW = Math.max(5, Math.floor(w * 0.12));
  const sampleH = Math.max(5, Math.floor(h * 0.10));

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idx1 = (y * w + x) * 4;
      if (data[idx1 + 3] > 100) {
        bgR += data[idx1]; bgG += data[idx1 + 1]; bgB += data[idx1 + 2]; count++;
      }
      const idx2 = (y * w + (w - 1 - x)) * 4;
      if (data[idx2 + 3] > 100) {
        bgR += data[idx2]; bgG += data[idx2 + 1]; bgB += data[idx2 + 2]; count++;
      }
    }
  }

  if (count > 0) {
    bgR /= count; bgG /= count; bgB /= count;
  }

  // Check if background in corners is light indoor studio/wall
  const isIndoorBg = (bgR + bgG + bgB) / 3 > 140;
  const bgMask = new Uint8Array(w * h);

  if (isIndoorBg) {
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];

    const colorDist = (r: number, g: number, b: number) => {
      const dr = r - bgR, dg = g - bgG, db = b - bgB;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    const maxSideY = Math.floor(h * 0.68);

    // Seed top edge
    for (let x = 0; x < w; x++) {
      const idx = (0 * w + x) * 4;
      if (colorDist(data[idx], data[idx + 1], data[idx + 2]) < 55) {
        visited[x] = 1;
        bgMask[x] = 1;
        queue.push(x);
      }
    }

    // Seed upper side edges
    for (let y = 1; y < maxSideY; y++) {
      const idxL = (y * w + 0) * 4;
      if (colorDist(data[idxL], data[idxL + 1], data[idxL + 2]) < 55 && !visited[y * w]) {
        visited[y * w] = 1;
        bgMask[y * w] = 1;
        queue.push(y * w);
      }
      const idxR = (y * w + (w - 1)) * 4;
      if (colorDist(data[idxR], data[idxR + 1], data[idxR + 2]) < 55 && !visited[y * w + w - 1]) {
        visited[y * w + w - 1] = 1;
        bgMask[y * w + w - 1] = 1;
        queue.push(y * w + w - 1);
      }
    }

    let head = 0;
    while (head < queue.length) {
      const p = queue[head++];
      const px = p % w;
      const py = Math.floor(p / w);

      if (py > maxSideY) continue;

      const neighbors = [
        px > 0 ? p - 1 : -1,
        px < w - 1 ? p + 1 : -1,
        py > 0 ? p - w : -1,
        py < h - 1 ? p + w : -1
      ];

      for (const np of neighbors) {
        if (np >= 0 && !visited[np]) {
          visited[np] = 1;
          const nIdx = np * 4;
          if (colorDist(data[nIdx], data[nIdx + 1], data[nIdx + 2]) < 55) {
            bgMask[np] = 1;
            queue.push(np);
          }
        }
      }
    }
  }

  // Soft feathering alpha map
  const alphaMap = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alphaMap[i] = bgMask[i] ? 0.0 : 1.0;
  }

  // Blur on alpha map
  const blurR = isMini ? 2 : 4;
  const tempA = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, c = 0;
      for (let k = -blurR; k <= blurR; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < w) { sum += alphaMap[y * w + nx]; c++; }
      }
      tempA[y * w + x] = sum / c;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0, c = 0;
      for (let k = -blurR; k <= blurR; k++) {
        const ny = y + k;
        if (ny >= 0 && ny < h) { sum += tempA[ny * w + x]; c++; }
      }
      alphaMap[y * w + x] = sum / c;
    }
  }

  // Soft feathered alpha gradient around hair, neck, and jacket to blend into the card's wavy patterns
  const fadeLeft = isMini ? 12 : 28;
  const fadeRight = isMini ? 12 : 30;
  const fadeTop = isMini ? 14 : 36;
  const fadeBottom = isMini ? 18 : 34;
  const cornerR = isMini ? 25 : 55;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ax = 1.0;
      if (x < fadeLeft) ax = Math.sin((x / fadeLeft) * (Math.PI / 2));
      else if (x > w - fadeRight) ax = Math.sin(((w - x) / fadeRight) * (Math.PI / 2));

      let ay = 1.0;
      if (y < fadeTop) ay = Math.sin((y / fadeTop) * (Math.PI / 2));
      else if (y > h - fadeBottom) ay = Math.sin(((h - y) / fadeBottom) * (Math.PI / 2));

      let corner = 1.0;
      if (y < cornerR) {
        if (x < cornerR) {
          const d = Math.sqrt((cornerR - x) ** 2 + (cornerR - y) ** 2);
          if (d > cornerR) corner = Math.max(0, 1 - (d - cornerR) / 20);
        } else if (x > w - cornerR) {
          const d = Math.sqrt((x - (w - cornerR)) ** 2 + (cornerR - y) ** 2);
          if (d > cornerR) corner = Math.max(0, 1 - (d - cornerR) / 20);
        }
      }

      alphaMap[y * w + x] *= (ax * ay * corner);
    }
  }

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const a = alphaMap[i];
    if (a > 0.05) {
      let r = data[idx], g = data[idx + 1], b = data[idx + 2];
      r = Math.min(255, Math.round(r * 1.05 + 3));
      g = Math.min(255, Math.round(g * 1.05 + 3));
      b = Math.min(255, Math.round(b * 1.05 + 3));
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b;
    }
    data[idx + 3] = Math.round(a * 255);
  }

  ctx.putImageData(imgData, 0, 0);
  return srcCanvas;
}

export type CardTemplateId = "template1" | "template2" | "template3";

const TEMPLATE_CONFIG: Record<CardTemplateId, { front: string; back: string }> = {
  template1: {
    front: "card-front-template.png",
    back: "card-back-template.png",
  },
  template2: {
    front: "front2.png",
    back: "back2.png",
  },
  template3: {
    front: "front3.png",
    back: "back3.png",
  },
};

// In-memory cache for static card template images to eliminate disk I/O on every render
const frontTemplateCache = new Map<CardTemplateId, any>();
const backTemplateCache = new Map<CardTemplateId, any>();

async function getFrontTemplateImage(templateId: CardTemplateId = "template1"): Promise<any> {
  const effectiveId: CardTemplateId = TEMPLATE_CONFIG[templateId] ? templateId : "template1";
  if (frontTemplateCache.has(effectiveId)) {
    return frontTemplateCache.get(effectiveId);
  }
  const cfg = TEMPLATE_CONFIG[effectiveId];
  const templatePath = path.join(process.cwd(), "public", "assets", cfg.front);
  if (fs.existsSync(templatePath)) {
    const img = await loadImage(templatePath);
    frontTemplateCache.set(effectiveId, img);
    return img;
  }
  if (effectiveId !== "template1") {
    return getFrontTemplateImage("template1");
  }
  return null;
}

async function getBackTemplateImage(templateId: CardTemplateId = "template1"): Promise<any> {
  const effectiveId: CardTemplateId = TEMPLATE_CONFIG[templateId] ? templateId : "template1";
  if (backTemplateCache.has(effectiveId)) {
    return backTemplateCache.get(effectiveId);
  }
  const cfg = TEMPLATE_CONFIG[effectiveId];
  const templatePath = path.join(process.cwd(), "public", "assets", cfg.back);
  if (fs.existsSync(templatePath)) {
    const img = await loadImage(templatePath);
    backTemplateCache.set(effectiveId, img);
    return img;
  }
  if (effectiveId !== "template1") {
    return getBackTemplateImage("template1");
  }
  return null;
}

// Background prewarm to guarantee instant 0ms disk latency on any template
export function prewarmTemplates() {
  const ids: CardTemplateId[] = ["template1", "template2", "template3"];
  for (const id of ids) {
    getFrontTemplateImage(id).catch(() => {});
    getBackTemplateImage(id).catch(() => {});
  }
}
prewarmTemplates();

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

function convertServerImageToGrayscale(img: any): any {
  const c = createCanvas(img.width, img.height);
  const cCtx = c.getContext("2d");
  cCtx.drawImage(img, 0, 0);
  const imgData = cCtx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;

  // ITU-R BT.709 luminance weights for natural high-contrast B&W portrait
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = gray;
    d[i + 1] = gray;
    d[i + 2] = gray;
  }
  cCtx.putImageData(imgData, 0, 0);
  return c;
}

export type BotPhotoStyle = "bw" | "color";

export async function renderFrontCardCanvas(
  data: EthiopianIdData,
  photoStyle: BotPhotoStyle = "bw",
  templateId: CardTemplateId = "template1"
): Promise<any> {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // 1. Draw front template (retrieved from in-memory cache)
  const templateImg = await getFrontTemplateImage(templateId);
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 2. Primary Portrait Photo (decode base64 once and reuse for ghost photo)
  let photoDrawable: any = null;
  if (data.photoUrl) {
    const rawPhotoImg = await loadServerImage(data.photoUrl);
    if (rawPhotoImg) {
      photoDrawable =
        photoStyle === "bw" ? convertServerImageToGrayscale(rawPhotoImg) : rawPhotoImg;
      
      const targetW = 320;
      const targetH = 430;
      const photoX = 55;
      const photoY = 125;

      const pCanvas = createCanvas(targetW, targetH);
      const pCtx = pCanvas.getContext("2d");
      pCtx.imageSmoothingEnabled = true;

      // Preserve natural aspect ratio (centered cover)
      const aspect = rawPhotoImg.width / rawPhotoImg.height;
      let drawW = targetW;
      let drawH = targetW / aspect;
      if (drawH < targetH) {
        drawH = targetH;
        drawW = targetH * aspect;
      }
      const offX = (targetW - drawW) / 2;
      const offY = (targetH - drawH) / 2;
      pCtx.drawImage(photoDrawable, offX, offY, drawW, drawH);

      // Isolate subject from indoor backdrop with feathered alpha vignette
      isolateSubjectWithFeathering(pCanvas, false);

      ctx.drawImage(pCanvas, photoX, photoY);
    }
  }

  // 3. Demographic text - Sharp, high-contrast black font (regular weight)
  const dobGregFormatted = formatGregorianDate(data.dateOfBirthGreg);
  const expiryGregFormatted = formatGregorianDate(data.dateOfExpiryGreg);
  const textColor = "#000000";

  if (templateId === "template1") {
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.font = "24px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 418, 196);

    ctx.font = "22px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 418, 230);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 330);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 394);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 460);

    // Barcode box and FAN (reduced by 10% to prevent collision, aligned bottom-center)
    const barcodeBoxX = 465;
    const barcodeBoxY = 498;
    const barcodeBoxW = 293;

    ctx.fillStyle = textColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 25);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 13, barcodeBoxY + 34, barcodeBoxW - 26, 52);
  } else if (templateId === "template2") {
    // 1. PERFECT LINE-BY-LINE ALIGNMENT & SPACING (FRONT):
    // Strict vertical grid line matching preprinted labels at x = 398
    const textX = 398;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";

    // Full Name
    ctx.font = "22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, textX, 210);

    ctx.font = "20px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, textX, 238);

    // Date of Birth
    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, textX, 320);

    // Sex (Label at y ≈ 352, value at y = 388)
    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, textX, 388);

    // SPACING: Increased vertical Y-offset between "ጾታ | Sex / ወንድ | Male" (y=388)
    // and "የሚያበቃበት ቀን | Date of Expiry" (Label at y ≈ 418, value at y = 452).
    // Provides 18-20px of clear vertical separation.
    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, textX, 452);

    // BARCODE: Reduce the "FAN" barcode box horizontally by 10% (270 -> 244px)
    // to prevent collision with "ካርታ / ቁጥር / FAN" label (ends at ~435), aligned bottom-center.
    const fanBoxW = 244;
    const fanBoxH = 96;
    const fanBoxX = 460;
    const fanBoxY = 502;

    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 0, 0, 0.05)";
    ctx.shadowBlur = 4;
    drawRoundedRect(ctx, fanBoxX, fanBoxY, fanBoxW, fanBoxH, 10);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.strokeStyle = "#E2E8F0";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, fanBoxX, fanBoxY, fanBoxW, fanBoxH, 10);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, fanBoxX + fanBoxW / 2, fanBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, fanBoxX + 12, fanBoxY + 32, fanBoxW - 24, 54);
  } else if (templateId === "template3") {
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.font = "24px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 418, 190);

    ctx.font = "22px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 418, 228);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 300);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 380);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 468);

    // Barcode box and FAN (reduced by 10% to prevent collision, aligned bottom-center)
    const barcodeBoxX = 455;
    const barcodeBoxY = 490;
    const barcodeBoxW = 248;

    ctx.fillStyle = textColor;
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 24);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 30, barcodeBoxW - 20, 52);
  }

  // 4. Ghost photo - soft feathered alpha gradient blending into card's wavy patterns
  if (photoDrawable) {
    const miniW = 115;
    const miniH = 135;
    const miniX = 830;
    const miniY = 460;
    const miniCanvas = createCanvas(miniW, miniH);
    const mCtx = miniCanvas.getContext("2d");
    mCtx.imageSmoothingEnabled = true;

    const aspect = photoDrawable.width / photoDrawable.height;
    let drawW = miniW;
    let drawH = miniW / aspect;
    if (drawH < miniH) {
      drawH = miniH;
      drawW = miniH * aspect;
    }
    mCtx.drawImage(photoDrawable, (miniW - drawW) / 2, (miniH - drawH) / 2, drawW, drawH);

    // Isolate subject for mini portrait with feathered alpha gradient
    isolateSubjectWithFeathering(miniCanvas, true);

    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.drawImage(miniCanvas, miniX, miniY);
    ctx.restore();
  }

  // 5. Vertical issue date on left margin (excluded for template2 to preserve natural clean gradient edge)
  if (templateId !== "template2") {
    ctx.save();
    ctx.translate(38, 605);
    ctx.rotate(-Math.PI / 2);
    ctx.font = "14px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillStyle = "#C68932";
    ctx.fillText("የተሰጠበት ቀን: ", 0, 0);
    const w1 = ctx.measureText("የተሰጠበት ቀን: ").width;

    ctx.fillStyle = textColor;
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(data.dateOfIssueEth, w1, 0);
    const w2 = w1 + ctx.measureText(data.dateOfIssueEth).width;

    ctx.fillStyle = "#C68932";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("   Date of Issue: ", w2, 0);
    const w3 = w2 + ctx.measureText("   Date of Issue: ").width;

    ctx.fillStyle = textColor;
    ctx.fillText(formatGregorianDate(data.dateOfIssueGreg), w3, 0);
    ctx.restore();
  }

  return canvas;
}

export async function renderFrontCardBuffer(
  data: EthiopianIdData,
  photoStyle: BotPhotoStyle = "bw",
  templateId: CardTemplateId = "template1"
): Promise<Buffer> {
  const canvas = await renderFrontCardCanvas(data, photoStyle, templateId);
  return canvas.toBuffer("image/png");
}

export async function renderBackCardCanvas(
  data: EthiopianIdData,
  templateId: CardTemplateId = "template1"
): Promise<any> {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // 1. Draw back template (retrieved from in-memory cache)
  const templateImg = await getBackTemplateImage(templateId);
  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // 2. Demographic text and codes according to template
  const textColor = "#000000";
  ctx.fillStyle = textColor;
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  const qrImg = await loadServerImage(qrSource);

  if (templateId === "template1") {
    ctx.textAlign = "left";
    ctx.font = "24px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, 40, 104);

    ctx.font = "22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 40, 188);

    // Tight single-line spacing under Address
    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.regionAmharic} / ${data.regionEnglish}`, 40, 254);
    ctx.fillText(`${data.subcityAmharic} / ${data.subcityEnglish}`, 40, 282);
    ctx.fillText(`${data.woredaAmharic} / ${data.woredaEnglish}`, 40, 310);

    // FIN Number inside FIN box
    ctx.font = "22px Arial, monospace";
    ctx.fillText(`FIN  ${data.finNumber}`, 104, 546);

    // SN Number inside SN badge
    ctx.font = "19px Arial, monospace";
    ctx.fillText(data.serialNumber || "65501482", 835, 597);

    // QR Code
    if (qrImg) {
      ctx.drawImage(qrImg, 462, 47, 490, 490);
    }
  } else if (templateId === "template2") {
    // 2. PERFECT LINE-BY-LINE ALIGNMENT & SPACING (BACK):
    // Single vertical grid line at x = 60
    const backTextX = 60;
    ctx.fillStyle = textColor;
    ctx.textAlign = "left";

    // Phone Number (Label is at y ≈ 38)
    ctx.font = "23px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, backTextX, 82);

    // FONT CLARITY: Sharp, high-contrast font ensuring "(በተገለጠው መሰረት / Self Declared)"
    // is visible and uses the correct Ge'ez "ጠ" character (\u1320)!
    ctx.font = "14.5px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("(በተገለጠው መሰረት / Self Declared)", backTextX, 145);

    // Stack the Address labels and values with equal vertical spacing (28px step),
    // ensuring the final line has ample padding (>125px) above the footer.
    ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.regionAmharic, backTextX, 246);
    ctx.font = "19px Arial, sans-serif";
    ctx.fillText(data.regionEnglish, backTextX, 274);

    ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.subcityAmharic, backTextX, 302);
    ctx.font = "19px Arial, sans-serif";
    ctx.fillText(data.subcityEnglish, backTextX, 330);

    ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.woredaAmharic, backTextX, 358);
    ctx.font = "19px Arial, sans-serif";
    ctx.fillText(data.woredaEnglish, backTextX, 386);

    // CENTER FIN: Vertically and horizontally center numeric string inside its white box,
    // aligning with "ፋይዳ ልዩ ቁጥር | FIN" label on its left.
    const finBoxX = 169;
    const finBoxY = 513;
    const finBoxW = 253;
    const finBoxH = 51;

    ctx.save();
    ctx.font = "22px Arial, monospace";
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.finNumber, finBoxX + finBoxW / 2, finBoxY + finBoxH / 2);
    ctx.restore();

    // CENTER SN: Symmetrically center "SN : 65501482" inside bottom-right white pill box with even padding.
    const snBoxX = 765;
    const snBoxY = 552;
    const snBoxW = 205;
    const snBoxH = 50;

    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, snBoxX, snBoxY, snBoxW, snBoxH, 8);
    ctx.fill();

    const snLabel = "SN : ";
    const snVal = data.serialNumber || "65501482";
    ctx.font = "18px Arial, sans-serif";
    const labelW = ctx.measureText(snLabel).width;
    ctx.font = "18px Arial, monospace";
    const valW = ctx.measureText(snVal).width;
    const totalSnW = labelW + valW;
    const snStartX = snBoxX + (snBoxW - totalSnW) / 2;
    const snCenterY = snBoxY + snBoxH / 2;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#945722";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText(snLabel, snStartX, snCenterY);
    ctx.fillStyle = textColor;
    ctx.font = "18px Arial, monospace";
    ctx.fillText(snVal, snStartX + labelW, snCenterY);
    ctx.restore();

    // QR Code with clean rounded white backdrop for 100% scan reliability
    if (qrImg) {
      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, 462, 46, 485, 485, 16);
      ctx.fill();
      ctx.drawImage(qrImg, 472, 56, 465, 465);
    }
  } else if (templateId === "template3") {
    ctx.textAlign = "left";
    ctx.font = "25px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, 35, 140);

    ctx.font = "23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 35, 245);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.regionAmharic, 35, 330);
    ctx.font = "21px Arial, sans-serif";
    ctx.fillText(data.regionEnglish, 35, 360);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.subcityAmharic, 35, 390);
    ctx.font = "21px Arial, sans-serif";
    ctx.fillText(data.subcityEnglish, 35, 418);

    ctx.font = "21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.woredaAmharic, 35, 448);
    ctx.font = "21px Arial, sans-serif";
    ctx.fillText(data.woredaEnglish, 35, 478);

    // FIN Number inside FIN box
    ctx.font = "22px Arial, monospace";
    ctx.fillText(`FIN  ${data.finNumber}`, 104, 562);

    // SN Number inside SN badge
    ctx.font = "19px Arial, monospace";
    ctx.fillText(data.serialNumber || "65501482", 825, 620);

    // QR Code
    if (qrImg) {
      ctx.drawImage(qrImg, 455, 45, 490, 490);
    }
  }

  return canvas;
}

export async function renderBackCardBuffer(
  data: EthiopianIdData,
  templateId: CardTemplateId = "template1"
): Promise<Buffer> {
  const canvas = await renderBackCardCanvas(data, templateId);
  return canvas.toBuffer("image/png");
}

// Generate single horizontal combined card (Front Left, Back Right, 15px gap, Zero paper background)
export async function renderCombinedCardBuffer(
  data: EthiopianIdData,
  photoStyle: BotPhotoStyle = "bw",
  templateId: CardTemplateId = "template1"
): Promise<Buffer> {
  const [frontCanvas, backCanvas] = await Promise.all([
    renderFrontCardCanvas(data, photoStyle, templateId),
    renderBackCardCanvas(data, templateId),
  ]);

  const GAP_PX = 15;
  const combinedWidth = CANVAS_WIDTH * 2 + GAP_PX;
  const combinedHeight = CANVAS_HEIGHT;

  const combinedCanvas = createCanvas(combinedWidth, combinedHeight);
  const ctx = combinedCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // Front card on the left (x=0, y=0)
  ctx.drawImage(frontCanvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  // Back card on the right (x=CANVAS_WIDTH + GAP_PX, y=0)
  ctx.drawImage(backCanvas, CANVAS_WIDTH + GAP_PX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  return combinedCanvas.toBuffer("image/png");
}

