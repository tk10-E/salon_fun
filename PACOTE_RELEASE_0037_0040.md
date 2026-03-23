# Pacote de Release 0037-0040

Fechamento operacional do lote de banco ainda pendente, sem aplicar nada automaticamente.

Data de referência: 22 de março de 2026.

## Escopo do lote

- `0037_customer_beauty_profile.sql`
- `0038_owner_operations_finance_inventory.sql`
- `0039_loyalty_gamified_defaults.sql`
- `0040_loyalty_vip_reward_service.sql`

## O que entra neste pacote

### `0037_customer_beauty_profile.sql`

Adiciona no cliente:
- `customers.allergies`
- `customers.beauty_products`

Impacto funcional:
- prontuário leve do cliente no app
- leitura desses dados no painel de clientes

Risco:
- baixo
- só adiciona colunas novas, sem alterar comportamento legado

### `0038_owner_operations_finance_inventory.sql`

Adiciona no salão:
- comissão automática por profissional em `staff_members`
- tabelas `inventory_products` e `inventory_movements`
- RPC `register_inventory_movement`
- RPC `get_owner_operations_dashboard`

Impacto funcional:
- novo painel `/dashboard/operations`
- leitura de faturamento por dia
- profissional que mais rende
- agenda resumida por funcionário
- estoque com entrada, saída e ajuste

Risco:
- médio
- cria tabelas, triggers, políticas e RPCs novas

### `0039_loyalty_gamified_defaults.sql`

Padroniza a escada da fidelidade:
- `Bronze`
- `Prata`
- `Ouro`

Impacto funcional:
- melhora a leitura comercial da fidelidade sem quebrar regras existentes

Risco:
- baixo
- altera defaults e faz backfill apenas nos casos que ainda estavam com o padrão antigo

### `0040_loyalty_vip_reward_service.sql`

Adiciona recompensa opcional de serviço no nível Ouro:
- `salon_loyalty_programs.vip_reward_service_id`
- trigger de validação do serviço dentro do mesmo salão
- atualização das RPCs de fidelidade para devolver `vip_reward_service_name`
- notificação de desbloqueio do VIP com recompensa especial

Impacto funcional:
- painel do dono passa a configurar um serviço grátis opcional no nível Ouro
- app do cliente passa a mostrar essa recompensa quando existir

Risco:
- médio
- altera funções já existentes de fidelidade

## Ordem recomendada

Aplicar na ordem natural:

1. `0037`
2. `0038`
3. `0039`
4. `0040`

Observação:
- `0040` depende da estrutura de fidelidade já existente desde `0026`
- `0039` e `0040` se complementam, mas não entram em conflito

## Pré-check antes de aplicar

1. Confirmar que o remoto está até `0036`.
2. Confirmar backup ou snapshot lógico disponível no Supabase.
3. Confirmar que `apps/web` e `apps/mobile` já estão verdes localmente.
4. Confirmar que ninguém está fazendo alteração manual no SQL Editor em paralelo.

## Comando recomendado

Primeiro:

```bash
supabase db push --dry-run
```

Depois:

```bash
supabase db push
```

Se o pooler falhar:

```bash
supabase db push --db-url "postgresql://postgres:<senha>@db.<project-ref>.supabase.co:5432/postgres"
```

## Conferência pós-apply

Rodar o arquivo:

- [0037_0040_post_deploy_verification.sql](/mnt/c/Users/tsilv/Downloads/salon%20fun/supabase/post_deploy_checks/0037_0040_post_deploy_verification.sql)

Esse script confere:
- histórico de migrations
- colunas novas
- tabelas novas
- índices novos
- triggers novos
- funções novas e funções reescritas

## Smoke test funcional mínimo

### Web

1. Abrir `/dashboard/customers` e validar leitura de alergias/produtos.
2. Abrir `/dashboard/operations` e validar:
   - métricas carregando
   - formulário de comissão
   - cadastro de produto
   - registro de movimentação
3. Abrir `/dashboard/benefits/loyalty` e validar:
   - nomes Bronze, Prata e Ouro
   - campo `Serviço grátis no Ouro`

### Mobile

1. Abrir perfil do cliente e validar:
   - alergias
   - produtos usados
2. Abrir carteira/fidelidade e validar:
   - nomenclatura Bronze/Prata/Ouro
   - leitura da recompensa especial quando configurada

## Critério de aceite do lote

O lote pode ser considerado seguro para produção quando:

- `0037` a `0040` aparecerem em `supabase_migrations.schema_migrations`
- o script de verificação SQL voltar sem ausência de objeto
- o painel `/dashboard/operations` abrir sem erro
- a fidelidade aceitar salvar Bronze/Prata/Ouro e opcionalmente um serviço no Ouro
- o app do cliente ler o prontuário e a recompensa VIP sem falha

## Observação importante

Este pacote só prepara a operação.

Nada aqui aplica migrations automaticamente.
