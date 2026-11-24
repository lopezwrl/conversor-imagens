import { useState } from "react";
import { X } from "lucide-react";
import type { CutoutMode, ImageOutputFormat, ImageRecord } from "../../types/image";
import type { BatchRenameRule } from "../../types/shared";
import { IMAGE_FORMATS, IMAGE_FORMAT_EXT, OPAQUE_IMAGE_FORMATS } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Label } from "../../components/ui/Field";

interface ImageCardProps {
  item: ImageRecord;
  index: number;
  renameRule: BatchRenameRule;
  onSelectFormat: (id: string, fmt: ImageOutputFormat | null) => void;
  onUpdate: (id: string, patch: Partial<ImageRecord>) => void;
  onRemove: (id: string) => void;
  onZoom: (src: string, title: string, meta: string) => void;
}

const CUTOUT_MODES: Array<{ id: CutoutMode; label: string }> = [
  { id: "automatico", label: "Rápido" },
  { id: "inteligente", label: "Refinado" },
  { id: "manual", label: "Pincel" },
];

export function ImageCard({
  item,
  index,
  renameRule,
  onSelectFormat,
  onUpdate,
  onRemove,
  onZoom,
}: ImageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const outBase = resolveOutputBaseName(item.nomeBase, item.nomePersonalizado, index, renameRule);
  const outName = `${outBase}.${IMAGE_FORMAT_EXT[item.formato]}`;
  const isOpaqueTarget = item.removerFundo && OPAQUE_IMAGE_FORMATS.has(item.formato);
  const hasException = item.formatoIndividual !== null;

  const sizeStatus =
    item.largura || item.altura
      ? `${item.largura || "auto"}×${item.altura || "auto"} px`
      : `${item.larguraOriginal}×${item.alturaOriginal} px`;
  const bgStatus = item.removerFundo
    ? `Sem fundo (${CUTOUT_MODES.find((c) => c.id === item.modoRemocao)?.label})`
    : "Fundo mantido";

  return (
    <div className="rounded-[6px] bg-[#F4D09A]/55 px-3.5 py-2.5 text-[#3B0011]">
      {/* Ordem: número, miniatura, nome original + saída, formato de saída, status, botão de remover */}
      <div className="flex min-h-[44px] flex-wrap items-center gap-3">
        {/* 1. Número */}
        <span className="w-5 text-[13px] font-semibold text-[#60011D]">{index + 1}</span>

        {/* 2. Miniatura clicável para zoom */}
        <button
          type="button"
          onClick={() =>
            onZoom(
              item.urlMiniatura,
              item.nome,
              `${item.larguraOriginal}×${item.alturaOriginal} px · ${formatBytes(item.tamanhoBytes)}`
            )
          }
          title="Ampliar imagem"
          className={`h-11 w-14 shrink-0 overflow-hidden rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
            item.removerFundo ? "checkerboard" : "bg-[#FFF3DE]"
          }`}
        >
          <img
            src={item.urlMiniatura}
            alt={item.nome}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </button>

        {/* 3. Nome original em destaque + saída e tamanho */}
        <div className="min-w-[160px] flex-1">
          <p className="truncate font-mono text-[13px] font-semibold text-[#3B0011]">
            {item.nome}
          </p>
          <p className="mt-0.5 text-[13px] text-[#60011D]">
            <span className="font-mono font-medium">→ {outName}</span>
            <span> · {formatBytes(item.tamanhoBytes)}</span>
          </p>
        </div>

        {/* 4. Formato de saída em controle segmentado (com exceção explícita se diferente do lote) */}
        <div className="flex flex-wrap items-center gap-2">
          {hasException && (
            <button
              type="button"
              onClick={() => onSelectFormat(item.id, null)}
              title="Voltar ao formato do lote"
              className="rounded-[6px] bg-[#0B3B46] px-2 py-0.5 text-[13px] font-medium text-[#FDE2B9] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
            >
              Exceção · seguir lote
            </button>
          )}
          <div className="inline-flex overflow-hidden rounded-[6px] bg-[#FDE2B9]">
            {IMAGE_FORMATS.map((fmt) => {
              const active = item.formato === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onSelectFormat(item.id, fmt as ImageOutputFormat)}
                  className={`px-2.5 py-1 font-mono text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                    active
                      ? "bg-[#60011D] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                      : "text-[#3B0011] hover:bg-[#F4D09A]"
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Status + botão de texto "Opções ›" */}
        <div className="flex items-center gap-3">
          <span className="hidden text-[13px] text-[#3B0011] md:inline">
            {sizeStatus} · {bgStatus}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[13px] font-semibold text-[#60011D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
          >
            <span>{expanded ? "Fechar opções" : "Opções"}</span>
            <span aria-hidden="true" className="text-sm leading-none">
              ›
            </span>
          </button>
        </div>

        {/* 6. Botão remover */}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label="Remover da fila"
          className="rounded-[6px] p-1 text-[#60011D] hover:text-[#3B0011] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Seção interna expansível da própria linha */}
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#60011D]/15 pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="mb-0">Nome do arquivo</Label>
              {item.nomePersonalizado !== null && (
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                  className="rounded-[6px] px-1 text-[13px] font-semibold text-[#0B3B46] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
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

          <div className="grid grid-cols-3 gap-2 sm:col-span-1 lg:col-span-2">
            <div>
              <Label>Largura (px)</Label>
              <Input
                type="number"
                min={1}
                placeholder={String(item.larguraOriginal)}
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
                value={item.altura}
                onChange={(e) => onUpdate(item.id, { altura: e.target.value })}
              />
            </div>
            <div>
              <Label>Qualidade</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={item.qualidade}
                onChange={(e) =>
                  onUpdate(item.id, {
                    qualidade: Math.max(1, Math.min(100, Number(e.target.value) || 90)),
                  })
                }
              />
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-2">
            <Label>Remoção de fundo</Label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex overflow-hidden rounded-[6px] bg-[#FDE2B9]">
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { removerFundo: false })}
                  className={`px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                    !item.removerFundo
                      ? "bg-[#60011D] font-semibold text-[#FDE2B9]"
                      : "text-[#3B0011] hover:bg-[#F4D09A]"
                  }`}
                >
                  Manter
                </button>
                {CUTOUT_MODES.map((m) => {
                  const active = item.removerFundo && item.modoRemocao === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        onUpdate(item.id, { removerFundo: true, modoRemocao: m.id })
                      }
                      className={`px-3 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer ${
                        active
                          ? "bg-[#0B3B46] font-semibold text-[#FDE2B9] ring-1 ring-inset ring-[#BC9200]"
                          : "text-[#3B0011] hover:bg-[#F4D09A]"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {isOpaqueTarget && (
                <label className="inline-flex items-center gap-1.5 text-[13px] text-[#3B0011]">
                  <span>Cor:</span>
                  <input
                    type="color"
                    value={item.corFundo}
                    onChange={(e) => onUpdate(item.id, { corFundo: e.target.value })}
                    className="h-7 w-8 rounded-[6px] border border-[#60011D]/30 cursor-pointer"
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
