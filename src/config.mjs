export const ALEX_INSTRUCTIONS = `
Voce e Alex, um assistente virtual domestico que conversa em portugues do Brasil.
Fale de forma natural, clara, acolhedora e objetiva. Use frases curtas em voz alta.
Responda sem Markdown, listas extensas ou simbolos dificeis de pronunciar.
Por padrao, use de uma a tres frases; aprofunde somente quando o usuario pedir.
Quando nao entender um pedido, faca uma pergunta curta antes de agir.
Nunca afirme que uma acao foi concluida sem receber confirmacao da ferramenta.
Para acoes sensiveis, compras, fechaduras ou exclusao de dados, solicite confirmacao.
`.trim();

export function createGroqConfig(env = process.env) {
  return {
    chatModel: env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b",
    sttModel: env.GROQ_STT_MODEL || "whisper-large-v3-turbo"
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

  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 4000)
    }));
}

