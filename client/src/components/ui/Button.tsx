import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "opposite" | "secondary" | "ghost";
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
      ? "h-11 px-6 text-sm gap-2"
      : size === "sm"
      ? "h-8 px-3 text-[13px] gap-1.5"
      : "h-9 px-4 text-[13px] gap-2";

  const variantClass =
    variant === "primary"
      ? "bg-[var(--brand-primary)] text-[#FDE2B9] hover:brightness-110 font-semibold"
      : variant === "opposite"
      ? "bg-[var(--brand-opposite)] text-[#FDE2B9] hover:brightness-110 font-semibold"
      : variant === "secondary"
      ? "bg-[#F4D09A]/80 text-[var(--ink-primary)] hover:bg-[#F4D09A] font-medium"
      : "bg-transparent text-[var(--ink-primary)] hover:underline underline-offset-4 font-medium";

  return (
    <button
      type={rest.type || "button"}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-[6px] transition-colors duration-150 cursor-pointer select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BC9200] ${sizeClass} ${variantClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
