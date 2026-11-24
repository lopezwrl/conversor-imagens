import React from "react";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, X } from "lucide-react";
import type { DocOutputFormat, DocRecord } from "../../types/document";
import type { BatchRenameRule } from "../../types/shared";
import { DOC_FORMAT_EXT, getDocFormatLabel, getTargetDocFormats } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Select } from "../../components/ui/Field";

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

/**
 * Linha de Pauta Editorial Horizontal:
 * Diferencia visualmente e ergonomicamente a seção de Documentos da seção de Fotos.
 */
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
    ? `Cap. ${String(index + 1).padStart(2, "0")} → ${mergedPdfName || "unificado"}.pdf`
    : `${outBase}.${DOC_FORMAT_EXT[item.formato]}`;

  const isPdfInput = item.extensao === "pdf";
  const outputsPdf = mergePdfMode || item.formato === "PDF" || item.formato === "PDF_SPLIT";

  return (
    <article
      draggable={total > 1}
      onDragStart={() => onDragStartIndex(index)}
      onDragOver={(e: React.DragEvent) => e.preventDefault()}
      onDrop={() => onDropIndex(index)}
      className="grid grid-cols-1 gap-3 border-b border-[var(--line)] bg-[#04181D]/90 px-4 py-3.5 transition-colors hover:bg-[#072229] lg:grid-cols-[auto_1.4fr_1.6fr_auto] lg:items-center"
    >
      {/* Coluna 1: Índice da pauta + alça + tipo */}
      <div className="flex items-center gap-3">
        {total > 1 && (
          <span
            title="Arraste para reordenar na pauta"
            className="cursor-grab text-[var(--fg-muted)] hover:text-[var(--fg-primary)]"
          >
            <GripVertical className="h-4 w-4" strokeWidth={1.5} />
          </span>
        )}
        <span className="font-mono text-xs font-semibold text-[#F4BFC2]">
          {String(index + 1).padStart(3, "0")}
        </span>
        <span className="min-w-[48px] border border-[var(--line-strong)] bg-[#031317] px-2 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--fg-primary)]">
          {item.extensao || "doc"}
        </span>
      </div>

      {/* Coluna 2: Arquivo original -> Nome de saída */}
      <div className="min-w-0 pr-2">
        <div className="flex items-baseline gap-2">
          <p className="truncate font-mono text-xs text-[var(--fg-primary)]" title={item.nome}>
            {item.nome}
          </p>
          <span className="shrink-0 font-mono text-[10px] text-[var(--fg-muted)]">
            {formatBytes(item.tamanhoBytes)}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--accent-bright)]">
          Saída: {outLabel}
        </p>
      </div>

      {/* Coluna 3: Controles inline da pauta */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {!mergePdfMode && (
          <>
            <div className="relative">
              <Input
                type="text"
                className="font-mono"
                value={item.nomePersonalizado ?? ""}
                placeholder={outBase}
                title="Nome de saída individual"
                onChange={(e) =>
                  onUpdate(item.id, {
                    nomePersonalizado: e.target.value === "" ? null : e.target.value,
                  })
                }
              />
              {item.nomePersonalizado !== null && (
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                  title="Voltar ao nome do lote"
                  className="absolute right-2 top-2.5 text-[var(--accent-bright)] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>

            <div>
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

        {/* Parâmetro contextual (páginas/rotação/folha/delimitador) */}
        <div className="flex items-center gap-1.5">
          {isPdfInput && outputsPdf && (
            <>
              <Input
                type="text"
                placeholder="Págs (1-3, 5)"
                className="font-mono"
                value={item.intervaloPaginas}
                onChange={(e) => onUpdate(item.id, { intervaloPaginas: e.target.value })}
              />
              <Select
                className="w-24 shrink-0 font-mono"
                value={item.rotacao}
                onChange={(e) =>
                  onUpdate(item.id, {
                    rotacao: Number(e.target.value) as 0 | 90 | 180 | 270,
                  })
                }
              >
                <option value={0}>0°</option>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </Select>
            </>
          )}

          {!isPdfInput && outputsPdf && (
            <>
              <Select
                value={item.tamanhoPagina}
                onChange={(e) =>
                  onUpdate(item.id, {
                    tamanhoPagina: e.target.value as "A4" | "LETTER" | "AUTO",
                  })
                }
              >
                <option value="A4">Folha A4</option>
                <option value="LETTER">Carta</option>
                {item.previewUrl && <option value="AUTO">Original</option>}
              </Select>
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
            </>
          )}

          {!mergePdfMode && item.formato === "CSV" && (
            <Select
              value={item.delimitadorCsv}
              onChange={(e) =>
                onUpdate(item.id, { delimitadorCsv: e.target.value as "," | ";" })
              }
            >
              <option value=";">CSV (;)</option>
              <option value=",">CSV (,)</option>
            </Select>
          )}
        </div>
      </div>

      {/* Coluna 4: Ações de ordem e remoção */}
      <div className="flex items-center justify-end gap-1">
        {total > 1 && (
          <>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label="Subir na pauta"
              className="flex h-7 w-7 items-center justify-center border border-[var(--line)] bg-[#031317] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-30 cursor-pointer"
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label="Descer na pauta"
              className="flex h-7 w-7 items-center justify-center border border-[var(--line)] bg-[#031317] text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] disabled:opacity-30 cursor-pointer"
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label="Remover da pauta"
          className="flex h-7 w-7 items-center justify-center border border-[var(--line)] bg-[#031317] text-[var(--fg-secondary)] hover:border-[var(--status-err)] hover:text-[var(--status-err)] cursor-pointer"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}
