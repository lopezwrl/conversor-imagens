export type SectionId = "portal" | "photos" | "docs";
export type WaterTheme = "photos" | "docs";

export interface BatchRenameRule {
  prefix: string;
  suffix: string;
  startNumber: number;
  padDigits: number;
  separator: string;
}

export type QueueStatus = "pendente" | "processando" | "concluida" | "erro";

export interface QueueEntry {
  nome: string;
  status: QueueStatus;
}

export interface ToastMessage {
  id: string;
  text: string;
  tone: "neutral" | "ok" | "warn" | "err";
}
