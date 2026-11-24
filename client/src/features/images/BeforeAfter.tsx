import { useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

interface BeforeAfterProps {
  originalUrl: string;
  resultUrl: string;
  alt: string;
}

export function BeforeAfter({ originalUrl, resultUrl, alt }: BeforeAfterProps) {
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
        alt={`${alt} (resultado)`}
        draggable={false}
        className="develop-reveal pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      <img
        src={originalUrl}
        alt={`${alt} (original)`}
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />

      <div
        style={{ left: `${pos}%` }}
        className="pointer-events-none absolute inset-y-0 w-[1px] -translate-x-1/2 bg-[#FDE2B9]"
      >
        <div
          className={`absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[6px] border border-[#BC9200] bg-[#1C030A] text-[#FDE2B9] transition-transform ${
            dragging ? "scale-110" : ""
          }`}
        >
          <MoveHorizontal className="h-3 w-3" strokeWidth={1.5} />
        </div>
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-[6px] bg-[#1C030A]/80 px-2 py-0.5 text-[10px] font-medium text-[#FDE2B9]">
        Original
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-[6px] bg-[#1C030A]/80 px-2 py-0.5 text-[10px] font-medium text-[#FDE2B9]">
        Resultado
      </span>
    </div>
  );
}
