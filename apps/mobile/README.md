# Salon Client

Reconstrução do app Flutter do cliente em cima das funcionalidades reais do painel web.

## O que este app cobre

- autenticação com Supabase
- login por Firebase Auth com troca automática para sessão do Supabase
- entrada social com Google e Facebook na tela de autenticação
- entrada por código do salão
- home premium com agenda, benefícios, campanhas e feed
- catálogo de serviços e profissionais
- reserva usando `get_day_availability` e `create_appointment`
- agenda/histórico com cancelamento e confirmação de presença
- feed do salão com curtidas e comentários
- perfil do cliente com preferências, alergias e rotina de beleza
- central de notificações lida direto das tabelas do projeto
- snapshots com cache local para home, explore, agenda, feed e perfil
- fallback offline com indicação de última sincronização
- transições de entrada e cortina visual de abertura no app

## Rodar

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_PUBLISHABLE_KEY=your-publishable-key \
  --dart-define=AUTH_REDIRECT_URL=salonfun://auth-callback \
  --dart-define=FIREBASE_API_KEY=your-firebase-api-key \
  --dart-define=FIREBASE_PROJECT_ID=your-firebase-project-id \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=your-firebase-sender-id \
  --dart-define=FIREBASE_ANDROID_APP_ID=your-firebase-android-app-id \
  --dart-define=FIREBASE_IOS_APP_ID=your-firebase-ios-app-id \
  --dart-define=FIREBASE_IOS_BUNDLE_ID=com.salonfun.salon_client \
  --dart-define=FACEBOOK_APP_ID=your-facebook-app-id \
  --dart-define=FACEBOOK_CLIENT_TOKEN=your-facebook-client-token
```

## Observações

- O app usa o `client_app_config` e a identidade do salão para ajustar tema, hero e microcopy.
- A base mantém cache local via `shared_preferences` para sustentar navegação mesmo quando a conexão oscila.
- O app autentica o cliente primeiro no Firebase e depois chama a Edge Function `firebase-auth-bridge`, que cria ou atualiza a conta equivalente no Supabase e devolve uma credencial temporária para abrir a sessão final do app.
- Em projetos hospedados do Supabase, publique `supabase/functions/firebase-auth-bridge` com `supabase functions deploy firebase-auth-bridge --no-verify-jwt`.
- No fluxo com e-mail e senha, a conta precisa confirmar o e-mail no Firebase antes de a sessão ser liberada no Supabase e vinculada ao salão.
- A integração `Authentication > Third-Party Auth > Firebase Auth` do painel não é necessária para esse fluxo mobile.
- Se você optar pelo fluxo nativo do Firebase no Android, salve o arquivo `google-services.json` em `apps/mobile/android/app/google-services.json`. O Gradle já está preparado para aplicar o plugin automaticamente quando esse arquivo existir.
- Para o Facebook em Android, preencha `FACEBOOK_APP_ID` e `FACEBOOK_CLIENT_TOKEN` no `.env.local`. O Gradle injeta esses valores no manifesto durante a build.
- A reserva agora guarda snapshots da disponibilidade por serviço e data para fallback offline. Quando estiver offline, o app mostra a última grade salva e bloqueia a confirmação final até a conexão voltar.

## APK e AAB de produção

O Android já aceita assinatura de release via `apps/mobile/android/key.properties`.

1. Copie `apps/mobile/android/key.properties.example` para `apps/mobile/android/key.properties`.
2. Preencha:

```properties
storeFile=../keystores/upload-keystore.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

3. Gere o artefato:

```bash
flutter build apk --release --dart-define-from-file=.env.local
flutter build appbundle --release --dart-define-from-file=.env.local
```

Sem `key.properties`, o Gradle ainda gera release assinado com a debug key para facilitar teste interno, mas isso nao deve ser usado para publicar na Play Store.
