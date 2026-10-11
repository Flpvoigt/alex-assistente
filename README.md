# Alex

Alex e um assistente virtual domestico por voz, projetado para conversar em portugues do Brasil e, em etapas futuras, pesquisar na internet, controlar luzes e integrar-se a televisao.

## Estado atual

O primeiro marco inclui:

- interface web responsiva;
- captura de microfone com cancelamento de eco, reducao de ruido e parada por silencio;
- transcricao em portugues com Groq Whisper Large V3 Turbo;
- respostas em streaming pelo GPT-OSS 120B executado na Groq;
- conversa continua depois de um unico clique, retomando a escuta a cada resposta;
- interrupcao manual da resposta para o usuario voltar a falar imediatamente;
- voz neural local gratuita Kokoro `pm_alex`, masculina e brasileira;
- selecao persistente com uma voz masculina do sistema como reserva;
- fala iniciada por frases enquanto o restante da resposta ainda esta sendo gerado;
- chave da Groq protegida no backend;
- configuracao pronta para o VS Code;
- testes basicos e regras de contribuicao;
- hooks que bloqueiam commits na branch principal e adicionam o coautor obrigatorio.

## Requisitos

- Node.js 20 ou superior;
- uma chave da API da Groq;
- navegador moderno com acesso ao microfone.

## Executar

```bash
cp .env.example .env
```

Preencha `GROQ_API_KEY` no arquivo `.env`. Na primeira instalacao, prepare a voz gratuita:

```bash
npm run voice:setup
```

Depois execute:

```bash
npm start
```

Abra `http://127.0.0.1:3000`, teste a voz escolhida e pressione **Iniciar conversa**.

Para desenvolvimento com reinicio automatico:

```bash
npm run voice
npm run dev
```

Use dois terminais nesse modo. A tarefa **Alex: iniciar** do VS Code usa o modo completo e inicia ambos automaticamente.

## Verificar

```bash
npm run check
```

## Seguranca

O arquivo `.env` e ignorado pelo Git. A chave permanente nunca deve ser colocada em `public/` nem enviada ao navegador. O microfone so e iniciado apos uma acao do usuario e para automaticamente quando detecta silencio.

## Voz neural gratuita do Alex

A Groq oferece transcricao multilingue, mas o TTS documentado atualmente nao possui portugues. Por isso o Alex usa **Kokoro 82M** localmente, com a voz brasileira masculina `pm_alex`. O modelo e aberto, roda no computador e nao cobra por texto ou por fala.

Na primeira execucao, os pesos do modelo, de aproximadamente 355 MB, sao baixados e aquecidos. Isso pode levar alguns minutos. Depois eles ficam no cache local. O comando `npm start` inicia o Alex e o servico de voz juntos.

Se o Kokoro ainda estiver carregando ou falhar, o Alex usa uma voz masculina `pt-BR` instalada no sistema. A opcao **Testar** permite ouvir a voz antes de iniciar. Para desativar o inicio automatico do Kokoro, configure `ALEX_TTS_AUTOSTART=false`.

A voz exata do ChatGPT e proprietaria e nao faz parte da API da Groq. Esta implementacao busca a mesma sensacao de conversa — baixa espera, frases curtas, ritmo suave e possibilidade de interromper — sem afirmar que reproduz aquela voz.

## Proximos marcos

1. Palavra de ativacao local "Alex".
2. Pesquisa na internet por ferramentas controladas no backend.
3. Integracao com Home Assistant e luzes.
4. Adaptador da TV conforme marca, modelo e sistema operacional.
5. Modo dispositivo sempre ativo e recuperacao automatica de falhas.

Consulte [a arquitetura](docs/architecture.md) e [o fluxo de contribuicao](CONTRIBUTING.md).

