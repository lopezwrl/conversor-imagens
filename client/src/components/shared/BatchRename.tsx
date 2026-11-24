import { RotateCcw } from "lucide-react";
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
  const p1 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 0, rule);
  const p2 = resolveOutputBaseName(sampleOriginalBase || "arquivo", null, 1, rule);

  return (
    <div className="border-t border-[var(--line)] pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--fg-primary)]">
            Renomeação em lote
          </span>
          <span className="font-mono text-[11px] text-[var(--fg-muted)]">
            Saída: <strong className="text-[var(--fg-secondary)]">{p1}.{sampleExtension}</strong>,{" "}
            {p2}.{sampleExtension}
          </span>
        </div>

        {hasCustomNames && (
          <button
            type="button"
            onClick={onResetCustomNames}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent-bright)] hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={1.5} />
            Restaurar padrão do lote nos itens editados
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Label>Prefixo</Label>
          <Input
            type="text"
            className="font-mono"
            placeholder="Ex: catalogo_outono"
            value={rule.prefix}
            onChange={(e) => onChange({ ...rule, prefix: e.target.value })}
          />
        </div>

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
          <Label>Número inicial</Label>
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
          <Label>Casas decimais</Label>
          <Select
            className="font-mono"
            value={rule.padDigits}
            onChange={(e) => onChange({ ...rule, padDigits: Number(e.target.value) })}
          >
            <option value={1}>1 (1, 2, 3)</option>
            <option value={2}>2 (01, 02, 03)</option>
            <option value={3}>3 (001, 002)</option>
          </Select>
        </div>

        <div>
          <Label>Separador</Label>
          <Select
            className="font-mono"
            value={rule.separator}
            onChange={(e) => onChange({ ...rule, separator: e.target.value })}
          >
            <option value="_">Sublinhado (_)</option>
            <option value="-">Hífen (-)</option>
            <option value=" ">Espaço</option>
          </Select>
        </div>
      </div>
    </div>
  );
}
