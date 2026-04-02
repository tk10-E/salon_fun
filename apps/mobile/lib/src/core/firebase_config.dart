import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class FirebaseConfig {
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const androidAppId = String.fromEnvironment('FIREBASE_ANDROID_APP_ID');
  static const iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
  );
  static const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  static bool get hasExplicitConfig {
    return apiKey.isNotEmpty &&
        projectId.isNotEmpty &&
        messagingSenderId.isNotEmpty &&
        _appIdForCurrentPlatform().isNotEmpty;
  }

  static FirebaseOptions? optionsForCurrentPlatform() {
    final resolvedAppId = _appIdForCurrentPlatform();
    if (apiKey.isEmpty ||
        projectId.isEmpty ||
        messagingSenderId.isEmpty ||
        resolvedAppId.isEmpty) {
      return null;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return FirebaseOptions(
          apiKey: apiKey,
          appId: resolvedAppId,
          messagingSenderId: messagingSenderId,
          projectId: projectId,
          storageBucket: storageBucket.isEmpty ? null : storageBucket,
        );
      case TargetPlatform.iOS:
        return FirebaseOptions(
          apiKey: apiKey,
          appId: resolvedAppId,
          messagingSenderId: messagingSenderId,
          projectId: projectId,
          storageBucket: storageBucket.isEmpty ? null : storageBucket,
          iosBundleId: iosBundleId.isEmpty ? null : iosBundleId,
        );
      default:
        return null;
    }
  }

  static String _appIdForCurrentPlatform() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return androidAppId.isNotEmpty ? androidAppId : appId;
      case TargetPlatform.iOS:
        return iosAppId.isNotEmpty ? iosAppId : appId;
      default:
        return '';
    }
  }
}
