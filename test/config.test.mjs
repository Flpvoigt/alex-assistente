import assert from "node:assert/strict";
import test from "node:test";

import { createGroqConfig, createVoiceConfig, sanitizeHistory } from "../src/config.mjs";

test("usa modelos Groq de producao por padrao", () => {
  const config = createGroqConfig({});

  assert.equal(config.chatModel, "openai/gpt-oss-120b");
  assert.equal(config.sttModel, "whisper-large-v3-turbo");
  assert.equal(config.webSearchEnabled, true);
});

test("aceita modelos configurados pelo ambiente", () => {
  const config = createGroqConfig({
    GROQ_CHAT_MODEL: "chat-de-teste",
    GROQ_STT_MODEL: "stt-de-teste"
  });

  assert.equal(config.chatModel, "chat-de-teste");
  assert.equal(config.sttModel, "stt-de-teste");
});

test("permite desligar a pesquisa integrada", () => {
  assert.equal(createGroqConfig({ ALEX_WEB_SEARCH: "false" }).webSearchEnabled, false);
});

test("limita e limpa o historico enviado ao modelo", () => {
  const history = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `mensagem-${index}`
  }));
  history.push({ role: "system", content: "ignorar" });

  const sanitized = sanitizeHistory(history);

  assert.equal(sanitized.length, 12);
  assert.equal(sanitized[0].content, "mensagem-2");
  assert.equal(sanitized.at(-1).content, "mensagem-13");
});

test("configura a voz neural masculina local com velocidade segura", () => {
  const defaults = createVoiceConfig({});
  assert.equal(defaults.voice, "pm_alex");
  assert.equal(defaults.speed, 0.94);

  assert.equal(createVoiceConfig({ KOKORO_TTS_SPEED: "9" }).speed, 1.25);
  assert.equal(createVoiceConfig({ KOKORO_TTS_SPEED: "invalida" }).speed, 0.94);
});

