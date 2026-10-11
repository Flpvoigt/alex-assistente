import assert from "node:assert/strict";
import test from "node:test";

import { createSessionConfig, getVoiceModel } from "../src/config.mjs";

test("usa configuracao padrao segura para a voz do Grok", () => {
  const config = createSessionConfig({});

  assert.equal(getVoiceModel({}), "grok-voice-think-fast-2.0");
  assert.equal(config.voice, "eve");
  assert.equal(config.turn_detection.type, "server_vad");
  assert.equal(config.audio.input.format.rate, 24000);
  assert.equal(config.audio.output.format.rate, 24000);
  assert.match(config.instructions, /Alex/);
  assert.match(config.instructions, /portugues do Brasil/);
});

test("aceita modelo e voz configurados pelo ambiente", () => {
  const config = createSessionConfig({
    XAI_VOICE: "voz-de-teste"
  });

  assert.equal(config.voice, "voz-de-teste");
  assert.equal(getVoiceModel({ XAI_VOICE_MODEL: "modelo-de-teste" }), "modelo-de-teste");
});

