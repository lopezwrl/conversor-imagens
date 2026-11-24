import { Maximize2, RotateCcw, X } from "lucide-react";
import type { CutoutMode, ImageOutputFormat, ImageRecord } from "../../types/image";
import type { BatchRenameRule } from "../../types/shared";
import { IMAGE_FORMATS, IMAGE_FORMAT_EXT, OPAQUE_IMAGE_FORMATS } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Label, Select } from "../../components/ui/Field";

interface ImageCardProps {
  item: ImageRecord;
  index: number;
  renameRule: BatchRenameRule;
  onUpdate: (id: string, patch: Partial<ImageRecord>) => void;
  onRemove: (id: string) => void;
  onZoom: (src: string, title: string, meta: string) => void;
}

const CUTOUT_MODES: Array<{ id: CutoutMode; code: string; label: string }> = [
  { id: "automatico", code: "C1", label: "Rápido" },
  { id: "inteligente", code: "C2", label: "Refinado" },
  { id: "manual", code: "C3", label: "Pincel" },
];

export function ImageCard({
  item,
  index,
  renameRule,
  onUpdate,
  onRemove,
  onZoom,
}: ImageCardProps) {
  const outBase = resolveOutputBaseName(item.nomeBase, item.nomePersonalizado, index, renameRule);
  const outName = `${outBase}.${IMAGE_FORMAT_EXT[item.formato]}`;
  const isOpaqueTarget = item.removerFundo && OPAQUE_IMAGE_FORMATS.has(item.formato);
  const frameCode = `FRAME ${String(index + 1).padStart(3, "0")}`;

  return (
    <article className="group flex flex-col border border-[var(--line-strong)] bg-[#190309]/92 transition-colors hover:border-[var(--accent)]">
      {/* Borda superior estilo tira de contato fotográfico */}
      <div className="flex items-center justify-between border-b border-[var(--line)] bg-[#120206] px-3 py-1.5 font-mono text-[10px] tracking-[0.12em]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--accent-bright)] font-semibold">{frameCode}</span>
          <span className="text-[var(--fg-muted)]">
            {item.larguraOriginal}×{item.alturaOriginal}
          </span>
          <span className="text-[var(--fg-muted)]">{formatBytes(item.tamanhoBytes)}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              onZoom(
                item.urlMiniatura,
                outName,
                `${item.larguraOriginal}×${item.alturaOriginal}px · ${formatBytes(item.tamanhoBytes)}`
              )
            }
            aria-label="Ampliar fotograma"
            className="p-0.5 text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover fotograma"
            className="p-0.5 text-[var(--fg-secondary)] hover:text-[var(--status-err)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Janela do fotograma com marcas de corte nos 4 cantos */}
      <div
        className={`relative aspect-[16/10] overflow-hidden border-b border-[var(--line)] p-2 ${
          item.removerFundo ? "checkerboard" : "bg-[#110205]"
        }`}
      >
        <img
          src={item.urlMiniatura}
          alt={item.nome}
          loading="lazy"
          className="h-full w-full object-contain"
        />

        {item.removerFundo && (
          <span className="absolute bottom-2 left-2 border border-[var(--accent)] bg-[#120206]/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent-bright)]">
            Recorte {CUTOUT_MODES.find((c) => c.id === item.modoRemocao)?.label}
          </span>
        )}
      </div>

      {/* Linha de origem -> destino */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[#140207] px-3 py-2 font-mono text-[11px]">
        <span className="truncate text-[var(--fg-muted)]" title={item.nome}>
          {item.nome}
        </span>
        <span className="shrink-0 text-[var(--fg-primary)]">{outName}</span>
      </div>

      {/* Ficha técnica de controles do fotograma */}
      <div className="grid grid-cols-2 gap-2.5 p-3">
        <div className="col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">
              Identificador de saída {item.nomePersonalizado !== null ? "(manual)" : ""}
            </Label>
            {item.nomePersonalizado !== null && (
              <button
                type="button"
                onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--accent-bright)] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-2.5 w-2.5" strokeWidth={1.5} />
                Seguir lote
              </button>
            )}
          </div>
          <Input
            type="text"
            className="font-mono"
            value={item.nomePersonalizado ?? ""}
            placeholder={outBase}
            onChange={(e) =>
              onUpdate(item.id, {
                nomePersonalizado: e.target.value === "" ? null : e.target.value,
              })
            }
          />
        </div>

        <div>
          <Label>Codificação</Label>
          <Select
            value={item.formato}
            onChange={(e) => onUpdate(item.id, { formato: e.target.value as ImageOutputFormat })}
          >
            {IMAGE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>Qualidade (%)</Label>
          <Input
            type="number"
            min={1}
            max={100}
            className="font-mono"
            value={item.qualidade}
            onChange={(e) =>
              onUpdate(item.id, {
                qualidade: Math.max(1, Math.min(100, Number(e.target.value) || 90)),
              })
            }
          />
        </div>

        <div>
          <Label>Largura (px)</Label>
          <Input
            type="number"
            min={1}
            placeholder={String(item.larguraOriginal)}
            className="font-mono"
            value={item.largura}
            onChange={(e) => onUpdate(item.id, { largura: e.target.value })}
          />
        </div>

        <div>
          <Label>Altura (px)</Label>
          <Input
            type="number"
            min={1}
            placeholder={String(item.alturaOriginal)}
            className="font-mono"
            value={item.altura}
            onChange={(e) => onUpdate(item.id, { altura: e.target.value })}
          />
        </div>

        <div className="col-span-2 flex items-center justify-between border-t border-[var(--line)] pt-2.5 font-mono text-[11px]">
          <label className="inline-flex items-center gap-2 text-[var(--fg-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={item.manterProporcao}
              onChange={(e) => onUpdate(item.id, { manterProporcao: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Travar proporção
          </label>

          <label className="inline-flex items-center gap-2 font-semibold text-[var(--fg-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={item.removerFundo}
              onChange={(e) => onUpdate(item.id, { removerFundo: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Isolar fundo
          </label>
        </div>

        {item.removerFundo && (
          <div className="col-span-2 space-y-2 border-t border-[var(--line)] bg-[#120206] p-2.5">
            <div className="grid grid-cols-3 divide-x divide-[var(--line)] border border-[var(--line)]">
              {CUTOUT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdate(item.id, { modoRemocao: m.id })}
                  className={`px-2 py-1.5 text-left font-mono text-[10px] transition-colors cursor-pointer ${
                    item.modoRemocao === m.id
                      ? "bg-[#FDE2B9] font-semibold text-[#60011D]"
                      : "text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  <span className="opacity-60">{m.code} </span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between gap-2 font-mono text-[10px] text-[var(--fg-secondary)]">
              <span>Limiar CIELAB ({item.sensibilidadeFundo}%)</span>
              <input
                type="range"
                min={10}
                max={95}
                value={item.sensibilidadeFundo}
                onChange={(e) =>
                  onUpdate(item.id, { sensibilidadeFundo: Number(e.target.value) })
                }
                className="w-28 accent-[var(--accent)]"
              />
            </label>

            {isOpaqueTarget && (
              <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 font-mono text-[10px] text-[var(--status-warn)]">
                <span>Fundo sólido para {item.formato}:</span>
                <input
                  type="color"
                  value={item.corFundo}
                  onChange={(e) => onUpdate(item.id, { corFundo: e.target.value })}
                  className="h-5 w-8 border border-[var(--line)] bg-transparent cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
