import { RotateCcw, Tag } from "lucide-react";
import type { BatchRenameConfig } from "../../types/revela";
import { computeTargetBaseName } from "../../services/api";

interface BatchRenameBarProps {
  value: BatchRenameConfig;
  onChange: (next: BatchRenameConfig) => void;
  sampleExtension: string;
  sampleOriginalBase: string;
  hasIndividualOverrides: boolean;
  onResetIndividualOverrides: () => void;
}

export function BatchRenameBar({
  value,
  onChange,
  sampleExtension,
  sampleOriginalBase,
  hasIndividualOverrides,
  onResetIndividualOverrides,
}: BatchRenameBarProps) {
  const preview1 = computeTargetBaseName(sampleOriginalBase || "arquivo", null, 0, value);
  const preview2 = computeTargetBaseName(sampleOriginalBase || "arquivo", null, 1, value);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Tag className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Renomeação em Lote Inteligente
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Atualiza todos os cards ao vivo — vale tanto no download individual quanto no ZIP.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[11px] text-[var(--accent-text)]">
            Prévia: <strong className="text-[var(--text-primary)]">{preview1}.{sampleExtension}</strong>,{" "}
            <span>{preview2}.{sampleExtension}</span>
          </div>
          {hasIndividualOverrides && (
            <button
              type="button"
              onClick={onResetIndividualOverrides}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Voltar todos os cards para o padrão do lote"
            >
              <RotateCcw className="h-3 w-3" />
              Limpar edições manuais
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Prefixo em lote
          </label>
          <input
            type="text"
            className="revela-input font-mono text-xs"
            placeholder="Ex: produto_verao (vazio = nome original)"
            value={value.prefix}
            onChange={(e) => onChange({ ...value, prefix: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Sufixo opcional
          </label>
          <input
            type="text"
            className="revela-input font-mono text-xs"
            placeholder="Ex: final"
            value={value.suffix}
            onChange={(e) => onChange({ ...value, suffix: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Início nº
            </label>
            <input
              type="number"
              min={0}
              className="revela-input font-mono text-xs"
              value={value.startNumber}
              onChange={(e) => onChange({ ...value, startNumber: Math.max(0, Number(e.target.value) || 0) })}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Dígitos
            </label>
            <select
              className="revela-select font-mono text-xs"
              value={value.padDigits}
              onChange={(e) => onChange({ ...value, padDigits: Number(e.target.value) })}
            >
              <option value={1}>1 (1, 2)</option>
              <option value={2}>2 (01, 02)</option>
              <option value={3}>3 (001)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Separador
          </label>
          <select
            className="revela-select font-mono text-xs"
            value={value.separator}
            onChange={(e) => onChange({ ...value, separator: e.target.value })}
          >
            <option value="_">Underline (_)</option>
            <option value="-">Hífen (-)</option>
            <option value=" ">Espaço ( )</option>
          </select>
        </div>
      </div>
    </div>
  );
}
