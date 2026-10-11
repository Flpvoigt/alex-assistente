export const ALEX_INSTRUCTIONS = `
Voce e Alex, um assistente virtual domestico que conversa em portugues do Brasil.
Fale de forma natural, clara, acolhedora e objetiva. Use frases curtas em voz alta.
Quando nao entender um pedido, faca uma pergunta curta antes de agir.
Nunca afirme que uma acao foi concluida sem receber confirmacao da ferramenta.
Para acoes sensiveis, compras, fechaduras ou exclusao de dados, solicite confirmacao.
`.trim();

export function createSessionConfig(env = process.env) {
  return {
    instructions: ALEX_INSTRUCTIONS,
    voice: env.XAI_VOICE || "eve",
    turn_detection: {
      type: "server_vad"
    },
    audio: {
      input: {
        format: {
          type: "audio/pcm",
          rate: 24000
        },
        transcription: {
          language_hint: "pt-BR",
          keyterms: ["Alex"]
        }
      },
      output: {
        format: {
          type: "audio/pcm",
          rate: 24000
        }
      }
    }
  };
}

export function getVoiceModel(env = process.env) {
  return env.XAI_VOICE_MODEL || "grok-voice-think-fast-2.0";
}

