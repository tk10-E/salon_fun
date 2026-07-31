import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/core/config/app_environment.dart';

void main() {
  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
  });

  test('rejects an Android Firebase app id when bootstrapping on iOS', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;

    final environment = _environment(
      firebaseAppId: '1:210248555053:android:0acc4f6d121da02c7a36a4',
    );

    expect(environment.firebaseOptions, isNull);
    expect(environment.canBootstrapFirebaseNatively, isFalse);
    expect(environment.hasFirebase, isFalse);
  });

  test('accepts an Android Firebase app id on Android', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;

    final environment = _environment(
      firebaseAppId: '1:210248555053:android:0acc4f6d121da02c7a36a4',
    );

    expect(
      environment.firebaseOptions?.appId,
      '1:210248555053:android:0acc4f6d121da02c7a36a4',
    );
    expect(environment.hasFirebase, isTrue);
  });

  test('prefers the iOS Firebase app id on Apple platforms', () {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;

    final environment = _environment(
      firebaseAppId: '1:210248555053:android:0acc4f6d121da02c7a36a4',
      firebaseIosAppId: '1:210248555053:ios:1234567890abcdef',
    );

    expect(
      environment.firebaseOptions?.appId,
      '1:210248555053:ios:1234567890abcdef',
    );
    expect(environment.hasFirebase, isTrue);
  });

  test('derives public legal and account deletion links from the web base url', () {
    final environment = _environment(apiBaseUrl: 'https://app.salonfun.com');

    expect(
      environment.defaultPrivacyPolicyUrl,
      'https://app.salonfun.com/privacidade',
    );
    expect(
      environment.defaultTermsOfUseUrl,
      'https://app.salonfun.com/termos',
    );
    expect(environment.defaultSupportUrl, 'https://app.salonfun.com/suporte');
    expect(
      environment.defaultAccountDeletionUrl,
      'https://app.salonfun.com/excluir-conta',
    );
  });
}

AppEnvironment _environment({
  String apiBaseUrl = '',
  String firebaseAppId = '',
  String firebaseIosAppId = '',
  String googleServerClientId = '',
}) {
  return AppEnvironment(
    apiBaseUrl: apiBaseUrl,
    supabaseUrl: 'https://project.supabase.co',
    supabaseAnonKey: 'anon-key',
    authBridgeUrl: '',
    googleServerClientId: googleServerClientId,
    defaultJoinCode: '',
    firebaseApiKey: 'firebase-api-key',
    firebaseProjectId: 'salon-fun-73373',
    firebaseMessagingSenderId: '210248555053',
    firebaseAppId: firebaseAppId,
    firebaseAndroidAppId: '',
    firebaseIosAppId: firebaseIosAppId,
    firebaseWebAppId: '',
    firebaseAuthDomain: 'salon-fun-73373.firebaseapp.com',
    firebaseStorageBucket: 'salon-fun-73373.firebasestorage.app',
    firebaseIosBundleId: '',
    enableAdMobAds: false,
    adMobBannerAdUnitId: '',
  );
}
