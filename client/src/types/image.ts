export type ImageOutputFormat = "PNG" | "JPEG" | "WEBP" | "AVIF" | "GIF" | "TIFF";
export type CutoutMode = "automatico" | "inteligente" | "manual";
export type FitMode = "inside" | "cover" | "fill";

export interface ImageRecord {
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
  formato: ImageOutputFormat;
  formatoIndividual: ImageOutputFormat | null;
  largura: string;
  altura: string;
  qualidade: number;
  manterProporcao: boolean;
  modoAjuste: FitMode;
  removerFundo: boolean;
  modoRemocao: CutoutMode;
  sensibilidadeFundo: number;
  corFundo: string;
  nomePersonalizado: string | null;
}

export interface ImageResultRecord {
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
  modoRemocao?: CutoutMode | null;
  urlOriginal?: string;
  tamanhoOriginalBytes?: number;
}

export type ImageStreamEvent =
  | {
      tipo: "progresso";
      indice: number;
      total: number;
      nome: string;
      etapa: "removendo_fundo" | "redimensionando" | "convertendo";
    }
  | ({ tipo: "resultado" } & ImageResultRecord)
  | {
      tipo: "concluido";
      zip_base64?: string;
      nome_zip?: string;
    };
