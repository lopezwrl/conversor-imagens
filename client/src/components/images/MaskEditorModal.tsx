import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Eraser,
  Hand,
  Paintbrush,
  Redo2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { downloadBlob } from "../../services/api";

interface MaskEditorModalProps {
  dadosBase64: string;
  mime: string;
  nomeArquivo: string;
  onClose: () => void;
}

type Tool = "remover" | "restaurar" | "mover";
type BgPreview = "checker" | "white" | "black" | "bordo";

export function MaskEditorModal({ dadosBase64, mime, nomeArquivo, onClose }: MaskEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rgbRef = useRef<Uint8ClampedArray | null>(null);
  const alphaRef = useRef<Uint8ClampedArray | null>(null);
  const dimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const undoStackRef = useRef<Uint8ClampedArray[]>([]);
  const redoStackRef = useRef<Uint8ClampedArray[]>([]);

  const paintingRef = useRef(false);
  const panningRef = useRef(false);
  const spaceDownRef = useRef(false);
  const lastPtRef = useRef({ x: 0, y: 0 });
  const lastClientRef = useRef({ x: 0, y: 0 });

  const [tool, setTool] = useState<Tool>("remover");
  const [brushSize, setBrushSize] = useState(32);
  const [softness, setSoftness] = useState(35); // 0 = duro, 100 = muito suave
  const [zoom, setZoom] = useState(1);
  const [bgPreview, setBgPreview] = useState<BgPreview>("checker");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const rgb = rgbRef.current;
    const alpha = alphaRef.current;
    const { w, h } = dimsRef.current;
    if (!canvas || !rgb || !alpha || !w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = ctx.createImageData(w, h);
    const d = frame.data;
    for (let i = 0; i < alpha.length; i++) {
      const base = i * 4;
      d[base] = rgb[base];
      d[base + 1] = rgb[base + 1];
      d[base + 2] = rgb[base + 2];
      d[base + 3] = alpha[i];
    }
    ctx.putImageData(frame, 0, 0);
  }, []);

  // Carrega imagem inicial para o canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) return;
      dimsRef.current = { w, h };

      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d");
      if (!tctx) return;
      tctx.drawImage(img, 0, 0);
      const data = tctx.getImageData(0, 0, w, h).data;
      rgbRef.current = data;

      const alpha = new Uint8ClampedArray(w * h);
      for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
      alphaRef.current = alpha;

      if (canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
      }
      setZoom(Math.max(0.15, Math.min(1, 660 / Math.max(w, h))));
      renderCanvas();
    };
    img.src = `data:${mime};base64,${dadosBase64}`;
  }, [dadosBase64, mime, renderCanvas]);

  const syncHistoryFlags = () => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const pushUndo = () => {
    if (!alphaRef.current) return;
    undoStackRef.current.push(alphaRef.current.slice());
    if (undoStackRef.current.length > 25) undoStackRef.current.shift();
    redoStackRef.current.length = 0;
    syncHistoryFlags();
  };

  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length || !alphaRef.current) return;
    redoStackRef.current.push(alphaRef.current.slice());
    alphaRef.current = undoStackRef.current.pop()!;
    syncHistoryFlags();
    renderCanvas();
  }, [renderCanvas]);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length || !alphaRef.current) return;
    undoStackRef.current.push(alphaRef.current.slice());
    alphaRef.current = redoStackRef.current.pop()!;
    syncHistoryFlags();
    renderCanvas();
  }, [renderCanvas]);

  // Atalhos de teclado: Ctrl+Z, Ctrl+Y, [, ], Espaço, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "[") {
        setBrushSize((s) => Math.max(4, s - 6));
      } else if (e.key === "]") {
        setBrushSize((s) => Math.min(160, s + 6));
      } else if (e.code === "Space") {
        spaceDownRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleUndo, handleRedo, onClose]);

  const paintCircle = (cx: number, cy: number, radius: number, targetAlpha: 0 | 255) => {
    const alpha = alphaRef.current;
    const { w, h } = dimsRef.current;
    if (!alpha) return;

    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(w - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(h - 1, Math.ceil(cy + radius));
    const featherFrac = softness / 100; // 0 = duro, 1 = suave
    const innerR = radius * (1 - featherFrac * 0.75);

    for (let y = y0; y <= y1; y++) {
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > radius) continue;
        if (featherFrac < 0.05 || dist <= innerR) {
          alpha[row + x] = targetAlpha;
        } else {
          const strength = 1 - (dist - innerR) / Math.max(0.001, radius - innerR);
          const cur = alpha[row + x];
          if (targetAlpha === 0) {
            alpha[row + x] = Math.min(cur, Math.round(cur * (1 - strength)));
          } else {
            alpha[row + x] = Math.max(cur, Math.round(cur + (255 - cur) * strength));
          }
        }
      }
    }
  };

  const paintStroke = (x0: number, y0: number, x1: number, y1: number) => {
    const radius = brushSize / 2;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const step = Math.max(1, radius / 4);
    const steps = Math.max(1, Math.ceil(dist / step));
    const target: 0 | 255 = tool === "remover" ? 0 : 255;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, target);
    }
  };

  const toCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = dimsRef.current;
    return {
      x: (e.clientX - rect.left) * (w / rect.width),
      y: (e.clientY - rect.top) * (h / rect.height),
    };
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const outName = nomeArquivo.replace(/\.[^.]+$/, "") + ".png";
      downloadBlob(blob, outName);
      onClose();
    }, "image/png");
  };

  const { w, h } = dimsRef.current;
  const bgStyle: React.CSSProperties =
    bgPreview === "white"
      ? { background: "#ffffff" }
      : bgPreview === "black"
      ? { background: "#09090b" }
      : bgPreview === "bordo"
      ? { background: "#60011D" }
      : {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-bold text-[var(--text-primary)]">
              Editor de Máscara — {nomeArquivo}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Atalhos: <span className="font-mono">Ctrl+Z</span> desfazer · <span className="font-mono">[ / ]</span> pincel ·{" "}
              <span className="font-mono">Espaço</span> ou botão do meio para mover · Scroll para zoom
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barra de Ferramentas */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-surface)]/70 px-5 py-3">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            {(
              [
                { id: "remover", label: "Remover", icon: Eraser },
                { id: "restaurar", label: "Restaurar", icon: Paintbrush },
                { id: "mover", label: "Mover", icon: Hand },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTool(id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  tool === id
                    ? "bg-[var(--brand)] text-[var(--brand-foreground)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            Pincel <span className="font-mono text-[11px] text-[var(--accent-text)]">{brushSize}px</span>
            <input
              type="range"
              min={4}
              max={160}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-[var(--accent)]"
            />
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            Suavidade <span className="font-mono text-[11px] text-[var(--accent-text)]">{softness}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={softness}
              onChange={(e) => setSoftness(Number(e.target.value))}
              className="w-20 accent-[var(--accent)]"
            />
          </label>

          {/* Zoom */}
          <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.15, +(z - 0.15).toFixed(2)))}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-12 text-center font-mono text-[11px] font-semibold text-[var(--text-primary)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, +(z + 0.15).toFixed(2)))}
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] cursor-pointer"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 cursor-pointer"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Preview de fundo para checar halo */}
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <span>Fundo:</span>
            {(
              [
                { id: "checker", title: "Xadrez", cls: "checkerboard" },
                { id: "white", title: "Branco", cls: "bg-white" },
                { id: "black", title: "Preto", cls: "bg-zinc-950" },
                { id: "bordo", title: "Bordô", cls: "bg-[#60011D]" },
              ] as const
            ).map((bg) => (
              <button
                key={bg.id}
                type="button"
                title={bg.title}
                onClick={() => setBgPreview(bg.id)}
                className={`h-5 w-5 rounded-full border cursor-pointer ${bg.cls} ${
                  bgPreview === bg.id ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-surface)]" : "border-[var(--border-strong)]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Área do Canvas */}
        <div ref={scrollRef} className="relative flex flex-1 overflow-auto bg-black/20 p-6 min-h-[300px]">
          <div
            style={bgStyle}
            className={`relative m-auto inline-block leading-none shadow-2xl ${bgPreview === "checker" ? "checkerboard" : ""}`}
          >
            <canvas
              ref={canvasRef}
              style={{
                width: w ? `${w * zoom}px` : undefined,
                height: h ? `${h * zoom}px` : undefined,
                cursor: tool === "mover" || spaceDownRef.current ? "grab" : "none",
              }}
              className="block touch-none"
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) => Math.min(4, Math.max(0.15, +(z + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))));
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                if (e.button === 1 || tool === "mover" || spaceDownRef.current) {
                  panningRef.current = true;
                  lastClientRef.current = { x: e.clientX, y: e.clientY };
                  return;
                }
                paintingRef.current = true;
                pushUndo();
                const pt = toCanvasCoords(e);
                lastPtRef.current = pt;
                paintCircle(pt.x, pt.y, brushSize / 2, tool === "remover" ? 0 : 255);
                renderCanvas();
              }}
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });

                if (panningRef.current && scrollRef.current) {
                  scrollRef.current.scrollLeft -= e.clientX - lastClientRef.current.x;
                  scrollRef.current.scrollTop -= e.clientY - lastClientRef.current.y;
                  lastClientRef.current = { x: e.clientX, y: e.clientY };
                  return;
                }
                if (!paintingRef.current) return;
                const pt = toCanvasCoords(e);
                paintStroke(lastPtRef.current.x, lastPtRef.current.y, pt.x, pt.y);
                lastPtRef.current = pt;
                renderCanvas();
              }}
              onPointerUp={() => {
                paintingRef.current = false;
                panningRef.current = false;
              }}
              onPointerCancel={() => {
                paintingRef.current = false;
                panningRef.current = false;
              }}
              onPointerLeave={() => setCursorPos((c) => ({ ...c, visible: false }))}
            />

            {/* Cursor circular proporcional ao pincel e ao zoom */}
            {cursorPos.visible && tool !== "mover" && !spaceDownRef.current && (
              <div
                style={{
                  left: cursorPos.x,
                  top: cursorPos.y,
                  width: Math.max(6, brushSize * zoom),
                  height: Math.max(6, brushSize * zoom),
                  borderColor: tool === "remover" ? "#fb7185" : "#34d399",
                }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.65)]"
              />
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border)] px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold cursor-pointer"
            style={{ background: "var(--brand)", color: "var(--brand-foreground)" }}
          >
            <Download className="h-4 w-4" />
            Confirmar e baixar PNG
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
