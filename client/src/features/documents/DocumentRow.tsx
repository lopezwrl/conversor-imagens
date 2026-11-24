import React from "react";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, X } from "lucide-react";
import type { DocOutputFormat, DocRecord } from "../../types/document";
import type { BatchRenameRule } from "../../types/shared";
import { DOC_FORMAT_EXT, getTargetDocFormats } from "../../lib/formats";
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

const SHORT_FORMAT_LABEL: Record<DocOutputFormat, string> = {
  PDF: "PDF",
  PDF_SPLIT: "Dividir PDF",
  DOCX: "DOCX",
  HTML: "HTML",
  MD: "MD",
  TXT: "TXT",
  XLSX: "XLSX",
  CSV: "CSV",
  JSON: "JSON",
};

/**
 * Ficha de Documento em Creme (#FDE2B9) com cabeçalho Petróleo (#0B3B46)
 * e botões de formato ativos em Bordô (#60011D) com borda Dourada (#BC9200).
 * Alto contraste com as 4 cores!
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
    ? `Parte ${String(index + 1).padStart(2, "0")} → ${mergedPdfName || "unificado"}.pdf`
    : `${outBase}.${DOC_FORMAT_EXT[item.formato]}`;

  const isPdfInput = item.extensao === "pdf";

  return (
    <article
      draggable={total > 1}
      onDragStart={() => onDragStartIndex(index)}
      onDragOver={(e: React.DragEvent) => e.preventDefault()}
      onDrop={() => onDropIndex(index)}
      className="flex flex-col gap-3 rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3.5 text-[#0B3B46] shadow-md transition-all hover:border-[#60011D]"
    >
      {/* Linha Superior: Índice, Tipo, Nome Original -> Saída e Ordem */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {total > 1 && (
            <span
              title="Arraste para reordenar"
              className="cursor-grab text-[#0B3B46] hover:text-[#60011D]"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <span className="rounded-md bg-[#0B3B46] px-2 py-1 font-mono text-xs font-bold text-[#FDE2B9]">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span className="rounded-md border border-[#BC9200] bg-[#60011D] px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-[#FDE2B9]">
            {item.extensao || "doc"}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs font-bold text-[#0B3B46]" title={item.nome}>
              {item.nome}{" "}
              <span className="font-normal opacity-75">({formatBytes(item.tamanhoBytes)})</span>
            </p>
            <p className="truncate font-mono text-xs font-bold text-[#60011D]">
              Saída: {outLabel}
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
                aria-label="Subir"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#0B3B46]/30 bg-[#FDE2B9] text-[#0B3B46] hover:bg-[#0B3B46] hover:text-[#FDE2B9] disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={() => onMove(index, index + 1)}
                aria-label="Descer"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[#0B3B46]/30 bg-[#FDE2B9] text-[#0B3B46] hover:bg-[#0B3B46] hover:text-[#FDE2B9] disabled:opacity-30 cursor-pointer"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#60011D] text-[#FDE2B9] hover:bg-[#820429] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Linha Inferior: Pílulas de Formato Clicáveis + Nome Individual */}
      {!mergePdfMode && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#BC9200]/40 pt-2.5">
          {/* Pílulas de formato de destino */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] font-bold uppercase text-[#0B3B46]">
              Converter em:
            </span>
            {targets.map((fmt) => {
              const active = item.formato === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onUpdate(item.id, { formato: fmt as DocOutputFormat })}
                  className={`rounded-lg border-2 px-3 py-1 font-mono text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-sm"
                      : "border-[#0B3B46]/25 bg-[#FDE2B9] text-[#0B3B46] hover:border-[#60011D]"
                  }`}
                >
                  {SHORT_FORMAT_LABEL[fmt]}
                </button>
              );
            })}
          </div>

          {/* Controles extras só quando necessários (PDF páginas/rotação + nome manual) */}
          <div className="flex flex-wrap items-center gap-2">
            {isPdfInput && (item.formato === "PDF" || item.formato === "PDF_SPLIT") && (
              <>
                <Input
                  type="text"
                  placeholder="Págs (ex: 1-3)"
                  className="w-28 font-mono"
                  value={item.intervaloPaginas}
                  onChange={(e) => onUpdate(item.id, { intervaloPaginas: e.target.value })}
                />
                <Select
                  className="w-20 font-mono"
                  value={item.rotacao}
                  onChange={(e) =>
                    onUpdate(item.id, { rotacao: Number(e.target.value) as 0 | 90 | 180 | 270 })
                  }
                >
                  <option value={0}>0°</option>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </Select>
              </>
            )}

            <div className="relative w-44">
              <Input
                type="text"
                className="font-mono"
                value={item.nomePersonalizado ?? ""}
                placeholder={outBase}
                title="Editar nome deste arquivo"
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
                  className="absolute right-2 top-2.5 text-[#60011D] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
