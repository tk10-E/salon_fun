# Performance Observability Runbook

## Objetivo

Detectar degradacao de performance cedo no painel e no app cliente, com dados reais.

## Fontes de sinal

1. Vercel Speed Insights
2. Vercel Web Analytics
3. Runtime logs no Vercel
4. Endpoint publico de performance:
   - `POST /api/public/observability/performance`
5. Logs estruturados de render no servidor:
   - `type: "server_render"`
6. Beacons do app cliente:
   - `type: "client_performance"`

## Eventos esperados

### Painel (web)

- Render lento ou erro:
  - log JSON com:
    - `type: "server_render"`
    - `label` da pagina
    - `duration_ms`
    - `outcome: "completed" | "failed"`
- Origem:
  - `apps/web/lib/serverPerformance.ts`

### App cliente (mobile)

- Operacao lenta ou falha:
  - log JSON com:
    - `type: "client_performance"`
    - `source: "mobile"`
    - `surface` (`agenda`, `feed`, `store`, `profile`, `auth`, `shell`)
    - `operation`
    - `duration_ms`
    - `severity: "slow" | "critical"`
    - `outcome: "ok" | "failed"`
- Origem:
  - `apps/mobile/lib/src/core/observability/client_performance_reporter.dart`
  - `apps/web/app/api/public/observability/performance/route.ts`

## SLO inicial recomendado

1. Painel:
   - `p95` de render server-side menor que `1200ms`
2. App cliente:
   - leituras criticas (`agenda`, `feed`, `store`) menor que `900ms` na maior parte das requisicoes
3. Erro:
   - nenhuma rota critica com `outcome: "failed"` recorrente por mais de 5 minutos

## Como investigar em producao

1. Abrir deployment atual no Vercel.
2. Abrir Runtime Logs e filtrar por:
   - `"type":"server_render"`
   - `"type":"client_performance"`
3. Verificar picos por `label` (web) e `surface/operation` (mobile).
4. Correlacionar horario com:
   - deploy recente
   - mudanca de schema/migration
   - pico de uso
5. Se houver `critical`:
   - checar primeiro erro de banco/Supabase nos logs.
   - validar latencia da rota publica e auth/session.

## Resposta operacional

### Caso 1: painel lento em paginas especificas

- Sinal:
  - `server_render` com `duration_ms` alto em um `label`.
- Acao:
  1. revisar loader dessa pagina
  2. reduzir queries em cascata
  3. garantir cache e dedupe para leitura repetida

### Caso 2: app cliente lento em leitura

- Sinal:
  - `client_performance` com `surface` repetindo `slow`.
- Acao:
  1. verificar se a chave de cache do modulo esta invalidando em excesso
  2. revisar endpoint/rpc usado pela operacao
  3. validar se houve crescimento de payload

### Caso 3: falhas recorrentes

- Sinal:
  - `outcome: "failed"` recorrente por operacao.
- Acao:
  1. levantar erro raiz por operacao
  2. degradar para fallback seguro
  3. abrir hotfix

## Verificacao rapida (smoke)

Rodar:

```bash
npm run verify:perf
```

Esse comando valida:

1. `/login` responde `200`
2. endpoint de performance aceita payload valido (`204`)
3. endpoint rejeita payload invalido (`400`)

## Cadencia sugerida

1. Diario:
   - olhar `critical` no log
2. Semanal:
   - revisar top 5 operacoes lentas
3. A cada release:
   - rodar `npm run verify:perf`
