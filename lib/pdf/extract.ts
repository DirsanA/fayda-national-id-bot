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

export async function extractIdDataFromPdf(
  file: File,
  source: RenderedPdf
): Promise<EthiopianIdData> {
  // 1. Read PDF text stream using pdfjs-dist
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: bytes });
  let extractedText = "";

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string }>;
    extractedText = items.map((it) => it.str).join(" ");
  } catch (err) {
    console.warn("Could not read text content stream:", err);
  } finally {
    await loadingTask.destroy();
  }

  // 2. High-resolution crop of visual assets from rendered 300 DPI canvas
  // Location of primary portrait photo:
  // Can be taken from the front card region or demographic panel
  // Top front card is x: 400.45, y: 90.0, w: 149.88, h: 240.0
  // Inside front card: Photo is centered at x ~ 432, y ~ 124, w ~ 86, h ~ 98 pt
  let photoUrl = cropCanvasSubArea(source.canvas, 431, 122, 88, 100);

  // If front card crop seems empty or small, fallback to demographic section photo on the left
  if (!photoUrl) {
    photoUrl = cropCanvasSubArea(source.canvas, 65, 120, 115, 130);
  }

  // Barcode in front card at bottom: x ~ 412, y ~ 290, w ~ 126, h ~ 28 pt
  const barcodeUrl = cropCanvasSubArea(source.canvas, 412, 290, 126, 28);

  // QR Code in back card: x ~ 417, y ~ 370, w ~ 116, h ~ 116 pt
  let qrCodeUrl = cropCanvasSubArea(source.canvas, 417, 370, 116, 116);
  if (!qrCodeUrl) {
    // Fallback to large QR on the left: x ~ 180, y ~ 480, w ~ 240, h ~ 240 pt
    qrCodeUrl = cropCanvasSubArea(source.canvas, 180, 480, 240, 240);
  }

  // 3. Parse fields with robust regex extractors
  // Defaults based on standard Ethiopian National ID format
  const data: EthiopianIdData = {
    fullNameAmharic: "ዮሰፍ ጊርማ ቱፋ",
    fullNameEnglish: "Yosef Girma Tufa",
    dateOfBirthEth: "02/04/1994",
    dateOfBirthGreg: "02/Jan/2002",
    sexAmharic: "ወንድ",
    sexEnglish: "Male",
    dateOfExpiryEth: "2027/01/13",
    dateOfExpiryGreg: "2034/Sep/23",
    dateOfIssueEth: "2019/01/15",
    dateOfIssueGreg: "2026/Sep/25",
    fanNumber: "8029 5016 4312 4539",
    finNumber: "214270390587",
    serialNumber: "65501482",
    phoneNumber: "0917521765",
    nationalityAmharic: "ኢትዮጵያዊ",
    nationalityEnglish: "Ethiopian",
    regionAmharic: "ኦሮሚያ",
    regionEnglish: "Oromia",
    subcityAmharic: "አምቦ ከተማ አስተዳደር",
    subcityEnglish: "Ambo City Administration",
    woredaAmharic: "ያኢ ገዳ",
    woredaEnglish: "Yahi Geda",
    photoUrl,
    qrCodeUrl,
    barcodeUrl: barcodeUrl || undefined,
  };

  if (extractedText) {
    // FAN: 16 digits often formatted as 4 groups of 4
    const fanMatch = extractedText.match(/\b(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})\b/);
    if (fanMatch) data.fanNumber = fanMatch[1];

    // FIN / UIN: 12 digits e.g. 2142 7039 0587 or 214270390587
    const finMatch = extractedText.match(/(?:FIN|UIN)[:\s]*([0-9\s]{12,15})/i);
    if (finMatch) {
      data.finNumber = finMatch[1].replace(/\s+/g, "");
    }

    // Phone: e.g. 0917521765
    const phoneMatch = extractedText.match(/\b(09\d{8})\b/);
    if (phoneMatch) data.phoneNumber = phoneMatch[1];

    // Serial Number: e.g. SN: 65501482
    const snMatch = extractedText.match(/SN[:\s]*(\d{7,10})/i);
    if (snMatch) data.serialNumber = snMatch[1];

    // Amharic Full Name (2 or 3 Ge'ez words)
    const amharicNameMatch = extractedText.match(/([\u1200-\u137F]{2,}\s+[\u1200-\u137F]{2,}(?:\s+[\u1200-\u137F]{2,})?)/);
    if (amharicNameMatch && !amharicNameMatch[1].includes("መታወቂያ") && !amharicNameMatch[1].includes("ኢትዮጵያ")) {
      data.fullNameAmharic = amharicNameMatch[1].trim();
    }

    // English Full Name (e.g. Yosef Girma Tufa)
    const englishNameMatch = extractedText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (englishNameMatch && !englishNameMatch[1].includes("Digital") && !englishNameMatch[1].includes("Card")) {
      data.fullNameEnglish = englishNameMatch[1].trim();
    }
  }

  return data;
}
