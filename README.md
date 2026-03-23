# Salon Fun MVP

MVP simples de agendamento para salões com:

- painel web em Next.js para o salão
- app Flutter para o cliente
- backend multi-tenant em Supabase

## Estrutura

```text
.
├── apps
│   ├── mobile      # app Flutter do cliente
│   └── web         # painel Next.js do salão
└── supabase
    └── migrations  # schema, RLS e RPCs
```

## Decisões do MVP

- isolamento por `salon_id`
- cliente entra por `join_code` do salão
- um cliente fica vinculado a um único salão neste MVP
- painel do salão acessa apenas dados do seu próprio `owner_user_id`
- agendamento sem conflito usando `exclusion constraint` no PostgreSQL
- criação de agendamento feita por RPC para garantir validação no backend

## Setup do Supabase

1. Crie um projeto no Supabase.
2. Em `Authentication > Providers`, deixe Email habilitado.
3. Para acelerar o MVP, desabilite confirmação obrigatória de e-mail.
4. Rode as migrations do diretório `supabase/migrations` até a mais recente do repositório:

```bash
supabase db push
```

Se o `db push` falhar por causa do pooler, siga o guia em [GUIA_DEPLOY_MIGRATIONS.md](/mnt/c/Users/tsilv/Downloads/salon fun/GUIA_DEPLOY_MIGRATIONS.md).

5. Copie a `Project URL` e a `publishable key`.

## Rodando o painel web

1. Entre em `apps/web`.
2. Copie `.env.example` para `.env.local`.
3. Preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

4. Instale e rode:

```bash
npm install
npm run dev
```

O painel abre em `http://localhost:3000`.

## Rodando o app Flutter

1. Entre em `apps/mobile`.
2. Rode:

```bash
flutter pub get
flutter run --dart-define-from-file=.env.local
```

## Push no Android

Para notificação real de vaga liberada no Android, faça também:

1. Crie um app Android no Firebase com o pacote `com.salonfun.salon_client`.
2. Baixe o `google-services.json` e coloque em `apps/mobile/android/app/google-services.json`.
3. Gere uma service account no Firebase e salve o JSON inteiro em um secret do Supabase:

```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
supabase secrets set VACANCY_PUSH_WEBHOOK_SECRET='troque-por-um-segredo-forte'
```

4. Faça o deploy da Edge Function sem verificação de JWT, porque ela usa um segredo próprio:

```bash
supabase functions deploy send-vacancy-push --no-verify-jwt
```

5. No SQL Editor do Supabase, registre os dois segredos que a trigger do banco usa:

```sql
insert into private.runtime_config (key, value)
values
  ('vacancy_push_function_url', 'https://seu-projeto.supabase.co/functions/v1/send-vacancy-push'),
  ('vacancy_push_webhook_secret', 'troque-por-um-segredo-forte')
on conflict (key)
do update set
  value = excluded.value,
  updated_at = timezone('utc', now());
```

6. Rode `supabase db push` para aplicar as migrations pendentes.

Com isso, quando uma vaga for liberada:
- o banco cria o alerta
- a trigger chama a Edge Function
- a Edge Function envia push via FCM para os clientes do salão
- o app também mostra notificação local quando estiver em foreground

## Fluxo do salão

1. Criar conta no painel.
2. Fazer onboarding do salão.
3. Cadastrar serviços.
4. Configurar agenda semanal, intervalo e fuso horário.
5. Cadastrar profissionais, distribuir serviços e criar bloqueios manuais.
6. Publicar fotos no feed do salão pelo painel.
7. Compartilhar o código do salão com o cliente.
8. Confirmar ou cancelar agendamentos no painel.
9. Acompanhar motivos de cancelamento e horários liberados.

## Fluxo do cliente

1. Criar conta no app.
2. Entrar com o código do salão.
3. Escolher serviço.
4. Escolher qualquer profissional ou um profissional especifico.
5. Ver, curtir e comentar as fotos do feed do salão.
6. Escolher horário livre.
7. Desmarcar com motivo quando precisar.
8. Acompanhar histórico dos agendamentos e vagas liberadas.

## Escopo intencionalmente fora do MVP

- marketplace de salões
- pagamentos
- galeria de imagens e conteúdo editorial

## Operação

- guia de deploy de migrations: [GUIA_DEPLOY_MIGRATIONS.md](/mnt/c/Users/tsilv/Downloads/salon fun/GUIA_DEPLOY_MIGRATIONS.md)
