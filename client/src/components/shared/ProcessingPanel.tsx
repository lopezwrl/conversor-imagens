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

  return (
    <div className="mt-4 rounded-xl border-2 border-[#BC9200] bg-[#FFF3DE] p-4 text-left text-[var(--ink-primary)] shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-xs font-bold">
        <span>{statusText}</span>
        <span className="rounded bg-[#60011D] px-2 py-0.5 text-[#FDE2B9]">{percent}%</span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full border border-[#BC9200] bg-[#FDE2B9]">
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{
            width: `${percent}%`,
            background: "linear-gradient(90deg, #60011D 0%, #BC9200 50%, #0B3B46 100%)",
          }}
        />
      </div>

      {stages.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {stages.map((st, idx) => {
            const done = percent === 100 || (activeIdx !== -1 && idx < activeIdx);
            const current = percent < 100 && idx === activeIdx;
            return (
              <span
                key={st.id}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-bold ${
                  done
                    ? "bg-[#0B3B46] text-[#FDE2B9]"
                    : current
                    ? "bg-[#60011D] text-[#FDE2B9]"
                    : "bg-[#FDE2B9] text-[var(--ink-primary)]/60"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                {st.label}
              </span>
            );
          })}
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#BC9200]/30 pt-3">
          {queue.map((item, idx) => (
            <span
              key={`${item.nome}-${idx}`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                item.status === "processando"
                  ? "border-[#BC9200] bg-[#60011D] text-[#FDE2B9]"
                  : item.status === "concluida"
                  ? "border-[#0B3B46] bg-[#0B3B46] text-[#FDE2B9]"
                  : item.status === "erro"
                  ? "border-[#60011D] bg-[#60011D]/20 text-[#60011D]"
                  : "border-[#BC9200]/40 bg-[#FDE2B9] text-[var(--ink-primary)]/70"
              }`}
            >
              {item.status === "processando" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : item.status === "concluida" ? (
                <Check className="h-3 w-3" />
              ) : item.status === "erro" ? (
                <X className="h-3 w-3" />
              ) : null}
              <span className="max-w-[160px] truncate">{item.nome}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
