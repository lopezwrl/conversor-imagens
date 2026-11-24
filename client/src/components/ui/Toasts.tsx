import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useToast } from "../../state/toasts";

export function Toasts() {
  const { toasts, dismiss } = useToast();
  const current = toasts.length > 0 ? toasts[toasts.length - 1] : null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[120] max-w-sm"
    >
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-auto flex items-center gap-3 rounded-[6px] border border-[#BC9200] bg-[#FDE2B9] px-4 py-2.5 text-[13px] font-medium text-[#3B0011]"
          >
            <p className="flex-1 leading-snug">{current.text}</p>
            <button
              type="button"
              onClick={() => dismiss(current.id)}
              aria-label="Fechar aviso"
              className="rounded-[6px] p-0.5 text-[#60011D] hover:text-[#3B0011] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
