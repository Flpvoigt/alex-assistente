import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAlexInstructions,
  createGroqConfig,
  createVoiceConfig,
  sanitizeHistory
} from "./config.mjs";
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

async function readRequestBody(request, limit = 25 * 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function requireGroqKey(response) {
  if (process.env.GROQ_API_KEY) return true;
  sendJson(response, 503, {
    error: "GROQ_API_KEY nao configurada. Copie .env.example para .env."
  });
  return false;
}

async function readGroqResponse(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    return { error: body || "Resposta invalida da Groq." };
  }
}

async function transcribe(request, response) {
  if (!requireGroqKey(response)) return;

  try {
    const audio = await readRequestBody(request);
    if (!audio.length) {
      sendJson(response, 400, { error: "Audio vazio." });
      return;
    }

    const contentType = request.headers["content-type"] || "audio/webm";
    const extension = contentType.includes("wav")
      ? "wav"
      : contentType.includes("mp4")
        ? "m4a"
        : contentType.includes("ogg")
          ? "ogg"
          : "webm";
    const form = new FormData();
    form.set("file", new Blob([audio], { type: contentType }), `fala.${extension}`);
    form.set("model", createGroqConfig().sttModel);
    form.set("language", "pt");
    form.set("response_format", "json");
    form.set("prompt", "O assistente se chama Alex. Transcreva em portugues do Brasil.");

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: form
      }
    );
    const data = await readGroqResponse(groqResponse);

    if (!groqResponse.ok) {
      sendJson(response, groqResponse.status, {
        error: data.error?.message || data.error || "Falha na transcricao."
      });
      return;
    }

    sendJson(response, 200, { text: data.text?.trim() || "" });
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";
    console.error("Falha ao transcrever com a Groq:", error);
    sendJson(response, tooLarge ? 413 : 502, {
      error: tooLarge ? "Audio muito grande." : "Falha ao transcrever o audio."
    });
  }
}

async function respond(request, response) {
  if (!requireGroqKey(response)) return;

  const upstreamAbort = new AbortController();
  response.on("close", () => upstreamAbort.abort());

  try {
    const rawBody = await readRequestBody(request, 256 * 1024);
    const body = JSON.parse(rawBody.toString("utf8"));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4000) {
      sendJson(response, 400, { error: "Mensagem vazia ou muito longa." });
      return;
    }

    const config = createGroqConfig();
    const enabledTools = config.webSearchEnabled ? [{ type: "browser_search" }] : undefined;
    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.chatModel,
          messages: [
            {
              role: "system",
              content: createAlexInstructions({ timeZone: process.env.TZ || "America/Sao_Paulo" })
            },
            ...sanitizeHistory(body.history),
            { role: "user", content: message }
          ],
          temperature: 0.4,
          max_completion_tokens: 700,
          reasoning_effort: config.reasoningEffort,
          tools: enabledTools,
          tool_choice: enabledTools ? "auto" : undefined,
          citation_options: "enabled",
          stream: true
        }),
        signal: upstreamAbort.signal
      }
    );

    if (!groqResponse.ok) {
      const data = await readGroqResponse(groqResponse);
      sendJson(response, groqResponse.status, {
        error: data.error?.message || data.error || "Falha ao gerar resposta."
      });
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    for await (const chunk of groqResponse.body) {
      if (response.destroyed) break;
      response.write(chunk);
    }
    response.end();
  } catch (error) {
    if (error?.name === "AbortError") return;
    const invalidJson = error instanceof SyntaxError;
    console.error("Falha ao responder com a Groq:", error);
    if (!response.headersSent) {
      sendJson(response, invalidJson ? 400 : 502, {
        error: invalidJson ? "JSON invalido." : "Falha ao gerar resposta."
      });
    } else {
      response.end();
    }
  }
}

async function voiceStatus(response) {
  const config = createVoiceConfig();
  try {
    const upstream = await fetch(config.healthUrl, { signal: AbortSignal.timeout(1500) });
    const data = await readGroqResponse(upstream);
    sendJson(response, upstream.ok ? 200 : 503, {
      provider: "Kokoro",
      voice: config.voice,
      ready: upstream.ok && data.ready === true,
      state: data.state || (upstream.ok ? "loading" : "unavailable"),
      error: data.error || null
    });
  } catch {
    sendJson(response, 200, {
      provider: "system",
      voice: null,
      ready: false,
      state: "unavailable"
    });
  }
}

async function synthesizeSpeech(request, response) {
  try {
    const rawBody = await readRequestBody(request, 64 * 1024);
    const body = JSON.parse(rawBody.toString("utf8"));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 1200) {
      sendJson(response, 400, { error: "Texto vazio ou muito longo para a voz." });
      return;
    }

    const config = createVoiceConfig();
    const upstream = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kokoro",
        input: text,
        voice: config.voice,
        response_format: "wav",
        speed: config.speed
      }),
      signal: AbortSignal.timeout(90000)
    });

    if (!upstream.ok) {
      const data = await readGroqResponse(upstream);
      sendJson(response, upstream.status, {
        error: data.error || "A voz neural local ainda nao esta pronta."
      });
      return;
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(200, {
      "Content-Type": upstream.headers.get("content-type") || "audio/wav",
      "Content-Length": audio.length,
      "Cache-Control": "no-store"
    });
    response.end(audio);
  } catch (error) {
    const invalidJson = error instanceof SyntaxError;
    console.error("Falha na voz neural local:", error);
    sendJson(response, invalidJson ? 400 : 503, {
      error: invalidJson
        ? "JSON invalido."
        : "Voz neural indisponivel. Execute npm run voice:setup."
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
      const config = createGroqConfig();
      const voiceConfig = createVoiceConfig();
      sendJson(response, 200, {
        assistant: "Alex",
        provider: "Groq",
        chatModel: config.chatModel,
        sttModel: config.sttModel,
        reasoningEffort: config.reasoningEffort,
        webSearchEnabled: config.webSearchEnabled,
        apiKeyConfigured: Boolean(process.env.GROQ_API_KEY),
        ttsProvider: "Kokoro",
        ttsVoice: voiceConfig.voice
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/voice/status") {
      await voiceStatus(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/transcribe") {
      await transcribe(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/respond") {
      await respond(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/speech") {
      await synthesizeSpeech(request, response);
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

