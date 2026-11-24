import type { FastifyReply } from "fastify";
import archiver from "archiver";

export interface ZipEntry {
  nome: string;
  dados: Buffer;
}

export class NdjsonStream {
  private reply: FastifyReply;
  private started = false;

  constructor(reply: FastifyReply) {
    this.reply = reply;
  }

  start(origin?: string) {
    if (this.started) return;
    this.started = true;
    this.reply.hijack();
    const headers: Record<string, string> = {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Credentials"] = "true";
    }
    this.reply.raw.writeHead(200, headers);
  }

  send(evento: Record<string, unknown>) {
    if (!this.started) this.start();
    if (!this.reply.raw.writableEnded) {
      this.reply.raw.write(`${JSON.stringify(evento)}\n`);
    }
  }

  end() {
    if (this.started && !this.reply.raw.writableEnded) {
      this.reply.raw.end();
    }
  }
}

export function criarZipBuffer(entradas: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err) => reject(err));

    for (const item of entradas) {
      archive.append(item.dados, { name: item.nome });
    }

    archive.finalize().catch(reject);
  });
}
