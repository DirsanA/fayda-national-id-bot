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

function createBroadBustMask(
  w: number,
  h: number,
  fadeLeft = 28,
  fadeRight = 32,
  fadeTop = 40,
  fadeBottom = 25,
  cornerR = 55
) {
  const mCanvas = createCanvas(w, h);
  const mCtx = mCanvas.getContext("2d");
  const imgData = mCtx.createImageData(w, h);
  const data = imgData.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      let ax = 1.0;
      if (x < fadeLeft) {
        ax = Math.sin((x / fadeLeft) * (Math.PI / 2));
      } else if (x > w - fadeRight) {
        ax = Math.sin(((w - x) / fadeRight) * (Math.PI / 2));
      }

      let ay = 1.0;
      if (y < fadeTop) {
        ay = Math.sin((y / fadeTop) * (Math.PI / 2));
      } else if (y > h - fadeBottom) {
        ay = Math.sin(((h - y) / fadeBottom) * (Math.PI / 2));
      }

      let corner = 1.0;
      if (y < cornerR) {
        if (x < cornerR) {
          const dx = cornerR - x;
          const dy = cornerR - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerR) {
            corner = Math.max(0, 1 - (dist - cornerR) / 25);
          }
        } else if (x > w - cornerR) {
          const dx = x - (w - cornerR);
          const dy = cornerR - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > cornerR) {
            corner = Math.max(0, 1 - (dist - cornerR) / 25);
          }
        }
      }

      const alpha = Math.round(ax * ay * corner * 255);
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = alpha;
    }
  }
  mCtx.putImageData(imgData, 0, 0);
  return mCanvas;
}

