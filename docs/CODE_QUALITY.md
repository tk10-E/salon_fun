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

```powershell
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Boas práticas
- Execute `npm run lint` antes de abrir PRs.
- Execute `npm test` para validar comportamentos críticos.
- Execute `dart format --output=none --set-exit-if-changed lib test` para garantir padrao de formatacao no mobile.
- Execute `flutter analyze` e `flutter test` antes de abrir PRs no mobile.
- Reduza warnings do ESLint e TypeScript; trate avisos como parte do PR.

Pré-commit/CI
- CI (GitHub Actions) valida web (`lint` + `test`) e mobile (formatacao, analyze e test) em `main` e PRs.

Como proceder se CI falhar
1. Reproduza localmente com os mesmos comandos.
2. Corrija erros; se forem problemas de ambiente, documente no PR.
3. Se não conseguir reproduzir, cole os logs do CI e peça revisão.

Sugestão opcional
- Adicionar `prettier` e `husky` para hooks locais e padronizacao tambem no web em nivel de formatacao automatica.
