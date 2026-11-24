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
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-[6px] border border-[#BC9200] bg-[#FDE2B9] text-[#60011D] shadow-lg"
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="truncate font-mono text-xs font-medium">{title}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#60011D]/75">{meta}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização"
              className="p-1 text-[#60011D]/70 hover:text-[#60011D] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="checkerboard flex max-h-[78vh] items-center justify-center overflow-hidden p-4">
          <img src={src} alt={title} className="max-h-[72vh] w-auto max-w-full object-contain" />
        </div>
      </motion.div>
    </motion.div>
  );
}
