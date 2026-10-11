# Regras de trabalho do projeto Alex

- Nunca implemente alteracoes diretamente em `main` ou `master`.
- Antes de modificar arquivos, crie uma branch curta e descritiva (`feat/`, `fix/`, `docs/`, `refactor/` ou `chore/`).
- Todo commit deve conter exatamente este trailer:
  `Co-authored-by: gustavoLoes <gustavoloes7@gmail.com>`
- Nao exponha `XAI_API_KEY`, tokens de dispositivos ou dados pessoais no frontend, em logs ou em commits.
- Execute `npm run check` antes de concluir uma alteracao.
- Acoes fisicas sensiveis devem exigir confirmacao explicita do usuario.

