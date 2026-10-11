# Arquitetura inicial

## Fluxo de voz

1. O navegador pede permissao para usar o microfone.
2. Um detector de silencio local encerra a gravacao quando o usuario termina de falar.
3. O backend envia somente essa fala para o Groq Whisper.
4. O texto transcrito e enviado ao modelo de conversa hospedado na Groq.
5. O backend repassa a resposta em streaming.
6. O navegador fala cada frase com a voz masculina `pt-BR` escolhida enquanto recebe o restante.
7. Ao terminar, a escuta recomeca automaticamente; o usuario tambem pode interromper a fala pelo botao.
8. A chave da Groq permanece somente no backend.

## Componentes planejados

- `voice`: conversa continua por turnos, deteccao local de silencio, streaming e selecao persistente de voz masculina.
- `wake-word`: deteccao local da palavra "Alex" sem transmitir audio continuamente.
- `tools`: pesquisas e chamadas de funcoes autorizadas.
- `home`: integracao com Home Assistant para luzes e dispositivos.
- `tv`: adaptadores especificos para Android/Google TV, Samsung ou LG.
- `security`: permissoes, confirmacoes e registro de acoes.

## Limite do primeiro marco

Esta versao oferece conversa continua por voz: Groq Whisper, modelo de conversa em streaming e voz local masculina. A interrupcao e feita pelo botao; ainda nao ha barge-in automatico por voz. Wake word, pesquisas, luzes e TV serao adicionados em branches separadas depois que os modelos dos equipamentos forem confirmados.

A palavra de ativacao devera ser detectada localmente. Assim, o Alex pode aguardar o chamado sem enviar audio continuamente e sem gerar custo de API enquanto o ambiente esta silencioso.

