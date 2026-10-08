export const ID1_WIDTH_MM = 85.6;
export const ID1_HEIGHT_MM = 53.98;
export const ID1_ASPECT_RATIO = ID1_WIDTH_MM / ID1_HEIGHT_MM;
export const TARGET_DPI = 300;

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RenderedPdf = {
  canvas: HTMLCanvasElement;
  imageUrl: string;
  width: number;
  height: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  effectiveDpi: number;
};

export type CroppedArtwork = {
  blob: Blob;
  imageUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
};

export type OutputValidation = {
  errors: string[];
  warnings: string[];
  cropWidth: number;
  cropHeight: number;
  aspectRatio: number;
  estimatedDpi: number;
  canGenerate: boolean;
};
