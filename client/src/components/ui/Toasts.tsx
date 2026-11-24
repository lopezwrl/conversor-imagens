import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useToast } from "../../state/toasts";

export function Toasts() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[120] flex max-w-sm flex-col gap-2"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const barColor =
            t.tone === "ok"
              ? "var(--status-ok)"
              : t.tone === "warn"
              ? "var(--status-warn)"
              : t.tone === "err"
              ? "var(--status-err)"
              : "var(--accent)";

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-start gap-3 rounded-[4px] border border-[var(--line-strong)] bg-[var(--bg-panel-solid)] px-3.5 py-2.5 text-xs text-[var(--fg-primary)] shadow-lg"
              style={{ borderLeftWidth: "3px", borderLeftColor: barColor }}
            >
              <p className="flex-1 leading-relaxed">{t.text}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fechar aviso"
                className="text-[var(--fg-muted)] hover:text-[var(--fg-primary)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
