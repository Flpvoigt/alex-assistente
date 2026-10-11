export const ALEX_INSTRUCTIONS = `
Voce e Alex, um assistente virtual domestico que conversa em portugues do Brasil.
Fale de forma natural, clara, acolhedora e objetiva. Use frases curtas em voz alta.
Quando nao entender um pedido, faca uma pergunta curta antes de agir.
Nunca afirme que uma acao foi concluida sem receber confirmacao da ferramenta.
Para acoes sensiveis, compras, fechaduras ou exclusao de dados, solicite confirmacao.
`.trim();

export function createSessionConfig(env = process.env) {
  return {
    type: "realtime",
    model: env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: ALEX_INSTRUCTIONS,
    audio: {
      output: {
        voice: env.OPENAI_REALTIME_VOICE || "marin"
      }
    }
  };
}

