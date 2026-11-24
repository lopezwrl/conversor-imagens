import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface LightboxProps {
  src: string;
  title: string;
  meta: string;
  onClose: () => void;
}

export function Lightbox({ src, title, meta, onClose }: LightboxProps) {
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
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/85 p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg-panel-solid)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar visualização"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-[4px] border border-[var(--line)] bg-[var(--bg-deep)] text-[var(--fg-primary)] hover:border-[var(--accent)] cursor-pointer"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className="checkerboard flex max-h-[76vh] items-center justify-center overflow-hidden p-4">
          <img src={src} alt={title} className="max-h-[72vh] w-auto max-w-full object-contain" />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-[var(--line)] px-4 py-2.5">
          <span className="truncate font-mono text-xs text-[var(--fg-primary)]">{title}</span>
          <span className="shrink-0 font-mono text-xs text-[var(--fg-secondary)]">{meta}</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
