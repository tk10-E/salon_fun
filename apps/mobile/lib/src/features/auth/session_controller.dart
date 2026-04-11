import 'package:flutter/foundation.dart';

import '../../core/utils/formatters.dart';
import '../profile/profile_repository.dart';
import '../shared/app_models.dart';
import '../shared/public_salon_repository.dart';
import 'auth_service.dart';
import 'biometric_lock_service.dart';

class SessionController extends ChangeNotifier {
  SessionController({
    required this.authService,
    required this.biometricLockService,
    required this.profileRepository,
    required this.publicSalonRepository,
    required this.defaultJoinCode,
  });

  final AuthService authService;
  final BiometricLockService biometricLockService;
  final ProfileRepository profileRepository;
  final PublicSalonRepository publicSalonRepository;
  final String defaultJoinCode;

  SessionStage _stage = SessionStage.loading;
  AppSession? _session;
  SalonLandingData? _joinPreview;
  String? _message;
  bool _busy = false;
  bool _requiresBiometricUnlock = false;
  int _previewTicket = 0;

  SessionStage get stage => _stage;
  AppSession? get session => _session;
  SalonLandingData? get joinPreview => _joinPreview;
  String? get message => _message;
  bool get isBusy => _busy;
  bool get requiresBiometricUnlock => _requiresBiometricUnlock;
  bool get canUseBiometricUnlock => biometricLockService.canUseBiometricLock;

  Future<void> restoreSession() async {
    _message = null;
    _stage = SessionStage.loading;
    _requiresBiometricUnlock = false;
    notifyListeners();

    try {
      await biometricLockService.initialize();
      if (defaultJoinCode.isNotEmpty) {
        _joinPreview = await publicSalonRepository.fetchLanding(
          defaultJoinCode,
          bypassCache: true,
        );
        notifyListeners();
      }

      await authService.restoreSupabaseSessionFromFirebase();
      final customer = await profileRepository.fetchCurrentCustomer();
      if (customer == null) {
        _stage = SessionStage.signedOut;
        _session = null;
        notifyListeners();
        return;
      }

      _session = AppSession(
        customer: customer,
        joinCode: defaultJoinCode.isEmpty ? null : defaultJoinCode,
        landingData: _joinPreview,
      );
      _stage = SessionStage.authenticated;
      _requiresBiometricUnlock = biometricLockService.canUseBiometricLock;
      notifyListeners();
    } catch (error) {
      _message = '$error'.replaceFirst('Exception: ', '');
      _stage = SessionStage.signedOut;
      _session = null;
      _requiresBiometricUnlock = false;
      notifyListeners();
    }
  }

  Future<void> previewSalon(String joinCode) async {
    final normalized = normalizeJoinCode(joinCode);
    final ticket = ++_previewTicket;
    if (normalized.length < 4) {
      _joinPreview = null;
      notifyListeners();
      return;
    }

    final preview = await publicSalonRepository.fetchLanding(
      normalized,
      bypassCache: true,
    );
    if (ticket != _previewTicket) {
      return;
    }

    _joinPreview = preview;
    notifyListeners();
  }

  Future<bool> signIn({
    required String joinCode,
    required String email,
    required String password,
    required String customerName,
  }) async {
    return _runBusy(() async {
      _message = null;
      final normalizedJoinCode = normalizeJoinCode(joinCode);
      await authService.signIn(
        joinCode: normalizedJoinCode,
        email: email,
        password: password,
        customerName: customerName,
      );
      await biometricLockService.markEnabledAfterLogin();
      await _completeAuthenticatedSession(normalizedJoinCode);
      return true;
    });
  }

  Future<bool> signInWithGoogle({required String joinCode}) async {
    return _runBusy(() async {
      _message = null;
      final normalizedJoinCode = normalizeJoinCode(joinCode);
      await authService.signInWithGoogle(joinCode: normalizedJoinCode);
      await biometricLockService.markEnabledAfterLogin();
      await _completeAuthenticatedSession(normalizedJoinCode);
      return true;
    });
  }

  Future<String?> signUp({
    required String email,
    required String password,
    required String customerName,
  }) async {
    String? result;
    await _runBusy(() async {
      _message = null;
      result = await authService.signUp(
        email: email,
        password: password,
        customerName: customerName,
      );
      _stage = SessionStage.signedOut;
      notifyListeners();
      return true;
    });
    return result;
  }

  Future<void> sendPasswordReset(String email) async {
    await _runBusy(() async {
      _message = null;
      await authService.sendPasswordReset(email);
      _message = 'Enviamos um link de recuperação para o seu e-mail.';
      notifyListeners();
      return true;
    });
  }

  Future<void> signOut() async {
    await _runBusy(() async {
      await authService.signOut();
      _session = null;
      _stage = SessionStage.signedOut;
      _requiresBiometricUnlock = false;
      notifyListeners();
      return true;
    });
  }

  Future<bool> unlockWithBiometrics() async {
    if (!_requiresBiometricUnlock) {
      return true;
    }

    final didAuthenticate = await biometricLockService.authenticate();
    if (didAuthenticate) {
      _requiresBiometricUnlock = false;
      _message = null;
      notifyListeners();
      return true;
    }

    _message = 'Não foi possível validar sua impressão digital.';
    notifyListeners();
    return false;
  }

  void lockForBiometrics() {
    if (_stage != SessionStage.authenticated || !canUseBiometricUnlock) {
      return;
    }

    _requiresBiometricUnlock = true;
    notifyListeners();
  }

  Future<bool> refreshLandingData() async {
    final current = _session;
    if (current == null ||
        current.joinCode == null ||
        current.joinCode!.isEmpty) {
      return false;
    }

    final landing = await publicSalonRepository.fetchLanding(
      current.joinCode!,
      bypassCache: true,
    );
    if (landing == null) {
      return false;
    }

    _session = current.copyWith(landingData: landing);
    notifyListeners();
    return true;
  }

  Future<bool> _runBusy(Future<bool> Function() action) async {
    _busy = true;
    notifyListeners();
    try {
      return await action();
    } catch (error) {
      _message = '$error'.replaceFirst('Exception: ', '');
      notifyListeners();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<void> _completeAuthenticatedSession(String normalizedJoinCode) async {
    final customer = await profileRepository.fetchCurrentCustomer();
    if (customer == null) {
      throw Exception('A conta entrou, mas não foi vinculada ao salão.');
    }

    final landingData = normalizedJoinCode.isEmpty
        ? _joinPreview
        : await publicSalonRepository.fetchLanding(
            normalizedJoinCode,
            bypassCache: true,
          );

    _session = AppSession(
      customer: customer,
      joinCode: normalizedJoinCode.isEmpty ? null : normalizedJoinCode,
      landingData: landingData ?? _joinPreview,
    );
    _stage = SessionStage.authenticated;
    _requiresBiometricUnlock = false;
    notifyListeners();
  }
}
