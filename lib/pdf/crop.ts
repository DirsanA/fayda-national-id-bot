import type { CropRect, CroppedArtwork, RenderedPdf } from "@/types/print";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function normalizeCrop(crop: CropRect): CropRect {
  const x = clamp(crop.x, 0, 1);
  const y = clamp(crop.y, 0, 1);
  return {
    x,
    y,
    width: clamp(crop.width, 0, 1 - x),
    height: clamp(crop.height, 0, 1 - y),
  };
}

export async function cropRenderedArtwork(source: RenderedPdf, crop: CropRect): Promise<CroppedArtwork> {
  const safeCrop = normalizeCrop(crop);
  const sx = Math.round(safeCrop.x * source.width);
  const sy = Math.round(safeCrop.y * source.height);
  const sw = Math.round(safeCrop.width * source.width);
  const sh = Math.round(safeCrop.height * source.height);

  if (sw < 1 || sh < 1) throw new Error("Select a non-empty area of the source PDF.");

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("This browser could not create the crop surface.");

  context.drawImage(source.canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Could not encode selected artwork."))), "image/png"),
  );

  return { blob, imageUrl: URL.createObjectURL(blob), width: sw, height: sh, aspectRatio: sw / sh };
}
