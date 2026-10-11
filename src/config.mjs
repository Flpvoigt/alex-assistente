export const ALEX_INSTRUCTIONS = `
Voce e Alex, um assistente virtual domestico que conversa em portugues do Brasil.
Fale de forma natural, clara, acolhedora e objetiva. Use frases curtas em voz alta.
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

