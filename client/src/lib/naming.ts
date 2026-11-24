import type { BatchRenameRule } from "../types/shared";

export function resolveOutputBaseName(
  originalBase: string,
  customName: string | null,
  index: number,
  rule: BatchRenameRule
): string {
  if (customName !== null && customName.trim() !== "") {
    return customName.trim();
  }

  const prefix = rule.prefix.trim();
  const suffix = rule.suffix.trim();

  if (!prefix && !suffix) {
    return originalBase;
  }

  const num = String(rule.startNumber + index).padStart(Math.max(1, rule.padDigits), "0");
  const sep = rule.separator || "_";

  if (prefix && suffix) return `${prefix}${sep}${num}${sep}${suffix}`;
  if (prefix) return `${prefix}${sep}${num}`;
  return `${originalBase}${sep}${suffix}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)} KB`;
}
