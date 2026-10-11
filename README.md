# Alex

Alex e um assistente virtual domestico por voz, projetado para conversar em portugues do Brasil e, em etapas futuras, pesquisar na internet, controlar luzes e integrar-se a televisao.

## Estado atual

O primeiro marco inclui:

- interface web responsiva;
- captura de microfone com cancelamento de eco e reducao de ruido;
- conversa de voz pela OpenAI Realtime API usando WebRTC;
- chave da API protegida no backend;
- configuracao pronta para o VS Code;
- testes basicos e regras de contribuicao;
- hooks que bloqueiam commits na branch principal e adicionam o coautor obrigatorio.

## Requisitos

- Node.js 20 ou superior;
- uma chave da API da OpenAI com acesso ao modelo Realtime;
- navegador moderno com acesso ao microfone.

## Executar

```bash
cp .env.example .env
```

Preencha `OPENAI_API_KEY` no arquivo `.env` e execute:

```bash
npm start
```

Abra `http://127.0.0.1:3000` e pressione **Conversar com Alex**.

Para desenvolvimento com reinicio automatico:

```bash
npm run dev
```

## Verificar

```bash
npm run check
```

## Seguranca

O arquivo `.env` e ignorado pelo Git. A chave permanente nunca deve ser colocada em `public/` nem enviada ao navegador. O microfone so e iniciado apos uma acao do usuario.

## Proximos marcos

1. Palavra de ativacao local "Alex".
2. Pesquisa na internet por ferramentas controladas no backend.
3. Integracao com Home Assistant e luzes.
4. Adaptador da TV conforme marca, modelo e sistema operacional.
5. Modo dispositivo sempre ativo e recuperacao automatica de falhas.

Consulte [a arquitetura](docs/architecture.md) e [o fluxo de contribuicao](CONTRIBUTING.md).

