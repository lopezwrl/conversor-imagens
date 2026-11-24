import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const sizeClass =
    size === "lg"
      ? "h-11 px-6 text-sm gap-2.5"
      : size === "sm"
      ? "h-8 px-3 text-xs gap-1.5"
      : "h-9 px-4 text-xs gap-2";

  const variantClass =
    variant === "primary"
      ? "bg-[var(--action-bg)] text-[var(--action-fg)] hover:bg-[var(--action-hover)] border border-transparent font-semibold"
      : variant === "secondary"
      ? "bg-[var(--bg-field)] text-[var(--fg-primary)] border border-[var(--line-strong)] hover:border-[var(--accent)] hover:bg-[var(--bg-hover)] font-medium"
      : variant === "danger"
      ? "bg-transparent text-[var(--status-err)] border border-[var(--status-err)]/35 hover:bg-[var(--status-err)]/10 font-medium"
      : "bg-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)] hover:bg-[var(--c-cream-soft)] border border-transparent font-medium";

  return (
    <button
      type={rest.type || "button"}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[4px] tracking-wide transition-colors duration-150 cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
