# Arquitetura inicial

## Fluxo de voz

1. O navegador pede permissao para usar o microfone.
2. Um detector de silencio local encerra a gravacao quando o usuario termina de falar.
3. O backend envia somente essa fala para o Groq Whisper.
4. O texto transcrito e enviado ao modelo de conversa hospedado na Groq.
5. O navegador reproduz a resposta usando uma voz `pt-BR` instalada no sistema.
6. A chave da Groq permanece somente no backend.

## Componentes planejados

- `voice`: gravacao por turno, deteccao local de silencio e fala sintetizada pelo sistema.
- `wake-word`: deteccao local da palavra "Alex" sem transmitir audio continuamente.
- `tools`: pesquisas e chamadas de funcoes autorizadas.
- `home`: integracao com Home Assistant para luzes e dispositivos.
- `tv`: adaptadores especificos para Android/Google TV, Samsung ou LG.
- `security`: permissoes, confirmacoes e registro de acoes.

## Limite do primeiro marco

Esta versao oferece uma conversa por voz em etapas: Groq Whisper, modelo de conversa e voz local. Wake word, pesquisas, luzes e TV serao adicionados em branches separadas depois que os modelos dos equipamentos forem confirmados.

A palavra de ativacao devera ser detectada localmente. Assim, o Alex pode aguardar o chamado sem enviar audio continuamente e sem gerar custo de API enquanto o ambiente esta silencioso.

