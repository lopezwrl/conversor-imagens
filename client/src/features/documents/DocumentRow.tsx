import React, { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import type { DocOutputFormat, DocRecord } from "../../types/document";
import type { BatchRenameRule } from "../../types/shared";
import { DOC_FORMAT_EXT, getTargetDocFormats } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Label, Select } from "../../components/ui/Field";

interface DocumentRowProps {
  item: DocRecord;
  index: number;
  total: number;
  mergePdfMode: boolean;
  renameRule: BatchRenameRule;
  onSelectFormat: (id: string, fmt: DocOutputFormat | null) => void;
  onUpdate: (id: string, patch: Partial<DocRecord>) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onDragStartIndex: (idx: number) => void;
  onDropIndex: (idx: number) => void;
}

const SHORT_FORMAT_LABEL: Record<DocOutputFormat, string> = {
  PDF: "PDF",
  PDF_SPLIT: "Dividir",
  DOCX: "DOCX",
  HTML: "HTML",
  MD: "MD",
  TXT: "TXT",
  XLSX: "XLSX",
  CSV: "CSV",
  JSON: "JSON",
};

export function DocumentRow({
  item,
  index,
  total,
  mergePdfMode,
  renameRule,
  onSelectFormat,
  onUpdate,
  onMove,
  onRemove,
  onDragStartIndex,
  onDropIndex,
}: DocumentRowProps) {
  const [expanded, setExpanded] = useState(false);

  const targets = getTargetDocFormats(item.extensao);
  const outBase = resolveOutputBaseName(item.nomeBase, item.nomePersonalizado, index, renameRule);
  const outName = `${outBase}.${DOC_FORMAT_EXT[item.formato]}`;
  const isPdfInput = item.extensao === "pdf";
  const hasException = !mergePdfMode && item.formatoIndividual !== null;

  const statusDetails: string[] = [];
  if (item.intervaloPaginas) statusDetails.push(`Páginas ${item.intervaloPaginas}`);
  if (item.rotacao) statusDetails.push(`${item.rotacao}°`);
  const statusText = statusDetails.length > 0 ? statusDetails.join(" · ") : "Padrão";

  return (
    <div
      draggable={total > 1}
      onDragStart={() => onDragStartIndex(index)}
      onDragOver={(e: React.DragEvent) => e.preventDefault()}
      onDrop={() => onDropIndex(index)}
      className="rounded-[6px] bg-[#F4D09A]/55 px-3.5 py-2.5 text-[#06252C]"
    >
      {/* Ordem: número, nome original + saída, formato de saída, status, botão de remover */}
      <div className="flex min-h-[44px] flex-wrap items-center gap-3">
        {/* 1. Número (com alça de arraste quando houver mais de 1) */}
        <div className="flex items-center gap-1.5">
          {total > 1 && (
            <span
              title="Arraste para reordenar"
              className="cursor-grab text-[#0B3B46] hover:text-[#06252C]"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <span className="w-5 text-[13px] font-semibold text-[#0B3B46]">{index + 1}</span>
        </div>

        {/* 2. Nome original em destaque + linha inferior com saída e tamanho */}
        <div className="min-w-[180px] flex-1">
          <p className="truncate font-mono text-[13px] font-semibold text-[#06252C]">
            {item.nome}
          </p>
          <p className="mt-0.5 text-[13px] text-[#0B3B46]">
            {mergePdfMode ? (
              <span>
                {index + 1} de {total} · {formatBytes(item.tamanhoBytes)}
              </span>
            ) : (
              <>
                <span className="font-mono font-medium">→ {outName}</span>
                <span> · {formatBytes(item.tamanhoBytes)}</span>
              </>
            )}
          </p>
        </div>

        {/* 3. Formato de saída (com exceção explícita e visível quando diferente do lote) */}
        {!mergePdfMode && (
          <div className="flex flex-wrap items-center gap-2">
            {hasException && (
              <button
                type="button"
                onClick={() => onSelectFormat(item.id, null)}
                title="Voltar ao formato do modo escolhido"
                className="rounded-[6px] bg-[#60011D] px-2 py-0.5 text-[13px] font-medium text-[#FDE2B9] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
              >
                Exceção · seguir lote
              </button>
            )}
            <div className="inline-flex flex-wrap overflow-hidden rounded-[6px] bg-[#FDE2B9]">
              {targets.map((fmt) => {
                const active = item.formato === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => onSelectFormat(item.id, fmt as DocOutputFormat)}
                    className={`px-2.5 py-1 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                      active
                        ? "bg-[#0B3B46] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                        : "text-[#06252C] hover:bg-[#F4D09A]"
                    }`}
                  >
                    {SHORT_FORMAT_LABEL[fmt]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Status + ação clicável "Opções ›" */}
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-[#06252C] sm:inline">{statusText}</span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[13px] font-semibold text-[#0B3B46] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
          >
            <span>{expanded ? "Fechar opções" : "Opções"}</span>
            <span aria-hidden="true" className="text-sm leading-none">
              ›
            </span>
          </button>
        </div>

        {/* 5. Ordem e botão de remover */}
        <div className="flex items-center gap-1">
          {total > 1 && (
            <>
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
                aria-label="Subir"
                className="rounded-[6px] p-1 text-[#0B3B46] hover:bg-[#FDE2B9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === total - 1}
                onClick={() => onMove(index, index + 1)}
                aria-label="Descer"
                className="rounded-[6px] p-1 text-[#0B3B46] hover:bg-[#FDE2B9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] disabled:opacity-30 cursor-pointer"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover da fila"
            className="rounded-[6px] p-1 text-[#0B3B46] hover:text-[#60011D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#0B3B46]/15 pt-3 sm:grid-cols-3">
          {!mergePdfMode && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="mb-0">Nome do arquivo</Label>
                {item.nomePersonalizado !== null && (
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                    className="rounded-[6px] px-1 text-[13px] font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
                  >
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
          )}

          {isPdfInput && (
            <>
              <div>
                <Label>Páginas</Label>
                <Input
                  type="text"
                  placeholder="Todas (ex: 1-3, 5)"
                  value={item.intervaloPaginas}
                  onChange={(e) => onUpdate(item.id, { intervaloPaginas: e.target.value })}
                />
              </div>
              <div>
                <Label>Rotação</Label>
                <Select
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
              </div>
            </>
          )}

          {!isPdfInput && (mergePdfMode || item.formato === "PDF") && (
            <>
              <div>
                <Label>Tamanho da folha</Label>
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
                  {item.previewUrl && <option value="AUTO">Ajustar à imagem</option>}
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
            <div>
              <Label>Separador CSV</Label>
              <Select
                value={item.delimitadorCsv}
                onChange={(e) =>
                  onUpdate(item.id, { delimitadorCsv: e.target.value as "," | ";" })
                }
              >
                <option value=";">Ponto e vírgula (;)</option>
                <option value=",">Vírgula (,)</option>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
