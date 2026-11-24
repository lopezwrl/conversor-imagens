import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface LightboxModalProps {
  src: string;
  title: string;
  meta: string;
  onClose: () => void;
}

export function LightboxModal({ src, title, meta, onClose }: LightboxModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar zoom"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-[#FDE2B9] hover:bg-black/85 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="checkerboard flex max-h-[75vh] items-center justify-center overflow-hidden p-4">
          <img src={src} alt={title} className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain" />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--border)] px-5 py-3">
          <span className="truncate font-mono text-xs font-semibold text-[var(--text-primary)]">{title}</span>
          <span className="shrink-0 font-mono text-xs text-[var(--accent-text)]">{meta}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
