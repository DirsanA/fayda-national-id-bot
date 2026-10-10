import type { EthiopianIdData } from "@/types/id-card";

function formatImageDataUri(value: any, key: string): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)) return trimmed;
  const base64 = trimmed.replace(/^base64,/i, "").replace(/\s+/g, "");
  if (base64.length < 32 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return "";
  let mime = /qr|code/i.test(key) ? "image/png" : "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) mime = "image/png";
  else if (base64.startsWith("UklGR")) mime = "image/webp";
  return `data:${mime};base64,${base64}`;
}

export function mapFaydaJsonResponseToIdData(apiData: Record<string, any>): EthiopianIdData {
  const d = apiData || {};

  // Formatter for FAN number (groups of 4 digits)
  const rawFan = (d.fanNumber || "").replace(/\s+/g, "");
  const formattedFan = rawFan.replace(/(\d{4})(?=\d)/g, "$1 ").trim() || "8029 5016 4312 4539";

  // Formatter for FIN number (unspaced)
  const rawFin = (d.fin || "").replace(/\s+/g, "");
  const formattedFin = rawFin || "214270390587";

  const photo = formatImageDataUri(d.photo, "photo");
  const qrCode = formatImageDataUri(d.qrCode, "qrCode");

  return {
    fullNameAmharic: d.name?.amharic || "ዮሰፍ ጊርማ ቱፋ",
    fullNameEnglish: d.name?.english || "Yosef Girma Tufa",
    dateOfBirthEth: d.dateOfBirth?.ethiopian || "02/04/1994",
    dateOfBirthGreg: d.dateOfBirth?.gregorian || "1994-05-02",
    sexAmharic: d.gender?.amharic || "ወንድ",
    sexEnglish: d.gender?.english || "Male",
    dateOfExpiryEth: d.expiryDate?.ethiopian || "2032/08/20",
    dateOfExpiryGreg: d.expiryDate?.gregorian || "2032-10-10",
    dateOfIssueEth: d.issueDate?.ethiopian || "2024/08/20",
    dateOfIssueGreg: d.issueDate?.gregorian || "2024-10-10",
    fanNumber: formattedFan,
    finNumber: formattedFin,
    serialNumber: d.serialNumber || d.sn || "65501482",
    phoneNumber: d.phone || "0917521765",
    nationalityAmharic: d.nationality?.amharic || "ኢትዮጵያዊ",
    nationalityEnglish: d.nationality?.english || "Ethiopian",
    regionAmharic: d.address?.region?.amharic || d.address?.city?.amharic || "ኦሮሚያ",
    regionEnglish: d.address?.region?.english || d.address?.city?.english || "Oromia",
    subcityAmharic: d.address?.subCity?.amharic || "አምቦ ከተማ አስተዳደር",
    subcityEnglish: d.address?.subCity?.english || "Ambo City Administration",
    woredaAmharic: d.address?.woreda?.amharic || "ያኢ ገዳ",
    woredaEnglish: d.address?.woreda?.english || "Yahi Geda",
    photoUrl: photo || "",
    qrCodeUrl: qrCode || "",
    barcodeUrl: undefined,
  };
}
