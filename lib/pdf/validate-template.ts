import { REDACTED_TEMPLATE, type TemplateRegion } from "./template-config";
import type { RenderedPdf } from "@/types/print";

function regionFitsPage(region: TemplateRegion) {
  return region.x >= 0 && region.y >= 0 && region.x + region.width <= REDACTED_TEMPLATE.page.width && region.y + region.height <= REDACTED_TEMPLATE.page.height;
}

export function validateConfiguredTemplate(source: RenderedPdf): string[] {
  const { page } = REDACTED_TEMPLATE;
  const errors: string[] = [];
  if (Math.abs(source.pageWidthPoints - page.width) > page.tolerance || Math.abs(source.pageHeightPoints - page.height) > page.tolerance) {
    errors.push(`This PDF is ${source.pageWidthPoints.toFixed(2)} x ${source.pageHeightPoints.toFixed(2)} pt; expected ${page.width} x ${page.height} pt for ${REDACTED_TEMPLATE.name}.`);
  }
  if (REDACTED_TEMPLATE.regions.some((region) => !regionFitsPage(region))) errors.push("Configured template regions fall outside the expected PDF page.");
  if (errors.length) return errors;

  const context = source.canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return ["Could not inspect the rendered template layout."];
  for (const sentinel of REDACTED_TEMPLATE.sentinels) {
    const x = Math.round((sentinel.x / page.width) * source.width);
    const y = Math.round((sentinel.y / page.height) * source.height);
    const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
    const distance = Math.max(Math.abs(red - sentinel.rgb[0]), Math.abs(green - sentinel.rgb[1]), Math.abs(blue - sentinel.rgb[2]));
    if (distance > sentinel.tolerance) {
      errors.push("PDF layout does not match the configured redacted template. No output was generated.");
      break;
    }
  }
  return errors;
}
