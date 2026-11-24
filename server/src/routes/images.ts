import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  extensaoDoArquivo,
  mensagemAmigavelErro,
  nomeBaseSemExtensao,
  resolverNomeSaida,
} from "../services/filenameUtils.js";
import {
  EXTENSOES_IMAGEM_VALIDAS,
  processarImagem,
  type ConfigImagem,
} from "../services/imageProcessor.js";
import { criarZipBuffer, NdjsonStream, type ZipEntry } from "../utils/ndjson.js";

export async function registerImageRoutes(app: FastifyInstance) {
  const handler = async (request: any, reply: any) => {
    const pastaTemp = await fs.mkdtemp(path.join(os.tmpdir(), "revela_img_"));
    const itens: Array<{ nomeOriginal: string; caminho: string }> = [];
    let configRaw = "{}";
    let usarZip = true;
    let nomeZip = "revela_imagens.zip";

    try {
      const parts = request.parts();
      let idx = 0;

      for await (const part of parts) {
        if (part.type === "file") {
          const nomeOriginal = part.filename || `imagem_${idx}.png`;
          const caminho = path.join(pastaTemp, `${idx}_${path.basename(nomeOriginal)}`);
          const buffer = await part.toBuffer();
          await fs.writeFile(caminho, buffer);
          itens.push({ nomeOriginal, caminho });
          idx++;
        } else {
          const val = String(part.value ?? "");
          if (part.fieldname === "config") configRaw = val;
          if (part.fieldname === "usar_zip") usarZip = val.toLowerCase() === "true";
          if (part.fieldname === "nome_zip" && val.trim()) nomeZip = val.trim();
        }
      }
    } catch (err) {
      await fs.rm(pastaTemp, { recursive: true, force: true });
      return reply.code(400).send({ erro: mensagemAmigavelErro(err) });
    }

    if (!itens.length) {
      await fs.rm(pastaTemp, { recursive: true, force: true });
      return reply.code(400).send({ erro: "Nenhuma imagem enviada." });
    }

    let config: Record<string, ConfigImagem> = {};
    try {
      config = JSON.parse(configRaw);
    } catch {
      config = {};
    }

    const stream = new NdjsonStream(reply);
    stream.start(request.headers.origin);

    const total = itens.length;
    const nomesUsados = new Set<string>();
    const entradasZip: ZipEntry[] = [];

    try {
      for (let i = 0; i < total; i++) {
        const indice = i + 1;
        const { nomeOriginal, caminho } = itens[i];
        const cfg: ConfigImagem = config[String(i)] || config[nomeOriginal] || {};

        try {
          const ext = extensaoDoArquivo(nomeOriginal);
          if (!EXTENSOES_IMAGEM_VALIDAS.has(ext)) {
            throw new Error(`Formato .${ext || "desconhecido"} não suportado no módulo de imagens.`);
          }

          const inputBuf = await fs.readFile(caminho);
          const resultado = await processarImagem(inputBuf, cfg, (etapa) => {
            stream.send({
              tipo: "progresso",
              indice,
              total,
              nome: nomeOriginal,
              etapa,
            });
          });

          const nomeBase = nomeBaseSemExtensao(nomeOriginal);
          const nomeFinal = resolverNomeSaida(nomeBase, cfg.novo_nome, resultado.extensao, nomesUsados, "imagem");

          if (usarZip) {
            entradasZip.push({ nome: nomeFinal, dados: resultado.dados });
          }

          stream.send({
            tipo: "resultado",
            indice: i,
            nome: nomeOriginal,
            status: "ok",
            salvo_como: nomeFinal,
            dimensoes: `${resultado.largura}x${resultado.altura}`,
            tamanho_bytes: resultado.dados.length,
            aviso: resultado.aviso,
            dados: resultado.dados.toString("base64"),
            mime: resultado.mime,
          });
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
  };

  app.post("/api/images/batch", handler);
  app.post("/api/converter-lote", handler);
}
