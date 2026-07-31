# PROJECT_CONTEXT

Atualizado em: 2026-05-21  
Escopo analisado: monorepo completo (`apps/web`, `apps/mobile`, `supabase`, docs e CI)

## 1. Objetivo principal do sistema
Construir um SaaS operacional para saloes (beleza, barbearia, estetica) com dois produtos conectados:
- painel web para operacao do salao
- app cliente Flutter para relacionamento, agenda, feed e loja

O sistema prioriza rotina diaria: agenda, clientes, caixa e recorrencia.

## 2. Problema que o produto resolve
Pequenos e medios saloes normalmente perdem receita por:
- agenda mal ocupada
- resposta lenta para cliente
- controle financeiro fragmentado
- baixa recorrencia e baixa reativacao

O produto resolve isso com operacao centralizada, automacoes e leitura em tempo real.

## 3. Publico-alvo
- Dono(a) de salao e gestor(a) operacional.
- Recepcao e equipe do salao.
- Cliente final do salao (via app cliente).

## 4. Estrutura da arquitetura
Arquitetura monorepo orientada a produto:
- `apps/web`: Next.js (painel + APIs + server actions)
- `apps/mobile`: Flutter (app cliente)
- `supabase`: migrations SQL + edge functions

Backbone de dados:
- Supabase/Postgres com forte uso de RPC e RLS
- isolamento multi-tenant por `salon_id`

Camada de integracoes:
- Firebase Auth (painel e app cliente)
- bridge Firebase -> Supabase (`firebase-auth-bridge`)
- Stripe (billing SaaS)
- OpenRouter (IA)
- Asaas (deposito/PIX gerenciado)
- FCM push (via edge functions)

## 5. Fluxo principal do usuario
Fluxo dono do salao:
1. Login no painel.
2. Onboarding do salao.
3. Ativacao de plano.
4. Operacao diaria no dashboard: agenda, clientes, caixa, equipe, servicos.
5. Gestao de feed/loja/campanhas/app cliente.

Fluxo cliente final:
1. Login no app cliente.
2. Vinculo ao salao por join code.
3. Consulta de agenda, feed e loja.
4. Agendamento, remarcacao, conclusao e avaliacao.
5. Engajamento recorrente via stories, ofertas, notificacoes e membership.

## 6. Tecnologias utilizadas
Web (`apps/web`):
- Next.js 15, React 18, TypeScript
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- Firebase SDK web
- Prisma 7
- Zod
- Stripe SDK
- Vercel Analytics e Speed Insights
- Vitest + Testing Library

Mobile (`apps/mobile`):
- Flutter (Dart 3)
- supabase_flutter
- firebase_core/auth/messaging
- http, shared_preferences, local_auth
- google_sign_in
- flutter_local_notifications
- image_picker, video_player
- google_mobile_ads

Infra e dados:
- Supabase migrations (117 arquivos)
- Supabase Edge Functions
- Vercel deploy
- GitHub Actions CI

## 7. Organizacao do codigo
Web:
- `app/dashboard/*`: paginas do painel
- `app/_actions/*`: regras mutaveis e casos de uso do painel
- `app/api/public/*`: APIs usadas pelo app cliente
- `app/api/internal/*`: APIs internas (IA, sessao, operacao)
- `lib/*`: dominio, seguranca, billing, agenda, performance, IA
- `components/*`: shell, navegacao, formularios e widgets

Mobile:
- `lib/src/features/*`: agenda, feed, loja, perfil, auth, home
- `lib/src/core/*`: tema, config, rede, observabilidade, seguranca
- `lib/src/bootstrap/*`: inicializacao e wiring dos repositorios

Banco:
- `supabase/migrations/*`: evolucao de schema e regras de negocio
- `supabase/functions/*`: funcoes edge integracionais

## 8. Principais modulos
Painel:
- Agenda e gestao (`/dashboard/gestao/agendamentos`)
- Clientes, equipe, servicos, pagamentos, comissoes
- Financeiro, operacoes, inventario/loja
- Feed, campanhas, app do cliente, beneficios
- IA operacional (`/dashboard/ai`)
- Ajustes, seguranca, billing

App cliente:
- Inicio, agenda, loja, feed/stories, perfil
- Membership, fidelidade, notificacoes
- Fluxo de agendamento e remarcacao

Back-end funcional:
- Autopilot de operacao (`operationsAutopilot`)
- Integridade de pagamento
- Public salon landing
- Telemetria de performance

## 9. Regras de negocio importantes
- `salon_id` e fronteira obrigatoria de tenant.
- Agenda valida conflito de horario, jornada, slot step e regras de atendimento.
- Somente servicos/profissionais ativos devem entrar em novos agendamentos.
- Pagamento deve respeitar integridade do valor (snapshot do servico).
- Planos/membership exigem controle de sessoes, vigencia e consumo.
- Remarcacao possui bloqueios de consistencia (servico/staff/janela).
- Status criticos de atendimento: `pending`, `confirmed`, `completed`, `cancelled`, `no_show`.
- Autopilot opera somente quando `autoPilotEnabled=true` por salao.
- Billing pode bloquear areas do painel quando assinatura esta travada.

## 10. Padroes visuais e UX
Painel web:
- Layout com sidebar agrupada por contexto operacional.
- Cards de leitura rapida e foco em agenda/caixa.
- Skeletons para carregamento e UX de estado.
- Estilo visual premium com tons quentes e contraste alto.

