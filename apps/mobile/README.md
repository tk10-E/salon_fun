# Salon Client

App Flutter do cliente para o MVP de agendamento.

## Rodar

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=your-publishable-key \
  --dart-define=AUTH_REDIRECT_URL=https://painel.example.com/login
```

## Push no Android

Para receber notificacoes reais de vaga liberada no Android:

1. Adicione `google-services.json` em `android/app/google-services.json`.
2. Rode `flutter pub get`.
3. Reinstale o app no dispositivo ou emulador Android.

O app registra o token FCM automaticamente quando o cliente ja estiver vinculado a um salao.
No logout, o token eh desativado para evitar push em conta errada.

## Observacao para Flutter Web

Se usar `flutter run -d chrome`, confirme no Supabase:

- `Authentication > Providers > Email` habilitado
- `Authentication > URL Configuration > Redirect URLs` contendo o endereco local do app

Para desenvolvimento local, use um wildcard como:

```text
http://localhost:*
```

## Redirect de e-mail no app nativo

Se o cadastro ou reset de senha for iniciado no Android/iOS, o Supabase usa o `Site URL` do projeto quando nenhum redirect eh informado.

Para evitar links indo para `localhost`, gere o app com uma URL publica:

```bash
flutter build apk --release --dart-define-from-file=.env.production
```

E dentro do arquivo `.env.production` inclua:

```text
AUTH_REDIRECT_URL=https://painel.example.com/login
```
