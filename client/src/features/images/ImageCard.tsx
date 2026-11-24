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

const CUTOUT_OPTIONS: Array<{ id: CutoutMode; label: string; hint: string }> = [
  { id: "automatico", label: "Rápido", hint: "Fundo uniforme" },
  { id: "inteligente", label: "Refinado", hint: "Contornos e detalhes" },
  { id: "manual", label: "Manual", hint: "Ajuste com pincel" },
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

  return (
    <article className="group flex flex-col overflow-hidden rounded-[6px] border border-[var(--line)] bg-[var(--bg-panel)] transition-colors hover:border-[var(--line-strong)]">
      {/* Miniatura */}
      <div
        className={`relative aspect-[16/10] overflow-hidden border-b border-[var(--line)] ${
          item.removerFundo ? "checkerboard" : "bg-[var(--bg-deep)]"
        }`}
      >
        <img
          src={item.urlMiniatura}
          alt={item.nome}
          loading="lazy"
          className="h-full w-full object-contain"
        />

        <span className="absolute left-2 top-2 rounded-[2px] bg-[var(--bg-deep)]/85 px-1.5 py-0.5 font-mono text-[10px] text-[var(--fg-secondary)]">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="absolute right-2 top-2 flex items-center gap-1">
          {item.removerFundo && (
            <span className="rounded-[2px] border border-[var(--line-gold)] bg-[var(--bg-deep)]/90 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent-bright)]">
              Recorte: {CUTOUT_OPTIONS.find((c) => c.id === item.modoRemocao)?.label}
            </span>
          )}
          <button
            type="button"
            onClick={() =>
              onZoom(
                item.urlMiniatura,
                outName,
                `${item.larguraOriginal}×${item.alturaOriginal}px · ${formatBytes(item.tamanhoBytes)}`
              )
            }
            aria-label="Ampliar imagem"
            className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-[var(--bg-deep)]/85 text-[var(--fg-primary)] hover:text-[var(--accent-bright)] cursor-pointer"
          >
            <Maximize2 className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover imagem"
            className="flex h-6 w-6 items-center justify-center rounded-[3px] bg-[var(--bg-deep)]/85 text-[var(--fg-secondary)] hover:text-[var(--status-err)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Cabeçalho de metadados */}
      <div className="border-b border-[var(--line)] px-3.5 py-2.5">
        <p className="truncate font-mono text-xs text-[var(--fg-primary)]" title={item.nome}>
          {item.nome}
        </p>
        <div className="mt-0.5 flex items-center justify-between gap-2 font-mono text-[11px] text-[var(--fg-muted)]">
          <span>
            {item.larguraOriginal}×{item.alturaOriginal}px · {formatBytes(item.tamanhoBytes)}
          </span>
          <span className="truncate text-[var(--accent-bright)]">{outName}</span>
        </div>
      </div>

      {/* Controles */}
      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        <div className="col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <Label className="mb-0">
              Nome de saída {item.nomePersonalizado !== null ? "(manual)" : ""}
            </Label>
            {item.nomePersonalizado !== null && (
              <button
                type="button"
                onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--accent-bright)] hover:underline cursor-pointer"
              >
                <RotateCcw className="h-2.5 w-2.5" strokeWidth={1.5} />
                Usar lote
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
          <Label>Formato</Label>
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
          <Label>Qualidade</Label>
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

        <div className="col-span-2 flex items-center justify-between border-t border-[var(--line)] pt-2.5 text-xs">
          <label className="inline-flex items-center gap-2 text-[var(--fg-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={item.manterProporcao}
              onChange={(e) => onUpdate(item.id, { manterProporcao: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Manter proporção
          </label>

          <label className="inline-flex items-center gap-2 font-medium text-[var(--fg-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={item.removerFundo}
              onChange={(e) => onUpdate(item.id, { removerFundo: e.target.checked })}
              className="accent-[var(--accent)]"
            />
            Remover fundo
          </label>
        </div>

        {item.removerFundo && (
          <div className="col-span-2 space-y-2.5 rounded-[4px] border border-[var(--line)] bg-[var(--bg-deep)]/55 p-2.5">
            <div className="grid grid-cols-3 gap-1">
              {CUTOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate(item.id, { modoRemocao: opt.id })}
                  className={`rounded-[3px] border px-2 py-1.5 text-left transition-colors cursor-pointer ${
                    item.modoRemocao === opt.id
                      ? "border-[var(--accent)] bg-[var(--bg-field)] text-[var(--fg-primary)]"
                      : "border-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]"
                  }`}
                >
                  <span className="block text-[11px] font-semibold">{opt.label}</span>
                  <span className="block font-mono text-[9px] text-[var(--fg-muted)]">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between gap-2 font-mono text-[11px] text-[var(--fg-secondary)]">
              <span>Tolerância ({item.sensibilidadeFundo}%)</span>
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
              <div className="space-y-1.5 border-t border-[var(--line)] pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[var(--fg-secondary)]">
                    Fundo sólido ({item.formato})
                  </span>
                  <input
                    type="color"
                    value={item.corFundo}
                    onChange={(e) => onUpdate(item.id, { corFundo: e.target.value })}
                    className="h-6 w-9 rounded-[2px] border border-[var(--line)] bg-transparent cursor-pointer"
                  />
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-[var(--status-warn)]">
                  {item.formato} não possui canal de transparência. A cor acima preencherá o fundo recortado.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
