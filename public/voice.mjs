const MALE_NAMES = [
  "eddy",
  "antonio",
  "fabio",
  "felipe",
  "thiago",
  "joao",
  "carlos",
  "bruno",
  "marcelo",
  "guilherme",
  "mateus",
  "reed",
  "rocko",
  "grandpa",
  "daniel",
  "paulo",
  "ricardo",
  "masculino",
  "male"
];

const FEMALE_NAMES = [
  "luciana",
  "joana",
  "maria",
  "francisca",
  "flo",
  "grandma",
  "sandy",
  "shelley",
  "feminina",
  "female"
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(value, candidates) {
  return candidates.some((candidate) => value.includes(candidate));
}

export function isPortugueseVoice(voice) {
  const language = normalize(voice?.lang).replace("_", "-");
  const name = normalize(voice?.name);
  return language.startsWith("pt") || name.includes("portugues") || name.includes("brazil");
}

export function isLikelyMaleVoice(voice) {
  const name = normalize(`${voice?.name || ""} ${voice?.voiceURI || ""}`);
  return includesAny(name, MALE_NAMES) && !includesAny(name, FEMALE_NAMES);
}

export function rankVoice(voice, savedVoiceUri = "") {
  if (!isPortugueseVoice(voice)) return -10000;

  const name = normalize(`${voice?.name || ""} ${voice?.voiceURI || ""}`);
  if (includesAny(name, FEMALE_NAMES)) return -5000;

  let score = 100;
  if (normalize(voice?.lang).replace("_", "-") === "pt-br") score += 100;
  if (isLikelyMaleVoice(voice)) score += 500;
  if (name.includes("eddy")) score += 160;
  if (includesAny(name, ["natural", "neural", "premium", "enhanced"])) score += 220;
  if (voice?.localService) score += 15;
  if (voice?.voiceURI === savedVoiceUri) score += 1000;
  return score;
}

export function listPortugueseMaleVoices(voices, savedVoiceUri = "") {
  return [...voices]
    .filter(
      (voice) => isPortugueseVoice(voice) && isLikelyMaleVoice(voice) && rankVoice(voice, savedVoiceUri) > 0
    )
    .sort((left, right) => rankVoice(right, savedVoiceUri) - rankVoice(left, savedVoiceUri));
}

export function normalizeSpeechText(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " trecho de código ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/〖[^〗]+〗/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

