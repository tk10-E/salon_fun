# Salon Fun

Aplicação web para gestão de salão de beleza com foco em operação simples:

- dashboard leve
- agenda com status e filtros
- clientes com histórico
- profissionais
- categorias de serviço
- serviços
- pagamentos e caixa básico
- comissões

O MVP funcional do painel está em [`/dashboard/gestao`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao).

## Stack

- Frontend: Next.js 14 + React + TypeScript
- Backend do painel: Server Components + Server Actions
- Banco: PostgreSQL via Supabase
- ORM de referência: Prisma 7
- Validação: Zod
- Auth do painel: Firebase Web + bridge para sessão Supabase
- Deploy sugerido: Vercel para `apps/web` + Supabase para banco/auth/storage

## Arquitetura

```text
.
├── apps
│   ├── mobile
│   └── web
│       ├── app
│       │   ├── _actions
│       │   │   └── management.ts
│       │   └── dashboard/gestao
│       │       ├── layout.tsx
│       │       ├── page.tsx
│       │       ├── agendamentos/page.tsx
│       │       ├── clientes/page.tsx
│       │       ├── profissionais/page.tsx
│       │       ├── categorias/page.tsx
│       │       ├── servicos/page.tsx
│       │       ├── pagamentos/page.tsx
│       │       └── comissoes/page.tsx
│       ├── components/management
│       ├── lib
│       │   ├── management.ts
│       │   ├── management-navigation.ts
│       │   └── management-schemas.ts
│       └── prisma
│           ├── schema.prisma
│           └── seed.ts
└── supabase
    ├── migrations
    │   └── 0072_salon_management_mvp.sql
    └── seed.sql
```

## Modelagem do banco

Entidades principais do módulo:

- `salons`
- `customers`
- `staff_members`
- `service_categories`
- `services`
- `appointments`
- `appointment_payments`

Regras aplicadas no banco:

- serviço precisa apontar para categoria
- apenas serviços ativos entram em novos agendamentos
- apenas profissionais ativos recebem novos agendamentos
- pagamentos só podem ser vinculados a atendimentos concluídos
- status `no_show` separado de `cancelled`
- `updated_at` nos recursos operacionais do MVP

Migrations relevantes:

- schema incremental do MVP: [`0072_salon_management_mvp.sql`](/mnt/c/Users/tsilv/Downloads/salon fun/supabase/migrations/0072_salon_management_mvp.sql)
- schema Prisma equivalente: [`apps/web/prisma/schema.prisma`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/prisma/schema.prisma)

## Páginas principais

- Painel: [`apps/web/app/dashboard/gestao/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/page.tsx)
- Agendamentos: [`apps/web/app/dashboard/gestao/agendamentos/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/agendamentos/page.tsx)
- Clientes: [`apps/web/app/dashboard/gestao/clientes/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/clientes/page.tsx)
- Profissionais: [`apps/web/app/dashboard/gestao/profissionais/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/profissionais/page.tsx)
- Categorias: [`apps/web/app/dashboard/gestao/categorias/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/categorias/page.tsx)
- Serviços: [`apps/web/app/dashboard/gestao/servicos/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/servicos/page.tsx)
- Pagamentos e caixa: [`apps/web/app/dashboard/gestao/pagamentos/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/pagamentos/page.tsx)
- Comissões: [`apps/web/app/dashboard/gestao/comissoes/page.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/dashboard/gestao/comissoes/page.tsx)

## Componentes e domínio

- Navegação do módulo: [`apps/web/components/management/ManagementModuleNav.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/components/management/ManagementModuleNav.tsx)
- Card de indicadores: [`apps/web/components/management/ManagementStatCard.tsx`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/components/management/ManagementStatCard.tsx)
- Queries, filtros e datas: [`apps/web/lib/management.ts`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/lib/management.ts)
- Schemas Zod: [`apps/web/lib/management-schemas.ts`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/lib/management-schemas.ts)
- CRUD e regras de negócio: [`apps/web/app/_actions/management.ts`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/app/_actions/management.ts)

## Setup local

### 1. Banco e auth

1. Crie um projeto no Supabase.
2. Aplique as migrations do repositório:

```bash
supabase db push
```

3. Configure o provider de e-mail no Supabase.
4. Configure o Firebase Web usado pelo login do painel.
5. Faça o deploy da Edge Function de bridge se for usar o fluxo completo de autenticação do painel:

```bash
supabase functions deploy firebase-auth-bridge --no-verify-jwt
```

### 2. Ambiente web

1. Entre em `apps/web`.
2. Copie [`apps/web/.env.example`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/.env.example) para `.env.local`.
3. Preencha pelo menos:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
DATABASE_URL=...
DIRECT_URL=...
```

### 3. Instalação e execução

```bash
cd apps/web
npm install
npm run dev
```

Painel em `http://localhost:3000`.

## Seed realista para desenvolvimento

O login do painel depende de Firebase, então o seed do domínio foi pensado para um salão já criado via onboarding.

Fluxo recomendado:

1. criar a conta do painel
2. concluir o onboarding do salão
3. rodar o seed para popular categorias, serviços, clientes, profissionais, agenda e pagamentos

Com `DATABASE_URL` configurada:

```bash
cd apps/web
npm run prisma:generate
npm run prisma:seed
```

Se quiser apontar para um salão específico:

```bash
cd apps/web
SALON_ID=uuid-do-salao npm run prisma:seed
```

Arquivo do seed:

- [`apps/web/prisma/seed.ts`](/mnt/c/Users/tsilv/Downloads/salon fun/apps/web/prisma/seed.ts)

## API e fluxo CRUD

O módulo usa Server Actions em vez de rotas REST dedicadas. As actions fazem:

- validação com Zod
- verificação do salão autenticado
- gravação direta no Postgres via Supabase
- mensagens de sucesso/erro
- revalidação das páginas do módulo

Actions principais:

- categorias: criar, editar, excluir
- serviços: criar, editar, excluir
- clientes: criar, editar, excluir
- profissionais: criar, editar, excluir
- agendamentos: criar, editar, atualizar status
- pagamentos: criar/atualizar, excluir

## Regras de negócio implementadas

- não cria agendamento sem cliente, profissional, serviço, data e hora
- serviço pertence a uma categoria
- apenas serviços ativos entram em novos agendamentos
- apenas profissionais ativos recebem novos agendamentos
- comissão considera apenas atendimentos concluídos
- cancelamentos não entram em comissão
- faltas ficam separadas de cancelamentos
- pagamento do atendimento só entra em atendimento concluído

## Comandos úteis

```bash
cd apps/web
npm run dev
npm run build
npm run prisma:generate
npm run prisma:seed
```

## Deploy

### Web

- publicar `apps/web` na Vercel
- configurar todas as variáveis do `.env.local` no projeto
- garantir `APP_URL` com o domínio final

### Banco

- usar Supabase com `supabase db push` no ambiente alvo
- aplicar a migration `0072_salon_management_mvp.sql`

### Prisma

- `DATABASE_URL` e `DIRECT_URL` precisam apontar para o Postgres real
- `npm run prisma:generate` gera o client para scripts e integração futura

## Status da entrega

Entregue no MVP:

- arquitetura organizada por módulos
- modelagem de banco para gestão operacional
- migration SQL real
- schema Prisma
- seed com dados realistas
- dashboard funcional
- CRUD de clientes, profissionais, categorias e serviços
- agenda com filtros e status
- pagamentos com caixa básico
- comissões por período
- interface responsiva dentro do painel existente
