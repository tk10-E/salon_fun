## Contexto

Descreva o problema, contexto de negocio e impacto esperado.

## Mudancas propostas

- 
- 

## Riscos e mitigacao

- **Risco principal:** 
- **Mitigacao:** 
- **Rollback:** referenciar `docs/RUNBOOK_DEPLOY.md` quando aplicavel.

## Escopo afetado

- [ ] `apps/web`
- [ ] `apps/mobile`
- [ ] `supabase` (migrations/functions)
- [ ] `docs`
- [ ] `.github/workflows`

## Plano de testes

### Web
- [ ] `cd apps/web && npm run lint`
- [ ] `cd apps/web && npm test`

### Mobile
- [ ] `cd apps/mobile && dart format --output=none --set-exit-if-changed lib test`
- [ ] `cd apps/mobile && flutter analyze`
- [ ] `cd apps/mobile && flutter test`

### Supabase (quando aplicavel)
- [ ] `supabase db push` em ambiente de teste
- [ ] Validacao de fluxo impactado (ex.: auth bridge, webhook, agendamento)

## Evidencias

Inclua prints, logs, ou observacoes relevantes para facilitar a revisao.

## Checklist final

- [ ] CI passou (`dependency-review`, `build-test-lint`, `mobile-quality`)
- [ ] Conversas de review resolvidas
- [ ] Documentacao atualizada (se necessario)
