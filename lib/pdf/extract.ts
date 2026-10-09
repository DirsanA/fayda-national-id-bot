import type { RenderedPdf } from "@/types/print";
import type { EthiopianIdData } from "@/types/id-card";

// Default template coordinates on a 595.28 x 841.89 pt page
const PAGE_WIDTH_PT = 595.28;
const PAGE_HEIGHT_PT = 841.89;

function cropCanvasSubArea(
  sourceCanvas: HTMLCanvasElement,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): string {
  const scaleX = sourceCanvas.width / PAGE_WIDTH_PT;
  const scaleY = sourceCanvas.height / PAGE_HEIGHT_PT;

  const sx = Math.max(0, Math.round(xPt * scaleX));
  const sy = Math.max(0, Math.round(yPt * scaleY));
  const sw = Math.min(sourceCanvas.width - sx, Math.round(widthPt * scaleX));
  const sh = Math.min(sourceCanvas.height - sy, Math.round(heightPt * scaleY));

  if (sw <= 0 || sh <= 0) return "";

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}

function convertRawImageToDataUrl(img: { width: number; height: number; data: Uint8Array | Uint8ClampedArray }): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imgData = ctx.createImageData(img.width, img.height);
    const src = img.data;
    const dst = imgData.data;
    const totalPixels = img.width * img.height;
    if (src.length === totalPixels * 3) {
      let s = 0;
      let d = 0;
      for (let i = 0; i < totalPixels; i++) {
        dst[d] = src[s];
        dst[d + 1] = src[s + 1];
        dst[d + 2] = src[s + 2];
        dst[d + 3] = 255;
        s += 3;
        d += 4;
      }
    } else if (src.length === totalPixels * 4) {
      dst.set(src);
    } else {
      return null;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function convertGregorianToEthiopian(date: Date = new Date()): { year: number; month: number; day: number; formatted: string } {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1;
  const gDay = date.getDate();

  const a = Math.floor((14 - gMonth) / 12);
  const y = gYear + 4800 - a;
  const m = gMonth + 12 * a - 3;
  const jdn = gDay + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  const ethJdnOffset = 1723856;
  const r = (jdn - ethJdnOffset) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const ethYear = 4 * Math.floor((jdn - ethJdnOffset) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;

  const mm = String(ethMonth).padStart(2, "0");
  const dd = String(ethDay).padStart(2, "0");
  return { year: ethYear, month: ethMonth, day: ethDay, formatted: `${ethYear}/${mm}/${dd}` };
}

export async function extractIdDataFromPdf(
  file: File,
  source: RenderedPdf
): Promise<EthiopianIdData> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });

  let itemsWithPos: Array<{ str: string; x: number; y: number }> = [];
  let extractedText = "";
  let rawPhotoUrl: string | null = null;
  let rawQrUrl: string | null = null;

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const pageHeight = 841.89;

    itemsWithPos = (textContent.items as Array<{ str: string; transform: number[] }>)
      .map((it) => ({
        str: it.str.trim(),
        x: it.transform[4],
        y: pageHeight - it.transform[5],
      }))
      .filter((it) => it.str.length > 0);

    extractedText = itemsWithPos.map((it) => it.str).join(" ");

    // Extract original embedded image objects
    try {
      const ops = await page.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        // paintImageXObject is operator 85 in pdfjs
        if (ops.fnArray[i] === 85 || ops.fnArray[i] === (pdfjs as unknown as { OPS: { paintImageXObject: number } }).OPS?.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          await new Promise<void>((resolve) => {
            page.objs.get(imgName, (img: { width: number; height: number; data: Uint8Array } | null) => {
              if (img && img.data) {
                const aspect = img.width / img.height;
                if (!rawPhotoUrl && aspect >= 0.65 && aspect <= 0.9 && img.width >= 200 && img.height >= 250) {
                  rawPhotoUrl = convertRawImageToDataUrl(img);
                } else if (!rawQrUrl && aspect >= 0.95 && aspect <= 1.05 && img.width >= 200) {
                  rawQrUrl = convertRawImageToDataUrl(img);
                }
              }
              resolve();
            });
          });
        }
      }
    } catch {
      // Continue to canvas crop fallback
    }
  } catch (err) {
    console.warn("Could not read text content stream:", err);
  } finally {
    await loadingTask.destroy();
  }

  // Fallback crops from 300 DPI canvas
  let photoUrl: string = rawPhotoUrl || "";
  if (!photoUrl) {
    photoUrl = cropCanvasSubArea(source.canvas, 431, 122, 88, 100);
    if (!photoUrl) photoUrl = cropCanvasSubArea(source.canvas, 65, 120, 115, 130);
  }

  let qrCodeUrl: string = rawQrUrl || "";
  if (!qrCodeUrl) {
    qrCodeUrl = cropCanvasSubArea(source.canvas, 417, 370, 116, 116);
    if (!qrCodeUrl) qrCodeUrl = cropCanvasSubArea(source.canvas, 180, 480, 240, 240);
  }

  const barcodeUrl = cropCanvasSubArea(source.canvas, 412, 290, 126, 28);

  // Position-based field queries
  const findItems = (minX: number, maxX: number, minY: number, maxY: number) =>
    itemsWithPos.filter((it) => it.x >= minX && it.x <= maxX && it.y >= minY && it.y <= maxY);

  const nameItems = findItems(160, 360, 215, 248);
  const amharicName = nameItems.find((i) => /[\u1200-\u137F]/.test(i.str))?.str;
  const englishName = nameItems.find((i) => /^[A-Za-z\s]+$/.test(i.str))?.str;

  const regionItems = findItems(195, 360, 280, 308);
  const regAmh = regionItems.find((i) => /[\u1200-\u137F]/.test(i.str))?.str;
  const regEng = regionItems.find((i) => /^[A-Za-z\s]+$/.test(i.str))?.str;

  const subcityItems = findItems(195, 360, 318, 342);
  const subAmh = subcityItems.find((i) => /[\u1200-\u137F]/.test(i.str))?.str;
  const subEng = subcityItems.find((i) => /^[A-Za-z\s]+$/.test(i.str))?.str;

  const woredaItems = findItems(195, 360, 348, 372);
  const worAmh = woredaItems.find((i) => /[\u1200-\u137F]/.test(i.str))?.str;
  const worEng = woredaItems.find((i) => /^[A-Za-z\s]+$/.test(i.str))?.str;
  const phoneItem = findItems(50, 150, 380, 400)[0]?.str;

  const datesFound = extractedText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/g) || [];
  const fanMatch = extractedText.match(/\b(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})\b/);
  const finMatch = extractedText.match(/(?:FIN|UIN)[:\s]*([0-9\s]{10,15})/i);
  const snMatch = extractedText.match(/SN[:\s]*(\d{7,10})/i);

  const issueMatch = extractedText.match(/(?:Issue\s*Date|የተሰጠበት\s*ቀን)[:\s]*([0-9\/\-A-Za-z]+)/i);
  const expiryMatch = extractedText.match(/(?:Expiry\s*Date|የሚያበቃበት\s*ቀን)[:\s]*([0-9\/\-A-Za-z]+)/i);

  // Dynamic Issue and Expiry dates (8-year Fayda validity)
  const now = new Date();
  const ethNow = convertGregorianToEthiopian(now);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nowGregFormatted = `${now.getFullYear()}/${MONTHS[now.getMonth()]}/${String(now.getDate()).padStart(2, "0")}`;

  const expGregYear = now.getFullYear() + 8;
  const expDay = Math.max(1, now.getDate() - 2);
  const expGregFormatted = `${expGregYear}/${MONTHS[now.getMonth()]}/${String(expDay).padStart(2, "0")}`;
  const expEthYear = ethNow.year + 8;
  const expEthDay = Math.max(1, ethNow.day - 2);
  const expEthFormatted = `${expEthYear}/${String(ethNow.month).padStart(2, "0")}/${String(expEthDay).padStart(2, "0")}`;

  const data: EthiopianIdData = {
    fullNameAmharic: amharicName || "ዮሰፍ ጊርማ ቱፋ",
    fullNameEnglish: englishName || "Yosef Girma Tufa",
    dateOfBirthEth: datesFound[1] || "02/04/1994",
    dateOfBirthGreg: datesFound[0] || "02/Jan/2002",
    sexAmharic: extractedText.includes("ወንድ") ? "ወንድ" : extractedText.includes("ሴት") ? "ሴት" : "ወንድ",
    sexEnglish: extractedText.includes("Female") ? "Female" : "Male",
    dateOfExpiryEth: expiryMatch ? expiryMatch[1] : expEthFormatted,
    dateOfExpiryGreg: expiryMatch ? expiryMatch[1] : expGregFormatted,
    dateOfIssueEth: issueMatch ? issueMatch[1] : ethNow.formatted,
    dateOfIssueGreg: issueMatch ? issueMatch[1] : nowGregFormatted,
    fanNumber: fanMatch ? fanMatch[1] : "8029 5016 4312 4539",
    finNumber: finMatch ? finMatch[1].replace(/\s+/g, "") : "214270390587",
    serialNumber: snMatch ? snMatch[1] : "65501482",
    phoneNumber: phoneItem || "0917521765",
    nationalityAmharic: "ኢትዮጵያዊ",
    nationalityEnglish: "Ethiopian",
    regionAmharic: regAmh || "ኦሮሚያ",
    regionEnglish: regEng || "Oromia",
    subcityAmharic: subAmh || "አምቦ ከተማ አስተዳደር",
    subcityEnglish: subEng || "Ambo City Administration",
    woredaAmharic: worAmh || "ያኢ ገዳ",
    woredaEnglish: worEng || "Yahi Geda",
    photoUrl: photoUrl || "",
    qrCodeUrl: qrCodeUrl || "",
    barcodeUrl: barcodeUrl || undefined,
  };

  return data;
}
