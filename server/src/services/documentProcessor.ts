import { PDFDocument, degrees, PageSizes } from "pdf-lib";
import PDFKitDocument from "pdfkit";
import mammoth from "mammoth";
import {
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import { marked } from "marked";
import TurndownService from "turndown";
import sharp from "sharp";
import { extensaoDoArquivo, nomeBaseSemExtensao } from "./filenameUtils.js";

// Import direto do core do pdf-parse v1 evita o bug conhecido de leitura de arquivo de teste em ESM
// @ts-expect-error subcaminho interno sem declaração TS
import pdfParseCore from "pdf-parse/lib/pdf-parse.js";

export type FormatoDocSaida = "PDF" | "PDF_SPLIT" | "DOCX" | "HTML" | "MD" | "TXT" | "XLSX" | "CSV" | "JSON";

export const EXTENSOES_DOC_VALIDAS = new Set([
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
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

export const MIME_DOC: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
};

export interface ConfigDocumento {
  formato?: FormatoDocSaida;
  novo_nome?: string | null;
  rotacao?: 0 | 90 | 180 | 270;
  intervalo_paginas?: string | null;
  tamanho_pagina?: "A4" | "LETTER" | "AUTO";
  orientacao?: "portrait" | "landscape";
  margem?: number;
  delimitador_csv?: "," | ";";
}

export interface ArquivoGeradoDoc {
  dados: Buffer;
  extensao: string;
  mime: string;
  sufixo?: string;
  paginas?: number;
  aviso?: string | null;
}

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });

export function formatosDestinoParaExtensao(ext: string): FormatoDocSaida[] {
  const e = ext.toLowerCase();
  if (e === "pdf") return ["PDF", "PDF_SPLIT", "TXT", "CSV", "JSON", "MD", "HTML", "DOCX"];
  if (e === "docx") return ["PDF", "TXT", "CSV", "JSON", "HTML", "MD"];
  if (e === "md" || e === "markdown") return ["PDF", "TXT", "CSV", "JSON", "DOCX", "HTML"];
  if (e === "html" || e === "htm") return ["PDF", "TXT", "CSV", "JSON", "DOCX", "MD"];
  if (e === "txt") return ["PDF", "TXT", "CSV", "JSON", "DOCX", "HTML", "MD"];
  if (e === "xlsx") return ["CSV", "JSON", "PDF", "TXT", "HTML", "MD"];
  if (e === "csv") return ["CSV", "XLSX", "JSON", "PDF", "TXT", "HTML", "MD"];
  if (e === "json") return ["JSON", "CSV", "XLSX", "PDF", "TXT", "HTML", "MD"];
  if (["png", "jpg", "jpeg", "webp"].includes(e)) return ["PDF"];
  return ["PDF", "TXT", "CSV", "JSON"];
}

/** Interpreta strings como "1-3, 5, 7-9" em índices base 0 válidos dentro de [0, total-1]. */
export function parsearIntervaloPaginas(expr: string | null | undefined, totalPaginas: number): number[] {
  if (!expr || !expr.trim()) {
    return Array.from({ length: totalPaginas }, (_, i) => i);
  }
  const indices = new Set<number>();
  const partes = expr.split(/[,;]+/);
  for (const parte of partes) {
    const limpa = parte.trim();
    if (!limpa) continue;
    const matchRange = limpa.match(/^(\d+)\s*-\s*(\d+)$/);
    if (matchRange) {
      let ini = Math.max(1, parseInt(matchRange[1], 10));
      let fim = Math.min(totalPaginas, parseInt(matchRange[2], 10));
      if (ini > fim) [ini, fim] = [fim, ini];
      for (let p = ini; p <= fim; p++) indices.add(p - 1);
    } else if (/^\d+$/.test(limpa)) {
      const p = parseInt(limpa, 10);
      if (p >= 1 && p <= totalPaginas) indices.add(p - 1);
    }
  }
  if (!indices.size) {
    throw new Error(`Intervalo de páginas inválido ("${expr}"). O PDF possui ${totalPaginas} página(s).`);
  }
  return Array.from(indices).sort((a, b) => a - b);
}

