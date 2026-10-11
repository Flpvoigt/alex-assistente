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
- selecao persistente de voz masculina `pt-BR`, com prioridade para vozes suaves ou neurais;
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

Preencha `GROQ_API_KEY` no arquivo `.env` e execute:

```bash
npm start
```

Abra `http://127.0.0.1:3000`, teste a voz escolhida e pressione **Iniciar conversa**.

Para desenvolvimento com reinicio automatico:

```bash
npm run dev
```

## Verificar

```bash
npm run check
```

## Seguranca

O arquivo `.env` e ignorado pelo Git. A chave permanente nunca deve ser colocada em `public/` nem enviada ao navegador. O microfone so e iniciado apos uma acao do usuario e para automaticamente quando detecta silencio.

## Voz masculina do Alex

A Groq oferece transcricao multilingue, mas o TTS documentado atualmente nao possui portugues. Por isso esta versao usa uma voz `pt-BR` instalada no aparelho, sem custo adicional.

O Alex ignora vozes femininas conhecidas e prioriza, nesta ordem, opcoes masculinas brasileiras suaves como **Eddy**, **Antonio**, **Fabio**, **Felipe**, **Thiago**, **Reed** e **Rocko**. A escolha fica salva no navegador. O ritmo e o tom foram reduzidos levemente para evitar uma fala acelerada ou metalica.

No macOS, abra **Ajustes do Sistema > Acessibilidade > Conteudo Falado > Voz do Sistema > Gerenciar Vozes**, baixe uma voz masculina em Portugues (Brasil) e recarregue a pagina. Em outros aparelhos, instale uma voz neural `pt-BR` nas configuracoes de acessibilidade ou sintese de voz. A opcao **Testar** permite comparar as vozes antes de iniciar.

A voz exata do ChatGPT e proprietaria e nao faz parte da API da Groq. Esta implementacao busca a mesma sensacao de conversa — baixa espera, frases curtas, ritmo suave e possibilidade de interromper — sem afirmar que reproduz aquela voz.

## Proximos marcos

1. Voz neural local propria com Kokoro e voz masculina `pm_alex`, sem depender das vozes do aparelho.
2. Palavra de ativacao local "Alex".
3. Pesquisa na internet por ferramentas controladas no backend.
4. Integracao com Home Assistant e luzes.
5. Adaptador da TV conforme marca, modelo e sistema operacional.
6. Modo dispositivo sempre ativo e recuperacao automatica de falhas.

Consulte [a arquitetura](docs/architecture.md) e [o fluxo de contribuicao](CONTRIBUTING.md).

