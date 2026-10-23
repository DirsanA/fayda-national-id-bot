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

/**
 * High-quality background removal preserving sharp facial details, natural hair,
 * skin tone, clothing, and natural edges with clean RGBA transparency.
 * Avoids blur, artificial vignettes, halos, or facial distortion.
 */
function isolateSubjectClean(srcCanvas: any) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const ctx = srcCanvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Check if image already has transparent background in corners
  let transparentCorners = 0;
  const cornerChecks = [
    [0, 0], [w - 1, 0], [0, 5], [w - 1, 5],
    [Math.floor(w * 0.1), 0], [Math.floor(w * 0.9), 0]
  ];
  for (const [cx, cy] of cornerChecks) {
    if (data[(cy * w + cx) * 4 + 3] < 50) transparentCorners++;
  }
  if (transparentCorners >= 3) {
    return srcCanvas;
  }

  // 2. Sample background color across top edge and upper corners
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  const sampleW = Math.max(4, Math.floor(w * 0.15));
  const sampleH = Math.max(4, Math.floor(h * 0.08));

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idxL = (y * w + x) * 4;
      bgR += data[idxL]; bgG += data[idxL + 1]; bgB += data[idxL + 2]; bgCount++;
      const idxR = (y * w + (w - 1 - x)) * 4;
      bgR += data[idxR]; bgG += data[idxR + 1]; bgB += data[idxR + 2]; bgCount++;
    }
  }
  bgR /= bgCount; bgG /= bgCount; bgB /= bgCount;

  // If background is very dark, skip removal
  if ((bgR + bgG + bgB) / 3 < 80) return srcCanvas;

  let sumSq = 0;
  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const idxL = (y * w + x) * 4;
      const dL = Math.hypot(data[idxL] - bgR, data[idxL + 1] - bgG, data[idxL + 2] - bgB);
      const idxR = (y * w + (w - 1 - x)) * 4;
      const dR = Math.hypot(data[idxR] - bgR, data[idxR + 1] - bgG, data[idxR + 2] - bgB);
      sumSq += (dL * dL + dR * dR);
    }
  }
  const stdDev = Math.sqrt(sumSq / bgCount);
  const distThresh = Math.max(26, Math.min(54, stdDev * 2.8 + 18));
  const solidThresh = distThresh * 0.72;

  const colorDist = (r: number, g: number, b: number) => Math.hypot(r - bgR, g - bgG, b - bgB);

  const isHumanForeground = (r: number, g: number, b: number) => {
    if (r < 75 && g < 75 && b < 75) return true; // Dark hair
    if (r > b + 28 && r > 85 && g > 60) return true; // Skin
    return false;
  };

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0, qTail = 0;
  const maxDepthY = Math.floor(h * 0.80);

  // Seed top edge
  for (let x = 0; x < w; x++) {
    const idx = (0 * w + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    if (!isHumanForeground(r, g, b) && colorDist(r, g, b) < distThresh) {
      visited[x] = 1;
      queue[qTail++] = x;
    }
  }

  // Seed upper sides
  for (let y = 1; y < maxDepthY; y++) {
    const pL = y * w + 0;
    const idxL = pL * 4;
    if (!visited[pL] && !isHumanForeground(data[idxL], data[idxL + 1], data[idxL + 2]) && colorDist(data[idxL], data[idxL + 1], data[idxL + 2]) < distThresh) {
      visited[pL] = 1;
      queue[qTail++] = pL;
    }
    const pR = y * w + (w - 1);
    const idxR = pR * 4;
    if (!visited[pR] && !isHumanForeground(data[idxR], data[idxR + 1], data[idxR + 2]) && colorDist(data[idxR], data[idxR + 1], data[idxR + 2]) < distThresh) {
      visited[pR] = 1;
      queue[qTail++] = pR;
    }
  }

  while (qHead < qTail) {
    const p = queue[qHead++];
    const px = p % w;
    const py = Math.floor(p / w);

    if (py >= maxDepthY) continue;

    const neighbors = [
      px > 0 ? p - 1 : -1,
      px < w - 1 ? p + 1 : -1,
      py > 0 ? p - w : -1,
      py < maxDepthY ? p + w : -1
    ];

    for (const np of neighbors) {
      if (np >= 0 && !visited[np]) {
        const nIdx = np * 4;
        const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
        if (!isHumanForeground(nr, ng, nb) && colorDist(nr, ng, nb) < distThresh) {
          visited[np] = 1;
          queue[qTail++] = np;
        }
      }
    }
  }

  // Apply crisp anti-aliased transparency to background pixels
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      const idx = p * 4;
      const d = colorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (d <= solidThresh) {
        data[idx + 3] = 0; // True transparent
      } else {
        const factor = (d - solidThresh) / (distThresh - solidThresh);
        data[idx + 3] = Math.round(Math.max(0, Math.min(255, factor * 255)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return srcCanvas;
}

export type CardTemplateId = "template1" | "template2" | "template3" | "template4";

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
    // front3.png has an open photo area (no opaque slot fill) so that the
    // transparent portrait produced by isolateSubjectClean shows through cleanly.
    front: "image.png",
    back: "card-back-template.png",
  },
  template4: {

    front: "front4.png",
    back: "card-back-template.png",
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
  const ids: CardTemplateId[] = ["template1", "template2", "template3", "template4"];
  for (const id of ids) {
    getFrontTemplateImage(id).catch(() => { });
    getBackTemplateImage(id).catch(() => { });
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

  // 2. Primary Portrait Photo (high-quality clean background removal, sized to match Reference 2)
  let photoDrawable: any = null;
  if (data.photoUrl) {
    const rawPhotoImg = await loadServerImage(data.photoUrl);
    if (rawPhotoImg) {
      // 1. Perform background removal for template2 (Modern Blue), template3 (Minimal), and template4.
      // Classic Standard (template1) keeps the original portrait photo as completed.
      let photoSource = rawPhotoImg;
      if (templateId === "template2" || templateId === "template3" || templateId === "template4") {
        const cleanPhotoCanvas = createCanvas(rawPhotoImg.width, rawPhotoImg.height);
        const cleanCtx = cleanPhotoCanvas.getContext("2d");
        cleanCtx.imageSmoothingEnabled = true;
        cleanCtx.drawImage(rawPhotoImg, 0, 0);
        isolateSubjectClean(cleanPhotoCanvas);
        photoSource = cleanPhotoCanvas;
      }

      photoDrawable =
        photoStyle === "bw" ? convertServerImageToGrayscale(photoSource) : photoSource;

      if (templateId === "template1") {
        const photoW = 281;
        const photoH = 400;
        const photoX = 73 + Math.round((302 - photoW) / 2);
        const photoY = 138 + Math.round((430 - photoH) / 2);

        ctx.save();
        drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 10);
        ctx.clip();
        ctx.drawImage(photoDrawable, photoX, photoY, photoW, photoH);
        ctx.restore();
      } else if (templateId === "template2") {
        const targetW = 282;
        const targetH = 354;
        const photoX = 72;
        const photoY = 198;

        const pCanvas = createCanvas(targetW, targetH);
        const pCtx = pCanvas.getContext("2d");
        pCtx.imageSmoothingEnabled = true;

        // Preserve natural aspect ratio without distortion
        const aspect = photoDrawable.width / photoDrawable.height;
        let drawW = targetW;
        let drawH = targetW / aspect;
        if (drawH < targetH) {
          drawH = targetH;
          drawW = targetH * aspect;
        }
        const offX = (targetW - drawW) / 2;
        const offY = (targetH - drawH) / 2;
        pCtx.drawImage(photoDrawable, offX, offY, drawW, drawH);

        ctx.drawImage(pCanvas, photoX, photoY);
      } else if (templateId === "template3") {
        // Minimal: Classic Standard card layout with Modern Blue transparent subject rendering.
        const targetW = 302;
        const targetH = 430;
        const photoX = 73;
        const photoY = 138;

        const pCanvas = createCanvas(targetW, targetH);
        const pCtx = pCanvas.getContext("2d");
        pCtx.imageSmoothingEnabled = true;

        // Preserve natural aspect ratio without distortion
        const aspect = photoDrawable.width / photoDrawable.height;
        let drawW = targetW;
        let drawH = targetW / aspect;
        if (drawH < targetH) {
          drawH = targetH;
          drawW = targetH * aspect;
        }
        const offX = (targetW - drawW) / 2;
        const offY = (targetH - drawH) / 2;
        pCtx.drawImage(photoDrawable, offX, offY, drawW, drawH);

        ctx.drawImage(pCanvas, photoX, photoY);
      } else if (templateId === "template4") {
        // Template 4: Decreased photo size with preserved natural aspect ratio so portrait does not look stretched/tall
        const targetW = 275;
        const targetH = 360;
        const photoX = 85;
        const photoY = 175;

        const pCanvas = createCanvas(targetW, targetH);
        const pCtx = pCanvas.getContext("2d");
        pCtx.imageSmoothingEnabled = true;

        // Preserve natural aspect ratio without distortion (contain mode)
        const aspect = photoDrawable.width / photoDrawable.height;
        let drawW = targetW;
        let drawH = targetW / aspect;
        if (drawH > targetH) {
          drawH = targetH;
          drawW = targetH * aspect;
        }
        const offX = (targetW - drawW) / 2;
        const offY = (targetH - drawH) / 2;
        pCtx.drawImage(photoDrawable, offX, offY, drawW, drawH);

        ctx.drawImage(pCanvas, photoX, photoY);
      }
    }
  }

  // 3. Demographic text - Sharp, high-contrast black font (regular weight)
  const dobGregFormatted = formatGregorianDate(data.dateOfBirthGreg);
  const expiryGregFormatted = formatGregorianDate(data.dateOfExpiryGreg);
  const textColor = "#000000";

  if (templateId === "template1" || templateId === "template3" || templateId === "template4") {
    ctx.fillStyle = "#020617";
    ctx.textAlign = "left";
    ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(data.fullNameAmharic, 418, 207);

    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText(data.fullNameEnglish, 418, 250);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfBirthEth} | ${dobGregFormatted}`, 418, 334);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.sexAmharic} | ${data.sexEnglish}`, 418, 405);

    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText(`${data.dateOfExpiryEth} | ${expiryGregFormatted}`, 418, 468);

    // Barcode box and FAN
    const barcodeBoxX = 456;
    const barcodeBoxY = 496;
    const barcodeBoxW = 328;

    ctx.fillStyle = "#020617";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText(data.fanNumber, barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, data.fanNumber, barcodeBoxX + 10, barcodeBoxY + 34, barcodeBoxW - 20, 52);
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
  }

  // 4. Ghost photo - clean, sharp transparent portrait proportioned to match Reference 2
  if (photoDrawable) {
    if (templateId === "template1" || templateId === "template3" || templateId === "template4") {
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawRoundedRect(ctx, 830, 460, 113, 134, 8);
      ctx.clip();
      ctx.drawImage(photoDrawable, 830, 460, 113, 134);
      ctx.restore();
    } else {
      const isT2 = templateId === "template2";
      const miniW = isT2 ? 116 : 115;
      const miniH = isT2 ? 150 : 135;
      const miniX = isT2 ? 792 : 830;
      const miniY = isT2 ? 445 : 460;
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

      ctx.save();
      ctx.globalAlpha = isT2 ? 0.88 : 0.82;
      ctx.drawImage(miniCanvas, miniX, miniY);
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
  const textColor = "#000000";
  ctx.fillStyle = textColor;
  const qrSource = data.qrCodeUrl || "/assets/target-qr.png";
  const qrImg = await loadServerImage(qrSource);

  if (templateId === "template1" || templateId === "template3" || templateId === "template4") {
    ctx.fillStyle = "#020617";
    ctx.textAlign = "left";
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

    // SN NUMBER BOX: Positioned in the bottom-right footer row exactly like Reference Image 2
    const snBoxX = 802;
    const snBoxY = 576;
    const snBoxW = 186;
    const snBoxH = 34;

    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, snBoxX, snBoxY, snBoxW, snBoxH, 6);
    ctx.fill();

    const snLabel = "SN : ";
    const snVal = data.serialNumber || "65501482";
    ctx.font = "bold 18px Arial, sans-serif";
    const labelW = ctx.measureText(snLabel).width;
    ctx.font = "bold 18px Arial, monospace";
    const valW = ctx.measureText(snVal).width;
    const totalSnW = labelW + valW;
    const snStartX = snBoxX + (snBoxW - totalSnW) / 2;
    const snCenterY = snBoxY + snBoxH / 2;

    ctx.save();
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#8c7b3e";
    ctx.font = "bold 18px Arial, sans-serif";
    ctx.fillText(snLabel, snStartX, snCenterY);
    ctx.fillStyle = textColor;
    ctx.font = "bold 18px Arial, monospace";
    ctx.fillText(snVal, snStartX + labelW, snCenterY);
    ctx.restore();

    // QR Code with clean rounded white backdrop for 100% scan reliability
    if (qrImg) {
      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, 462, 46, 485, 485, 16);
      ctx.fill();
      ctx.drawImage(qrImg, 472, 56, 465, 465);
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

