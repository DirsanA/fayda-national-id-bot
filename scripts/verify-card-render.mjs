import { loadImage, createCanvas, GlobalFonts } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";

GlobalFonts.registerFromPath(path.join(process.cwd(), "public", "fonts", "NotoSansEthiopic.ttf"), "NotoSansEthiopic");

const CANVAS_WIDTH = 1011;
const CANVAS_HEIGHT = 638;

function drawRoundedRect(ctx, x, y, width, height, radius) {
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

function drawCode128Barcode(ctx, value, x, y, width, height) {
  const digits = value.replace(/\s+/g, "");
  const bars = [];
  bars.push({ width: 3, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10) || 0;
    bars.push({ width: (d % 3) + 1, isBlack: true });
    bars.push({ width: ((d + 1) % 2) + 1, isBlack: false });
    bars.push({ width: ((d + 2) % 3) + 1, isBlack: true });
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

  ctx.fillStyle = "#000000";
  bars.forEach((b) => {
    const barW = b.width * scale;
    if (b.isBlack) ctx.fillRect(currX, y, barW, height);
    currX += barW;
  });
}

/**
 * Clean, sharp background removal with RGBA transparency.
 * Preserves the original face, eyes, hair details, ears, skin texture, clothing, and natural edges.
 * No blur, no smoothing, no halos, no artificial vignette.
 */
function isolateSubjectClean(srcCanvas) {
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

  const colorDist = (r, g, b) => Math.hypot(r - bgR, g - bgG, b - bgB);

  const isHumanForeground = (r, g, b) => {
    if (r < 75 && g < 75 && b < 75) return true;
    if (r > b + 28 && r > 85 && g > 60) return true;
    return false;
  };

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let qHead = 0, qTail = 0;
  const maxDepthY = Math.floor(h * 0.80);

  for (let x = 0; x < w; x++) {
    const idx = (0 * w + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    if (!isHumanForeground(r, g, b) && colorDist(r, g, b) < distThresh) {
      visited[x] = 1;
      queue[qTail++] = x;
    }
  }

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

  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      const idx = p * 4;
      const d = colorDist(data[idx], data[idx + 1], data[idx + 2]);
      if (d <= solidThresh) {
        data[idx + 3] = 0;
      } else {
        const factor = (d - solidThresh) / (distThresh - solidThresh);
        data[idx + 3] = Math.round(Math.max(0, Math.min(255, factor * 255)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return srcCanvas;
}

async function renderCard() {
  const frontTemplate = await loadImage("public/assets/front2.png");
  const backTemplate = await loadImage("public/assets/back2.png");
  const qrImg = await loadImage("public/assets/target-qr.png");
  const rawPhoto = await loadImage("scratch/bilise_portrait.png");

  // Perform background removal on source image
  const photoCanvas = createCanvas(rawPhoto.width, rawPhoto.height);
  const photoCtx = photoCanvas.getContext("2d");
  photoCtx.imageSmoothingEnabled = true;
  photoCtx.drawImage(rawPhoto, 0, 0);
  isolateSubjectClean(photoCanvas);

  const GAP_PX = 15;
  const combined = createCanvas(CANVAS_WIDTH * 2 + GAP_PX, CANVAS_HEIGHT);
  const ctx = combined.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // Base templates
  ctx.drawImage(frontTemplate, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const backOffset = CANVAS_WIDTH + GAP_PX;
  ctx.drawImage(backTemplate, backOffset, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // ================= FRONT CARD =================

  // 1. Main Portrait: Sized & positioned to match Reference 2 (x: 72, y: 198, w: 282, h: 354)
  const targetW = 282;
  const targetH = 354;
  const photoX = 72;
  const photoY = 198;

  const pCanvas = createCanvas(targetW, targetH);
  const pCtx = pCanvas.getContext("2d");
  pCtx.imageSmoothingEnabled = true;

  const aspect = photoCanvas.width / photoCanvas.height;
  let drawW = targetW;
  let drawH = targetW / aspect;
  if (drawH < targetH) {
    drawH = targetH;
    drawW = targetH * aspect;
  }
  const offX = (targetW - drawW) / 2;
  const offY = (targetH - drawH) / 2;
  pCtx.drawImage(photoCanvas, offX, offY, drawW, drawH);

  ctx.drawImage(pCanvas, photoX, photoY);

  // 2. Secondary Mini Portrait: Positioned at bottom right below Faida star emblem (x: 792, y: 445, w: 116, h: 150)
  const miniW = 116;
  const miniH = 150;
  const miniX = 792;
  const miniY = 445;

  const miniCanvas = createCanvas(miniW, miniH);
  const mCtx = miniCanvas.getContext("2d");
  mCtx.imageSmoothingEnabled = true;

  let mDrawW = miniW;
  let mDrawH = miniW / aspect;
  if (mDrawH < miniH) {
    mDrawH = miniH;
    mDrawW = miniH * aspect;
  }
  mCtx.drawImage(photoCanvas, (miniW - mDrawW) / 2, (miniH - mDrawH) / 2, mDrawW, mDrawH);

  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.drawImage(miniCanvas, miniX, miniY);
  ctx.restore();

  // 3. Demographic text - Left-aligned to vertical grid line x = 398
  const textX = 398;
  const textColor = "#000000";
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";

  // Full Name
  ctx.font = "22px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ቢሊሴ ራቡማ ደሲሳ", textX, 210);

  ctx.font = "20px Arial, sans-serif";
  ctx.fillText("Bilise Rabuma Desisa", textX, 238);

  // Date of Birth
  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("29/12/2010 | 04/Sep/2018", textX, 320);

  // Sex
  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ሴት | Female", textX, 388);

  // Date of Expiry (18-20px clear separation from Sex)
  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("2027/02/03 | 2034/Oct/13", textX, 452);

  // FAN Barcode Box (reduced by 10% to prevent collision, aligned bottom-center)
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
  ctx.fillText("4629 0367 9524 0927", fanBoxX + fanBoxW / 2, fanBoxY + 26);
  ctx.textAlign = "left";
  drawCode128Barcode(ctx, "4629036795240927", fanBoxX + 12, fanBoxY + 32, fanBoxW - 24, 54);

  // ================= BACK CARD =================

  // 1. Text Column: Strict vertical grid x = backOffset + 60
  const backTextX = backOffset + 60;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";

  // Phone Number
  ctx.font = "22px Arial, sans-serif";
  ctx.fillText("0932827165", backTextX, 108);

  // Disclaimer: (በተገለጠው መሰረት / Self Declared)
  ctx.font = "16px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillStyle = textColor;
  ctx.fillText("(በተገለጠው መሰረት / Self Declared)", backTextX, 145);

  // Address lines (stacked with 28px equal spacing, >125px padding above footer)
  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ኦሮሚያ", backTextX, 246);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("Oromia", backTextX, 274);

  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ምዕራብ ሸዋ", backTextX, 302);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("West Shawa", backTextX, 330);

  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ባኮ ቲቤ", backTextX, 358);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("Bako Tibe", backTextX, 386);

  // FIN Box: centered numeric string
  const finBoxX = backOffset + 169;
  const finBoxY = 513;
  const finBoxW = 253;
  const finBoxH = 51;

  ctx.save();
  ctx.font = "22px Arial, monospace";
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("9817-4314-7136", finBoxX + finBoxW / 2, finBoxY + finBoxH / 2);
  ctx.restore();

  // QR Code
  if (qrImg) {
    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, backOffset + 462, 46, 485, 485, 16);
    ctx.fill();
    ctx.drawImage(qrImg, backOffset + 472, 56, 465, 465);
  }

  // 2. SN NUMBER BOX: Positioned in the bottom-right footer row exactly like Reference Image 2
  const snBoxX = backOffset + 802;
  const snBoxY = 576;
  const snBoxW = 186;
  const snBoxH = 34;

  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, snBoxX, snBoxY, snBoxW, snBoxH, 6);
  ctx.fill();

  const snLabel = "SN : ";
  const snVal = "6878747";
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

  const outPath = "scratch/verified-modern-blue.png";
  fs.writeFileSync(outPath, combined.toBuffer("image/png"));
  console.log(`Saved newly verified card to ${outPath}`);
}

await renderCard();
