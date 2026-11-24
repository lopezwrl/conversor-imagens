import type { DocOutputFormat } from "../types/document";
import type { ImageOutputFormat } from "../types/image";

export const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "bmp",
  "gif",
  "tiff",
  "tif",
  "svg",
]);

export const DOC_ONLY_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "md",
  "markdown",
  "txt",
  "html",
  "htm",
  "xlsx",
  "csv",
  "json",
]);

export const DOC_ACCEPTED_EXTENSIONS = new Set([
  ...DOC_ONLY_EXTENSIONS,
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

export const IMAGE_FORMATS: ImageOutputFormat[] = ["PNG", "JPEG", "WEBP", "AVIF", "GIF", "TIFF"];
export const OPAQUE_IMAGE_FORMATS = new Set<ImageOutputFormat>(["JPEG", "GIF"]);

export const IMAGE_FORMAT_EXT: Record<ImageOutputFormat, string> = {
  PNG: "png",
  JPEG: "jpg",
  WEBP: "webp",
  AVIF: "avif",
  GIF: "gif",
  TIFF: "tiff",
};

export const DOC_FORMAT_EXT: Record<DocOutputFormat, string> = {
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

export function inferImageFormat(ext: string): ImageOutputFormat {
  const u = ext.toUpperCase();
  if (u === "JPG" || u === "JPEG") return "JPEG";
  if (u === "WEBP") return "WEBP";
  if (u === "AVIF") return "AVIF";
  if (u === "GIF") return "GIF";
  if (u === "TIFF" || u === "TIF") return "TIFF";
  return "PNG";
}

export function getTargetDocFormats(ext: string): DocOutputFormat[] {
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

export function getDocFormatLabel(fmt: DocOutputFormat): string {
  const map: Record<DocOutputFormat, string> = {
    PDF: "PDF",
    PDF_SPLIT: "PDF (uma página por arquivo)",
    DOCX: "Word (.docx)",
    HTML: "HTML (.html)",
    MD: "Markdown (.md)",
    TXT: "Texto (.txt)",
    XLSX: "Planilha (.xlsx)",
    CSV: "CSV (.csv)",
    JSON: "JSON (.json)",
  };
  return map[fmt];
}
