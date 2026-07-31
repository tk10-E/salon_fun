import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract class DeviceAuthenticator {
  Future<bool> isDeviceSupported();

  Future<bool> canCheckBiometrics();

  Future<bool> authenticate({required String localizedReason});
}

class LocalAuthDeviceAuthenticator implements DeviceAuthenticator {
  LocalAuthDeviceAuthenticator({LocalAuthentication? localAuth})
    : _localAuth = localAuth ?? LocalAuthentication();

  final LocalAuthentication _localAuth;

  @override
  Future<bool> isDeviceSupported() {
    return _localAuth.isDeviceSupported();
  }

  @override
  Future<bool> canCheckBiometrics() {
    return _localAuth.canCheckBiometrics;
  }

  @override
  Future<bool> authenticate({required String localizedReason}) {
    return _localAuth.authenticate(
      localizedReason: localizedReason,
      options: const AuthenticationOptions(
        biometricOnly: false,
        stickyAuth: true,
        sensitiveTransaction: false,
        useErrorDialogs: true,
      ),
    );
  }
}

class BiometricLockService {
  BiometricLockService({
    Future<SharedPreferences> Function()? prefsLoader,
    DeviceAuthenticator? authenticator,
    bool disableBiometrics = false,
  }) : _prefsLoader = prefsLoader ?? SharedPreferences.getInstance,
       _authenticator = authenticator ?? LocalAuthDeviceAuthenticator(),
       _disableBiometrics = disableBiometrics;

  static const _biometricEnabledKey = 'auth.biometric_enabled';
  static const _unlockReason =
      'Confirme sua identidade para abrir sua conta com a segurança do aparelho.';

  final Future<SharedPreferences> Function() _prefsLoader;
  final DeviceAuthenticator _authenticator;
  final bool _disableBiometrics;

  bool _initialized = false;
  bool _isSupported = false;
  bool _isEnabled = false;

  bool get isDisabledByPolicy => _disableBiometrics;
  bool get canUseBiometricLock => _isSupported && _isEnabled;

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    _initialized = true;
    final prefs = await _prefsLoader();
    if (_disableBiometrics) {
      await _clearSavedState(prefs);
      return;
    }

    final persistedEnabled = prefs.getBool(_biometricEnabledKey) ?? false;
    _isSupported = await _detectSupport();
    _isEnabled = _isSupported && persistedEnabled;

    if (!_isSupported && persistedEnabled) {
      await prefs.remove(_biometricEnabledKey);
    }
  }

  Future<void> markEnabledAfterLogin() async {
    await initialize();
    final prefs = await _prefsLoader();

    if (_disableBiometrics) {
      await _clearSavedState(prefs);
      return;
    }

    if (!_isSupported) {
      _isSupported = await _detectSupport();
    }

    if (_isSupported) {
      _isEnabled = true;
      await prefs.setBool(_biometricEnabledKey, true);
      return;
    }

    await _clearSavedState(prefs);
  }

  Future<void> clearSavedLockPreference() async {
    final prefs = await _prefsLoader();
    _initialized = true;
    await _clearSavedState(prefs);
  }

  Future<bool> authenticate() async {
    if (_disableBiometrics || !_isSupported || !_isEnabled) {
      return false;
    }

    try {
      return await _authenticator.authenticate(localizedReason: _unlockReason);
    } on PlatformException {
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _detectSupport() async {
    try {
      final deviceSupported = await _authenticator.isDeviceSupported();
      if (deviceSupported) {
        return true;
      }

      return await _authenticator.canCheckBiometrics();
    } on PlatformException {
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> _clearSavedState(SharedPreferences prefs) async {
    _isSupported = false;
    _isEnabled = false;
    await prefs.remove(_biometricEnabledKey);
  }
}
