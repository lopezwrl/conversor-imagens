import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extensaoDoArquivo,
  mensagemAmigavelErro,
  nomeBaseSemExtensao,
  resolverNomeSaida,
  sanitizarNomeArquivo,
} from "../services/filenameUtils.js";
import {
  EXTENSOES_DOC_VALIDAS,
  MIME_DOC,
  mesclarArquivosEmPdfUnico,
  processarDocumento,
  type ConfigDocumento,
} from "../services/documentProcessor.js";
import { criarZipBuffer, NdjsonStream, type ZipEntry } from "../utils/ndjson.js";

export async function registerDocumentRoutes(app: FastifyInstance) {
  app.post("/api/documents/batch", async (request, reply) => {
    const pastaTemp = await fs.mkdtemp(path.join(os.tmpdir(), "revela_doc_"));
    const itens: Array<{ nomeOriginal: string; caminho: string }> = [];
    let configRaw = "{}";
    let usarZip = true;
    let modoMesclarPdf = false;
    let nomeMesclado = "revela_unificado";
    let nomeZip = "revela_documentos.zip";

    try {
      const parts = request.parts();
      let idx = 0;

      for await (const part of parts) {
        if (part.type === "file") {
          const nomeOriginal = part.filename || `documento_${idx}`;
          const caminho = path.join(pastaTemp, `${idx}_${path.basename(nomeOriginal)}`);
          const buffer = await part.toBuffer();
          await fs.writeFile(caminho, buffer);
          itens.push({ nomeOriginal, caminho });
          idx++;
        } else {
          const val = String(part.value ?? "");
          if (part.fieldname === "config") configRaw = val;
          if (part.fieldname === "usar_zip") usarZip = val.toLowerCase() === "true";
          if (part.fieldname === "mesclar_pdf") modoMesclarPdf = val.toLowerCase() === "true";
          if (part.fieldname === "nome_mesclado" && val.trim()) nomeMesclado = val.trim();
          if (part.fieldname === "nome_zip" && val.trim()) nomeZip = val.trim();
        }
      }
    } catch (err) {
      await fs.rm(pastaTemp, { recursive: true, force: true });
      return reply.code(400).send({ erro: mensagemAmigavelErro(err) });
    }

    if (!itens.length) {
      await fs.rm(pastaTemp, { recursive: true, force: true });
      return reply.code(400).send({ erro: "Nenhum documento enviado." });
    }

    let config: Record<string, ConfigDocumento> = {};
    try {
      config = JSON.parse(configRaw);
    } catch {
      config = {};
    }

    const stream = new NdjsonStream(reply);
    stream.start(request.headers.origin);

    try {
      // Modo Especial: Mesclar todos os documentos/PDFs/imagens em 1 único PDF
      if (modoMesclarPdf) {
        try {
          const carregados = await Promise.all(
            itens.map(async (item, i) => ({
              nome: item.nomeOriginal,
              buffer: await fs.readFile(item.caminho),
              cfg: config[String(i)] || config[item.nomeOriginal] || {},
            }))
          );

          const { dados, totalPaginas } = await mesclarArquivosEmPdfUnico(
            carregados,
            (indice, total, nome) => {
              stream.send({ tipo: "progresso", indice, total, nome, etapa: "convertendo" });
            }
          );

          const baseLimpa = sanitizarNomeArquivo(nomeMesclado) || "revela_unificado";
          const salvoComo = baseLimpa.toLowerCase().endsWith(".pdf") ? baseLimpa : `${baseLimpa}.pdf`;

          stream.send({
            tipo: "resultado",
            indice: 0,
            nome: `${itens.length} arquivo(s) unificados`,
            status: "ok",
            salvo_como: salvoComo,
            paginas: totalPaginas,
            tamanho_bytes: dados.length,
            dados: dados.toString("base64"),
            mime: MIME_DOC.pdf,
            aviso: null,
          });
          stream.send({ tipo: "concluido" });
        } catch (err) {
          stream.send({
            tipo: "resultado",
            indice: 0,
            nome: "Mesclagem em PDF",
            status: "erro",
            mensagem: mensagemAmigavelErro(err),
          });
          stream.send({ tipo: "concluido" });
        }
        return;
      }

      // Modo Lote Individual / Conversão
      const total = itens.length;
      const nomesUsados = new Set<string>();
      const entradasZip: ZipEntry[] = [];

      for (let i = 0; i < total; i++) {
        const indice = i + 1;
        const { nomeOriginal, caminho } = itens[i];
        const cfg: ConfigDocumento = config[String(i)] || config[nomeOriginal] || {};

        try {
          const ext = extensaoDoArquivo(nomeOriginal);
          if (!EXTENSOES_DOC_VALIDAS.has(ext)) {
            throw new Error(`Formato .${ext || "desconhecido"} não suportado no módulo de documentos.`);
          }

          const inputBuf = await fs.readFile(caminho);
          const gerados = await processarDocumento(inputBuf, nomeOriginal, cfg, (etapa) => {
            stream.send({ tipo: "progresso", indice, total, nome: nomeOriginal, etapa });
          });

          const nomeBase = nomeBaseSemExtensao(nomeOriginal);

          for (const arq of gerados) {
            const baseComSufixo = arq.sufixo
              ? `${sanitizarNomeArquivo(cfg.novo_nome) || nomeBase}${arq.sufixo}`
              : cfg.novo_nome;
            const nomeFinal = resolverNomeSaida(nomeBase, baseComSufixo, arq.extensao, nomesUsados, "documento");

            if (usarZip) {
              entradasZip.push({ nome: nomeFinal, dados: arq.dados });
            }

            stream.send({
              tipo: "resultado",
              indice: i,
              nome: nomeOriginal,
              status: "ok",
              salvo_como: nomeFinal,
              paginas: arq.paginas ?? null,
              tamanho_bytes: arq.dados.length,
              aviso: arq.aviso ?? null,
              dados: arq.dados.toString("base64"),
              mime: arq.mime,
            });
          }
        } catch (err) {
          stream.send({
            tipo: "resultado",
            indice: i,
            nome: nomeOriginal,
            status: "erro",
            mensagem: mensagemAmigavelErro(err),
          });
        } finally {
          await fs.rm(caminho, { force: true }).catch(() => {});
        }
      }

      if (usarZip && entradasZip.length > 0) {
        const zipBuf = await criarZipBuffer(entradasZip);
        stream.send({
          tipo: "concluido",
          zip_base64: zipBuf.toString("base64"),
          nome_zip: nomeZip.endsWith(".zip") ? nomeZip : `${nomeZip}.zip`,
        });
      } else {
        stream.send({ tipo: "concluido" });
      }
    } finally {
      stream.end();
      await fs.rm(pastaTemp, { recursive: true, force: true }).catch(() => {});
    }
  });
}
