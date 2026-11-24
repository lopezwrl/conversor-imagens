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
          const accentBg =
            t.tone === "err"
              ? "#60011D"
              : t.tone === "ok"
              ? "#0B3B46"
              : "#BC9200";

          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto flex items-center gap-3 rounded-lg border-2 border-[#BC9200] bg-[#FDE2B9] px-4 py-3 text-xs font-bold text-[#60011D] shadow-xl"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: accentBg }}
              />
              <p className="flex-1 leading-snug">{t.text}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Fechar aviso"
                className="text-[#60011D]/70 hover:text-[#60011D] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
