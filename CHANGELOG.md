# Changelog

## v2.0.0 - 2026-04-01

Primeiro release formal da plataforma Salon Fun com a nova experiência premium e base pronta para operação mais séria.

### Destaques

- painel web evoluído para uma experiência mais executiva, com configuração mais rica do salão e do app cliente
- app mobile reconstruído para uma jornada premium white-label com onboarding, feed, agenda, notificações e experiência visual nova
- fluxo de identidade Firebase + Supabase endurecido para exigir confirmação de e-mail antes de vincular sessão sensível por e-mail e liberar bridge com o backend
- novas migrations e ajustes operacionais no Supabase para onboarding, catálogo, automações, notificações, CRM, operações e proteção de dados do cliente
- documentação e setup atualizados para `APP_URL`, seed local do Supabase e fluxo de verificação de e-mail no app cliente

### Verificações executadas

- `npm test` em `apps/web`
- `npm run build` em `apps/web`
- `flutter analyze` em `apps/mobile`
- `flutter test` em `apps/mobile`

### Observações de deploy

- rode `supabase db push` para aplicar as migrations novas antes de publicar
- configure `APP_URL` no painel web com o domínio canônico do ambiente
- mantenha `apps/mobile/android/app/google-services.json` apenas localmente ou no CI seguro; ele não faz parte do release versionado
