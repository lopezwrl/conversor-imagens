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
      className={`block text-[13px] font-semibold text-[var(--ink-primary)] mb-1 ${className}`}
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
      className={`h-9 w-full rounded-[6px] border border-[var(--ink-primary)]/30 bg-[#FFF3DE] px-2.5 text-[13px] text-[var(--ink-primary)] placeholder:text-[var(--ink-primary)]/70 transition-colors focus:border-[#BC9200] focus:ring-2 focus:ring-[#BC9200] focus:bg-white focus:outline-none ${className}`}
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
      className={`h-9 w-full rounded-[6px] border border-[var(--ink-primary)]/30 bg-[#FFF3DE] px-2.5 text-[13px] text-[var(--ink-primary)] transition-colors focus:border-[#BC9200] focus:ring-2 focus:ring-[#BC9200] focus:bg-white focus:outline-none cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