// ---------- Helpers de HTML / Texto / Markdown ----------

function escaparHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function envolverHtmlDocument(titulo: string, corpoHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escaparHtml(titulo)}</title>
<style>
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.65; color: #16181a; max-width: 820px; margin: 2.5rem auto; padding: 0 1.5rem; background: #fcfbf9; }
  h1, h2, h3 { color: #0B3B46; margin-top: 1.6em; line-height: 1.25; }
  table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.92rem; }
  th, td { border: 1px solid #d5dfe1; padding: 0.55rem 0.75rem; text-align: left; }
  th { background: #0B3B46; color: #FDE2B9; font-weight: 600; }
  tr:nth-child(even) td { background: #f3f7f6; }
  pre, code { font-family: ui-monospace, Consolas, monospace; background: #eef3f4; border-radius: 6px; }
  code { padding: 0.15rem 0.35rem; }
  pre { padding: 1rem; overflow-x: auto; }
  blockquote { border-left: 3px solid #BC9200; margin-left: 0; padding-left: 1rem; color: #475569; }
</style>
</head>
<body>
${corpoHtml}
</body>
</html>`;
}

function htmlParaTextoLimpo(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Helpers de Planilhas (XLSX / CSV / JSON) ----------

function detectarDelimitadorCsv(texto: string): string {
  const primeiraLinha = texto.split(/\r?\n/)[0] || "";
  const pontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const virgula = (primeiraLinha.match(/,/g) || []).length;
  return pontoVirgula > virgula ? ";" : ",";
}

function parsearCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const sep = detectarDelimitadorCsv(limpo);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i];
    const nxt = limpo[i + 1];
    if (inQuotes) {
      if (ch === '"' && nxt === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\r" && nxt === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function serializarCsv(rows: string[][], sep = ","): string {
  const esc = (v: string) => {
    const s = String(v ?? "");
    if (s.includes(sep) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return "\uFEFF" + rows.map((r) => r.map(esc).join(sep)).join("\r\n");
}

async function lerTabelaDeArquivo(buffer: Buffer, ext: string): Promise<string[][]> {
  if (ext === "csv") {
    return parsearCsv(buffer.toString("utf-8"));
  }
  if (ext === "json") {
    const parsed = JSON.parse(buffer.toString("utf-8"));
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "object" && parsed[0] !== null && !Array.isArray(parsed[0])) {
        const headers = Array.from(
          new Set(parsed.flatMap((obj) => (obj && typeof obj === "object" ? Object.keys(obj) : [])))
        );
        const rows = [headers];
        for (const item of parsed) {
          rows.push(
            headers.map((h) => {
              const val = (item as Record<string, unknown>)[h];
              if (val === null || val === undefined) return "";
              return typeof val === "object" ? JSON.stringify(val) : String(val);
            })
          );
        }
        return rows;
      }
      if (Array.isArray(parsed[0])) {
        return parsed.map((r: unknown[]) => r.map((v) => String(v ?? "")));
      }
      return [["Valor"], ...parsed.map((v) => [String(v ?? "")])];
    }
    if (typeof parsed === "object" && parsed !== null) {
      return [["Chave", "Valor"], ...Object.entries(parsed).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v) : String(v ?? "")])];
    }
    throw new Error("O arquivo JSON não contém uma lista ou objeto estruturado.");
  }
  if (ext === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("A planilha XLSX não contém abas.");
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
          return String((v as { text: unknown }).text ?? "");
        }
        if (typeof v === "object" && "result" in (v as Record<string, unknown>)) {
          return String((v as { result: unknown }).result ?? "");
        }
        return String(v);
      });
      rows.push(vals);
    });
    return rows;
  }
  throw new Error(`Não foi possível ler dados tabulares do formato .${ext}`);
}

async function gerarXlsxDeTabela(rows: string[][], tituloAba = "Dados"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tituloAba.slice(0, 31) || "Dados");

  rows.forEach((row, idx) => {
    const r = ws.addRow(row);
    if (idx === 0) {
      r.font = { bold: true, color: { argb: "FFFDE2B9" } };
      r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B3B46" } };
    }
  });

  // Auto-largura inteligente
  ws.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = Math.min(48, len + 3);
    });
    col.width = maxLen;
  });

  const arrayBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuf);
}

function tabelaParaJson(rows: string[][]): string {
  if (!rows.length) return "[]";
  const [headers, ...body] = rows;
  const cols = headers.map((h, i) => (h.trim() ? h.trim() : `coluna_${i + 1}`));
  const objetos = body.map((r) => {
    const obj: Record<string, string> = {};
    cols.forEach((col, i) => {
      obj[col] = r[i] ?? "";
    });
    return obj;
  });
  return JSON.stringify(objetos, null, 2);
}

function tabelaParaHtml(rows: string[][], titulo: string): string {
  if (!rows.length) return envolverHtmlDocument(titulo, "<p>Tabela vazia.</p>");
  const [head, ...body] = rows;
  const ths = head.map((h) => `<th>${escaparHtml(h)}</th>`).join("");
  const trs = body
    .map((r) => `<tr>${head.map((_, i) => `<td>${escaparHtml(r[i] ?? "")}</td>`).join("")}</tr>`)
    .join("\n");
  return envolverHtmlDocument(titulo, `<h1>${escaparHtml(titulo)}</h1><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
}

function tabelaParaMarkdown(rows: string[][]): string {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const safe = (v: string) => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const headerLine = `| ${head.map(safe).join(" | ")} |`;
  const sepLine = `| ${head.map(() => "---").join(" | ")} |`;
  const bodyLines = body.map((r) => `| ${head.map((_, i) => safe(r[i] ?? "")).join(" | ")} |`);
  return [headerLine, sepLine, ...bodyLines].join("\n");
}

// ---------- Geradores de PDF (PDFKit editorial & tabela + pdf-lib imagem) ----------

function gerarPdfDeTextoEstruturado(
  titulo: string,
  markdownOuTexto: string,
  cfg: ConfigDocumento
): Promise<{ dados: Buffer; paginas: number }> {
  return new Promise((resolve, reject) => {
    const margem = typeof cfg.margem === "number" ? cfg.margem : 54;
    const size = cfg.tamanho_pagina === "LETTER" ? "LETTER" : "A4";
    const layout = cfg.orientacao === "landscape" ? "landscape" : "portrait";

    const doc = new PDFKitDocument({ size, layout, margin: margem, bufferPages: true });
    const chunks: Buffer[] = [];
    let totalPaginas = 1;
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve({ dados: Buffer.concat(chunks), paginas: totalPaginas });
    });

    // Cabeçalho editorial discreto
    doc.fillColor("#0B3B46").font("Helvetica-Bold").fontSize(18).text(titulo, { align: "left" });
    doc
      .moveDown(0.3)
      .strokeColor("#BC9200")
      .lineWidth(1.2)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(0.9);

    const linhas = markdownOuTexto.replace(/\r\n/g, "\n").split("\n");
    for (const linha of linhas) {
      const trimmed = linha.trim();
      if (!trimmed) {
        doc.moveDown(0.45);
        continue;
      }
      if (trimmed.startsWith("# ")) {
        doc.moveDown(0.5).fillColor("#0B3B46").font("Helvetica-Bold").fontSize(16).text(trimmed.slice(2).trim());
        doc.moveDown(0.25);
      } else if (trimmed.startsWith("## ")) {
        doc.moveDown(0.45).fillColor("#0B3B46").font("Helvetica-Bold").fontSize(13.5).text(trimmed.slice(3).trim());
        doc.moveDown(0.2);
      } else if (trimmed.startsWith("### ")) {
        doc.moveDown(0.35).fillColor("#60011D").font("Helvetica-Bold").fontSize(11.5).text(trimmed.slice(4).trim());
        doc.moveDown(0.15);
      } else if (/^[-*+]\s+/.test(trimmed)) {
        const textoItem = trimmed.replace(/^[-*+]\s+/, "").replace(/\*\*(.*?)\*\*/g, "$1");
        doc
          .fillColor("#1f2933")
          .font("Helvetica")
          .fontSize(10.5)
          .text(`•  ${textoItem}`, { indent: 12, lineGap: 3 });
      } else if (trimmed.startsWith("> ")) {
        doc
          .fillColor("#4b5563")
          .font("Helvetica-Oblique")
          .fontSize(10.5)
          .text(trimmed.slice(2).trim(), { indent: 16, lineGap: 3 });
      } else {
        const limpo = trimmed.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
        doc.fillColor("#1f2933").font("Helvetica").fontSize(10.5).text(limpo, { lineGap: 3.5 });
      }
    }

    // Numeração de páginas no rodapé (sem disparar quebra de página extra!)
    const range = doc.bufferedPageRange();
    totalPaginas = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      const rodapeY = doc.page.height - Math.max(24, margem * 0.55);
      doc
        .fillColor("#64748b")
        .font("Helvetica")
        .fontSize(8.5)
        .text(`Página ${i + 1} de ${range.count}  ·  Gerado no Revela`, margem, rodapeY, {
          width: doc.page.width - margem * 2,
          align: "right",
          lineBreak: false,
        });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

function gerarPdfDeTabela(
  titulo: string,
  rows: string[][],
  cfg: ConfigDocumento
): Promise<{ dados: Buffer; paginas: number }> {
  return new Promise((resolve, reject) => {
    const margem = 40;
    const colsCount = rows[0]?.length || 1;
    const layout = cfg.orientacao || (colsCount > 5 ? "landscape" : "portrait");
    const size = cfg.tamanho_pagina === "LETTER" ? "LETTER" : "A4";

    const doc = new PDFKitDocument({ size, layout, margin: margem, bufferPages: true });
    const chunks: Buffer[] = [];
    let totalPaginas = 1;
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("error", reject);
    doc.on("end", () => {
      resolve({ dados: Buffer.concat(chunks), paginas: totalPaginas });
    });

    const usableWidth = doc.page.width - margem * 2;
    const maxCols = Math.min(colsCount, 10);
    const colWidth = usableWidth / maxCols;

    const desenharCabecalhoPagina = () => {
      doc.fillColor("#0B3B46").font("Helvetica-Bold").fontSize(14).text(titulo, margem, margem);
      doc.moveDown(0.5);
    };

    const desenharHeaderTabela = (y: number) => {
      const header = rows[0] || [];
      doc.save().fillColor("#0B3B46").rect(margem, y, usableWidth, 22).fill().restore();
      doc.fillColor("#FDE2B9").font("Helvetica-Bold").fontSize(8.5);
      for (let c = 0; c < maxCols; c++) {
        doc.text(String(header[c] ?? "").slice(0, 32), margem + c * colWidth + 5, y + 6, {
          width: colWidth - 10,
          ellipsis: true,
          lineBreak: false,
        });
      }
      return y + 22;
    };

    desenharCabecalhoPagina();
    let y = desenharHeaderTabela(doc.y);

    const body = rows.slice(1);
    const rowH = 19;
    for (let rIdx = 0; rIdx < body.length; rIdx++) {
      if (y + rowH > doc.page.height - margem - 24) {
        doc.addPage();
        y = desenharHeaderTabela(margem);
      }
      if (rIdx % 2 === 1) {
        doc.save().fillColor("#F3F7F6").rect(margem, y, usableWidth, rowH).fill().restore();
      }
      doc.strokeColor("#E2E8F0").lineWidth(0.5).moveTo(margem, y + rowH).lineTo(margem + usableWidth, y + rowH).stroke();
      doc.fillColor("#1E293B").font("Helvetica").fontSize(8.2);
      const row = body[rIdx];
      for (let c = 0; c < maxCols; c++) {
        doc.text(String(row[c] ?? "").slice(0, 42), margem + c * colWidth + 5, y + 5, {
          width: colWidth - 10,
          ellipsis: true,
          lineBreak: false,
        });
      }
      y += rowH;
    }

    const range = doc.bufferedPageRange();
    totalPaginas = range.count;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc
        .fillColor("#64748b")
        .font("Helvetica")
        .fontSize(8)
        .text(`Página ${i + 1} de ${range.count}  ·  Revela`, margem, doc.page.height - 24, {
          width: usableWidth,
          align: "right",
          lineBreak: false,
        });
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}

async function gerarDocxDeMarkdownOuTexto(titulo: string, conteudo: string): Promise<Buffer> {
  const paragrafos: Paragraph[] = [
    new Paragraph({
      text: titulo,
      heading: HeadingLevel.TITLE,
      spacing: { after: 240 },
    }),
  ];

  const linhas = conteudo.replace(/\r\n/g, "\n").split("\n");
  for (const linha of linhas) {
    const t = linha.trim();
    if (!t) {
      paragrafos.push(new Paragraph({ text: "" }));
      continue;
    }
    if (t.startsWith("# ")) {
      paragrafos.push(new Paragraph({ text: t.slice(2), heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 100 } }));
    } else if (t.startsWith("## ")) {
      paragrafos.push(new Paragraph({ text: t.slice(3), heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 80 } }));
    } else if (t.startsWith("### ")) {
      paragrafos.push(new Paragraph({ text: t.slice(4), heading: HeadingLevel.HEADING_3, spacing: { before: 120, after: 60 } }));
    } else if (/^[-*+]\s+/.test(t)) {
      paragrafos.push(new Paragraph({ text: t.replace(/^[-*+]\s+/, ""), bullet: { level: 0 } }));
    } else {
      paragrafos.push(new Paragraph({ children: [new TextRun({ text: t.replace(/\*\*(.*?)\*\*/g, "$1") })], spacing: { after: 120 } }));
    }
  }

  const doc = new DocxDocument({ sections: [{ children: paragrafos }] });
  return await Packer.toBuffer(doc);
}

async function gerarDocxDeTabela(titulo: string, rows: string[][]): Promise<Buffer> {
  const tableRows = rows.map(
    (r, idx) =>
      new TableRow({
        children: r.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: String(cell ?? ""), bold: idx === 0 })] })],
            })
        ),
      })
  );

  const doc = new DocxDocument({
    sections: [
      {
        children: [
          new Paragraph({ text: titulo, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }),
        ],
      },
    ],
  });
  return await Packer.toBuffer(doc);
}

