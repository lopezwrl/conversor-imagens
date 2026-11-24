import type { BatchRenameConfig, DocOutputFormat, ImageOutputFormat } from "../types/revela";

export const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "avif", "bmp", "gif", "tiff", "tif", "svg"]);
export const DOC_EXTENSIONS = new Set(["pdf", "docx", "md", "markdown", "txt", "html", "htm", "xlsx", "csv", "json"]);
export const DOC_ACCEPTED_EXTENSIONS = new Set([...DOC_EXTENSIONS, "png", "jpg", "jpeg", "webp"]);

export const IMAGE_OUTPUT_EXT: Record<ImageOutputFormat, string> = {
  PNG: "png",
  JPEG: "jpg",
  WEBP: "webp",
  AVIF: "avif",
  GIF: "gif",
  TIFF: "tiff",
};

export const DOC_OUTPUT_EXT: Record<DocOutputFormat, string> = {
  PDF: "pdf",
  PDF_SPLIT: "pdf",
  DOCX: "docx",
  HTML: "html",
  MD: "md",
  TXT: "txt",
  XLSX: "xlsx",
  CSV: "csv",
  JSON: "json",
};

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

export function getBaseName(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

export function normalizeImageFormat(ext: string): ImageOutputFormat {
  const u = ext.toUpperCase();
  if (u === "JPG" || u === "JPEG") return "JPEG";
  if (u === "WEBP") return "WEBP";
  if (u === "AVIF") return "AVIF";
  if (u === "GIF") return "GIF";
  if (u === "TIFF" || u === "TIF") return "TIFF";
  return "PNG";
}

export function getDocTargetFormats(ext: string): DocOutputFormat[] {
  const e = ext.toLowerCase();
  if (e === "pdf") return ["PDF", "PDF_SPLIT", "TXT", "MD", "HTML", "DOCX"];
  if (e === "docx") return ["PDF", "HTML", "MD", "TXT"];
  if (e === "md" || e === "markdown") return ["PDF", "DOCX", "HTML", "TXT"];
  if (e === "html" || e === "htm") return ["PDF", "DOCX", "MD", "TXT"];
  if (e === "txt") return ["PDF", "DOCX", "HTML", "MD"];
  if (e === "xlsx") return ["CSV", "JSON", "PDF", "HTML", "MD"];
  if (e === "csv") return ["XLSX", "JSON", "PDF", "HTML", "MD"];
  if (e === "json") return ["XLSX", "CSV", "PDF", "HTML", "MD"];
  if (["png", "jpg", "jpeg", "webp"].includes(e)) return ["PDF"];
  return ["PDF", "TXT"];
}

export function formatDocFormatLabel(fmt: DocOutputFormat): string {
  const labels: Record<DocOutputFormat, string> = {
    PDF: "PDF",
    PDF_SPLIT: "PDF (1 por página)",
    DOCX: "Word (.docx)",
    HTML: "HTML",
    MD: "Markdown (.md)",
    TXT: "Texto (.txt)",
    XLSX: "Excel (.xlsx)",
    CSV: "CSV (.csv)",
    JSON: "JSON (.json)",
  };
  return labels[fmt];
}

/**
 * Calcula o nome final exato (sem extensão) de qualquer item (Imagem ou Documento)
 * resolvendo definitivamente o bug de renomeação em lote!
 */
export function computeTargetBaseName(
  nomeBaseOriginal: string,
  nomePersonalizado: string | null,
  indice: number,
  batchRename: BatchRenameConfig
): string {
  // Override individual do card sempre tem prioridade
  if (nomePersonalizado !== null && nomePersonalizado.trim() !== "") {
    return nomePersonalizado.trim();
  }

  const prefix = batchRename.prefix.trim();
  const suffix = batchRename.suffix.trim();

  if (!prefix && !suffix) {
    return nomeBaseOriginal;
  }

  const num = String(batchRename.startNumber + indice).padStart(Math.max(1, batchRename.padDigits), "0");
  const sep = batchRename.separator || "_";

  if (prefix && suffix) return `${prefix}${sep}${num}${sep}${suffix}`;
  if (prefix) return `${prefix}${sep}${num}`;
  return `${nomeBaseOriginal}${sep}${suffix}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(0.1, Math.round((bytes / 1024) * 10) / 10)} KB`;
}

export async function generateFileHash(file: File): Promise<string> {
  const slice = await file.slice(0, 1024 * 1024).arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuf = await crypto.subtle.digest("SHA-256", slice);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime || "application/octet-stream" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lê pastas e arquivos recursivamente de um evento Drag & Drop */
export async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<{
  files: File[];
  folderName: string | null;
  hasFolder: boolean;
}> {
  const files: File[] = [];
  let folderName: string | null = null;
  let hasFolder = false;

  const readDirectory = (entry: FileSystemDirectoryEntry): Promise<File[]> =>
    new Promise((resolve) => {
      const reader = entry.createReader();
      const found: File[] = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            resolve(found);
            return;
          }
          for (const ent of entries) {
            if (ent.isFile) {
              const f = await new Promise<File>((res) => (ent as FileSystemFileEntry).file(res));
              found.push(f);
            } else if (ent.isDirectory) {
              const nested = await readDirectory(ent as FileSystemDirectoryEntry);
              found.push(...nested);
            }
          }
          readBatch();
        });
      };
      readBatch();
    });

  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    if (entries.length > 0) {
      for (const entry of entries) {
        if (entry.isDirectory) {
          hasFolder = true;
          if (!folderName) folderName = entry.name;
          const nested = await readDirectory(entry as FileSystemDirectoryEntry);
          files.push(...nested);
        } else if (entry.isFile) {
          const f = await new Promise<File>((res) => (entry as FileSystemFileEntry).file(res));
          files.push(f);
        }
      }
      return { files, folderName, hasFolder };
    }
  }

  return { files: Array.from(dataTransfer.files), folderName: null, hasFolder: false };
}

/** Leitor genérico de stream NDJSON retornado pelo back-end Node/Fastify */
export async function readNdjsonStream<T extends { tipo: string }>(
  response: Response,
  onEvent: (event: T) => void
): Promise<boolean> {
  if (!response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let completed = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as T;
        if (parsed.tipo === "concluido") completed = true;
        onEvent(parsed);
      } catch {
        // ignora linha isolada malformada
      }
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer) as T;
      if (parsed.tipo === "concluido") completed = true;
      onEvent(parsed);
    } catch {
      // ignora
    }
  }

  return completed;
}
