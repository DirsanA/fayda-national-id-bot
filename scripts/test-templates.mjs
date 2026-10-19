import path from "path";
import fs from "fs";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";

try {
  const fontPath = path.join(process.cwd(), "public", "fonts", "NotoSansEthiopic.ttf");
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, "NotoSansEthiopic");
  }
} catch (e) {}

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
  ctx.fillStyle = "#020617";
  bars.forEach((b) => {
    const barW = b.width * scale;
    if (b.isBlack) ctx.fillRect(currX, y, barW, height);
    currX += barW;
  });
}

async function renderCard(templateId, frontFile, backFile) {
  const fPath = path.join(process.cwd(), "public", "assets", frontFile);
  const bPath = path.join(process.cwd(), "public", "assets", backFile);
  const fImg = await loadImage(fPath);
  const bImg = await loadImage(bPath);
  const qrImg = await loadImage(path.join(process.cwd(), "public", "assets", "target-qr.png"));

  const GAP_PX = 15;
  const combinedCanvas = createCanvas(CANVAS_WIDTH * 2 + GAP_PX, CANVAS_HEIGHT);
  const ctx = combinedCanvas.getContext("2d");

  // FRONT
  ctx.drawImage(fImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Front Coordinates per template
  ctx.fillStyle = "#020617";
  if (templateId === "template1") {
    ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አበበ በቀለ ደስታ", 418, 207);
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText("Abebe Bekele Desta", 418, 250);
    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("12/04/1988 | 20/12/1995", 418, 334);
    ctx.fillText("ወንድ | Male", 418, 405);
    ctx.fillText("12/04/2000 | 20/12/2007", 418, 468);

    const barcodeBoxX = 456;
    const barcodeBoxY = 496;
    const barcodeBoxW = 328;
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("4952 8025 7094 3927", barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, "4952802570943927", barcodeBoxX + 10, barcodeBoxY + 34, barcodeBoxW - 20, 52);
  } else if (templateId === "template2") {
    ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አበበ በቀለ ደስታ", 418, 208);
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText("Abebe Bekele Desta", 418, 245);
    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("12/04/1988 | 20/12/1995", 418, 325);
    ctx.fillText("ወንድ | Male", 418, 405);
    ctx.fillText("12/04/2000 | 20/12/2007", 418, 485);

    const barcodeBoxX = 450;
    const barcodeBoxY = 515;
    const barcodeBoxW = 380;
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("4952 8025 7094 3927", barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, "4952802570943927", barcodeBoxX + 15, barcodeBoxY + 32, barcodeBoxW - 30, 48);
  } else if (templateId === "template3") {
    ctx.font = "bold 26px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አበበ በቀለ ደስታ", 418, 190);
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText("Abebe Bekele Desta", 418, 228);
    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("12/04/1988 | 20/12/1995", 418, 300);
    ctx.fillText("ወንድ | Male", 418, 380);
    ctx.fillText("12/04/2000 | 20/12/2007", 418, 468);

    const barcodeBoxX = 445;
    const barcodeBoxY = 490;
    const barcodeBoxW = 275;
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("4952 8025 7094 3927", barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 24);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, "4952802570943927", barcodeBoxX + 10, barcodeBoxY + 30, barcodeBoxW - 20, 52);
  }

  // Vertical Issue date
  ctx.save();
  ctx.translate(38, 605);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "bold 14px NotoSansEthiopic, Arial, sans-serif";
  ctx.fillStyle = "#C68932";
  ctx.fillText("የተሰጠበት ቀን: ", 0, 0);
  const w1 = ctx.measureText("የተሰጠበት ቀን: ").width;
  ctx.fillStyle = "#020617";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText("12/04/1990", w1, 0);
  ctx.restore();

  // BACK
  const backX = CANVAS_WIDTH + GAP_PX;
  ctx.drawImage(bImg, backX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = "#020617";
  if (templateId === "template1") {
    ctx.font = "bold 25px Arial, sans-serif";
    ctx.fillText("+251911223344", backX + 40, 110);
    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ኢትዮጵያዊ | Ethiopian", backX + 40, 194);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አዲስ አበባ", backX + 40, 258);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Addis Ababa", backX + 40, 293);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ቦሌ", backX + 40, 330);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Bole", backX + 40, 359);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ወረዳ 03", backX + 40, 395);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Woreda 03", backX + 40, 430);

    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText("FIN  9876 5432 1098", backX + 104, 546);
    ctx.font = "bold 19px Arial, monospace";
    ctx.fillText("65501482", backX + 835, 597);
    ctx.drawImage(qrImg, backX + 462, 47, 490, 490);
  } else if (templateId === "template2") {
    ctx.font = "bold 25px Arial, sans-serif";
    ctx.fillText("+251911223344", backX + 40, 95);
    // Nationality is already embedded in template 2 background
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አዲስ አበባ", backX + 40, 250);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Addis Ababa", backX + 40, 282);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ቦሌ", backX + 40, 315);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Bole", backX + 40, 345);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ወረዳ 03", backX + 40, 380);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Woreda 03", backX + 40, 412);

    // FIN Box
    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText("9876 5432 1098", backX + 175, 548);

    // SN Box
    ctx.font = "bold 19px Arial, monospace";
    ctx.fillText("65501482", backX + 850, 612);

    // QR with white backdrop
    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, backX + 452, 38, 506, 506, 12);
    ctx.fill();
    ctx.drawImage(qrImg, backX + 460, 46, 490, 490);
  } else if (templateId === "template3") {
    ctx.font = "bold 25px Arial, sans-serif";
    ctx.fillText("+251911223344", backX + 35, 140);
    ctx.font = "bold 23px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ኢትዮጵያዊ | Ethiopian", backX + 35, 245);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አዲስ አበባ", backX + 35, 330);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Addis Ababa", backX + 35, 360);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ቦሌ", backX + 35, 390);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Bole", backX + 35, 418);
    ctx.font = "bold 21px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ወረዳ 03", backX + 35, 448);
    ctx.font = "bold 21px Arial, sans-serif";
    ctx.fillText("Woreda 03", backX + 35, 478);

    // FIN Box
    ctx.font = "bold 22px Arial, monospace";
    ctx.fillText("FIN  9876 5432 1098", backX + 104, 562);

    // SN Box
    ctx.font = "bold 19px Arial, monospace";
    ctx.fillText("65501482", backX + 825, 620);

    // QR
    ctx.drawImage(qrImg, backX + 455, 45, 490, 490);
  }

  const outBuf = combinedCanvas.toBuffer("image/png");
  fs.writeFileSync("./scratch/perfect-" + templateId + ".png", outBuf);
  console.log("Saved perfect-" + templateId + ".png");
}

async function main() {
  await renderCard("template1", "card-front-template.png", "card-back-template.png");
  await renderCard("template2", "front2.png", "back2.png");
  await renderCard("template3", "front3.png", "back3.png");
}
main().catch(console.error);
