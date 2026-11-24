import { useState } from "react";
import type { BatchRenameRule } from "../../types/shared";
import { resolveOutputBaseName } from "../../lib/naming";
import { Input, Label, Select } from "../ui/Field";

interface BatchRenameProps {
  rule: BatchRenameRule;
  onChange: (next: BatchRenameRule) => void;
  sampleExtension: string;
  sampleOriginalBase: string;
  hasCustomNames: boolean;
  onResetCustomNames: () => void;
}

export function BatchRename({
  rule,
  onChange,
  sampleExtension,
  sampleOriginalBase,
  hasCustomNames,
  onResetCustomNames,
}: BatchRenameProps) {
  const [showMore, setShowMore] = useState(false);
  const p1 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 0, rule);
  const p2 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 1, rule);

  return (
    <div className="rounded-[6px] bg-[#F4D09A]/55 p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[210px] flex-1">
          <Label>Nome do lote</Label>
          <Input
            type="text"
            className="font-mono"
            placeholder="Prefixo opcional (ex: catalogo)"
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
          />
        </div>

        <div className="pb-1.5 text-[13px] text-[var(--ink-primary)]">
          Exemplo:{" "}
          <span className="font-mono font-semibold text-[var(--ink-primary)]">
            {p1}.{sampleExtension}
          </span>
          ,{" "}
          <span className="font-mono font-medium text-[var(--ink-primary)]">
            {p2}.{sampleExtension}
          </span>
        </div>

        <div className="flex items-center gap-4 pb-1.5 text-[13px]">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 font-semibold text-[var(--ink-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
          >
            <span>{showMore ? "Ocultar numeração" : "Opções de numeração"}</span>
            <span aria-hidden="true" className="text-sm leading-none">
              ›
            </span>
          </button>

          {hasCustomNames && (
            <button
              type="button"
              onClick={onResetCustomNames}
              className="inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 font-semibold text-[var(--ink-secondary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
            >
              <span>Restaurar nomes editados</span>
            </button>
          )}
        </div>
      </div>

      {showMore && (
        <div className="mt-3 grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
          <div>
            <Label>Sufixo</Label>
            <Input
              type="text"
              className="font-mono"
              placeholder="Opcional"
              value={rule.suffix}
              onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            />
          </div>
          <div>
            <Label>Começar em</Label>
            <Input
              type="number"
              min={0}
              value={rule.startNumber}
              onChange={(e) =>
                onChange({ ...rule, startNumber: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </div>
          <div>
            <Label>Zeros à esquerda</Label>
            <Select
              value={rule.padDigits}
              onChange={(e) => onChange({ ...rule, padDigits: Number(e.target.value) })}
            >
              <option value={1}>1, 2, 3</option>
              <option value={2}>01, 02, 03</option>
              <option value={3}>001, 002</option>
            </Select>
          </div>
          <div>
            <Label>Separador</Label>
            <Select
              value={rule.separator}
              onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            >
              <option value="_">Sublinhado (_)</option>
              <option value="-">Hífen (-)</option>
              <option value=" ">Espaço</option>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
