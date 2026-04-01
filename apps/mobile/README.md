# Salon Client

App Flutter do cliente para o MVP de agendamento.

## Rodar

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=your-publishable-key \
  --dart-define=AUTH_REDIRECT_URL=salonfun://auth-callback
```

## Push no Android

Para receber notificacoes reais de vaga liberada no Android:

1. Adicione `google-services.json` em `android/app/google-services.json`.
2. Rode `flutter pub get`.
3. Reinstale o app no dispositivo ou emulador Android.

O app registra o token FCM automaticamente quando o cliente ja estiver vinculado a um salao.
No logout, o token eh desativado para evitar push em conta errada.

## Push no iOS

Para receber notificacoes reais no iPhone:

1. Adicione `GoogleService-Info.plist` em `ios/Runner/GoogleService-Info.plist`.
2. Habilite as capacidades `Push Notifications` e `Background Modes > Remote notifications` no target `Runner`.
3. Gere e vincule a chave/certificado APNs do app no projeto Firebase usado por este ambiente.
4. Reinstale o app em um dispositivo fisico iOS e aceite as permissoes de notificacao.

O app ja esta preparado para registrar token FCM e exibir notificacoes locais no iOS, mas a entrega real depende da configuracao APNs/Firebase do projeto.

## Observacao para Flutter Web

Se usar `flutter run -d chrome`, confirme no Supabase:

- `Authentication > Providers > Email` habilitado
- `Authentication > URL Configuration > Redirect URLs` contendo o endereco local do app

Para desenvolvimento local, use um wildcard como:

```text
http://localhost:*
```

## Redirect de e-mail no app nativo

O app usa `salonfun://auth-callback` como redirect nativo padrao para confirmacao de email e recuperacao de senha. Se voce quiser sobrescrever esse comportamento por ambiente, gere o app com o valor abaixo:

```bash
flutter build apk --release --dart-define-from-file=.env.production
```

E dentro do arquivo `.env.production` inclua:

```text
AUTH_REDIRECT_URL=salonfun://auth-callback
```

No Supabase, confirme tambem que `salonfun://auth-callback` esta cadastrado em `Authentication > URL Configuration > Redirect URLs`.
