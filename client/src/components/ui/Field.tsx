import React from "react";

export function Label({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--fg-secondary)] mb-1 ${className}`}
    >
      {children}
    </label>
  );
}

export function Input({
  className = "",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 w-full rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] px-2.5 text-xs text-[var(--fg-primary)] placeholder:text-[var(--fg-muted)] transition-colors focus:border-[var(--accent)] focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-9 w-full rounded-[4px] border border-[var(--line)] bg-[var(--bg-field)] px-2.5 text-xs text-[var(--fg-primary)] transition-colors focus:border-[var(--accent)] focus:outline-none ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