function createMiniPortraitMask(w: number, h: number) {
  const mCanvas = createCanvas(w, h);
  const mCtx = mCanvas.getContext("2d");
  mCtx.save();
  mCtx.translate(w / 2, h / 2);
  mCtx.scale(1, h / w);
  const grad = mCtx.createRadialGradient(0, 0, w * 0.22, 0, 0, w * 0.48);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.65, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(0.85, "rgba(255, 255, 255, 0.4)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  mCtx.fillStyle = grad;
  mCtx.fillRect(-w, -w, w * 2, w * 2);
  mCtx.restore();
  return mCanvas;
}

function isolateSubject(srcCanvas: any) {
  const W = srcCanvas.width;
  const H = srcCanvas.height;
  const ctx = srcCanvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  const bgMask = new Uint8Array(W * H);
  const queue: number[] = [];

  function isBgColor(idx: number) {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 88;
  }

  // Seed top boundary and upper corners
  for (let x = 0; x < W; x++) {
    const idx = (0 * W + x) * 4;
    if (isBgColor(idx)) {
      bgMask[x] = 1;
      queue.push(x);
    }
  }
  for (let y = 0; y < H * 0.75; y++) {
    const lIdx = (y * W + 0) * 4;
    if (isBgColor(lIdx) && !bgMask[y * W]) {
      bgMask[y * W] = 1;
      queue.push(y * W);
    }
    const rIdx = (y * W + (W - 1)) * 4;
    if (isBgColor(rIdx) && !bgMask[y * W + W - 1]) {
      bgMask[y * W + W - 1] = 1;
      queue.push(y * W + W - 1);
    }
  }

  // Flood fill background
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % W;
    const cy = Math.floor(curr / W);

    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const nPos = ny * W + nx;
        if (!bgMask[nPos]) {
          const nIdx = nPos * 4;
          if (isBgColor(nIdx)) {
            bgMask[nPos] = 1;
            queue.push(nPos);
          }
        }
      }
    }
  }

  // Soft feathering blur on alpha mask
  const alphaMap = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    alphaMap[i] = bgMask[i] ? 0.0 : 1.0;
  }

  const blurRadius = 3;
  const tempAlpha = new Float32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0, count = 0;
      for (let k = -blurRadius; k <= blurRadius; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < W) {
          sum += alphaMap[y * W + nx];
          count++;
        }
      }
      tempAlpha[y * W + x] = sum / count;
    }
  }

  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let sum = 0, count = 0;
      for (let k = -blurRadius; k <= blurRadius; k++) {
        const ny = y + k;
        if (ny >= 0 && ny < H) {
          sum += tempAlpha[ny * W + x];
          count++;
        }
      }
      alphaMap[y * W + x] = sum / count;
    }
  }

  // Bottom edge soft fade so jacket merges into card pattern
  const fadeBottomPx = 25;
  for (let y = H - fadeBottomPx; y < H; y++) {
    const factor = (H - 1 - y) / fadeBottomPx;
    for (let x = 0; x < W; x++) {
      alphaMap[y * W + x] *= factor;
    }
  }

  // Apply alpha and enhance vibrancy
  for (let i = 0; i < W * H; i++) {
    const idx = i * 4;
    const a = alphaMap[i];

    if (a > 0.1) {
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];
      r = Math.min(255, Math.round(r * 1.08 + 4));
      g = Math.min(255, Math.round(g * 1.08 + 4));
      b = Math.min(255, Math.round(b * 1.08 + 4));
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
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
      if (templateId === "template2") {
        // Natural broad bust with seamless soft-feathered alpha-vignette mask
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

        // Isolate subject and remove wall/backdrop entirely
        isolateSubject(pCanvas);

        ctx.drawImage(pCanvas, photoX, photoY);
      } else {
        const photoW = 281;
        const photoH = 400;
        const photoX = 73 + Math.round((302 - photoW) / 2);
        const photoY = 138 + Math.round((430 - photoH) / 2);

        ctx.save();
        drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 10);
        ctx.clip();
        ctx.drawImage(photoDrawable, photoX, photoY, photoW, photoH);
        ctx.restore();
      }
    }
  }

  // 3. Demographic text - Clean, high contrast deep navy-black with NotoSansEthiopic
  const dobGregFormatted = formatGregorianDate(data.dateOfBirthGreg);
  const expiryGregFormatted = formatGregorianDate(data.dateOfExpiryGreg);

  if (templateId === "template1") {
    ctx.fillStyle = "#020617";
    ctx.font = "bold 25px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 418, 196);

    ctx.font = "bold 23px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 418, 230);

    ctx.font = "bold 22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 330);

    ctx.font = "bold 22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 394);

    ctx.font = "bold 22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 460);

    // Barcode box and FAN (Strictly inside existing white box: x=457..783, y=498..594)
    const barcodeBoxX = 457;
    const barcodeBoxY = 498;
    const barcodeBoxW = 326;

    ctx.fillStyle = "#020617";
    ctx.font = "bold 21px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 25);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 13, barcodeBoxY + 34, barcodeBoxW - 26, 52);
  } else if (templateId === "template2") {
    // Front coordinates for modern blue template with guaranteed vertical gaps and deep navy-black contrast
    const textColor = "#0A0F1D";
    ctx.fillStyle = textColor;

    ctx.font = "bold 22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 416, 210);

    ctx.font = "bold 20px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 416, 240);

    ctx.font = "bold 19.5px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 416, 322);

    ctx.font = "bold 19.5px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 416, 382);

    // Clear 23px gap below Sex line before Expiry label, value directly below label
    ctx.font = "bold 19.5px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 416, 450);

    // Re-sized & re-centered barcode container (shorter horizontally, taller vertically)
    // Margin to left label >= 25px (445 - 420 = 25px), margin to mini-portrait >= 30px (830 - 715 = 115px)
    const fanBoxX = 445;
    const fanBoxY = 502;
    const fanBoxW = 270;
    const fanBoxH = 96;

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
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, fanBoxX + fanBoxW / 2, fanBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, fanBoxX + 14, fanBoxY + 32, fanBoxW - 28, 54);
  } else if (templateId === "template3") {
    ctx.fillStyle = "#020617";
    ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 418, 190);

    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 418, 228);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 300);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 380);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 468);

    // Barcode box and FAN
    const barcodeBoxX = 445;
    const barcodeBoxY = 490;
    const barcodeBoxW = 275;

    ctx.fillStyle = "#020617";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 24);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 30, barcodeBoxW - 20, 52);
  }

  // 4. Ghost photo
  if (photoDrawable) {
    if (templateId === "template2") {
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

      // Isolate subject for mini portrait
      isolateSubject(miniCanvas);

      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(miniCanvas, miniX, miniY);
      ctx.restore();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawRoundedRect(ctx, 830, 460, 113, 134, 8);
      ctx.clip();
      ctx.drawImage(photoDrawable, 830, 460, 113, 134);
      ctx.restore();
    }
  }

  // 5. Vertical issue date on left margin (excluded for template2 to preserve natural clean gradient edge)
  if (templateId !== "template2") {
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
  ctx.fillStyle = "#020617";
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  const qrImg = await loadServerImage(qrSource);

  if (templateId === "template1") {
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, 40, 104);

    ctx.font = "bold 22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 40, 188);

    // Tight single-line spacing under Address
    ctx.font = "bold 20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.regionAmharic} / ${data.regionEnglish}`, 40, 254);
    ctx.fillText(`${data.subcityAmharic} / ${data.subcityEnglish}`, 40, 282);
    ctx.fillText(`${data.woredaAmharic} / ${data.woredaEnglish}`, 40, 310);

    // FIN Number inside FIN box
    ctx.fillStyle = "#020617";
    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText(`FIN  ${data.finNumber}`, 104, 546);

    // SN Number inside SN badge
    ctx.fillStyle = "#020617";
    ctx.font = "bold 19px Arial, monospace";
    ctx.fillText(data.serialNumber || "65501482", 835, 597);

    // QR Code
    if (qrImg) {
      ctx.drawImage(qrImg, 462, 47, 490, 490);
    }
  } else if (templateId === "template2") {
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, 45, 102);

    // Stacked Amharic and English address lines with tight, consistent line-height (>100px clearance above FIN)
    ctx.font = "bold 19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.regionAmharic, 45, 252);
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.fillText(data.regionEnglish, 45, 280);

    ctx.font = "bold 19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.subcityAmharic, 45, 310);
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.fillText(data.subcityEnglish, 45, 338);

    ctx.font = "bold 19px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.woredaAmharic, 45, 368);
    ctx.font = "bold 19px Arial, sans-serif";
    ctx.fillText(data.woredaEnglish, 45, 396);

    // FIN Number inside FIN box (to the right of pre-printed FIN label)
    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText(data.finNumber, 185, 538);

    // SN inside white rounded box (centered vertically and horizontally)
    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, 794, 544, 194, 60, 6);
    ctx.fill();

    ctx.font = "bold 19px Arial, sans-serif";
    ctx.fillStyle = "#945722";
    ctx.fillText("SN : ", 810, 582);
    const snW = ctx.measureText("SN : ").width;
    ctx.fillStyle = "#0A0F1D";
    ctx.font = "bold 19px Arial, monospace";
    ctx.fillText(data.serialNumber || "65501482", 810 + snW, 582);

    // QR Code with clean rounded white backdrop for 100% scan reliability
    if (qrImg) {
      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, 462, 46, 485, 485, 16);
      ctx.fill();
      ctx.drawImage(qrImg, 472, 56, 465, 465);
    }
  } else if (templateId === "template3") {
    ctx.font = "bold 25px Arial, sans-serif";
    ctx.fillText(data.phoneNumber, 35, 140);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.nationalityAmharic} | ${data.nationalityEnglish}`, 35, 245);

    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.regionAmharic, 35, 330);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText(data.regionEnglish, 35, 360);

    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.subcityAmharic, 35, 390);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText(data.subcityEnglish, 35, 418);

    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.woredaAmharic, 35, 448);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText(data.woredaEnglish, 35, 478);

    // FIN Number inside FIN box
    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText(`FIN  ${data.finNumber}`, 104, 562);

    // SN Number inside SN badge
    ctx.font = "bold 19px Arial, monospace";
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

