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
  page: { width: 595.28, height: 841.89, tolerance: 0.5 },
  regions: [
    { id: "front", label: "Front artwork", x: 70, y: 100, width: 455, height: 287 },
    { id: "back", label: "Back artwork", x: 70, y: 455, width: 455, height: 287 },
  ] as const satisfies readonly TemplateRegion[],
  output: { widthMm: ID1_WIDTH_MM, heightMm: ID1_HEIGHT_MM },
  // These green header pixels distinguish this deliberately synthetic layout from a same-sized but incompatible PDF.
  sentinels: [
    { x: 95, y: 120, rgb: [10, 115, 89], tolerance: 28 },
    { x: 95, y: 475, rgb: [10, 115, 89], tolerance: 28 },
  ] as const satisfies readonly TemplateSentinel[],
} as const;

export function topLeftPointsToCrop(region: TemplateRegion): CropRect {
  return {
    x: region.x / REDACTED_TEMPLATE.page.width,
    y: region.y / REDACTED_TEMPLATE.page.height,
    width: region.width / REDACTED_TEMPLATE.page.width,
    height: region.height / REDACTED_TEMPLATE.page.height,
  };
}
