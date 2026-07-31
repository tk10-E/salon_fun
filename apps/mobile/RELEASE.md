# Release Mobile

## Onde rodar

O projeto Flutter do cliente fica em `apps/mobile`.

Se quiser rodar direto dentro dele:

```powershell
cd .\apps\mobile
flutter build appbundle --release --dart-define-from-file=.env.production --build-number=3
```

Se preferir rodar da raiz do monorepo:

```powershell
.\scripts\build-mobile-release.ps1 -Artifact appbundle -BuildNumber 3
```

## Versao

- `version` atual do app: `apps/mobile/pubspec.yaml`
- para upload na Play Store, o `build-number` precisa ser maior que o ultimo publicado
- voce pode subir a versao fixa no `pubspec.yaml` ou passar no build com `--build-name` e `--build-number`

Exemplo:

```powershell
.\scripts\build-mobile-release.ps1 -Artifact appbundle -BuildName 1.0.2 -BuildNumber 3
```

## Assinatura

Para publicacao real, configure `apps/mobile/android/key.properties`.
Voce pode partir de `apps/mobile/android/key.properties.example`.

Campos esperados:

```text
storeFile=../keystores/upload-keystore.jks
storePassword=...
keyAlias=...
keyPassword=...
```

Sem isso, o build `release` agora falha por padrao para evitar publicacao acidental com assinatura debug.
O script `scripts/build-mobile-release.ps1` tambem valida isso antes do build e informa se voce esta em `release-real` ou `smoke-test-debug`.

Para smoke test local, voce pode liberar explicitamente a assinatura debug:

```powershell
.\scripts\build-mobile-release.ps1 -Artifact apk -BuildNumber 3 -AllowDebugSigningForRelease
```

## Artefatos

- APK: `apps/mobile/build/app/outputs/flutter-apk/app-release.apk`
- AAB: `apps/mobile/build/app/outputs/bundle/release/app-release.aab`

## Checklist rapido

1. Conferir `.env.production`
2. Confirmar `build-number` novo
3. Confirmar `android/key.properties` para publicacao
4. Gerar `appbundle` para Play Store
5. Guardar o artefato gerado junto com a versao publicada