async function adicionarImagemAoPdf(pdfDoc: PDFDocument, imgBuffer: Buffer, cfg: ConfigDocumento) {
  const meta = await sharp(imgBuffer).metadata();
  const isJpeg = meta.format === "jpeg";
  const embedded = isJpeg
    ? await pdfDoc.embedJpg(await sharp(imgBuffer).rotate().jpeg({ quality: 92 }).toBuffer())
    : await pdfDoc.embedPng(await sharp(imgBuffer).rotate().png().toBuffer());

  const imgW = embedded.width;
  const imgH = embedded.height;
  const margem = typeof cfg.margem === "number" ? cfg.margem : 28;

  let pageW: number;
  let pageH: number;
  if (cfg.tamanho_pagina === "AUTO") {
    pageW = imgW;
    pageH = imgH;
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawImage(embedded, { x: 0, y: 0, width: imgW, height: imgH });
    return;
  }

  const [baseW, baseH] = cfg.tamanho_pagina === "LETTER" ? PageSizes.Letter : PageSizes.A4;
  const landscape = cfg.orientacao === "landscape";
  pageW = landscape ? baseH : baseW;
  pageH = landscape ? baseW : baseH;

  const page = pdfDoc.addPage([pageW, pageH]);
  const availW = Math.max(20, pageW - margem * 2);
  const availH = Math.max(20, pageH - margem * 2);
  const scale = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  page.drawImage(embedded, { x, y, width: drawW, height: drawH });
}

