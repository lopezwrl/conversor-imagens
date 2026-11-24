import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { ToastItem } from "../../types/revela";

interface BorderBeamCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  active?: boolean;
  onClick?: () => void;
}

export function BorderBeamCard({
  children,
  className = "",
  innerClassName = "",
  active = false,
  onClick,
}: BorderBeamCardProps) {
  return (
    <div
      onClick={onClick}
      data-active={active ? "true" : "false"}
      className={`revela-beam-wrap rounded-[20px] p-[1.5px] border border-[var(--border)] transition-shadow duration-300 ${className}`}
      style={{ boxShadow: active ? "var(--shadow-lg)" : "var(--shadow-md)" }}
    >
      <div className={`revela-beam-inner rounded-[18.5px] h-full ${innerClassName}`}>{children}</div>
    </div>
  );
}

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function MagneticButton({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...rest
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = ((e.clientX - (rect.left + rect.width / 2)) / rect.width) * 10;
    const dy = ((e.clientY - (rect.top + rect.height / 2)) / rect.height) * 8;
    setOffset({ x: dx, y: dy });
  };

  const sizeClasses =
    size === "lg"
      ? "px-7 py-3.5 text-base rounded-2xl gap-2.5"
      : size === "sm"
      ? "px-3.5 py-2 text-xs rounded-xl gap-1.5"
      : "px-5 py-2.5 text-sm rounded-xl gap-2";

  const variantStyle: React.CSSProperties =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 100%)",
          color: "var(--brand-foreground)",
          border: "1px solid var(--accent-soft)",
          boxShadow: "0 10px 26px -8px var(--brand)",
        }
      : variant === "secondary"
      ? {
          background: "var(--bg-surface)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-strong)",
        }
      : {
          background: "transparent",
          color: "var(--text-secondary)",
          border: "1px solid transparent",
        };

  return (
    <motion.button
      ref={ref}
      type={rest.type || "button"}
      disabled={disabled}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      animate={{ x: offset.x, y: offset.y }}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 360, damping: 22 }}
      style={variantStyle}
      className={`relative inline-flex items-center justify-center font-semibold cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${sizeClasses} ${className}`}
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
}

export function ConfettiBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  const colors = ["#60011D", "#BC9200", "#FDE2B9", "#0B3B46", "#E4BA2C"];
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 + (i % 3) * 0.15;
    const dist = 70 + (i % 5) * 28;
    return {
      id: `${trigger}-${i}`,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 40,
      rotate: (i * 47) % 360,
      color: colors[i % colors.length],
    };
  });

  return (
    <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center">
      <div className="relative h-0 w-0">
        {pieces.map((p) => (
          <motion.span
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
            animate={{ opacity: 0, x: p.x, y: p.y, scale: 0.35, rotate: p.rotate }}
            transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
            style={{ backgroundColor: p.color }}
            className="absolute h-2.5 w-2 rounded-[2px]"
          />
        ))}
      </div>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const iconFor = (type: ToastItem["type"]) => {
    if (type === "success") return <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />;
    if (type === "warning") return <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />;
    if (type === "error") return <XCircle className="h-4 w-4 shrink-0 text-[var(--status-error)]" />;
    return <Info className="h-4 w-4 shrink-0 text-[var(--accent-text)]" />;
  };

  return (
    <div className="fixed bottom-5 right-5 z-[110] flex max-w-sm flex-col gap-2.5 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-[var(--shadow-lg)] backdrop-blur-md"
          >
            <span className="mt-0.5">{iconFor(t.type)}</span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="rounded-lg p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
