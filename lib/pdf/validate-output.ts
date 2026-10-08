import { ID1_ASPECT_RATIO, ID1_HEIGHT_MM, ID1_WIDTH_MM, TARGET_DPI, type CropRect, type OutputValidation, type RenderedPdf } from "@/types/print";
import { normalizeCrop } from "./crop";

const MM_PER_INCH = 25.4;
const ASPECT_TOLERANCE = 0.015;

export function validateOutput(source: RenderedPdf | undefined, crop: CropRect | undefined): OutputValidation {
  const empty: OutputValidation = { errors: [], warnings: [], cropWidth: 0, cropHeight: 0, aspectRatio: 0, estimatedDpi: 0, canGenerate: false };
  if (!source || !crop) return { ...empty, errors: ["Render a source PDF and select the card artwork first."] };

  const safeCrop = normalizeCrop(crop);
  const cropWidth = Math.round(safeCrop.width * source.width);
  const cropHeight = Math.round(safeCrop.height * source.height);
  const aspectRatio = cropWidth / cropHeight;
  const estimatedDpi = Math.min(cropWidth / (ID1_WIDTH_MM / MM_PER_INCH), cropHeight / (ID1_HEIGHT_MM / MM_PER_INCH));
  const errors: string[] = [];
  const warnings: string[] = [];

  if (cropWidth < 1 || cropHeight < 1) errors.push("Select a non-empty area of the PDF.");
  if (safeCrop.x !== crop.x || safeCrop.y !== crop.y || safeCrop.width !== crop.width || safeCrop.height !== crop.height) errors.push("The selected area extends outside the PDF page.");
  if (Math.abs(aspectRatio / ID1_ASPECT_RATIO - 1) > ASPECT_TOLERANCE) errors.push("Selected area does not match the expected ID-1 card ratio. Adjust the crop before generating.");
  if (estimatedDpi < TARGET_DPI) warnings.push(`Output resolution is approximately ${Math.round(estimatedDpi)} DPI; ${TARGET_DPI} DPI is recommended for high-quality printing.`);
  if (source.effectiveDpi < TARGET_DPI) warnings.push(`The PDF preview was rendered at ${Math.round(source.effectiveDpi)} DPI because of browser canvas limits.`);

  return { errors, warnings, cropWidth, cropHeight, aspectRatio, estimatedDpi, canGenerate: errors.length === 0 };
}
