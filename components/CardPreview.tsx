import type { CroppedArtwork, OutputValidation } from "@/types/print";
import { ID1_HEIGHT_MM, ID1_WIDTH_MM } from "@/types/print";
import { ValidationMessage } from "./ValidationMessage";

type CardPreviewProps = {
  artwork?: CroppedArtwork;
  validation: OutputValidation;
};

export function CardPreview({ artwork, validation }: CardPreviewProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Selected card preview">
      <h3 className="font-semibold">Card-size preview</h3>
      <p className="mt-1 text-sm text-slate-600">Final physical size: {ID1_WIDTH_MM.toFixed(2)} × {ID1_HEIGHT_MM.toFixed(2)} mm (ID-1).</p>
      <div className="mt-4 flex min-h-48 items-center justify-center rounded-lg bg-slate-100 p-4">
        {artwork ? <img src={artwork.imageUrl} alt="Selected source artwork" className="max-h-72 max-w-full border border-slate-300 shadow-sm" style={{ aspectRatio: `${ID1_WIDTH_MM} / ${ID1_HEIGHT_MM}` }} /> : <span className="text-sm text-slate-500">The selected region will appear here.</span>}
      </div>
      {artwork && <p className="mt-3 text-xs text-slate-600">Source crop: {artwork.width} × {artwork.height} px · estimated {Math.round(validation.estimatedDpi)} DPI at final size</p>}
      <div className="mt-4 space-y-2">
        {validation.errors.map((message) => <ValidationMessage key={message} tone="error">{message}</ValidationMessage>)}
        {validation.warnings.map((message) => <ValidationMessage key={message} tone="info">{message}</ValidationMessage>)}
        {validation.canGenerate && !validation.warnings.length && <ValidationMessage tone="success">Crop ratio and dimensions are valid. Artwork will be placed at actual size without stretching.</ValidationMessage>}
      </div>
    </section>
  );
}
