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
      className={`block font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--ink-primary)] mb-1 ${className}`}
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
      className={`h-9 w-full rounded-md border-2 border-[var(--ink-primary)]/25 bg-[#FFF3DE] px-3 text-xs font-semibold text-[var(--ink-primary)] placeholder:text-[var(--ink-primary)]/45 transition-colors focus:border-[#BC9200] focus:bg-white focus:outline-none ${className}`}
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
      className={`h-9 w-full rounded-md border-2 border-[var(--ink-primary)]/25 bg-[#FFF3DE] px-2.5 text-xs font-semibold text-[var(--ink-primary)] transition-colors focus:border-[#BC9200] focus:bg-white focus:outline-none cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
