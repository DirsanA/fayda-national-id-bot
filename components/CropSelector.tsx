"use client";

import { PointerEvent, useRef, useState } from "react";
import type { CropRect, RenderedPdf } from "@/types/print";

type Mode = "create" | "move" | "nw" | "ne" | "sw" | "se";
type Interaction = { mode: Mode; originX: number; originY: number; crop: CropRect };

type CropSelectorProps = {
  source: RenderedPdf;
  crop: CropRect;
  onChange: (crop: CropRect) => void;
  onReset: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const MIN_SIZE = 0.03;

export function CropSelector({ source, crop, onChange, onReset }: CropSelectorProps) {
  const [zoom, setZoom] = useState(1);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const interaction = useRef<Interaction | null>(null);

  const coordinates = (event: PointerEvent<HTMLElement>) => {
    const bounds = surfaceRef.current!.getBoundingClientRect();
    return { x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1), y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1) };
  };

  const update = (event: PointerEvent<HTMLElement>) => {
    const active = interaction.current;
    if (!active) return;
    const point = coordinates(event);
    const dx = point.x - active.originX;
    const dy = point.y - active.originY;
    let next = active.crop;

    if (active.mode === "create") {
      const x = Math.min(active.originX, point.x); const y = Math.min(active.originY, point.y);
      next = { x, y, width: Math.abs(dx), height: Math.abs(dy) };
    } else if (active.mode === "move") {
      next = { ...active.crop, x: clamp(active.crop.x + dx, 0, 1 - active.crop.width), y: clamp(active.crop.y + dy, 0, 1 - active.crop.height) };
    } else {
      let { x, y, width, height } = active.crop;
      if (active.mode.includes("w")) { x = clamp(active.crop.x + dx, 0, active.crop.x + active.crop.width - MIN_SIZE); width = active.crop.width + active.crop.x - x; }
      if (active.mode.includes("e")) width = clamp(active.crop.width + dx, MIN_SIZE, 1 - x);
      if (active.mode.includes("s")) height = clamp(active.crop.height + dy, MIN_SIZE, 1 - y);
      if (active.mode.includes("n")) { y = clamp(active.crop.y + dy, 0, active.crop.y + active.crop.height - MIN_SIZE); height = active.crop.height + active.crop.y - y; }
      next = { x, y, width, height };
    }
    if (next.width >= MIN_SIZE && next.height >= MIN_SIZE) onChange(next);
  };

  const start = (mode: Mode, event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const point = coordinates(event);
    interaction.current = { mode, originX: point.x, originY: point.y, crop };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Card-area selection">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">Select card area</h3><p className="mt-1 text-sm text-slate-600">Drag a new rectangle, move its centre, or resize its corners.</p></div>
        <div className="flex items-center gap-2"><button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium" onClick={() => setZoom((value) => Math.max(0.6, value - 0.2))}>−</button><span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span><button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium" onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}>+</button><button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium" onClick={() => { setZoom(1); onReset(); }}>Reset</button></div>
      </div>
      <div className="mt-4 max-h-[620px] overflow-auto rounded-lg bg-slate-100 p-3">
        <div ref={surfaceRef} className="relative touch-none select-none shadow-sm" style={{ width: `${zoom * 100}%`, minWidth: "460px" }} onPointerDown={(event) => start("create", event)} onPointerMove={update} onPointerUp={() => { interaction.current = null; }}>
          <img src={source.imageUrl} alt="Rendered source PDF for card-area selection" className="block h-auto w-full" draggable={false} />
          <div className="absolute border-2 border-blue-600 bg-blue-500/10" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} onPointerDown={(event) => start("move", event)}>
            {(["nw", "ne", "sw", "se"] as const).map((corner) => <span key={corner} aria-label={`Resize selection ${corner}`} onPointerDown={(event) => start(corner, event)} className={`absolute h-3 w-3 rounded-full border-2 border-white bg-blue-600 ${corner.includes("n") ? "-top-2" : "-bottom-2"} ${corner.includes("w") ? "-left-2" : "-right-2"}`} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
