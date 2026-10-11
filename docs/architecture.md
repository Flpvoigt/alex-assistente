# Arquitetura inicial

## Fluxo de voz

1. O navegador pede permissao para usar o microfone.
2. O backend troca a chave permanente da xAI por um token temporario.
3. O navegador conecta diretamente ao Grok Voice por WebSocket usando esse token.
4. A chave permanente permanece somente no backend.
5. O navegador converte o microfone para PCM 24 kHz e reproduz a resposta em fluxo.
6. A sessao e encerrada automaticamente apos cinco minutos para limitar custos.

## Componentes planejados

- `voice`: conversa em tempo real, interrupcoes e recuperacao de conexao.
- `wake-word`: deteccao local da palavra "Alex" sem transmitir audio continuamente.
- `tools`: pesquisas e chamadas de funcoes autorizadas.
- `home`: integracao com Home Assistant para luzes e dispositivos.
- `tv`: adaptadores especificos para Android/Google TV, Samsung ou LG.
- `security`: permissoes, confirmacoes e registro de acoes.

## Limite do primeiro marco

Esta versao oferece a base web de conversa por voz com Grok. Wake word, pesquisas, luzes e TV serao adicionados em branches separadas depois que os modelos dos equipamentos forem confirmados. O wake word devera ser local para que uma sessao paga nao fique aberta enquanto o Alex aguarda o chamado.

