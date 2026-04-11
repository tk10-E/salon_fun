# Qualidade de Código — guia rápido

Objetivo: manter o repositório sem erros ou warnings em CI e em produção.

Comandos principais (na raiz do repo):

```powershell
cd apps/web
npm ci
npm run lint        # ESLint
npm test            # Vitest
npm run prisma:generate
```

Boas práticas
- Execute `npm run lint` antes de abrir PRs.
- Execute `npm test` para validar comportamentos críticos.
- Reduza warnings do ESLint e TypeScript; trate avisos como parte do PR.

Pré-commit/CI
- CI (GitHub Actions) já valida lint + tests em `main` e PRs.

Como proceder se CI falhar
1. Reproduza localmente com os mesmos comandos.
2. Corrija erros; se forem problemas de ambiente, documente no PR.
3. Se não conseguir reproduzir, cole os logs do CI e peça revisão.

Sugestão opcional
- Adicionar `prettier` e `husky` para formatação e hooks pre-commit.
