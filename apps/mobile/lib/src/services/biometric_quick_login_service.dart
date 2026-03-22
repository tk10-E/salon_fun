import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

enum QuickBiometricKind { fingerprint, face, generic }

class BiometricQuickLoginState {
  const BiometricQuickLoginState({
    required this.isSupported,
    required this.hasSavedCredentials,
    required this.kind,
  });

  const BiometricQuickLoginState.unsupported()
    : isSupported = false,
      hasSavedCredentials = false,
      kind = QuickBiometricKind.generic;

  final bool isSupported;
  final bool hasSavedCredentials;
  final QuickBiometricKind kind;

  String get actionLabel {
    switch (kind) {
      case QuickBiometricKind.fingerprint:
        return 'Entrar com impressão digital';
      case QuickBiometricKind.face:
        return 'Entrar com reconhecimento facial';
      case QuickBiometricKind.generic:
        return 'Entrar com biometria';
    }
  }

  String get optInLabel {
    switch (kind) {
      case QuickBiometricKind.fingerprint:
        return 'Ativar impressão digital neste aparelho';
      case QuickBiometricKind.face:
        return 'Ativar reconhecimento facial neste aparelho';
      case QuickBiometricKind.generic:
        return 'Ativar biometria neste aparelho';
    }
  }
}

class BiometricQuickLoginCredentials {
  const BiometricQuickLoginCredentials({
    required this.email,
    required this.password,
  });

  final String email;
  final String password;
}

class BiometricQuickLoginService {
  BiometricQuickLoginService({
    LocalAuthentication? localAuthentication,
    FlutterSecureStorage? secureStorage,
  }) : _localAuthentication = localAuthentication ?? LocalAuthentication(),
       _secureStorage =
           secureStorage ??
           const FlutterSecureStorage(
             aOptions: AndroidOptions(
               encryptedSharedPreferences: true,
               resetOnError: true,
             ),
             iOptions: IOSOptions(
               accessibility: KeychainAccessibility.first_unlock_this_device,
             ),
           );

  final LocalAuthentication _localAuthentication;
  final FlutterSecureStorage _secureStorage;

  static const _emailKey = 'quick_login_email';
  static const _passwordKey = 'quick_login_password';

  Future<BiometricQuickLoginState> getState() async {
    if (kIsWeb) {
      return const BiometricQuickLoginState.unsupported();
    }

    try {
      final canUseBiometric =
          await _localAuthentication.isDeviceSupported() &&
          await _localAuthentication.canCheckBiometrics;
      if (!canUseBiometric) {
        return const BiometricQuickLoginState.unsupported();
      }

      final availableBiometrics = await _localAuthentication
          .getAvailableBiometrics();

      final email = await _secureStorage.read(key: _emailKey);
      final password = await _secureStorage.read(key: _passwordKey);

      return BiometricQuickLoginState(
        isSupported: true,
        hasSavedCredentials:
            (email?.trim().isNotEmpty ?? false) &&
            (password?.trim().isNotEmpty ?? false),
        kind: _detectKind(availableBiometrics),
      );
    } catch (_) {
      return const BiometricQuickLoginState.unsupported();
    }
  }

  Future<void> saveCredentials({
    required String email,
    required String password,
  }) async {
    await _secureStorage.write(key: _emailKey, value: email.trim());
    await _secureStorage.write(key: _passwordKey, value: password);
  }

  Future<void> clearSavedCredentials() async {
    await _secureStorage.delete(key: _emailKey);
    await _secureStorage.delete(key: _passwordKey);
  }

  Future<BiometricQuickLoginCredentials?> authenticateAndReadCredentials({
    required QuickBiometricKind kind,
  }) async {
    try {
      final authenticated = await _localAuthentication.authenticate(
        localizedReason: _localizedReason(kind),
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          sensitiveTransaction: true,
        ),
      );

      if (!authenticated) {
        return null;
      }

      final email = await _secureStorage.read(key: _emailKey);
      final password = await _secureStorage.read(key: _passwordKey);
      if (email == null ||
          email.trim().isEmpty ||
          password == null ||
          password.isEmpty) {
        return null;
      }

      return BiometricQuickLoginCredentials(
        email: email.trim(),
        password: password,
      );
    } catch (_) {
      return null;
    }
  }

  QuickBiometricKind _detectKind(List<BiometricType> types) {
    if (types.contains(BiometricType.face)) {
      return QuickBiometricKind.face;
    }

    if (types.contains(BiometricType.fingerprint) ||
        types.contains(BiometricType.strong) ||
        types.contains(BiometricType.weak)) {
      return QuickBiometricKind.fingerprint;
    }

    return QuickBiometricKind.generic;
  }

  String _localizedReason(QuickBiometricKind kind) {
    switch (kind) {
      case QuickBiometricKind.fingerprint:
        return 'Confirme sua impressão digital para entrar no app.';
      case QuickBiometricKind.face:
        return 'Confirme seu rosto para entrar no app.';
      case QuickBiometricKind.generic:
        return 'Confirme sua biometria para entrar no app.';
    }
  }
}
