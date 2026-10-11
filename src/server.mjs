import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSessionConfig, getVoiceModel } from "./config.mjs";
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

async function createRealtimeSession(response) {
  if (!process.env.XAI_API_KEY) {
    sendJson(response, 503, {
      error: "XAI_API_KEY nao configurada. Copie .env.example para .env."
    });
    return;
  }

  try {
    const xAiResponse = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ expires_after: { seconds: 300 } })
    });

    const data = await xAiResponse.json();
    if (!xAiResponse.ok) {
      sendJson(response, xAiResponse.status, data);
      return;
    }

    sendJson(response, 200, {
      ...data,
      model: getVoiceModel(),
      session: createSessionConfig()
    });
  } catch (error) {
    console.error("Falha ao criar token temporario da xAI:", error);
    sendJson(response, 502, { error: "Falha ao criar sessao de voz da xAI." });
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
      sendJson(response, 200, {
        assistant: "Alex",
        provider: "xAI",
        model: getVoiceModel(),
        apiKeyConfigured: Boolean(process.env.XAI_API_KEY)
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/session") {
      await createRealtimeSession(response);
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

