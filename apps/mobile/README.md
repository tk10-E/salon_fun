# Salon Fun Cliente

App Flutter do cliente com:

- login profissional com Firebase
- bridge Firebase -> Supabase
- login com Facebook via Firebase
- agenda focada em velocidade
- feed estilo social
- loja virtual do salão

## Rodar

```bash
flutter run \
  --dart-define=PUBLIC_WEB_BASE_URL=https://seu-web-app.com \
  --dart-define=SUPABASE_URL=https://seu-projeto.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=seu-anon-key \
  --dart-define=AUTH_BRIDGE_URL=https://seu-projeto.supabase.co/functions/v1/firebase-auth-bridge \
  --dart-define=FIREBASE_API_KEY=seu-firebase-api-key \
  --dart-define=FIREBASE_PROJECT_ID=seu-firebase-project-id \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=seu-messaging-sender-id \
  --dart-define=FIREBASE_ANDROID_APP_ID=seu-android-app-id \
  --dart-define=FIREBASE_IOS_APP_ID=seu-ios-app-id
```

## Opcional

- `DEFAULT_SALON_JOIN_CODE`
- `FIREBASE_APP_ID`
- `FIREBASE_WEB_APP_ID`
- `GOOGLE_SERVER_CLIENT_ID`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_IOS_BUNDLE_ID`
- `FACEBOOK_APP_ID`
- `FACEBOOK_CLIENT_TOKEN`
- `FACEBOOK_DISPLAY_NAME`
- `FACEBOOK_LOGIN_PROTOCOL_SCHEME`

## Facebook no app cliente

O app cliente usa `Facebook -> Firebase -> bridge -> Supabase`.

Enquanto o Android ainda nao estiver validado na Meta/Play, mantenha:

```text
ENABLE_FACEBOOK_SIGN_IN=false
```

A integracao continua pronta no codigo, mas o botao fica oculto no app para nao atrapalhar o fluxo estavel de e-mail e Google.

Checklist externo:

- confira o `GOOGLE_SERVER_CLIENT_ID` do app web/oauth quando quiser forçar a configuração em Dart
- cadastre os `SHA-1` e `SHA-256` do build debug/release no Firebase para o Google funcionar em todos os APKs
- ative `Facebook` em `Firebase Authentication`
- use a mesma app Meta/Facebook vinculada ao provider do Firebase
- preencha `FACEBOOK_APP_ID` e `FACEBOOK_CLIENT_TOKEN`
- no Android, cadastre os `key hashes` debug/release na Meta
- no iOS, copie os mesmos valores para `ios/Flutter/FacebookConfig.xcconfig`

## Validação

```bash
dart format lib test
flutter analyze
flutter test
```
