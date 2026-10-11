# Arquitetura inicial

## Fluxo de voz

1. O navegador pede permissao para usar o microfone.
2. O navegador cria uma conexao WebRTC.
3. O backend envia a oferta SDP para a OpenAI Realtime API.
4. A chave permanente permanece somente no backend.
5. O audio do usuario e a resposta do Alex trafegam pelos canais WebRTC.

## Componentes planejados

- `voice`: conversa em tempo real, interrupcoes e recuperacao de conexao.
- `wake-word`: deteccao local da palavra "Alex" sem transmitir audio continuamente.
- `tools`: pesquisas e chamadas de funcoes autorizadas.
- `home`: integracao com Home Assistant para luzes e dispositivos.
- `tv`: adaptadores especificos para Android/Google TV, Samsung ou LG.
- `security`: permissoes, confirmacoes e registro de acoes.

## Limite do primeiro marco

Esta versao oferece a base web de conversa por voz. Wake word, pesquisas, luzes e TV serao adicionados em branches separadas depois que os modelos dos equipamentos forem confirmados.

