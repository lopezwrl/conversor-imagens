import { Check, Loader2, X } from "lucide-react";
import type { QueueEntry } from "../../types/shared";

interface ProcessingPanelProps {
  visible: boolean;
  percent: number;
  statusText: string;
  stages: Array<{ id: string; label: string }>;
  activeStage: string | null;
  queue: QueueEntry[];
}

export function ProcessingPanel({
  visible,
  percent,
  statusText,
  stages,
  activeStage,
  queue,
}: ProcessingPanelProps) {
  if (!visible) return null;

  const activeIdx = activeStage ? stages.findIndex((s) => s.id === activeStage) : -1;
  const finished = queue.filter((q) => q.status === "concluida" || q.status === "erro").length;

  return (
    <div className="mt-5 rounded-[6px] border border-[var(--line-strong)] bg-[var(--bg-panel-solid)] p-4 text-left">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs">
        <span className="text-[var(--fg-primary)]">{statusText}</span>
        <span className="text-[var(--accent-bright)]">{percent}%</span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-[var(--bg-field)]">
        <div
          className="h-full bg-[var(--accent)] transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {stages.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-6 border-b border-[var(--line)] pb-3">
          {stages.map((st, idx) => {
            const done = percent === 100 || (activeIdx !== -1 && idx < activeIdx);
            const current = percent < 100 && idx === activeIdx;
            return (
              <span
                key={st.id}
                className={`inline-flex items-center gap-2 font-mono text-[11px] ${
                  done
                    ? "text-[var(--status-ok)]"
                    : current
                    ? "text-[var(--fg-primary)]"
                    : "text-[var(--fg-muted)]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    done
                      ? "bg-[var(--status-ok)]"
                      : current
                      ? "bg-[var(--accent-bright)]"
                      : "bg-[var(--line-strong)]"
                  }`}
                />
                {st.label}
              </span>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-muted)]">
            <span>Fila</span>
            <span>
              {finished} / {queue.length}
            </span>
          </div>
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {queue.map((item, idx) => (
              <li
                key={`${item.nome}-${idx}`}
                className={`flex items-center gap-2.5 rounded-[4px] px-2.5 py-1.5 font-mono text-xs ${
                  item.status === "processando"
                    ? "bg-[var(--bg-field)] text-[var(--fg-primary)]"
                    : item.status === "erro"
                    ? "text-[var(--status-err)]"
                    : "text-[var(--fg-secondary)]"
                }`}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {item.status === "processando" ? (
                    <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-bright)]" strokeWidth={1.5} />
                  ) : item.status === "concluida" ? (
                    <Check className="h-3 w-3 text-[var(--status-ok)]" strokeWidth={1.5} />
                  ) : item.status === "erro" ? (
                    <X className="h-3 w-3 text-[var(--status-err)]" strokeWidth={1.5} />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--line-strong)]" />
                  )}
                </span>
                <span className="flex-1 truncate">{item.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
