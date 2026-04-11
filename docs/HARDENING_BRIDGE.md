# Hardening: `firebase-auth-bridge` e rotação de secrets

Checklist com passos seguros para operar a função bridge (Firebase → Supabase) em produção.

1) Restringir acesso e origem
- Defina uma variável de ambiente `ALLOWED_BRIDGE_ORIGINS` contendo as origens (domínios) permitidas.
- Na função (`supabase/functions/firebase-auth-bridge/index.ts`) valide `Origin` e rejeite requisições de origens não autorizadas.

2) Segredos e rotação de `SUPABASE_SERVICE_ROLE_KEY`
- Para rotacionar a chave do Supabase com mínimo downtime:
  1. Crie a nova chave (Supabase Console → Settings → API).
  2. Atualize o segredo nos ambientes (Vercel / runner CI / Secrets Manager) com a nova chave em um nome temporário, ex.: `SUPABASE_SERVICE_ROLE_KEY_NEW`.
  3. Atualize a função e serviços para ler `SUPABASE_SERVICE_ROLE_KEY_NEW` quando disponível (feature flag) e valide em staging.
  4. Após validação, promova `SUPABASE_SERVICE_ROLE_KEY_NEW` para `SUPABASE_SERVICE_ROLE_KEY` (substitua) e reinicie / re-deploy dos serviços.
  5. Revoke a chave antiga no Console do Supabase.

3) Logging e auditoria
- Instrumente a função para enviar erros e eventos importantes (criação/atualização de usuário) para Sentry/Datadog.
- Capture o `firebase_user.localId` e `email` no log de auditoria (sem gravar senhas).

4) Segurança adicional
- Use `security definer` e grants mínimos no DB (já implementado), revise que a função não use credenciais de mais privilégio do que necessário.
- Considere limitar endpoints administrativos por IP ou VPN.

5) Testes e validação após mudança
- Teste o fluxo real de login: gerar `firebase_id_token` com uma conta de teste (email verificado) e validar que a bridge sincroniza o usuário no Supabase.
- Verifique criação/atualização no Supabase Auth Admin e retorno da senha efêmera.

6) Procedimento de emergência
- Se a bridge começar a falhar, desative temporariamente a bridge e altere o fluxo para login direto no Supabase (se aplicável), e abra investigação.

7) Observability e alertas
- Crie alertas para:
  - taxa de erro > X% nas funções (5xx)
  - falhas de sincronização de usuários
  - requisições de origens não autorizadas
