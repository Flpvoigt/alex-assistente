import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSessionConfig } from "./config.mjs";
import { loadEnvFile } from "./env.mjs";

loadEnvFile();

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(currentDirectory, "../public");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request, limit = 1_000_000) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function createRealtimeSession(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "OPENAI_API_KEY nao configurada. Copie .env.example para .env."
    });
    return;
  }

  try {
    const sdp = await readRequestBody(request);
    if (!sdp.trim()) {
      sendJson(response, 400, { error: "Oferta SDP vazia." });
      return;
    }

    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify(createSessionConfig()));

    const openAiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "alex-local-user"
      },
      body: form
    });

    const body = await openAiResponse.text();
    response.writeHead(openAiResponse.status, {
      "Content-Type": openAiResponse.ok
        ? "application/sdp"
        : "application/json; charset=utf-8"
    });
    response.end(body);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    console.error("Falha ao criar sessao Realtime:", error);
    sendJson(response, tooLarge ? 413 : 502, {
      error: tooLarge ? "Oferta SDP muito grande." : "Falha ao criar sessao de voz."
    });
  }
}

async function serveStatic(urlPath, response) {
  const requestedPath = urlPath === "/" ? "/index.html" : urlPath;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(publicDirectory, `.${decodedPath}`);

  if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
    sendJson(response, 403, { error: "Caminho invalido." });
    return;
  }

  try {
    const body = await readFile(filePath);
    const contentType = mimeTypes.get(path.extname(filePath)) || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      sendJson(response, 404, { error: "Nao encontrado." });
      return;
    }
    throw error;
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", assistant: "Alex" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/status") {
      const config = createSessionConfig();
      sendJson(response, 200, {
        assistant: "Alex",
        model: config.model,
        apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY)
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/session") {
      await createRealtimeSession(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    sendJson(response, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error("Erro inesperado:", error);
    if (!response.headersSent) sendJson(response, 500, { error: "Erro interno." });
    else response.end();
  }
});

server.listen(port, host, () => {
  console.log(`Alex disponivel em http://${host}:${port}`);
});

