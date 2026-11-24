import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

interface DocumentPreviewProps {
  title: string;
  url: string;
  mime: string;
  text?: string;
  onClose: () => void;
}

export function DocumentPreview({ title, url, mime, text, onClose }: DocumentPreviewProps) {
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
        className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[10px] border border-[var(--line-strong)] bg-[var(--bg-panel-solid)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <span className="truncate font-mono text-xs text-[var(--fg-primary)]">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[var(--fg-secondary)] hover:bg-[var(--bg-field)] hover:text-[var(--fg-primary)] cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-[var(--bg-deep)] p-4">
          {mime.includes("pdf") ? (
            <iframe title={title} src={url} className="h-full w-full rounded-[4px] border-0" />
          ) : mime.includes("html") ? (
            <iframe
              title={title}
              src={url}
              sandbox=""
              className="h-full w-full rounded-[4px] border-0 bg-white"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--fg-primary)]">
              {text}
            </pre>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
