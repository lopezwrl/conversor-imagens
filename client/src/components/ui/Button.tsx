import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "opposite" | "gold" | "secondary" | "danger";
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
      ? "h-12 px-7 text-sm gap-2.5"
      : size === "sm"
      ? "h-8 px-3.5 text-xs gap-1.5"
      : "h-10 px-4 text-xs gap-2";

  const variantClass =
    variant === "primary"
      ? "bg-[var(--brand-primary)] text-[#FDE2B9] border-2 border-[#BC9200] hover:brightness-115 font-bold shadow-md"
      : variant === "opposite"
      ? "bg-[var(--brand-opposite)] text-[#FDE2B9] border-2 border-[#BC9200] hover:brightness-115 font-bold shadow-md"
      : variant === "gold"
      ? "bg-[#BC9200] text-[#FFF3DE] border-2 border-[#60011D] hover:bg-[#d1a300] font-bold"
      : variant === "danger"
      ? "bg-[#60011D] text-[#FDE2B9] border border-[#BC9200] hover:bg-[#7d0428] font-semibold"
      : "bg-[#FFF3DE] text-[var(--ink-primary)] border-2 border-[var(--ink-primary)]/30 hover:border-[#BC9200] font-semibold";

  return (
    <button
      type={rest.type || "button"}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg tracking-wide transition-all duration-150 cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
