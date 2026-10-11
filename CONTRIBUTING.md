# Como contribuir

## Fluxo obrigatorio

1. Atualize a branch principal.
2. Crie uma branch para cada conjunto de mudancas:
   - `feat/nome-da-funcionalidade`
   - `fix/nome-do-problema`
   - `docs/nome-da-documentacao`
   - `chore/nome-da-tarefa`
3. Rode `npm run check`.
4. Crie o commit. O hook adiciona automaticamente:
   `Co-authored-by: gustavoLoes <gustavoloes7@gmail.com>`
5. Revise o diff antes de integrar na branch principal.

Commits diretos em `main` e `master` sao bloqueados pelo hook versionado em `.githooks/`.

