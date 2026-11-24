import sharp from "sharp";
import { corHexParaRgb } from "./filenameUtils.js";
import { removerFundoImagem, type ModoRemocao } from "./backgroundRemover.js";

export type FormatoImagemSaida = "PNG" | "JPEG" | "WEBP" | "AVIF" | "GIF" | "TIFF";

export const EXTENSOES_IMAGEM_VALIDAS = new Set([
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

export const EXTENSAO_POR_FORMATO: Record<FormatoImagemSaida, string> = {
  PNG: "png",
  JPEG: "jpg",
  WEBP: "webp",
  AVIF: "avif",
  GIF: "gif",
  TIFF: "tiff",
};

export const MIME_POR_FORMATO: Record<FormatoImagemSaida, string> = {
  PNG: "image/png",
  JPEG: "image/jpeg",
  WEBP: "image/webp",
  AVIF: "image/avif",
  GIF: "image/gif",
  TIFF: "image/tiff",
};

const FORMATOS_COM_ALPHA = new Set<FormatoImagemSaida>(["PNG", "WEBP", "AVIF", "TIFF"]);

export interface ConfigImagem {
  formato?: string;
  largura?: number | string | null;
  altura?: number | string | null;
  qualidade?: number | string | null;
  manter_proporcao?: boolean;
  modo_ajuste?: "inside" | "cover" | "fill";
  remover_fundo?: boolean;
  modo_remocao?: ModoRemocao;
  sensibilidade_fundo?: number;
  cor_fundo?: string;
  novo_nome?: string | null;
}

export interface ResultadoProcessamentoImagem {
  dados: Buffer;
  largura: number;
  altura: number;
  formato: FormatoImagemSaida;
  extensao: string;
  mime: string;
  aviso: string | null;
}

/** Decodificador simples de BMP 24-bit e 32-bit não-comprimido para manter compatibilidade total. */
function decodificarBmpSeNecessario(buffer: Buffer): { buffer: Buffer; raw?: { width: number; height: number; channels: 3 | 4 } } {
  if (buffer.length < 54 || buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
    return { buffer };
  }
  const pixelOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const rawHeight = buffer.readInt32LE(22);
  const bpp = buffer.readUInt16LE(28);
  const compression = buffer.readUInt32LE(30);

  if (compression !== 0 || (bpp !== 24 && bpp !== 32) || width <= 0 || rawHeight === 0) {
    return { buffer };
  }

  const height = Math.abs(rawHeight);
  const topDown = rawHeight < 0;
  const channels: 3 | 4 = bpp === 32 ? 4 : 3;
  const rowStride = Math.floor((bpp * width + 31) / 32) * 4;
  const out = Buffer.allocUnsafe(width * height * channels);

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const srcRow = pixelOffset + srcY * rowStride;
    const dstRow = y * width * channels;
    for (let x = 0; x < width; x++) {
      const s = srcRow + x * channels;
      const d = dstRow + x * channels;
      out[d] = buffer[s + 2]; // R
      out[d + 1] = buffer[s + 1]; // G
      out[d + 2] = buffer[s]; // B
      if (channels === 4) out[d + 3] = buffer[s + 3]; // A
    }
  }
  return { buffer: out, raw: { width, height, channels } };
}

export function normalizarFormatoImagem(formato?: string): FormatoImagemSaida {
  const upper = (formato || "PNG").toUpperCase();
  if (upper === "JPG") return "JPEG";
  if (upper in EXTENSAO_POR_FORMATO) return upper as FormatoImagemSaida;
  return "PNG";
}

export async function processarImagem(
  inputBuffer: Buffer,
  cfg: ConfigImagem,
  onEtapa?: (etapa: "removendo_fundo" | "redimensionando" | "convertendo") => void
): Promise<ResultadoProcessamentoImagem> {
  const formato = normalizarFormatoImagem(cfg.formato);
  const largura = cfg.largura ? Math.max(1, Math.round(Number(cfg.largura))) : null;
  const altura = cfg.altura ? Math.max(1, Math.round(Number(cfg.altura))) : null;
  const qualidade = Math.max(1, Math.min(100, Math.round(Number(cfg.qualidade) || 90)));
  const manterProporcao = cfg.manter_proporcao !== false;
  const modoAjuste = cfg.modo_ajuste || "inside";
  const removerFundoAtivo = Boolean(cfg.remover_fundo);
  const modoRemocao: ModoRemocao =
    cfg.modo_remocao === "inteligente" || cfg.modo_remocao === "manual" ? cfg.modo_remocao : "automatico";
  const sensibilidade = typeof cfg.sensibilidade_fundo === "number" ? cfg.sensibilidade_fundo : 50;
  const corFundo = corHexParaRgb(cfg.cor_fundo);

  let aviso: string | null = null;
  const decoded = decodificarBmpSeNecessario(inputBuffer);

  // Converte BMP decodificado para PNG em memória antes do pipeline normal
  const workingInput = decoded.raw
    ? await sharp(decoded.buffer, { raw: decoded.raw }).png().toBuffer()
    : inputBuffer;

  const meta = await sharp(workingInput).metadata();
  if (removerFundoAtivo && (meta.pages ?? 1) > 1) {
    aviso =
      "Imagem animada detectada: a remoção de fundo foi aplicada ao primeiro quadro; a animação não é preservada.";
  }

  let pipeline: sharp.Sharp;

  // 1. Remoção de fundo (se solicitada)
  if (removerFundoAtivo) {
    onEtapa?.("removendo_fundo");
    const resRemocao = await removerFundoImagem(workingInput, {
      modo: modoRemocao,
      sensibilidade,
    });
    if (resRemocao.aviso) {
      aviso = aviso ? `${aviso} ${resRemocao.aviso}` : resRemocao.aviso;
    }
    pipeline = sharp(resRemocao.rgba, {
      raw: { width: resRemocao.width, height: resRemocao.height, channels: 4 },
    });
  } else {
    pipeline = sharp(workingInput, { animated: formato === "GIF" || formato === "WEBP" }).rotate();
  }

  // 2. Redimensionamento
  onEtapa?.("redimensionando");
  if (largura || altura) {
    const fit: keyof sharp.FitEnum = manterProporcao
      ? largura && altura
        ? modoAjuste === "cover"
          ? "cover"
          : "inside"
        : "inside"
      : "fill";

    pipeline = pipeline.resize({
      width: largura ?? undefined,
      height: altura ?? undefined,
      fit,
      kernel: "lanczos3",
      withoutEnlargement: false,
    });
  }

  // 3. Conversão de formato + transparência
  onEtapa?.("convertendo");
  const suportaAlpha = FORMATOS_COM_ALPHA.has(formato);
  if (!suportaAlpha) {
    pipeline = pipeline.flatten({ background: corFundo });
    if (removerFundoAtivo) {
      const msgCor = `${formato} não suporta fundo transparente: aplicamos a cor sólida escolhida como fundo.`;
      aviso = aviso ? `${aviso} ${msgCor}` : msgCor;
    }
  } else if (removerFundoAtivo) {
    pipeline = pipeline.ensureAlpha();
  }

  switch (formato) {
    case "PNG":
      pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
      break;
    case "JPEG":
      pipeline = pipeline.jpeg({ quality: qualidade, mozjpeg: true });
      break;
    case "WEBP":
      pipeline = pipeline.webp({ quality: qualidade });
      break;
    case "AVIF":
      pipeline = pipeline.avif({ quality: qualidade });
      break;
    case "GIF":
      pipeline = pipeline.gif();
      break;
    case "TIFF":
      pipeline = pipeline.tiff({ quality: qualidade });
      break;
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    dados: data,
    largura: info.width,
    altura: info.height,
    formato,
    extensao: EXTENSAO_POR_FORMATO[formato],
    mime: MIME_POR_FORMATO[formato],
    aviso,
  };
}
