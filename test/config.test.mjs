import assert from "node:assert/strict";
import test from "node:test";

import { createGroqConfig, sanitizeHistory } from "../src/config.mjs";

test("usa modelos Groq de producao por padrao", () => {
  const config = createGroqConfig({});

  assert.equal(config.chatModel, "openai/gpt-oss-120b");
  assert.equal(config.sttModel, "whisper-large-v3-turbo");
});

test("aceita modelos configurados pelo ambiente", () => {
  const config = createGroqConfig({
    GROQ_CHAT_MODEL: "chat-de-teste",
    GROQ_STT_MODEL: "stt-de-teste"
  });

  assert.equal(config.chatModel, "chat-de-teste");
  assert.equal(config.sttModel, "stt-de-teste");
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

