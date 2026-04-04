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

5. Publique a Edge Function usada pelo app mobile para transformar a identidade validada no Firebase em sessão do Supabase:

```bash
supabase functions deploy firebase-auth-bridge --no-verify-jwt
```

6. Copie a `Project URL` e a `publishable key`.

## Rodando o painel web

1. Entre em `apps/web`.
2. Copie `.env.example` para `.env.local`.
3. Preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=https://seu-dominio-do-painel.com
STRIPE_SECRET_KEY=sk_live_or_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_GROWTH_MONTHLY=price_xxx
STRIPE_PRICE_GROWTH_YEARLY=price_xxx
STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_PREMIUM_YEARLY=price_xxx
```

4. Instale e rode:

```bash
npm install
npm run dev
```

O painel abre em `http://localhost:3000`.

## Auth do painel

O painel do salao agora usa:

- Firebase Web para `login`, `cadastro`, `Google` e `recuperacao de senha`
- Supabase para sessao de dados, regras, banco, dashboard e billing

Para o painel funcionar em producao, garanta tambem no ambiente web:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
```

No Firebase Authentication, adicione os dominios usados pelo painel em `Authorized domains`.

## Billing real com Stripe

O painel agora já suporta:

- checkout de assinatura recorrente
- portal de cobrança do cliente
- webhook para sincronizar status no Supabase

Depois de preencher as variáveis acima:

1. Crie os `Price IDs` no Stripe para cada plano e ciclo.
2. Aponte o webhook do Stripe para:

```text
https://seu-dominio-do-painel.com/api/stripe/webhook
```

3. No Stripe, envie pelo menos estes eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

4. Em `Billing > Customer portal` no Stripe, ative o portal para permitir troca de plano, método de pagamento e cancelamento.
5. No painel, abra `/dashboard/billing` e confirme que o card `Gateway de cobrança` mostra `Stripe pronto para produção` antes de abrir venda real.
6. No terminal do painel, rode `npm run verify:billing` para validar secret live, price IDs, portal e webhook sem expor segredos.
7. Rode também `npm run verify:operations` para validar com dados reais se catálogo, equipe, agenda, base de clientes, push e conteúdo do app já sustentam um salão piloto.

Sem essas variáveis, o painel continua com o fallback manual de billing.

## Rodando o app Flutter

1. Entre em `apps/mobile`.
2. Rode:

```bash
flutter pub get
flutter run --dart-define-from-file=.env.local
```

Se você criar conta por e-mail e senha no app mobile, confirme primeiro o link de verificação enviado pelo Firebase antes de tentar entrar.
No app mobile atual, o Firebase valida a identidade e a Edge Function `firebase-auth-bridge` cria ou atualiza a conta correspondente no Supabase. A integração `Authentication > Third-Party Auth > Firebase Auth` do painel não é mais necessária para esse fluxo.

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

## Release Android

Para publicar o app cliente na Play Store:

1. Copie `apps/mobile/android/key.properties.example` para `apps/mobile/android/key.properties`.
2. Aponte `storeFile`, `storePassword`, `keyAlias` e `keyPassword` para sua keystore de upload.
3. Gere o bundle:

```bash
cd apps/mobile
flutter build appbundle --release --dart-define-from-file=.env.local
```

Se `key.properties` nao existir, o Gradle ainda cai na debug key para teste interno, mas isso nao serve para publicacao.

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
