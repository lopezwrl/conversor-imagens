import { useState } from "react";
import { ChevronDown, ChevronUp, Maximize2, RotateCcw, Scissors, Sliders, X } from "lucide-react";
import type { CutoutMode, ImageOutputFormat, ImageRecord } from "../../types/image";
import type { BatchRenameRule } from "../../types/shared";
import { IMAGE_FORMATS, IMAGE_FORMAT_EXT, OPAQUE_IMAGE_FORMATS } from "../../lib/formats";
import { formatBytes, resolveOutputBaseName } from "../../lib/naming";
import { Input, Label } from "../../components/ui/Field";

interface ImageCardProps {
  item: ImageRecord;
  index: number;
  renameRule: BatchRenameRule;
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
  onUpdate,
  onRemove,
  onZoom,
}: ImageCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const outBase = resolveOutputBaseName(item.nomeBase, item.nomePersonalizado, index, renameRule);
  const outName = `${outBase}.${IMAGE_FORMAT_EXT[item.formato]}`;
  const isOpaqueTarget = item.removerFundo && OPAQUE_IMAGE_FORMATS.has(item.formato);
  const hasCustomSize = item.largura !== "" || item.altura !== "";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border-2 border-[#BC9200] bg-[#FDE2B9] text-[#60011D] shadow-xl transition-transform hover:-translate-y-0.5">
      {/* Topo em Bordô (#60011D) com texto Creme (#FDE2B9) e Dourado (#BC9200) */}
      <div className="flex items-center justify-between gap-2 bg-[#60011D] px-3.5 py-2 text-[#FDE2B9]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-[#BC9200] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#FFF3DE]">
            #{String(index + 1).padStart(2, "0")}
          </span>
          <span className="truncate font-mono text-xs font-bold" title={item.nome}>
            {item.nome}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
            className="rounded p-1 text-[#FDE2B9] hover:bg-white/15 cursor-pointer"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remover imagem"
            className="rounded p-1 text-[#FDE2B9] hover:bg-[#BC9200] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Miniatura clara e visível */}
      <div
        className={`relative aspect-[16/10] overflow-hidden border-b-2 border-[#BC9200]/50 ${
          item.removerFundo ? "checkerboard" : "bg-[#FFF3DE]"
        }`}
      >
        <img
          src={item.urlMiniatura}
          alt={item.nome}
          loading="lazy"
          className="h-full w-full object-contain p-2"
        />

        <span className="absolute bottom-2 left-2 rounded-md border border-[#BC9200] bg-[#60011D]/90 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FDE2B9]">
          {item.largura || item.larguraOriginal}×{item.altura || item.alturaOriginal}px · {formatBytes(item.tamanhoBytes)}
        </span>

        {item.removerFundo && (
          <span className="absolute bottom-2 right-2 rounded-md border border-[#BC9200] bg-[#0B3B46] px-2 py-0.5 font-mono text-[10px] font-bold text-[#FDE2B9]">
            Sem fundo ({CUTOUT_MODES.find((c) => c.id === item.modoRemocao)?.label})
          </span>
        )}
      </div>

      {/* Corpo enxuto em Creme (#FDE2B9): só o essencial visível de cara! */}
      <div className="space-y-3 p-3.5">
        {/* Nome final de saída em destaque */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[#BC9200] bg-[#FFF3DE] px-3 py-1.5">
          <span className="font-mono text-[10px] font-bold uppercase text-[#0B3B46]">Saída:</span>
          <span className="truncate font-mono text-xs font-bold text-[#60011D]">{outName}</span>
        </div>

        {/* 1. Pílulas de Formato (1 clique, super visíveis!) */}
        <div>
          <div className="grid grid-cols-6 gap-1">
            {IMAGE_FORMATS.map((fmt) => {
              const active = item.formato === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onUpdate(item.id, { formato: fmt as ImageOutputFormat })}
                  className={`rounded-md border py-1.5 font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    active
                      ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9] shadow-sm"
                      : "border-[#60011D]/25 bg-[#FFF3DE] text-[#60011D] hover:border-[#BC9200]"
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Botão grande de Remover Fundo (em Petróleo #0B3B46 quando ativo!) + Botão de Ajustes Extras */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { removerFundo: !item.removerFundo })}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
              item.removerFundo
                ? "border-[#BC9200] bg-[#0B3B46] text-[#FDE2B9] shadow-md"
                : "border-[#0B3B46]/35 bg-[#FFF3DE] text-[#0B3B46] hover:border-[#0B3B46]"
            }`}
          >
            <Scissors className="h-3.5 w-3.5" />
            {item.removerFundo ? "Fundo Removido" : "Remover Fundo"}
          </button>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
              showDetails || hasCustomSize || item.nomePersonalizado !== null
                ? "border-[#BC9200] bg-[#BC9200] text-[#FFF3DE]"
                : "border-[#60011D]/25 bg-[#FFF3DE] text-[#60011D] hover:border-[#BC9200]"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Medidas / Nome</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Se Remover Fundo estiver ativo, mostra apenas as 3 pílulas de modo */}
        {item.removerFundo && (
          <div className="space-y-2 rounded-xl border-2 border-[#0B3B46] bg-[#FFF3DE] p-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {CUTOUT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onUpdate(item.id, { modoRemocao: m.id })}
                  className={`rounded-md py-1.5 font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    item.modoRemocao === m.id
                      ? "bg-[#0B3B46] text-[#FDE2B9]"
                      : "bg-[#FDE2B9] text-[#0B3B46] hover:bg-[#0B3B46]/15"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {isOpaqueTarget && (
              <div className="flex items-center justify-between pt-1 font-mono text-[11px] font-bold text-[#60011D]">
                <span>Cor de fundo ({item.formato}):</span>
                <input
                  type="color"
                  value={item.corFundo}
                  onChange={(e) => onUpdate(item.id, { corFundo: e.target.value })}
                  className="h-6 w-10 rounded border border-[#60011D] cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* Gaveta opcional: só abre se o usuário quiser mudar largura/altura/nome de UMA foto específica */}
        {showDetails && (
          <div className="space-y-2.5 rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="mb-0">Nome individual</Label>
                {item.nomePersonalizado !== null && (
                  <button
                    type="button"
                    onClick={() => onUpdate(item.id, { nomePersonalizado: null })}
                    className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#0B3B46] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
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

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Largura</Label>
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
                <Label>Altura</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={String(item.alturaOriginal)}
                  className="font-mono"
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
                  className="font-mono"
                  value={item.qualidade}
                  onChange={(e) =>
                    onUpdate(item.id, {
                      qualidade: Math.max(1, Math.min(100, Number(e.target.value) || 90)),
                    })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
