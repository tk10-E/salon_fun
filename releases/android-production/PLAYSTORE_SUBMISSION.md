# Play Store Submission

## Artefatos prontos

- `salonfun-1.0.9-10-release.aab`
- `salonfun-1.0.9-10-release.apk`
- `SHA256SUMS.txt`
- `whatsnew-pt-BR.txt`

## Identificacao do app

- Nome: `Salon Fun`
- Package: `com.salonfun.salon_client`
- Version name: `1.0.9`
- Version code: `10`
- Compile SDK: `36`
- Target SDK: `36`

## Assinatura do upload

- Dono do certificado: `CN=Salon Fun, OU=Mobile, O=JC7 Desenvolvimentos, L=Sao Paulo, ST=SP, C=BR`
- SHA-1: `7A:7D:7B:19:1F:C5:8F:1C:8B:54:83:1A:7E:2C:25:74:11:2F:E7:6F`
- SHA-256: `86:47:BE:17:D1:D1:E2:5F:2B:8E:E8:7C:6E:B6:C7:E6:7E:DF:A4:C7:5F:DA:CF:5A:99:E1:F1:41:7F:46:F7:4F`

## Validacao tecnica feita

- `flutter test test/home_feed_pages_test.dart --plain-name "renders the premium feed shell"`
- `flutter test test/home_feed_pages_test.dart --plain-name "keeps the feed responsive when the panel connection oscillates"`
- `flutter test test/home_feed_pages_test.dart --plain-name "renders the notifications bell in the app shell"`
- `node scripts/verify-client-facing-readiness.mjs`
- `node scripts/verify-operations-readiness.mjs`
- build release do `AAB`
- build release do `APK`
- conferencia operacional:
  - `GET /login` no painel de producao respondeu `200`
  - feed de producao com `10` posts publicados no total
  - imagens do bucket `salon-posts` responderam `200`
- conferido nos artefatos:
  - `package`: `com.salonfun.salon_client`
  - `versionCode`: `10`
  - `versionName`: `1.0.9`

## Itens da Play Console para conferir

1. Fazer upload do `salonfun-1.0.9-10-release.aab`.
2. Colar o texto de `whatsnew-pt-BR.txt` em "Novidades desta versao".
3. Confirmar que a politica de privacidade publicada aponta para:
   - `https://painel.jc7desenvovimento.online/privacidade`
4. Confirmar que a pagina de exclusao de conta publicada aponta para:
   - `https://painel.jc7desenvovimento.online/excluir-conta`
5. Marcar que o app exibe anuncios, porque ha AdMob ativo no build.
6. Revisar a ficha de seguranca de dados com base no codigo atual do app.

## Mapa rapido para a ficha de seguranca de dados

Inferencia baseada no codigo atual do app. Confirme com sua operacao real antes de enviar.

- Autenticacao:
  - login por e-mail e senha
  - login com Google
  - login com Facebook
- Dados de perfil tratados no app:
  - nome
  - telefone
  - e-mail
  - data de nascimento
  - WhatsApp
  - foto de perfil
- Infraestrutura e comunicacao:
  - push notifications com Firebase Messaging
  - token do dispositivo para notificacoes
  - banners com AdMob
- Links publicos no app:
  - privacidade
  - termos
  - suporte
  - exclusao de conta

## Referencias oficiais

- Target API level:
  - https://developer.android.com/google/play/requirements/target-sdk
- Data safety:
  - https://support.google.com/googleplay/android-developer/answer/10787469
- App signing:
  - https://support.google.com/googleplay/android-developer/answer/9842756
- Account deletion:
  - https://support.google.com/googleplay/android-developer/answer/13327111