App cliente:
- Navegacao em 5 abas (Inicio, Agenda, Loja, Feed, Perfil).
- Story viewer estilo social com progresso automatico e tap para avancar.
- Loja com imagem otimizada e `BoxFit.contain` para evitar cortes agressivos.
- Tema adaptavel por configuracao visual do salao.

## 11. Estrategias de retencao e engajamento
- Feed + stories com interacao (likes/comentarios).
- Ofertas e campanhas de reativacao.
- Membership e fidelidade.
- Notificacoes push e jornadas de retorno.
- Aniversario e comunicacoes segmentadas.
- IA para diagnostico de movimento e sugestao de acao.

## 12. Sistema de autenticacao e seguranca
Autenticacao:
- Firebase para identidade primaria.
- Bridge para espelhar credencial no Supabase.
- Sessao ativa no Supabase para operacao de dados.

Camada de seguranca:
- Protecao de origem e headers.
- Rate limiting com fallback em memoria.
- Protecao replay para chamadas sensiveis.
- Auditoria de eventos de seguranca.
- Controle de sessao por risco (device/IP/user-agent).
- Politica de MFA TOTP e geofence por salao.

## 13. APIs e integracoes
APIs publicas:
- `/api/public/salons/[joinCode]`
- `/api/public/customer-appointments` (+ `status`, `reschedule`)
- `/api/public/appointment-plan-reservations`
- `/api/public/appointment-reviews`
- `/api/public/customer-feed-stories`
- `/api/public/observability/performance`

APIs internas:
- IA (`/api/internal/ai/*`)
- autopilot (`/api/internal/operations/autopilot`)
- keep-alive de sessao (`/api/internal/session/ping`)

Integracoes externas:
- Supabase (DB/Auth/Storage/Realtime/RPC)
- Firebase Auth e FCM
- Stripe webhook e sincronizacao de assinatura
- OpenRouter para IA
- Asaas para deposito/PIX

## 14. Estado atual do projeto
Estado: avancado e operacional, com foco claro em producao.

Sinais objetivos:
- 117 migrations SQL
- 113 testes no web
- 15 testes no mobile
- CI cobrindo lint/test/analyze em web e mobile
- modulo de IA e observabilidade ja em producao

Tambem ha refactor ativo grande no workspace, com mudancas extensas simultaneas.

## 15. Pontos fracos
- Documentacao raiz desatualizada em relacao ao escopo atual.
- Arquivos muito grandes (ex.: `panelAssistant.ts`, `management.ts`, `management actions`).
- Alta complexidade de configuracao de ambiente (muitos segredos e provedores).
- Modulos legados parcialmente removidos ainda deixam rastros estruturais.
- Percepcao de lentidao pode ocorrer por combinacao de SSR + skeleton + carga de dados.

## 16. Oportunidades de melhoria
- Quebrar dominios grandes em pacotes menores por bounded context.
- Contratos tipados compartilhados web/mobile para reduzir drift.
- Mais testes E2E cross-flow (agenda -> caixa -> loja -> notificacao).
- Telemetria com alertas automatizados por SLO (nao so log passivo).
- Simplificar configuracoes de Ajustes com progressive disclosure.
- Padronizar jobs agendados com observabilidade de execucao e retry.

## 17. Features mais importantes
- Agenda robusta com regra de conflito e remarcacao segura.
- Caixa/pagamentos/comissoes conectados ao atendimento.
- App cliente com agendamento, feed, stories e loja.
- Membership e beneficios para recorrencia.
- Autopilot operacional para reduzir carga manual do salao.
- IA do painel para leitura de operacao e campanhas.
- Billing com gate de acesso por assinatura.

## 18. Comportamento esperado da aplicacao
- Responder rapido e sem ambiguidade em operacoes criticas.
- Nao permitir overbooking, inconsistencias de status ou vazamento de tenant.
- Manter dados coerentes entre painel e app cliente.
- Oferecer fallback seguro em falhas de rede e schema drift.
- Registrar eventos criticos para auditoria e suporte.

## 19. Experiencia emocional desejada para o usuario
Para o salao:
- sensacao de controle, clareza e previsibilidade
- menos friccao operacional e menos medo de perder horario/receita

Para o cliente final:
- sensacao de app premium, confiavel e pratico
- facilidade para agendar, comprar e voltar

## 20. Diferenciais competitivos
- Produto duplo integrado (painel + app cliente) no mesmo dominio de negocio.
- Profundidade real em agenda, recorrencia e operacao de salao.
- Automacao com regra de negocio (autopilot) e IA contextual.
- Seguranca operacional acima da media para SMB SaaS (sessao, replay, auditoria).
- Estrategia forte de engajamento (stories, loja, notificacoes, membership).

## Referencias rapidas de arquivo
- Web stack: `apps/web/package.json`
- Mobile stack: `apps/mobile/pubspec.yaml`
- Agenda dominio web: `apps/web/lib/management.ts`
- Agenda dominio mobile: `apps/mobile/lib/src/features/agenda/booking_repository.dart`
- Autopilot: `apps/web/lib/operationsAutopilot.ts`
- IA painel: `apps/web/lib/ai/panelAssistant.ts`
- Seguranca: `apps/web/lib/security.ts`, `apps/web/lib/sessionSecurity.ts`
- Billing: `apps/web/lib/billing.ts`, `apps/web/lib/stripeBilling.ts`
- Public API salao: `apps/web/app/api/public/salons/[joinCode]/route.ts`
- CI: `.github/workflows/ci.yml`
