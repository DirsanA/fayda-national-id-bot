import sharp from 'sharp';
import fs from 'fs';

async function createBlankTemplates() {
  const frontSrc = 'C:/Users/abate/.gemini/antigravity-ide/brain/b0d440fc-6a4f-4ae8-bc17-fde2355da842/.user_uploaded/media_1791527843705.png';
  const backSrc = 'C:/Users/abate/.gemini/antigravity-ide/brain/b0d440fc-6a4f-4ae8-bc17-fde2355da842/.user_uploaded/media_1791527844101.png';

  // 1. Process Front Template (1011 x 638)
  const frontImg = sharp(frontSrc).resize(1011, 638, { fit: 'fill', kernel: 'lanczos3' });
  const frontBuffer = await frontImg.raw().toBuffer({ resolveWithObject: true });

  const fData = frontBuffer.data;
  const fWidth = frontBuffer.info.width;
  const fChannels = frontBuffer.info.channels;

  // Function to fill a rectangle with a gradient or solid color
  function fillRect(x1, y1, w, h, r, g, b, alpha = 255) {
    for (let y = y1; y < y1 + h && y < 638; y++) {
      for (let x = x1; x < x1 + w && x < 1011; x++) {
        const idx = (y * fWidth + x) * fChannels;
        fData[idx] = r;
        fData[idx + 1] = g;
        fData[idx + 2] = b;
        if (fChannels === 4) fData[idx + 3] = alpha;
      }
    }
  }

  // Linear gradient fill between two colors
  function fillGradX(x1, y1, w, h, c1, c2) {
    for (let x = x1; x < x1 + w && x < 1011; x++) {
      const t = (x - x1) / w;
      const r = Math.round(c1[0] * (1 - t) + c2[0] * t);
      const g = Math.round(c1[1] * (1 - t) + c2[1] * t);
      const b = Math.round(c1[2] * (1 - t) + c2[2] * t);
      for (let y = y1; y < y1 + h && y < 638; y++) {
        const idx = (y * fWidth + x) * fChannels;
        fData[idx] = r;
        fData[idx + 1] = g;
        fData[idx + 2] = b;
        if (fChannels === 4) fData[idx + 3] = 255;
      }
    }
  }

  // A. Blank out Photo area: x: 45 to 305, y: 135 to 480
  // Background here is mint gradient: rgb(194, 242, 231) -> rgb(216, 248, 240)
  fillGradX(45, 135, 265, 345, [196, 242, 232], [216, 248, 240]);

  // B. Blank out Text Values areas: x: 345 to 730
  // Name values: y: 175 to 245
  fillGradX(345, 175, 385, 75, [222, 247, 238], [242, 245, 222]);
  // DOB value: y: 285 to 325
  fillGradX(345, 285, 385, 42, [222, 247, 238], [242, 245, 222]);
  // Sex value: y: 365 to 405
  fillGradX(345, 365, 385, 42, [222, 247, 238], [242, 245, 222]);
  // Expiry value: y: 445 to 485
  fillGradX(345, 445, 385, 42, [222, 247, 238], [242, 245, 222]);

  // C. Blank out Barcode box: x: 405 to 735, y: 495 to 595 with pure white
  fillRect(405, 495, 330, 100, 255, 255, 255);

  // D. Blank out Ghost Photo: x: 825 to 940, y: 485 to 615
  fillGradX(825, 485, 115, 130, [240, 248, 225], [230, 245, 220]);

  await sharp(fData, {
    raw: {
      width: fWidth,
      height: 638,
      channels: fChannels,
    },
  })
    .png()
    .toFile('public/assets/card-front-blank.png');

  console.log('card-front-blank.png generated!');

  // 2. Process Back Template (1011 x 638)
  const backImg = sharp(backSrc).resize(1011, 638, { fit: 'fill', kernel: 'lanczos3' });
  const backBuffer = await backImg.raw().toBuffer({ resolveWithObject: true });

  const bData = backBuffer.data;
  const bWidth = backBuffer.info.width;
  const bChannels = backBuffer.info.channels;

  function fillBackGradX(x1, y1, w, h, c1, c2) {
    for (let x = x1; x < x1 + w && x < 1011; x++) {
      const t = (x - x1) / w;
      const r = Math.round(c1[0] * (1 - t) + c2[0] * t);
      const g = Math.round(c1[1] * (1 - t) + c2[1] * t);
      const b = Math.round(c1[2] * (1 - t) + c2[2] * t);
      for (let y = y1; y < y1 + h && y < 638; y++) {
        const idx = (y * bWidth + x) * bChannels;
        bData[idx] = r;
        bData[idx + 1] = g;
        bData[idx + 2] = b;
        if (bChannels === 4) bData[idx + 3] = 255;
      }
    }
  }

  function fillBackRect(x1, y1, w, h, r, g, b) {
    for (let y = y1; y < y1 + h && y < 638; y++) {
      for (let x = x1; x < x1 + w && x < 1011; x++) {
        const idx = (y * bWidth + x) * bChannels;
        bData[idx] = r;
        bData[idx + 1] = g;
        bData[idx + 2] = b;
        if (bChannels === 4) bData[idx + 3] = 255;
      }
    }
  }

  // A. Blank out Phone value: x: 35 to 430, y: 70 to 110
  fillBackGradX(35, 70, 395, 42, [210, 245, 235], [230, 250, 240]);

  // B. Blank out Nationality value: x: 35 to 430, y: 165 to 205
  fillBackGradX(35, 165, 395, 42, [210, 245, 235], [230, 250, 240]);

  // C. Blank out Address values: x: 35 to 430, y: 240 to 450
  fillBackGradX(35, 240, 395, 215, [210, 245, 235], [230, 250, 240]);

  // D. Blank out FIN box interior: x: 105 to 330, y: 520 to 575 with pure white
  fillBackRect(105, 520, 225, 55, 255, 255, 255);

  // E. Blank out QR Code box: x: 440 to 970, y: 30 to 565 with pure white
  fillBackRect(440, 30, 530, 535, 255, 255, 255);

  // F. Blank out SN number in SN badge: x: 820 to 970, y: 575 to 625 with pure white
  fillBackRect(820, 575, 150, 50, 255, 255, 255);

  await sharp(bData, {
    raw: {
      width: bWidth,
      height: 638,
      channels: bChannels,
    },
  })
    .png()
    .toFile('public/assets/card-back-blank.png');

  console.log('card-back-blank.png generated!');
}

createBlankTemplates().catch(console.error);
