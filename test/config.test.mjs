import assert from "node:assert/strict";
import test from "node:test";

import {
  createAlexInstructions,
  createGroqConfig,
  createVoiceConfig,
  MAX_HISTORY_CHARACTERS,
  MAX_HISTORY_MESSAGES,
  sanitizeHistory
} from "../src/config.mjs";

test("usa modelos Groq de producao por padrao", () => {
  const config = createGroqConfig({});

  assert.equal(config.chatModel, "openai/gpt-oss-120b");
  assert.equal(config.sttModel, "whisper-large-v3-turbo");
  assert.equal(config.webSearchEnabled, true);
  assert.equal(config.reasoningEffort, "low");
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

test("aceita somente niveis de raciocinio suportados pelo GPT OSS", () => {
  assert.equal(createGroqConfig({ GROQ_REASONING_EFFORT: "high" }).reasoningEffort, "high");
  assert.equal(createGroqConfig({ GROQ_REASONING_EFFORT: "invalido" }).reasoningEffort, "low");
});

test("limita e limpa o historico enviado ao modelo", () => {
  const history = Array.from({ length: MAX_HISTORY_MESSAGES + 2 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `mensagem-${index}`
  }));
  history.push({ role: "system", content: "ignorar" });

  const sanitized = sanitizeHistory(history);

  assert.equal(sanitized.length, MAX_HISTORY_MESSAGES);
  assert.equal(sanitized[0].content, "mensagem-2");
  assert.equal(sanitized.at(-1).content, `mensagem-${MAX_HISTORY_MESSAGES + 1}`);
});

test("respeita o orcamento total do historico", () => {
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: "x".repeat(3000)
  }));

  const sanitized = sanitizeHistory(history);
  const total = sanitized.reduce((sum, item) => sum + item.content.length, 0);

  assert.equal(total, MAX_HISTORY_CHARACTERS);
  assert.equal(sanitized.length, 10);
});

test("informa data, hora e fuso atuais ao Alex", () => {
  const instructions = createAlexInstructions({
    now: new Date("2026-10-11T15:30:00.000Z"),
    timeZone: "America/Sao_Paulo"
  });

  assert.match(instructions, /11 de outubro de 2026/);
  assert.match(instructions, /12:30/);
  assert.match(instructions, /America\/Sao_Paulo/);
});

test("configura a voz neural masculina local com velocidade segura", () => {
  const defaults = createVoiceConfig({});
  assert.equal(defaults.voice, "pm_alex");
  assert.equal(defaults.speed, 0.94);

  assert.equal(createVoiceConfig({ KOKORO_TTS_SPEED: "9" }).speed, 1.25);
  assert.equal(createVoiceConfig({ KOKORO_TTS_SPEED: "invalida" }).speed, 0.94);
});

