import React, { useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

interface BeforeAfterSliderProps {
  originalUrl: string;
  resultUrl: string;
  alt: string;
}

export function BeforeAfterSlider({ originalUrl, resultUrl, alt }: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updatePos = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
        updatePos(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging) updatePos(e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      className="checkerboard relative h-full w-full cursor-ew-resize select-none overflow-hidden touch-none"
    >
      <img
        src={resultUrl}
        alt={`${alt} — resultado`}
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <img
        src={originalUrl}
        alt={`${alt} — original`}
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      {/* Linha divisória */}
      <div
        style={{ left: `${pos}%` }}
        className="pointer-events-none absolute inset-y-0 w-[2px] -translate-x-1/2 bg-[#FDE2B9] shadow-[0_0_8px_rgba(0,0,0,0.65)]"
      >
        <div
          className={`absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-lg transition-transform ${
            dragging ? "scale-115" : ""
          }`}
        >
          <MoveHorizontal className="h-3.5 w-3.5" />
        </div>
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FDE2B9] backdrop-blur-sm">
        Original
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-[#60011D]/85 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#FDE2B9] backdrop-blur-sm">
        Resultado
      </span>
    </div>
  );
}
