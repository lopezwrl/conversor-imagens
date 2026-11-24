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

export type DocBatchMode =
  | "all_pdf"
  | "merge_pdf"
  | "split_pdf"
  | "to_txt"
  | "to_csv"
  | "to_json";

export interface DocRecord {
  id: string;
  hash: string;
  file: File;
  nome: string;
  nomeBase: string;
  extensao: string;
  tamanhoBytes: number;
  previewUrl?: string;
  formato: DocOutputFormat;
  formatoIndividual: DocOutputFormat | null;
  rotacao: 0 | 90 | 180 | 270;
  intervaloPaginas: string;
  tamanhoPagina: "A4" | "LETTER" | "AUTO";
  orientacao: "portrait" | "landscape";
  delimitadorCsv: "," | ";";
  nomePersonalizado: string | null;
}

export interface DocResultRecord {
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

export type DocStreamEvent =
  | {
      tipo: "progresso";
      indice: number;
      total: number;
      nome: string;
      etapa: "lendo" | "convertendo" | "finalizando";
    }
  | ({ tipo: "resultado" } & DocResultRecord)
  | {
      tipo: "concluido";
      zip_base64?: string;
      nome_zip?: string;
    };
