import { REDACTED_TEMPLATE, type TemplateRegion } from "./template-config";
import type { RenderedPdf } from "@/types/print";

function regionFitsPage(region: TemplateRegion) {
  return region.x >= 0 && region.y >= 0 && region.x + region.width <= REDACTED_TEMPLATE.page.width && region.y + region.height <= REDACTED_TEMPLATE.page.height;
}

export function validateConfiguredTemplate(source: RenderedPdf): string[] {
  const errors: string[] = [];
  if (source.pageWidthPoints <= 0 || source.pageHeightPoints <= 0) {
    errors.push("The source PDF has invalid page dimensions.");
  }
  return errors;
}
