import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

class AppEnvironment {
  AppEnvironment({
    required this.apiBaseUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.authBridgeUrl,
    required this.defaultJoinCode,
    required this.firebaseApiKey,
    required this.firebaseProjectId,
    required this.firebaseMessagingSenderId,
    required this.firebaseAppId,
    required this.firebaseAndroidAppId,
    required this.firebaseIosAppId,
    required this.firebaseWebAppId,
    required this.firebaseAuthDomain,
    required this.firebaseStorageBucket,
    required this.firebaseIosBundleId,
  });

  factory AppEnvironment.fromEnvironment() {
    return AppEnvironment(
      apiBaseUrl: _normalizeUrl(
        const String.fromEnvironment('PUBLIC_WEB_BASE_URL', defaultValue: ''),
      ),
      supabaseUrl: _normalizeUrl(
        const String.fromEnvironment('SUPABASE_URL', defaultValue: ''),
      ),
      supabaseAnonKey: const String.fromEnvironment(
        'SUPABASE_ANON_KEY',
        defaultValue: '',
      ).trim(),
      authBridgeUrl: _normalizeUrl(
        const String.fromEnvironment('AUTH_BRIDGE_URL', defaultValue: ''),
      ),
      defaultJoinCode: const String.fromEnvironment(
        'DEFAULT_SALON_JOIN_CODE',
        defaultValue: '',
      ).trim().toUpperCase(),
      firebaseApiKey: const String.fromEnvironment(
        'FIREBASE_API_KEY',
        defaultValue: '',
      ).trim(),
      firebaseProjectId: const String.fromEnvironment(
        'FIREBASE_PROJECT_ID',
        defaultValue: '',
      ).trim(),
      firebaseMessagingSenderId: const String.fromEnvironment(
        'FIREBASE_MESSAGING_SENDER_ID',
        defaultValue: '',
      ).trim(),
      firebaseAppId: const String.fromEnvironment(
        'FIREBASE_APP_ID',
        defaultValue: '',
      ).trim(),
      firebaseAndroidAppId: const String.fromEnvironment(
        'FIREBASE_ANDROID_APP_ID',
        defaultValue: '',
      ).trim(),
      firebaseIosAppId: const String.fromEnvironment(
        'FIREBASE_IOS_APP_ID',
        defaultValue: '',
      ).trim(),
      firebaseWebAppId: const String.fromEnvironment(
        'FIREBASE_WEB_APP_ID',
        defaultValue: '',
      ).trim(),
      firebaseAuthDomain: const String.fromEnvironment(
        'FIREBASE_AUTH_DOMAIN',
        defaultValue: '',
      ).trim(),
      firebaseStorageBucket: const String.fromEnvironment(
        'FIREBASE_STORAGE_BUCKET',
        defaultValue: '',
      ).trim(),
      firebaseIosBundleId: const String.fromEnvironment(
        'FIREBASE_IOS_BUNDLE_ID',
        defaultValue: '',
      ).trim(),
    );
  }

  factory AppEnvironment.testing() {
    return AppEnvironment(
      apiBaseUrl: '',
      supabaseUrl: '',
      supabaseAnonKey: '',
      authBridgeUrl: '',
      defaultJoinCode: '',
      firebaseApiKey: '',
      firebaseProjectId: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: '',
      firebaseAndroidAppId: '',
      firebaseIosAppId: '',
      firebaseWebAppId: '',
      firebaseAuthDomain: '',
      firebaseStorageBucket: '',
      firebaseIosBundleId: '',
    );
  }

  final String apiBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String authBridgeUrl;
  final String defaultJoinCode;
  final String firebaseApiKey;
  final String firebaseProjectId;
  final String firebaseMessagingSenderId;
  final String firebaseAppId;
  final String firebaseAndroidAppId;
  final String firebaseIosAppId;
  final String firebaseWebAppId;
  final String firebaseAuthDomain;
  final String firebaseStorageBucket;
  final String firebaseIosBundleId;

  bool get hasPublicApi => apiBaseUrl.isNotEmpty;

  bool get hasSupabase => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;

  bool get hasFirebase =>
      firebaseOptions != null || canBootstrapFirebaseNatively;

  bool get hasFirebaseBaseConfig =>
      firebaseApiKey.isNotEmpty &&
      firebaseProjectId.isNotEmpty &&
      firebaseMessagingSenderId.isNotEmpty;

  bool get canBootstrapFirebaseNatively {
    if (!hasFirebaseBaseConfig || kIsWeb) {
      return false;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return true;
      default:
        return false;
    }
  }

  String get resolvedBridgeUrl {
    if (authBridgeUrl.isNotEmpty) {
      return authBridgeUrl;
    }

    if (hasSupabase) {
      return '$supabaseUrl/functions/v1/firebase-auth-bridge';
    }

    return '';
  }

  FirebaseOptions? get firebaseOptions {
    if (firebaseApiKey.isEmpty ||
        firebaseProjectId.isEmpty ||
        firebaseMessagingSenderId.isEmpty) {
      return null;
    }

    final resolvedAppId = _resolveFirebaseAppId();
    if (resolvedAppId.isEmpty) {
      return null;
    }

    return FirebaseOptions(
      apiKey: firebaseApiKey,
      appId: resolvedAppId,
      messagingSenderId: firebaseMessagingSenderId,
      projectId: firebaseProjectId,
      authDomain: firebaseAuthDomain.isEmpty ? null : firebaseAuthDomain,
      storageBucket: firebaseStorageBucket.isEmpty
          ? null
          : firebaseStorageBucket,
      iosBundleId: firebaseIosBundleId.isEmpty ? null : firebaseIosBundleId,
    );
  }

  Uri? publicApiUri(String path) {
    if (!hasPublicApi) {
      return null;
    }

    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$apiBaseUrl$normalizedPath');
  }

  String _resolveFirebaseAppId() {
    if (kIsWeb) {
      return firebaseWebAppId.isNotEmpty ? firebaseWebAppId : firebaseAppId;
    }

    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return firebaseAndroidAppId.isNotEmpty
            ? firebaseAndroidAppId
            : firebaseAppId;
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return firebaseIosAppId.isNotEmpty ? firebaseIosAppId : firebaseAppId;
      default:
        return firebaseAppId;
    }
  }
}

String _normalizeUrl(String value) {
  final normalized = value.trim();
  if (normalized.isEmpty) {
    return '';
  }

  return normalized.endsWith('/')
      ? normalized.substring(0, normalized.length - 1)
      : normalized;
}
