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

function isolateSubjectWithFeathering(srcCanvas, isMini = false) {
  const w = srcCanvas.width;
  const h = srcCanvas.height;
  const ctx = srcCanvas.getContext("2d");
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

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

  const isIndoorBg = (bgR + bgG + bgB) / 3 > 140;
  const bgMask = new Uint8Array(w * h);

  if (isIndoorBg) {
    const visited = new Uint8Array(w * h);
    const queue = [];
    const colorDist = (r, g, b) => Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    const maxSideY = Math.floor(h * 0.68);

    for (let x = 0; x < w; x++) {
      const idx = (0 * w + x) * 4;
      if (colorDist(data[idx], data[idx + 1], data[idx + 2]) < 55) {
        visited[x] = 1;
        bgMask[x] = 1;
        queue.push(x);
      }
    }

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

  const alphaMap = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alphaMap[i] = bgMask[i] ? 0.0 : 1.0;

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

async function renderVerifiedCard() {
  const frontImg = await loadImage("public/assets/front2.png");
  const backImg = await loadImage("public/assets/back2.png");
  const qrImg = await loadImage("public/assets/target-qr.png");
  const manImg = await loadImage("scratch/man_portrait_from_img1.png");

  const GAP_PX = 15;
  const combined = createCanvas(CANVAS_WIDTH * 2 + GAP_PX, CANVAS_HEIGHT);
  const ctx = combined.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // FRONT
  ctx.drawImage(frontImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Portrait
  const pCanvas = createCanvas(320, 430);
  const pCtx = pCanvas.getContext("2d");
  const aspect = manImg.width / manImg.height;
  let drawW = 320, drawH = 320 / aspect;
  if (drawH < 430) { drawH = 430; drawW = 430 * aspect; }
  pCtx.drawImage(manImg, (320 - drawW) / 2, (430 - drawH) / 2, drawW, drawH);
  isolateSubjectWithFeathering(pCanvas, false);
  ctx.drawImage(pCanvas, 55, 125);

  // Mini Portrait
  const mCanvas = createCanvas(115, 135);
  const mCtx = mCanvas.getContext("2d");
  let mDrawW = 115, mDrawH = 115 / aspect;
  if (mDrawH < 135) { mDrawH = 135; mDrawW = 135 * aspect; }
  mCtx.drawImage(manImg, (115 - mDrawW) / 2, (135 - mDrawH) / 2, mDrawW, mDrawH);
  isolateSubjectWithFeathering(mCanvas, true);
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.drawImage(mCanvas, 830, 460);
  ctx.restore();

  // Strict vertical grid line: x = 398
  const textX = 398;
  const textColor = "#000000";
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";

  // Center column text
  ctx.font = "22px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ድርሳን አንተሁነ ጋሹ", textX, 210);

  ctx.font = "20px Arial, sans-serif";
  ctx.fillText("Dirsan Antehun Gashu", textX, 238);

  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("7/12/1994 | 2002/Aug/13", textX, 320);

  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ወንድ | Male", textX, 388);

  // 15-20px clear vertical separation above Expiry label
  ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("08/02/2027 | 18/Oct/2034", textX, 452);

  // Barcode container reduced by 10% (to 244px)
  const fanBoxW = 244;
  const fanBoxH = 96;
  const fanBoxX = 460;
  const fanBoxY = 502;

  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, fanBoxX, fanBoxY, fanBoxW, fanBoxH, 10);
  ctx.fill();

  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, fanBoxX, fanBoxY, fanBoxW, fanBoxH, 10);
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = "20px monospace";
  ctx.textAlign = "center";
  ctx.fillText("4952 8025 7094 3927", fanBoxX + fanBoxW / 2, fanBoxY + 26);
  ctx.textAlign = "left";
  drawCode128Barcode(ctx, "4952802570943927", fanBoxX + 12, fanBoxY + 32, fanBoxW - 24, 54);

  // BACK
  const backX = CANVAS_WIDTH + GAP_PX;
  ctx.drawImage(backImg, backX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const backTextX = backX + 60;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";

  // Phone
  ctx.font = "23px Arial, sans-serif";
  ctx.fillText("0943599259", backTextX, 82);

  // Self declared with correct Ge'ez 'ጠ'
  ctx.font = "14.5px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("(በተገለጠው መሰረት / Self Declared)", backTextX, 145);

  // Stacked address lines with equal vertical spacing (28px step), ample padding above footer
  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("አማራ", backTextX, 246);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("Amhara", backTextX, 274);

  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ምዕራብ ጎጃም ዞን", backTextX, 302);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("West Gojjam Zone", backTextX, 330);

  ctx.font = "19px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillText("ሰሜን ሜጫ", backTextX, 358);
  ctx.font = "19px Arial, sans-serif";
  ctx.fillText("Semen Mecha", backTextX, 386);

  // CENTER FIN: Vertically and horizontally center numeric string inside white box
  const finBoxX = backX + 169;
  const finBoxY = 513;
  const finBoxW = 253;
  const finBoxH = 51;

  ctx.save();
  ctx.font = "22px Arial, monospace";
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("385935169405", finBoxX + finBoxW / 2, finBoxY + finBoxH / 2);
  ctx.restore();

  // CENTER SN: Symmetrically center "SN : 65501482" inside white pill box with even padding
  const snBoxX = backX + 765;
  const snBoxY = 552;
  const snBoxW = 205;
  const snBoxH = 50;

  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, snBoxX, snBoxY, snBoxW, snBoxH, 8);
  ctx.fill();

  const snLabel = "SN : ";
  const snVal = "65501482";
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

  // QR Code
  ctx.fillStyle = "#FFFFFF";
  drawRoundedRect(ctx, backX + 462, 46, 485, 485, 16);
  ctx.fill();
  ctx.drawImage(qrImg, backX + 472, 56, 465, 465);

  const outPath = "scratch/verified-final-card.png";
  fs.writeFileSync(outPath, combined.toBuffer("image/png"));
  console.log("Successfully generated:", outPath);
}

renderVerifiedCard().catch(console.error);
