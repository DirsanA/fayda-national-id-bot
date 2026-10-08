import { ID1_HEIGHT_MM, ID1_WIDTH_MM, type CropRect } from "@/types/print";

export type TemplateRegion = {
  id: "front" | "back";
  label: string;
  // Coordinates use a PDF-style top-left origin in points.
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateSentinel = {
  // A fixed, non-personal visual marker used only to recognise the synthetic template.
  x: number;
  y: number;
  rgb: readonly [number, number, number];
  tolerance: number;
};

export const REDACTED_TEMPLATE = {
  name: "Redacted training document v1",
  page: { width: 595.280029, height: 841.890014, tolerance: 0.5 },
  regions: [
    { id: "front", label: "Front artwork", x: 400.456604, y: 90.0, width: 149.886780, height: 240.0 },
    { id: "back", label: "Back artwork", x: 400.456604, y: 337.0, width: 149.886780, height: 240.0 },
  ] as const satisfies readonly TemplateRegion[],
  output: { widthMm: ID1_WIDTH_MM, heightMm: ID1_HEIGHT_MM },
  sentinels: [] as const satisfies readonly TemplateSentinel[],
} as const;

export function topLeftPointsToCrop(region: TemplateRegion): CropRect {
  return {
    x: region.x / REDACTED_TEMPLATE.page.width,
    y: region.y / REDACTED_TEMPLATE.page.height,
    width: region.width / REDACTED_TEMPLATE.page.width,
    height: region.height / REDACTED_TEMPLATE.page.height,
  };
}
