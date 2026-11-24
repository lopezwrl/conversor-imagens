import { motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import type { QueueItemState } from "../../types/revela";

interface ProcessingQueueProps {
  visible: boolean;
  percent: number;
  statusText: string;
  stages: Array<{ id: string; label: string }>;
  activeStage: string | null;
  queue: QueueItemState[];
}

export function ProcessingQueue({
  visible,
  percent,
  statusText,
  stages,
  activeStage,
  queue,
}: ProcessingQueueProps) {
  if (!visible) return null;

  const activeIdx = activeStage ? stages.findIndex((s) => s.id === activeStage) : -1;
  const doneCount = queue.filter((q) => q.status === "concluida" || q.status === "erro").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow-md)]"
    >
      {/* Barra de progresso real */}
      <div className="mb-2 flex items-center justify-between gap-2 font-mono text-xs">
        <span className="font-semibold text-[var(--text-primary)]">{statusText}</span>
        <span className="font-bold text-[var(--accent-text)]">{percent}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <motion.div
          className="progress-shimmer h-full rounded-full"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          style={{
            background: "linear-gradient(90deg, var(--brand) 0%, var(--accent) 100%)",
          }}
        />
      </div>

      {/* Etapas pulsantes */}
      {stages.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5">
          {stages.map((st, idx) => {
            const isDone = percent === 100 || (activeIdx !== -1 && idx < activeIdx);
            const isCurrent = percent < 100 && idx === activeIdx;
            return (
              <div
                key={st.id}
                className={`flex items-center gap-2 font-mono text-[11px] font-semibold transition-colors ${
                  isDone
                    ? "text-[var(--status-success)]"
                    : isCurrent
                    ? "text-[var(--accent-text)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full transition-transform ${
                    isDone
                      ? "bg-[var(--status-success)]"
                      : isCurrent
                      ? "scale-125 bg-[var(--accent)] animate-pulse"
                      : "bg-[var(--border-strong)]"
                  }`}
                />
                {st.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Fila visual por arquivo */}
      {queue.length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <span>Fila de Processamento</span>
            <span className="font-mono text-[var(--accent-text)]">
              {doneCount} de {queue.length}
            </span>
          </div>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {queue.map((item, i) => (
              <li
                key={`${item.nome}-${i}`}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 font-mono text-xs transition-colors ${
                  item.status === "processando"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : item.status === "erro"
                    ? "border-[var(--status-error)]/40 bg-[var(--status-error)]/10 text-[var(--status-error)]"
                    : "border-transparent bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {item.status === "processando" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-text)]" />
                  ) : item.status === "concluida" ? (
                    <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
                  ) : item.status === "erro" ? (
                    <X className="h-3.5 w-3.5 text-[var(--status-error)]" />
                  ) : (
                    <span className="h-2 w-2 rounded-full border border-[var(--border-strong)]" />
                  )}
                </span>
                <span className="flex-1 truncate">{item.nome}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
