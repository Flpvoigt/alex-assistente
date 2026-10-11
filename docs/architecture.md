# Arquitetura inicial

## Fluxo de voz

1. O navegador pede permissao para usar o microfone.
2. Um detector de silencio local encerra a gravacao quando o usuario termina de falar.
3. O backend envia somente essa fala para o Groq Whisper.
4. O texto transcrito e enviado ao modelo de conversa hospedado na Groq.
5. O backend repassa a resposta em streaming.
6. O backend gera cada frase localmente no Kokoro com a voz brasileira masculina `pm_alex`.
7. O navegador recebe e toca o WAV enquanto o restante da resposta continua sendo recebido.
8. Ao terminar, a escuta recomeca automaticamente; o usuario tambem pode interromper a fala pelo botao.
9. A chave da Groq permanece somente no backend e a voz local nao usa chave.

## Componentes planejados

- `voice`: Kokoro local, conversa continua por turnos, deteccao de silencio, streaming e reserva masculina do sistema.
- `wake-word`: deteccao local da palavra "Alex" sem transmitir audio continuamente.
- `tools`: pesquisas e chamadas de funcoes autorizadas.
- `home`: integracao com Home Assistant para luzes e dispositivos.
- `tv`: adaptadores especificos para Android/Google TV, Samsung ou LG.
- `security`: permissoes, confirmacoes e registro de acoes.

## Limite do primeiro marco

Esta versao oferece conversa continua por voz: Groq Whisper, modelo de conversa em streaming e Kokoro local com `pm_alex`. A interrupcao e feita pelo botao; ainda nao ha barge-in automatico por voz. Wake word, pesquisas, luzes e TV serao adicionados em branches separadas depois que os modelos dos equipamentos forem confirmados.

A palavra de ativacao devera ser detectada localmente. Assim, o Alex pode aguardar o chamado sem enviar audio continuamente e sem gerar custo de API enquanto o ambiente esta silencioso.

