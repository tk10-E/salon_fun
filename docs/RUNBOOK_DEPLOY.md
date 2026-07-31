# Runbook de Deploy e Rollback

Este runbook cobre o deploy do painel web (`apps/web`) e das migrations/funcoes do Supabase.

## 1) Checklist pre-deploy

- Confirmar variaveis obrigatorias no ambiente alvo (`apps/web/.env.example` como referencia).
- Validar CI verde em `main` (web + mobile).
- Validar migrations pendentes com `supabase db push` em ambiente de teste.
- Garantir que segredos sensiveis (Stripe/Meta/WhatsApp) estao atualizados.

## 2) Deploy web (Vercel)

1. Confirmar `APP_URL` com dominio final.
2. Publicar `apps/web` no projeto correto da Vercel.
3. Validar healthcheck manual:
   - login no painel
   - acesso ao dashboard
   - operacao basica de leitura (ex.: lista de agendamentos)

## 3) Deploy banco/funcoes (Supabase)

1. Aplicar migrations:

```bash
supabase db push
```

2. Publicar funcoes edge necessarias:

```bash
supabase functions deploy firebase-auth-bridge --no-verify-jwt
```

3. Validar:
   - autenticacao Firebase -> Supabase
   - webhooks criticos (quando aplicavel)

## 4) Verificacao pos-deploy

- Fluxo de login funciona sem erro.
- Dashboard carrega sem erros de permissao.
- Fluxo critico de agendamento funciona (criar/atualizar status).
- Fluxo critico de pagamento nao apresenta regressao.
- Logs sem aumento anormal de erros 5xx/4xx.

## 5) Rollback

### Web

- Reverter para o deploy anterior na Vercel.
- Revalidar login e dashboard.

### Banco

- Se migration for aditiva e segura, preferir hotfix incremental.
- Se migration causar impacto funcional, interromper rollout web e aplicar script de reversao planejado.
- Toda migration nova deve prever estrategia de rollback antes do deploy.

## 6) Incidente e escalacao

- Registrar horario de inicio/fim e impacto.
- Identificar dominio impactado (`auth`, `agenda`, `pagamentos`, `notificacoes`).
- Acionar responsavel tecnico do dominio.
- Publicar status de mitigacao e proximo passo.