// ---------- Pipeline Principal de Documento Individual ----------

export async function processarDocumento(
  buffer: Buffer,
  nomeOriginal: string,
  cfg: ConfigDocumento,
  onEtapa?: (etapa: "lendo" | "convertendo" | "finalizando") => void
): Promise<ArquivoGeradoDoc[]> {
  const extIn = extensaoDoArquivo(nomeOriginal);
  const titulo = nomeBaseSemExtensao(nomeOriginal);
  const destino: FormatoDocSaida = cfg.formato || formatosDestinoParaExtensao(extIn)[0];

  onEtapa?.("lendo");

  // 1) Imagens -> PDF
  if (["png", "jpg", "jpeg", "webp"].includes(extIn)) {
    onEtapa?.("convertendo");
    const pdf = await PDFDocument.create();
    await adicionarImagemAoPdf(pdf, buffer, cfg);
    onEtapa?.("finalizando");
    const bytes = await pdf.save();
    return [{ dados: Buffer.from(bytes), extensao: "pdf", mime: MIME_DOC.pdf, paginas: 1 }];
  }

  // 2) Entrada PDF
  if (extIn === "pdf") {
    if (destino === "PDF" || destino === "PDF_SPLIT") {
      const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: false });
      const totalPaginas = srcPdf.getPageCount();
      const indices = parsearIntervaloPaginas(cfg.intervalo_paginas, totalPaginas);
      const rot = cfg.rotacao || 0;

      onEtapa?.("convertendo");

      if (destino === "PDF_SPLIT") {
        const resultados: ArquivoGeradoDoc[] = [];
        for (const idx of indices) {
          const single = await PDFDocument.create();
          const [copiada] = await single.copyPages(srcPdf, [idx]);
          if (rot) copiada.setRotation(degrees((copiada.getRotation().angle + rot) % 360));
          single.addPage(copiada);
          const bytes = await single.save();
          resultados.push({
            dados: Buffer.from(bytes),
            extensao: "pdf",
            mime: MIME_DOC.pdf,
            sufixo: `_pag_${idx + 1}`,
            paginas: 1,
          });
        }
        onEtapa?.("finalizando");
        return resultados;
      }

      const outPdf = await PDFDocument.create();
      const copiadas = await outPdf.copyPages(srcPdf, indices);
      for (const page of copiadas) {
        if (rot) page.setRotation(degrees((page.getRotation().angle + rot) % 360));
        outPdf.addPage(page);
      }
      onEtapa?.("finalizando");
      const bytes = await outPdf.save();
      return [{ dados: Buffer.from(bytes), extensao: "pdf", mime: MIME_DOC.pdf, paginas: copiadas.length }];
    }

    // PDF -> TXT / MD / HTML / DOCX / CSV / JSON
    onEtapa?.("convertendo");
    const parsed = await pdfParseCore(buffer);
    const texto = (parsed.text || "").trim();
    const avisoVazio = texto.length < 10 ? "Pouco ou nenhum texto selecionável encontrado (este PDF pode ser escaneado como imagem)." : null;

    onEtapa?.("finalizando");
    if (destino === "TXT") {
      return [{ dados: Buffer.from(texto, "utf-8"), extensao: "txt", mime: MIME_DOC.txt, paginas: parsed.numpages, aviso: avisoVazio }];
    }
    if (destino === "MD") {
      const md = `# ${titulo}\n\n${texto}`;
      return [{ dados: Buffer.from(md, "utf-8"), extensao: "md", mime: MIME_DOC.md, paginas: parsed.numpages, aviso: avisoVazio }];
    }
    if (destino === "HTML") {
      const htmlBody = `<h1>${escaparHtml(titulo)}</h1>` + texto.split(/\n{2,}/).map((p: string) => `<p>${escaparHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n");
      return [{ dados: Buffer.from(envolverHtmlDocument(titulo, htmlBody), "utf-8"), extensao: "html", mime: MIME_DOC.html, paginas: parsed.numpages, aviso: avisoVazio }];
    }
    if (destino === "DOCX") {
      const docxBuf = await gerarDocxDeMarkdownOuTexto(titulo, texto);
      return [{ dados: docxBuf, extensao: "docx", mime: MIME_DOC.docx, paginas: parsed.numpages, aviso: avisoVazio }];
    }
    if (destino === "CSV" || destino === "JSON") {
      const linhas = texto
        .split(/\r?\n/)
        .map((l: string) => l.trim())
        .filter(Boolean);
      const sep = cfg.delimitador_csv || ";";
      const rows: string[][] = [["Linha", "Conteudo"], ...linhas.map((l: string, i: number) => [String(i + 1), l])];
      if (destino === "CSV") {
        return [{ dados: Buffer.from(serializarCsv(rows, sep), "utf-8"), extensao: "csv", mime: MIME_DOC.csv, paginas: parsed.numpages, aviso: avisoVazio }];
      }
      return [{ dados: Buffer.from(tabelaParaJson(rows), "utf-8"), extensao: "json", mime: MIME_DOC.json, paginas: parsed.numpages, aviso: avisoVazio }];
    }
  }

  // 3) Planilhas & Dados (XLSX / CSV / JSON)
  if (["xlsx", "csv", "json"].includes(extIn)) {
    const rows = await lerTabelaDeArquivo(buffer, extIn);
    onEtapa?.("convertendo");

    if (destino === "XLSX") {
      const xlsxBuf = await gerarXlsxDeTabela(rows, titulo);
      onEtapa?.("finalizando");
      return [{ dados: xlsxBuf, extensao: "xlsx", mime: MIME_DOC.xlsx }];
    }
    if (destino === "CSV") {
      const sep = cfg.delimitador_csv || ";";
      onEtapa?.("finalizando");
      return [{ dados: Buffer.from(serializarCsv(rows, sep), "utf-8"), extensao: "csv", mime: MIME_DOC.csv }];
    }
    if (destino === "JSON") {
      onEtapa?.("finalizando");
      return [{ dados: Buffer.from(tabelaParaJson(rows), "utf-8"), extensao: "json", mime: MIME_DOC.json }];
    }
    if (destino === "TXT") {
      const txtOut = rows.map((r) => r.join("\t")).join("\n");
      onEtapa?.("finalizando");
      return [{ dados: Buffer.from(txtOut, "utf-8"), extensao: "txt", mime: MIME_DOC.txt }];
    }
    if (destino === "HTML") {
      onEtapa?.("finalizando");
      return [{ dados: Buffer.from(tabelaParaHtml(rows, titulo), "utf-8"), extensao: "html", mime: MIME_DOC.html }];
    }
    if (destino === "MD") {
      onEtapa?.("finalizando");
      return [{ dados: Buffer.from(tabelaParaMarkdown(rows), "utf-8"), extensao: "md", mime: MIME_DOC.md }];
    }
    if (destino === "DOCX") {
      const docxBuf = await gerarDocxDeTabela(titulo, rows);
      onEtapa?.("finalizando");
      return [{ dados: docxBuf, extensao: "docx", mime: MIME_DOC.docx }];
    }
    if (destino === "PDF") {
      const { dados, paginas } = await gerarPdfDeTabela(titulo, rows, cfg);
      onEtapa?.("finalizando");
      return [{ dados, extensao: "pdf", mime: MIME_DOC.pdf, paginas }];
    }
  }

  // 4) Documentos de Texto Rico (DOCX / MD / HTML / TXT)
  let markdown = "";
  let html = "";
  let textoPuro = "";

  if (extIn === "docx") {
    const htmlRes = await mammoth.convertToHtml({ buffer });
    const rawRes = await mammoth.extractRawText({ buffer });
    html = htmlRes.value;
    textoPuro = rawRes.value.trim();
    markdown = turndown.turndown(html);
  } else if (extIn === "md" || extIn === "markdown") {
    markdown = buffer.toString("utf-8");
    html = await marked.parse(markdown);
    textoPuro = htmlParaTextoLimpo(html);
  } else if (extIn === "html" || extIn === "htm") {
    html = buffer.toString("utf-8");
    markdown = turndown.turndown(html);
    textoPuro = htmlParaTextoLimpo(html);
  } else if (extIn === "txt") {
    textoPuro = buffer.toString("utf-8");
    markdown = textoPuro;
    html = textoPuro
      .split(/\n{2,}/)
      .map((p) => `<p>${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("\n");
  } else {
    throw new Error(`Formato .${extIn} não suportado para conversão.`);
  }

  onEtapa?.("convertendo");

  if (destino === "PDF") {
    const { dados, paginas } = await gerarPdfDeTextoEstruturado(titulo, markdown || textoPuro, cfg);
    onEtapa?.("finalizando");
    return [{ dados, extensao: "pdf", mime: MIME_DOC.pdf, paginas }];
  }
  if (destino === "DOCX") {
    const docxBuf = await gerarDocxDeMarkdownOuTexto(titulo, markdown || textoPuro);
    onEtapa?.("finalizando");
    return [{ dados: docxBuf, extensao: "docx", mime: MIME_DOC.docx }];
  }
  if (destino === "HTML") {
    const docHtml = html.includes("<html") ? html : envolverHtmlDocument(titulo, html);
    onEtapa?.("finalizando");
    return [{ dados: Buffer.from(docHtml, "utf-8"), extensao: "html", mime: MIME_DOC.html }];
  }
  if (destino === "MD") {
    onEtapa?.("finalizando");
    return [{ dados: Buffer.from(markdown, "utf-8"), extensao: "md", mime: MIME_DOC.md }];
  }
  if (destino === "TXT") {
    onEtapa?.("finalizando");
    return [{ dados: Buffer.from(textoPuro, "utf-8"), extensao: "txt", mime: MIME_DOC.txt }];
  }
  if (destino === "CSV" || destino === "JSON") {
    const linhas = textoPuro
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const sep = cfg.delimitador_csv || ";";
    const rows: string[][] = [["Linha", "Conteudo"], ...linhas.map((l, i) => [String(i + 1), l])];
    onEtapa?.("finalizando");
    if (destino === "CSV") {
      return [{ dados: Buffer.from(serializarCsv(rows, sep), "utf-8"), extensao: "csv", mime: MIME_DOC.csv }];
    }
    return [{ dados: Buffer.from(tabelaParaJson(rows), "utf-8"), extensao: "json", mime: MIME_DOC.json }];
  }

  throw new Error(`Conversão de .${extIn} para ${destino} não suportada.`);
}

// ---------- Mesclagem Multi-Arquivo em 1 Único PDF (Merge PDFs + Imagens) ----------

export async function mesclarArquivosEmPdfUnico(
  itens: Array<{ nome: string; buffer: Buffer; cfg: ConfigDocumento }>,
  onProgresso?: (indice: number, total: number, nome: string) => void
): Promise<{ dados: Buffer; totalPaginas: number }> {
  const merged = await PDFDocument.create();

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i];
    onProgresso?.(i + 1, itens.length, item.nome);
    const ext = extensaoDoArquivo(item.nome);

    if (ext === "pdf") {
      const src = await PDFDocument.load(item.buffer, { ignoreEncryption: false });
      const indices = parsearIntervaloPaginas(item.cfg.intervalo_paginas, src.getPageCount());
      const copiadas = await merged.copyPages(src, indices);
      const rot = item.cfg.rotacao || 0;
      for (const p of copiadas) {
        if (rot) p.setRotation(degrees((p.getRotation().angle + rot) % 360));
        merged.addPage(p);
      }
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      await adicionarImagemAoPdf(merged, item.buffer, item.cfg);
    } else {
      // Converte qualquer documento suportado (DOCX/MD/TXT/XLSX/CSV/HTML) para PDF primeiro e anexa!
      const [gerado] = await processarDocumento(item.buffer, item.nome, { ...item.cfg, formato: "PDF" });
      const src = await PDFDocument.load(gerado.dados);
      const copiadas = await merged.copyPages(src, src.getPageIndices());
      for (const p of copiadas) merged.addPage(p);
    }
  }

  const bytes = await merged.save();
  return { dados: Buffer.from(bytes), totalPaginas: merged.getPageCount() };
}
