import assert from "node:assert/strict";
import test from "node:test";

import { createSessionConfig } from "../src/config.mjs";

test("usa configuracao padrao segura para voz", () => {
  const config = createSessionConfig({});

  assert.equal(config.type, "realtime");
  assert.equal(config.model, "gpt-realtime-2.1");
  assert.equal(config.audio.output.voice, "marin");
  assert.match(config.instructions, /Alex/);
  assert.match(config.instructions, /portugues do Brasil/);
});

test("aceita modelo e voz configurados pelo ambiente", () => {
  const config = createSessionConfig({
    OPENAI_REALTIME_MODEL: "modelo-de-teste",
    OPENAI_REALTIME_VOICE: "voz-de-teste"
  });

  assert.equal(config.model, "modelo-de-teste");
  assert.equal(config.audio.output.voice, "voz-de-teste");
});

