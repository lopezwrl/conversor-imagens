import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const p1 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 0, rule);
  const p2 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 1, rule);

  return (
    <div className="rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <Label>Renomear lote (prefixo)</Label>
          <Input
            type="text"
            className="font-mono"
            placeholder="Ex: catalogo (vazio mantém o nome original)"
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
          />
        </div>

        <div className="flex flex-col justify-end pt-3">
          <div className="rounded-lg border border-[#BC9200] bg-[#FDE2B9] px-3 py-2 font-mono text-xs font-bold text-[var(--ink-primary)]">
            Saída: <span className="underline">{p1}.{sampleExtension}</span>, {p2}.{sampleExtension}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-[var(--ink-primary)]/25 bg-[#FDE2B9] px-3 text-xs font-bold text-[var(--ink-primary)] hover:border-[#BC9200] cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showAdvanced ? "Menos opções" : "Numeração"}
          </button>

          {hasCustomNames && (
            <button
              type="button"
              onClick={onResetCustomNames}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#60011D] px-3 text-xs font-bold text-[#FDE2B9] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Resetar editados
            </button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#BC9200]/40 pt-3 sm:grid-cols-4">
          <div>
            <Label>Sufixo</Label>
            <Input
              type="text"
              className="font-mono"
              placeholder="Ex: pronto"
              value={rule.suffix}
              onChange={(e) => onChange({ ...rule, suffix: e.target.value })}
            />
          </div>
          <div>
            <Label>Começar em</Label>
            <Input
              type="number"
              min={0}
              className="font-mono"
              value={rule.startNumber}
              onChange={(e) =>
                onChange({ ...rule, startNumber: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </div>
          <div>
            <Label>Zeros</Label>
            <Select
              className="font-mono"
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
              className="font-mono"
              value={rule.separator}
              onChange={(e) => onChange({ ...rule, separator: e.target.value })}
            >
              <option value="_">Underline (_)</option>
              <option value="-">Hífen (-)</option>
              <option value=" ">Espaço</option>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
