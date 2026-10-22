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
  if (templateId === "template1" || templateId === "template3") {
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
    // 1. FRONT: strict vertical grid line, spacing, and 10% barcode reduction
    const textX = 398;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "left";

    ctx.font = "22px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("አበበ በቀለ ደስታ", textX, 210);

    ctx.font = "20px Arial, sans-serif";
    ctx.fillText("Abebe Bekele Desta", textX, 238);

    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("12/04/1988 | 20/12/1995", textX, 320);

    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("ወንድ | Male", textX, 388);

    // SPACING: Increased vertical Y-offset between Sex (388) and Expiry (452)
    ctx.font = "20px NotoSansEthiopic, Arial, sans-serif";
    ctx.fillText("12/04/2000 | 20/12/2007", textX, 452);

    // BARCODE: Reduce "FAN" barcode box horizontally by 10% (270 -> 244px), aligned bottom-center
    const barcodeBoxW = 244;
    const barcodeBoxH = 96;
    const barcodeBoxX = 460;
    const barcodeBoxY = 502;

    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, barcodeBoxX, barcodeBoxY, barcodeBoxW, barcodeBoxH, 10);
    ctx.fill();

    ctx.fillStyle = "#000000";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("4952 8025 7094 3927", barcodeBoxX + barcodeBoxW / 2, barcodeBoxY + 26);
    ctx.textAlign = "left";
    drawCode128Barcode(ctx, "4952802570943927", barcodeBoxX + 12, barcodeBoxY + 32, barcodeBoxW - 24, 54);
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
  if (templateId === "template1" || templateId === "template3") {
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
    // 2. BACK: strict vertical grid line, address spacing, centered FIN & SN
    const backTextX = backX + 60;
    ctx.fillStyle = "#000000";
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
    ctx.fillStyle = "#000000";
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
    ctx.fillStyle = "#000000";
    ctx.font = "18px Arial, monospace";
    ctx.fillText(snVal, snStartX + labelW, snCenterY);
    ctx.restore();

    // QR with white backdrop
    ctx.fillStyle = "#FFFFFF";
    drawRoundedRect(ctx, backX + 462, 46, 485, 485, 16);
    ctx.fill();
    ctx.drawImage(qrImg, backX + 472, 56, 465, 465);
  }

  const outBuf = combinedCanvas.toBuffer("image/png");
  fs.writeFileSync("./scratch/perfect-" + templateId + ".png", outBuf);
  console.log("Saved perfect-" + templateId + ".png");
}

async function main() {
  await renderCard("template1", "card-front-template.png", "card-back-template.png");
  await renderCard("template2", "front2.png", "back2.png");
  await renderCard("template3", "card-front-template.png", "card-back-template.png");
}
main().catch(console.error);
