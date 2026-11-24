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

  return (
    <div className="mt-4 rounded-[6px] bg-[#F4D09A]/65 p-4 text-left text-[var(--ink-primary)]">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px] font-semibold">
        <span>{statusText}</span>
        <span>{percent}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-[6px] bg-[#FFF3DE]">
        <div
          className="h-full bg-[var(--brand-primary)] transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {stages.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[13px]">
          {stages.map((st, idx) => {
            const done = percent === 100 || (activeIdx !== -1 && idx < activeIdx);
            const current = percent < 100 && idx === activeIdx;
            return (
              <span
                key={st.id}
                className={
                  done
                    ? "font-semibold text-[var(--ink-secondary)]"
                    : current
                    ? "font-semibold text-[var(--ink-primary)] underline decoration-[#BC9200]"
                    : "text-[var(--ink-primary)]"
                }
              >
                {st.label}
              </span>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 pt-2 text-[13px]">
          {queue.map((item, idx) => (
            <span
              key={`${item.nome}-${idx}`}
              className={`font-mono ${
                item.status === "processando"
                  ? "font-semibold text-[var(--ink-primary)]"
                  : item.status === "concluida"
                  ? "text-[var(--ink-secondary)]"
                  : item.status === "erro"
                  ? "text-[#60011D] line-through"
                  : "text-[var(--ink-primary)]"
              }`}
            >
              {item.nome}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
