export const MAX_HISTORY_MESSAGES = 30;
export const MAX_HISTORY_CHARACTERS = 30000;

export const ALEX_INSTRUCTIONS = `
Voce e Alex, um assistente virtual pessoal que conversa em portugues do Brasil.
Sua fala deve soar humana, calma e espontanea. Responda primeiro ao ponto principal e use frases faceis de ouvir.
Nao repita a pergunta, nao use saudacoes desnecessarias e evite iniciar toda resposta com "claro" ou "com certeza".
Por padrao, responda em uma a tres frases. Aprofunde quando o usuario pedir detalhes ou quando uma resposta curta puder induzir a erro.
Mantenha a continuidade da conversa: entenda referencias como "isso", "ele" e "continue" usando o historico disponivel.
Quando houver ambiguidade que realmente mude a resposta, faca somente uma pergunta curta. Caso contrario, adote a interpretacao mais provavel.
Nao use Markdown, tabelas, listas longas, emojis ou simbolos dificeis de pronunciar nas respostas faladas.
Use pesquisa somente quando a resposta depender de informacao atual, local ou verificacao externa. Nao pesquise conversas casuais nem conhecimento estavel.
Quando pesquisar, integre o resultado naturalmente e nao leia enderecos, marcadores de citacao ou nomes de sites sem necessidade.
Admita quando nao souber. Nunca invente fatos, resultados de pesquisa ou a conclusao de uma acao.
Para acoes sensiveis, compras, fechaduras ou exclusao de dados, solicite confirmacao explicita.
`.trim();

export function createAlexInstructions({ now = new Date(), timeZone = "America/Sao_Paulo" } = {}) {
  let localDateTime;
  try {
    localDateTime = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone
    }).format(now);
  } catch {
    localDateTime = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(now);
  }

  return `${ALEX_INSTRUCTIONS}\nContexto atual: ${localDateTime}. Fuso horario: ${timeZone}.`;
}

export function createGroqConfig(env = process.env) {
  const supportedReasoningEfforts = new Set(["low", "medium", "high"]);
  const requestedReasoningEffort = String(env.GROQ_REASONING_EFFORT || "low").toLowerCase();

  return {
    chatModel: env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b",
    sttModel: env.GROQ_STT_MODEL || "whisper-large-v3-turbo",
    webSearchEnabled: env.ALEX_WEB_SEARCH !== "false",
    reasoningEffort: supportedReasoningEfforts.has(requestedReasoningEffort)
      ? requestedReasoningEffort
      : "low"
  };
}

export function createVoiceConfig(env = process.env) {
  const parsedSpeed = Number(env.KOKORO_TTS_SPEED || 0.94);
  return {
    url: env.KOKORO_TTS_URL || "http://127.0.0.1:8787/v1/audio/speech",
    healthUrl: env.KOKORO_HEALTH_URL || "http://127.0.0.1:8787/health",
    voice: env.KOKORO_TTS_VOICE || "pm_alex",
    speed: Number.isFinite(parsedSpeed) ? Math.min(1.25, Math.max(0.75, parsedSpeed)) : 0.94
  };
}

export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  const validMessages = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, 6000)
    }));

  const selected = [];
  let characterCount = 0;
  for (let index = validMessages.length - 1; index >= 0; index -= 1) {
    const item = validMessages[index];
    const available = MAX_HISTORY_CHARACTERS - characterCount;
    if (available <= 0) break;

    selected.unshift({
      role: item.role,
      content: item.content.slice(-available)
    });
    characterCount += Math.min(item.content.length, available);
  }

  return selected;
}

