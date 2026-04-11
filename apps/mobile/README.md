# Salon Fun Cliente

App Flutter do cliente com:

- login profissional com Firebase
- bridge Firebase -> Supabase
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
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_IOS_BUNDLE_ID`

## Validação

```bash
dart format lib test
flutter analyze
flutter test
```
