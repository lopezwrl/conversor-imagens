import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerImageRoutes } from "./routes/images.js";
import { registerDocumentRoutes } from "./routes/documents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
  },
  bodyLimit: 300 * 1024 * 1024,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(multipart, {
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB por arquivo
    files: 250,
    fieldSize: 10 * 1024 * 1024,
  },
});

app.get("/api/health", async () => ({
  status: "ok",
  service: "revela-api",
  version: "2.0.0",
}));

await registerImageRoutes(app);
await registerDocumentRoutes(app);

// Em produção, serve o build do React se existir em ../client/dist
const clientDist = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
  });
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile("index.html");
  });
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Revela API pronta em http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
