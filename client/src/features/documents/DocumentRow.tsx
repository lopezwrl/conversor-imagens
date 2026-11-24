import React from "react";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, X } from "lucide-react";
import type { DocOutputFormat, DocRecord } from "../../types/document";
import type { BatchRenameRule } from "../../types/shared";
import { DOC_FORMAT_EXT, getDocFormatLabel, getTargetDocFormats } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Label, Select } from "../../components/ui/Field";

interface DocumentRowProps {
  item: DocRecord;
  index: number;
  total: number;
  mergePdfMode: boolean;
  mergedPdfName: string;
  renameRule: BatchRenameRule;
  onUpdate: (id: string, patch: Partial<DocRecord>) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onDragStartIndex: (idx: number) => void;
  onDropIndex: (idx: number) => void;
}

export function DocumentRow({
  item,
  index,
  total,
  mergePdfMode,
  mergedPdfName,
  renameRule,
  onUpdate,
  onMove,
  onRemove,
  onDragStartIndex,
  onDropIndex,
}: DocumentRowProps) {
  const targets = getTargetDocFormats(item.extensao);
  const outBase = resolveOutputBaseName(item.nomeBase, item.nomePersonalizado, index, renameRule);
  const outLabel = mergePdfMode
    ? `Parte ${index + 1} em ${mergedPdfName || "unificado"}.pdf`
    : `${outBase}.${DOC_FORMAT_EXT[item.formato]}`;

  const isPdfInput = item.extensao === "pdf";
  const outputsPdf = mergePdfMode || item.formato === "PDF" || item.formato === "PDF_SPLIT";

  return (
    <article
      draggable={total > 1}
      onDragStart={() => onDragStartIndex(index)}
      onDragOver={(e: React.DragEvent) => e.preventDefault()}
      onDrop={() => onDropIndex(index)}
      className="flex flex-col justify-between rounded-[6px] border border-[var(--line)] bg-[var(--bg-panel)] transition-colors hover:border-[var(--line-strong)]"
    >
      {/* Topo do cartão */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {total > 1 && (
            <span
              title="Arraste para reordenar"
              className="mt-0.5 cursor-grab text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-[var(--fg-muted)]">{String(index + 1).padStart(2, "0")}</span>
              <span className="rounded-[2px] border border-[var(--line-strong)] bg-[var(--bg-field)] px-1.5 py-0.2 uppercase text-[var(--fg-primary)]">
                {item.extensao || "doc"}
              </span>
              <span className="text-[var(--fg-muted)]">{formatBytes(item.tamanhoBytes)}</span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-[var(--fg-primary)]" title={item.nome}>
              {item.nome}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--accent-bright)]">
              {outLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {total > 1 && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
                aria-label="Mover para cima"
                className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-[var(--line)] bg-[var(--bg-field)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="h-3 w-3" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={() => onMove(index, index + 1)}
                aria-label="Mover para baixo"
                className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-[var(--line)] bg-[var(--bg-field)] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-30 cursor-pointer"
              >
                <ArrowDown className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover documento"
            className="flex h-6 w-6 items-center justify-center rounded-[3px] border border-[var(--line)] bg-[var(--bg-field)] text-[var(--fg-secondary)] hover:text-[var(--status-err)] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {item.previewUrl && (
        <div className="h-24 w-full overflow-hidden border-b border-[var(--line)] bg-[var(--bg-deep)]">
          <img src={item.previewUrl} alt={item.nome} className="h-full w-full object-contain" />
        </div>
      )}

      {/* Controles */}
      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        {!mergePdfMode && (
          <>
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

            <div className="col-span-2">
              <Label>Formato de saída</Label>
              <Select
                value={item.formato}
                onChange={(e) =>
                  onUpdate(item.id, { formato: e.target.value as DocOutputFormat })
                }
              >
                {targets.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {getDocFormatLabel(fmt)}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        {isPdfInput && outputsPdf && (
          <>
            <div>
              <Label>Intervalo de páginas</Label>
              <Input
                type="text"
                placeholder="Todas (ex: 1-3, 5)"
                className="font-mono"
                value={item.intervaloPaginas}
                onChange={(e) => onUpdate(item.id, { intervaloPaginas: e.target.value })}
              />
            </div>
            <div>
              <Label>Rotação</Label>
              <Select
                className="font-mono"
                value={item.rotacao}
                onChange={(e) =>
                  onUpdate(item.id, {
                    rotacao: Number(e.target.value) as 0 | 90 | 180 | 270,
                  })
                }
              >
                <option value={0}>0°</option>
                <option value={90}>90° horário</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </Select>
            </div>
          </>
        )}

        {!isPdfInput && outputsPdf && (
          <>
            <div>
              <Label>Folha</Label>
              <Select
                value={item.tamanhoPagina}
                onChange={(e) =>
                  onUpdate(item.id, {
                    tamanhoPagina: e.target.value as "A4" | "LETTER" | "AUTO",
                  })
                }
              >
                <option value="A4">A4</option>
                <option value="LETTER">Carta</option>
                {item.previewUrl && <option value="AUTO">Dimensão da imagem</option>}
              </Select>
            </div>
            <div>
              <Label>Orientação</Label>
              <Select
                value={item.orientacao}
                onChange={(e) =>
                  onUpdate(item.id, {
                    orientacao: e.target.value as "portrait" | "landscape",
                  })
                }
              >
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </Select>
            </div>
          </>
        )}

        {!mergePdfMode && item.formato === "CSV" && (
          <div className="col-span-2">
            <Label>Delimitador CSV</Label>
            <Select
              value={item.delimitadorCsv}
              onChange={(e) =>
                onUpdate(item.id, { delimitadorCsv: e.target.value as "," | ";" })
              }
            >
              <option value=";">Ponto e vírgula (;) para Excel em português</option>
              <option value=",">Vírgula (,)</option>
            </Select>
          </div>
        )}
      </div>
    </article>
  );
}
