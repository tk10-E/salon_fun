# Setup de desenvolvimento (rápido)

Este guia descreve passos mínimos para rodar a aplicação `apps/web` localmente.

Pré-requisitos
- Node.js 18+ ou compatível com a stack do projeto
- Git
- Uma instância PostgreSQL / Supabase (recomendado Supabase)
- Chaves do Supabase (veja variáveis necessárias abaixo)

Passos básicos

1. Copie o exemplo de variáveis para `.env.local` em `apps/web`:

```powershell
cd apps/web
cp .env.example .env.local
```

2. Edite `apps/web/.env.local` e preencha pelo menos as variáveis listadas no `README.md`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `DATABASE_URL`
- `DIRECT_URL`

3. Instale dependências e gere o client Prisma:

```powershell
cd apps/web
npm install
npm run prisma:generate
```

4. Rode o seed (opcional — precisa de `DATABASE_URL` configurada):

```powershell
cd apps/web
npm run prisma:seed
```

Observações
- Se utilizar Supabase local ou remoto, aplique as migrations (ex.: `supabase db push`).
- A função `firebase-auth-bridge` (em `supabase/functions`) exige `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` como variáveis de ambiente.

Ajuda
- Se quiser, execute o script `scripts/setup-dev.ps1` na raiz (PowerShell) para automatizar os passos acima.
