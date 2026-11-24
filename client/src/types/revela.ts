export type SectionMode = "portal" | "photos" | "docs";
export type ActiveWorkspace = "photos" | "docs";
export type ColorMode = "light" | "dark";

export type ImageOutputFormat = "PNG" | "JPEG" | "WEBP" | "AVIF" | "GIF" | "TIFF";
export type RemovalMode = "automatico" | "inteligente" | "manual";

export interface BatchRenameConfig {
  prefix: string;
  suffix: string;
  startNumber: number;
  padDigits: number; // 1 => _1, 2 => _01, 3 => _001
  separator: string; // "_" ou "-"
}

export interface ImageItem {
  id: string;
  hash: string;
  file: File;
  nome: string;
  nomeBase: string;
  larguraOriginal: number;
  alturaOriginal: number;
  tamanhoBytes: number;
  urlMiniatura: string;
  formatoOriginal: ImageOutputFormat;
  // Configurações individuais (reativas!)
  formato: ImageOutputFormat;
  largura: string;
  altura: string;
  qualidade: number;
  manterProporcao: boolean;
  modoAjuste: "inside" | "cover" | "fill";
  removerFundo: boolean;
  modoRemocao: RemovalMode;
  sensibilidadeFundo: number;
  corFundo: string;
  nomePersonalizado: string | null; // null => segue renomeação em lote ou original
}

export interface ImageProcessResult {
  indice: number;
  nome: string;
  status: "ok" | "erro";
  salvo_como?: string;
  dimensoes?: string;
  tamanho_bytes?: number;
  aviso?: string | null;
  dados?: string;
  mime?: string;
  mensagem?: string;
  modoRemocao?: RemovalMode | null;
  urlOriginal?: string;
  tamanhoOriginalBytes?: number;
}

export type DocOutputFormat =
  | "PDF"
  | "PDF_SPLIT"
  | "DOCX"
  | "HTML"
  | "MD"
  | "TXT"
  | "XLSX"
  | "CSV"
  | "JSON";

export interface DocItem {
  id: string;
  hash: string;
  file: File;
  nome: string;
  nomeBase: string;
  extensao: string;
  tamanhoBytes: number;
  previewUrl?: string; // quando for imagem para PDF
  // Configurações individuais
  formato: DocOutputFormat;
  rotacao: 0 | 90 | 180 | 270;
  intervaloPaginas: string;
  tamanhoPagina: "A4" | "LETTER" | "AUTO";
  orientacao: "portrait" | "landscape";
  delimitadorCsv: "," | ";";
  nomePersonalizado: string | null;
}

export interface DocProcessResult {
  indice: number;
  nome: string;
  status: "ok" | "erro";
  salvo_como?: string;
  paginas?: number | null;
  tamanho_bytes?: number;
  aviso?: string | null;
  dados?: string;
  mime?: string;
  mensagem?: string;
  tamanhoOriginalBytes?: number;
}

export interface QueueItemState {
  nome: string;
  status: "pendente" | "processando" | "concluida" | "erro";
}

export interface ToastItem {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}
