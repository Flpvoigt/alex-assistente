import assert from "node:assert/strict";
import test from "node:test";

import {
  isLikelyMaleVoice,
  listPortugueseMaleVoices,
  normalizeSpeechText,
  rankVoice
} from "../public/voice.mjs";

const voice = (name, lang = "pt-BR", localService = true) => ({
  name,
  lang,
  localService,
  voiceURI: name
});

test("prioriza uma voz neural masculina brasileira e rejeita vozes femininas", () => {
  const voices = [voice("Luciana"), voice("Microsoft Antonio Online (Natural)"), voice("Eddy")];
  const ranked = listPortugueseMaleVoices(voices);

  assert.equal(ranked[0].name, "Microsoft Antonio Online (Natural)");
  assert.equal(ranked[1].name, "Eddy");
  assert.equal(ranked.some((item) => item.name === "Luciana"), false);
});

test("reconhece nomes masculinos e rejeita uma voz feminina conhecida", () => {
  assert.equal(isLikelyMaleVoice(voice("Fabio Neural")), true);
  assert.equal(isLikelyMaleVoice(voice("Luciana")), false);
  assert.ok(rankVoice(voice("Luciana")) < 0);
  assert.equal(listPortugueseMaleVoices([voice("Voz padrao")]).length, 0);
});

test("mantem a escolha salva acima da preferencia automatica", () => {
  const voices = [voice("Eddy"), voice("Reed")];
  const ranked = listPortugueseMaleVoices(voices, "Reed");

  assert.equal(ranked[0].name, "Reed");
});

test("remove marcacao, citacoes e enderecos que deixariam a fala robotica", () => {
  const text = "Veja **a previsão** em [Fonte](https://exemplo.com) 〖2†L6-L10〗 ou https://exemplo.com/agora.";

  assert.equal(normalizeSpeechText(text), "Veja a previsão em Fonte ou");
});
