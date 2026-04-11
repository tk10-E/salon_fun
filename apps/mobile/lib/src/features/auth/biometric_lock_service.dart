import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class BiometricLockService {
  BiometricLockService({
    LocalAuthentication? localAuth,
    Future<SharedPreferences> Function()? prefsLoader,
    bool disableBiometrics = false,
  }) : _localAuth = localAuth ?? LocalAuthentication(),
       _prefsLoader = prefsLoader ?? SharedPreferences.getInstance,
       _disableBiometrics = disableBiometrics;

  static const _biometricEnabledKey = 'auth.biometric_enabled';

  final LocalAuthentication _localAuth;
  final Future<SharedPreferences> Function() _prefsLoader;
  final bool _disableBiometrics;

  bool _initialized = false;
  bool _isSupported = false;
  bool _isEnabled = false;

  bool get canUseBiometricLock => _isSupported && _isEnabled;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    _initialized = true;
    if (_disableBiometrics) {
      _isSupported = false;
      _isEnabled = false;
      return;
    }

    final prefs = await _prefsLoader();
    final savedPreference = prefs.getBool(_biometricEnabledKey) ?? false;

    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isSupported = await _localAuth.isDeviceSupported();
      final enrolled = await _localAuth.getAvailableBiometrics();
      _isSupported = (canCheck || isSupported) && enrolled.isNotEmpty;
    } on PlatformException {
      _isSupported = false;
    }

    _isEnabled = _isSupported && savedPreference;
  }

  Future<void> markEnabledAfterLogin() async {
    await initialize();
    if (!_isSupported) {
      return;
    }

    _isEnabled = true;
    final prefs = await _prefsLoader();
    await prefs.setBool(_biometricEnabledKey, true);
  }

  Future<bool> authenticate() async {
    await initialize();
    if (!canUseBiometricLock) {
      return false;
    }

    try {
      return await _localAuth.authenticate(
        localizedReason:
            'Use sua impressão digital para entrar no app do salão.',
        biometricOnly: true,
        persistAcrossBackgrounding: true,
      );
    } on PlatformException {
      return false;
    }
  }
}
