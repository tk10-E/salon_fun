import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/observability/client_performance_reporter.dart';
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
    this.clientPerformanceReporter,
    required this.profileRepository,
    required this.publicSalonRepository,
    required this.defaultJoinCode,
    Future<SharedPreferences> Function()? prefsLoader,
  }) : _prefsLoader = prefsLoader ?? SharedPreferences.getInstance;

  static const _lastJoinCodeKey = 'auth.last_join_code';
  static const _landingDataCacheKey = 'auth.cached_landing_data';
  static const _customerProfileCacheKey = 'auth.cached_customer_profile';
  static const _deviceLockEnabledKey = 'auth.biometric_enabled';
  static const _installationMarkerKey = 'auth.installation_marker_v1';
  static const _landingRefreshMinInterval = Duration(seconds: 30);
  static const _sessionRefreshMinInterval = Duration(seconds: 45);
  static const _biometricUnlockSyncRetryDelays = <Duration>[
    Duration.zero,
    Duration(milliseconds: 280),
    Duration(milliseconds: 720),
  ];

  final AuthService authService;
  final BiometricLockService biometricLockService;
  final ClientPerformanceReporter? clientPerformanceReporter;
  final ProfileRepository profileRepository;
  final PublicSalonRepository publicSalonRepository;
  final String defaultJoinCode;
  final Future<SharedPreferences> Function() _prefsLoader;

  SessionStage _stage = SessionStage.loading;
  AppSession? _session;
  SalonLandingData? _joinPreview;
  String? _message;
  bool _busy = false;
  bool _requiresBiometricUnlock = false;
  int _previewTicket = 0;
  DateTime? _lastLandingRefreshAt;
  DateTime? _lastSessionRefreshAt;
  Future<bool>? _landingRefreshInFlight;
  Future<bool>? _sessionRefreshInFlight;

  SessionStage get stage => _stage;
  AppSession? get session => _session;
  SalonLandingData? get joinPreview => _joinPreview;
  String? get message => _message;
  bool get isBusy => _busy;
  bool get requiresBiometricUnlock => _requiresBiometricUnlock;
  bool get canUseBiometricUnlock => biometricLockService.canUseBiometricLock;

  Future<void> restoreSession() async {
    await _tracePerformance<void>(
      operation: 'session.restore',
      route: '/login',
      slowThresholdMs: 1200,
      surface: 'auth',
      action: () async {
        _message = null;
        _stage = SessionStage.loading;
        _requiresBiometricUnlock = false;
        notifyListeners();

        String? restoredJoinCode;
        SalonLandingData? cachedLandingData;
        CustomerProfile? cachedCustomerProfile;

        try {
          await biometricLockService.initialize();
          restoredJoinCode = await _loadRestoredJoinCode();
          cachedLandingData = await _loadCachedLandingData(
            expectedJoinCode: restoredJoinCode,
          );
          cachedCustomerProfile = await _loadCachedCustomerProfile();
          if (cachedLandingData != null) {
            _joinPreview = cachedLandingData;
            notifyListeners();
          }

          final installScopedSessionWasReset =
              await _resetPersistedSessionIfAppWasReinstalled();
          if (installScopedSessionWasReset) {
            _message = null;
          }

          final restoredSupabaseSession = await authService
              .restoreSupabaseSessionFromFirebase();
          final hasPersistedAuthenticatedSession =
              restoredSupabaseSession ||
              authService.hasPersistedAuthenticatedSession;
          final customer = await _fetchCurrentCustomerSafely();
          final resolvedCustomer =
              customer ??
              (hasPersistedAuthenticatedSession ? cachedCustomerProfile : null);

          if (resolvedCustomer == null) {
            if (!hasPersistedAuthenticatedSession) {
              await _storeCachedCustomerProfile(null);
            }
            await biometricLockService.clearSavedLockPreference();
            _stage = SessionStage.signedOut;
            _session = null;
            notifyListeners();
            return;
          }

          if (customer != null) {
            await biometricLockService.markEnabledAfterLogin();
            await _storeCachedCustomerProfile(customer);
          }
          final resolvedJoinCode =
              _normalizeStoredJoinCode(restoredJoinCode) ??
              _normalizeStoredJoinCode(_joinPreview?.preview.joinCode);
          final requiresBiometricUnlock =
              biometricLockService.canUseBiometricLock;
          _applyAuthenticatedSession(
            customer: resolvedCustomer,
            joinCode: resolvedJoinCode,
            landingData: _joinPreview ?? cachedLandingData,
            requiresBiometricUnlock: requiresBiometricUnlock,
          );
          _schedulePostRestoreSync(
            requiresBiometricUnlock: requiresBiometricUnlock,
            shouldRefreshAuthenticatedSession: customer == null,
          );
        } catch (error) {
          final hasPersistedAuthenticatedSession =
              authService.hasPersistedAuthenticatedSession;
          if (cachedCustomerProfile != null &&
              hasPersistedAuthenticatedSession) {
            final resolvedJoinCode =
                _normalizeStoredJoinCode(restoredJoinCode) ??
                _normalizeStoredJoinCode(_joinPreview?.preview.joinCode);
            final requiresBiometricUnlock =
                biometricLockService.canUseBiometricLock;
            _applyAuthenticatedSession(
              customer: cachedCustomerProfile,
              joinCode: resolvedJoinCode,
              landingData: _joinPreview ?? cachedLandingData,
              requiresBiometricUnlock: requiresBiometricUnlock,
            );
            _schedulePostRestoreSync(
              requiresBiometricUnlock: requiresBiometricUnlock,
              shouldRefreshAuthenticatedSession: true,
            );
            return;
          }

          _message = _presentableError(error);
          _stage = SessionStage.signedOut;
          _session = null;
          _requiresBiometricUnlock = false;
          notifyListeners();
        }
      },
    );
  }

  Future<void> previewSalon(String joinCode) async {
    final normalized = normalizeJoinCode(joinCode);
    final ticket = ++_previewTicket;
    if (normalized.length < 4) {
      _joinPreview = null;
      notifyListeners();
      return;
    }

    final preview =
        await _fetchLandingSafely(normalized, bypassCache: true) ??
        await _loadCachedLandingData(expectedJoinCode: normalized);
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

  Future<bool> signInWithGoogle({
    required String joinCode,
    String customerName = '',
  }) async {
    return _runBusy(() async {
      _message = null;
      final normalizedJoinCode = normalizeJoinCode(joinCode);
      await authService.signInWithGoogle(
        joinCode: normalizedJoinCode,
        customerName: customerName,
      );
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
      await biometricLockService.clearSavedLockPreference();
      await _storeJoinCode(null);
      await _storeLandingData(null);
      await _storeCachedCustomerProfile(null);
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
      _message = null;
      notifyListeners();
      final didRestoreUnlockedSession =
          await _syncAuthenticatedSessionAfterBiometricUnlock();
      if (!didRestoreUnlockedSession) {
        _message =
            'Ainda estamos retomando sua sessao neste aparelho. Tente novamente em alguns segundos.';
        notifyListeners();
        return false;
      }
      _requiresBiometricUnlock = false;
      notifyListeners();
      return true;
    }

    _message = 'Não foi possível validar a segurança do aparelho.';
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
    return _refreshLandingDataInternal(force: true);
  }

  Future<bool> refreshLandingDataIfNeeded() async {
    return _refreshLandingDataInternal(force: false);
  }

  Future<bool> refreshAuthenticatedSession() async {
    return _refreshAuthenticatedSessionInternal(force: true);
  }

  Future<bool> refreshAuthenticatedSessionIfNeeded() async {
    return _refreshAuthenticatedSessionInternal(force: false);
  }

  Future<bool> _refreshLandingDataInternal({required bool force}) async {
    final inFlight = _landingRefreshInFlight;
    if (inFlight != null) {
      return inFlight;
    }

    if (!force) {
      final lastRefreshAt = _lastLandingRefreshAt;
      if (lastRefreshAt != null &&
          DateTime.now().difference(lastRefreshAt) <
              _landingRefreshMinInterval) {
        return false;
      }
    }

    final future = _refreshLandingDataNow();
    _landingRefreshInFlight = future;
    try {
      return await future;
    } finally {
      if (identical(_landingRefreshInFlight, future)) {
        _landingRefreshInFlight = null;
      }
    }
  }

  Future<bool> _refreshAuthenticatedSessionInternal({
    required bool force,
  }) async {
    final inFlight = _sessionRefreshInFlight;
    if (inFlight != null) {
      return inFlight;
    }

    if (!force) {
      final lastRefreshAt = _lastSessionRefreshAt;
      if (lastRefreshAt != null &&
          DateTime.now().difference(lastRefreshAt) <
              _sessionRefreshMinInterval) {
        return false;
      }
    }

    final future = _refreshAuthenticatedSessionNow();
    _sessionRefreshInFlight = future;
    try {
      return await future;
    } finally {
      if (identical(_sessionRefreshInFlight, future)) {
        _sessionRefreshInFlight = null;
      }
    }
  }

  Future<bool> _refreshLandingDataNow() async {
    return _tracePerformance<bool>(
      operation: 'session.refreshLanding',
      route: '/inicio',
      slowThresholdMs: 950,
      surface: 'auth',
      action: () async {
        final current = _session;
        if (current == null) {
          return false;
        }

        final joinCode =
            _normalizeStoredJoinCode(current.joinCode) ??
            _normalizeStoredJoinCode(current.landingData?.preview.joinCode);
        if (joinCode == null) {
          return false;
        }

        final cachedLanding =
            current.landingData ??
            await _loadCachedLandingData(expectedJoinCode: joinCode);
        final landing =
            await _fetchLandingSafely(
              joinCode,
              bypassCache: true,
              persist: false,
            ) ??
            cachedLanding;
        if (landing == null) {
          return false;
        }

        final latestSession = _session;
        final latestJoinCode =
            _normalizeStoredJoinCode(latestSession?.joinCode) ??
            _normalizeStoredJoinCode(
              latestSession?.landingData?.preview.joinCode,
            );
        if (latestSession == null ||
            latestSession.customer.id != current.customer.id ||
            latestJoinCode != joinCode) {
          return false;
        }

        final resolvedJoinCode =
            _normalizeStoredJoinCode(joinCode) ??
            _normalizeStoredJoinCode(landing.preview.joinCode);
        _lastLandingRefreshAt = DateTime.now();
        await _storeJoinCode(resolvedJoinCode);
        await _storeLandingData(landing);
        _session = latestSession.copyWith(
          landingData: landing,
          joinCode: resolvedJoinCode,
        );
        notifyListeners();
        return true;
      },
    );
  }

  Future<bool> _refreshAuthenticatedSessionNow() async {
    return _tracePerformance<bool>(
      operation: 'session.refreshAuthenticated',
      route: '/inicio',
      slowThresholdMs: 950,
      surface: 'auth',
      action: () async {
        final current = _session;
        if (_stage != SessionStage.authenticated || current == null) {
          return false;
        }

        final restoredSupabaseSession = await authService
            .restoreSupabaseSessionFromFirebase();
        final hasPersistedAuthenticatedSession =
            restoredSupabaseSession ||
            authService.hasPersistedAuthenticatedSession;
        _lastSessionRefreshAt = DateTime.now();
        if (!hasPersistedAuthenticatedSession) {
          return false;
        }

        final customer = await _fetchCurrentCustomerSafely();
        if (customer == null) {
          return restoredSupabaseSession;
        }

        await _storeCachedCustomerProfile(customer);

        final latestSession = _session;
        if (latestSession == null ||
            latestSession.customer.id != current.customer.id) {
          return false;
        }

        if (_sameCustomerProfile(latestSession.customer, customer)) {
          return true;
        }

        _session = latestSession.copyWith(customer: customer);
        notifyListeners();
        return true;
      },
    );
  }

  Future<bool> _runBusy(Future<bool> Function() action) async {
    _busy = true;
    notifyListeners();
    try {
      return await action();
    } catch (error) {
      _message = _presentableError(error);
      notifyListeners();
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<T> _tracePerformance<T>({
    required String operation,
    required String route,
    required int slowThresholdMs,
    required String surface,
    required Future<T> Function() action,
  }) {
    final reporter = clientPerformanceReporter;
    if (reporter == null) {
      return action();
    }

    return reporter.trace<T>(
      operation: operation,
      route: route,
      slowThresholdMs: slowThresholdMs,
      surface: surface,
      action: action,
    );
  }

  Future<void> _completeAuthenticatedSession(String normalizedJoinCode) async {
    final customer = await profileRepository.fetchCurrentCustomer();
    if (customer == null) {
      throw Exception('A conta entrou, mas não foi vinculada ao salão.');
    }

    final resolvedJoinCode =
        _normalizeStoredJoinCode(normalizedJoinCode) ??
        _normalizeStoredJoinCode(_joinPreview?.preview.joinCode);
    final previewLandingData =
        _landingDataMatchesJoinCode(_joinPreview, resolvedJoinCode)
        ? _joinPreview
        : null;
    final cachedLandingData = await _loadCachedLandingData(
      expectedJoinCode: resolvedJoinCode,
    );
    final resolvedLandingData = previewLandingData ?? cachedLandingData;

    await _storeJoinCode(resolvedJoinCode);
    await _storeLandingData(resolvedLandingData);
    await _storeCachedCustomerProfile(customer);

    _applyAuthenticatedSession(
      customer: customer,
      joinCode: resolvedJoinCode,
      landingData: resolvedLandingData,
      requiresBiometricUnlock: false,
    );
    _refreshLandingAfterSessionReady();
  }

  void _refreshLandingAfterSessionReady() {
    unawaited(refreshLandingData().catchError((_) => false));
  }

  void _refreshAuthenticatedSessionAfterRestore() {
    unawaited(refreshAuthenticatedSession().catchError((_) => false));
  }

  void _schedulePostRestoreSync({
    required bool requiresBiometricUnlock,
    required bool shouldRefreshAuthenticatedSession,
  }) {
    if (requiresBiometricUnlock) {
      return;
    }

    if (shouldRefreshAuthenticatedSession) {
      _refreshAuthenticatedSessionAfterRestore();
    }
    _refreshLandingAfterSessionReady();
  }

  Future<bool> _syncAuthenticatedSessionAfterBiometricUnlock() async {
    for (final delay in _biometricUnlockSyncRetryDelays) {
      if (delay > Duration.zero) {
        await Future<void>.delayed(delay);
      }

      final didRefreshAuthenticatedSession = await refreshAuthenticatedSession()
          .catchError((_) => false);
      if (!didRefreshAuthenticatedSession) {
        continue;
      }

      await refreshLandingData().catchError((_) => false);
      return true;
    }

    return false;
  }

  bool _landingDataMatchesJoinCode(
    SalonLandingData? landingData,
    String? joinCode,
  ) {
    final normalizedJoinCode = _normalizeStoredJoinCode(joinCode);
    if (landingData == null || normalizedJoinCode == null) {
      return false;
    }

    return _normalizeStoredJoinCode(landingData.preview.joinCode) ==
        normalizedJoinCode;
  }

  Future<String> _loadRestoredJoinCode() async {
    final prefs = await _prefsLoader();
    final storedJoinCode = _normalizeStoredJoinCode(
      prefs.getString(_lastJoinCodeKey),
    );
    return storedJoinCode ?? normalizeJoinCode(defaultJoinCode);
  }

  Future<void> _storeJoinCode(String? joinCode) async {
    final prefs = await _prefsLoader();
    final normalizedJoinCode = _normalizeStoredJoinCode(joinCode);

    if (normalizedJoinCode == null) {
      await prefs.remove(_lastJoinCodeKey);
      return;
    }

    await prefs.setString(_lastJoinCodeKey, normalizedJoinCode);
  }

  Future<bool> _resetPersistedSessionIfAppWasReinstalled() async {
    final prefs = await _prefsLoader();
    final hasInstallationMarker =
        prefs.getBool(_installationMarkerKey) ?? false;
    if (hasInstallationMarker) {
      return false;
    }

    final hasLocalInstallState =
        prefs.containsKey(_lastJoinCodeKey) ||
        prefs.containsKey(_landingDataCacheKey) ||
        prefs.containsKey(_customerProfileCacheKey) ||
        prefs.containsKey(_deviceLockEnabledKey);
    await prefs.setBool(_installationMarkerKey, true);

    if (hasLocalInstallState || !authService.hasPersistedAuthenticatedSession) {
      return false;
    }

    await authService.signOut();
    return true;
  }

  Future<SalonLandingData?> _fetchLandingSafely(
    String joinCode, {
    bool bypassCache = false,
    bool persist = true,
  }) async {
    final normalizedJoinCode = _normalizeStoredJoinCode(joinCode);
    if (normalizedJoinCode == null) {
      return null;
    }

    try {
      final landingData = await publicSalonRepository.fetchLanding(
        normalizedJoinCode,
        bypassCache: bypassCache,
      );
      if (landingData != null) {
        if (persist) {
          _lastLandingRefreshAt = DateTime.now();
          await _storeLandingData(landingData);
        }
      }
      return landingData;
    } catch (_) {
      return null;
    }
  }

  Future<SalonLandingData?> _loadCachedLandingData({
    String? expectedJoinCode,
  }) async {
    final prefs = await _prefsLoader();
    final cachedPayload = prefs.getString(_landingDataCacheKey);
    if (cachedPayload == null || cachedPayload.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(cachedPayload);
      if (decoded is! Map) {
        await prefs.remove(_landingDataCacheKey);
        return null;
      }

      final landingData = SalonLandingData.fromJson(
        decoded.cast<String, dynamic>(),
      );
      final normalizedExpectedJoinCode = _normalizeStoredJoinCode(
        expectedJoinCode,
      );
      final cachedJoinCode = _normalizeStoredJoinCode(
        landingData.preview.joinCode,
      );
      if (normalizedExpectedJoinCode != null &&
          cachedJoinCode != normalizedExpectedJoinCode) {
        return null;
      }
      return landingData;
    } catch (_) {
      await prefs.remove(_landingDataCacheKey);
      return null;
    }
  }

  Future<void> _storeLandingData(SalonLandingData? landingData) async {
    final prefs = await _prefsLoader();
    if (landingData == null) {
      await prefs.remove(_landingDataCacheKey);
      return;
    }

    await prefs.setString(
      _landingDataCacheKey,
      jsonEncode(landingData.toJson()),
    );
  }

  Future<CustomerProfile?> _fetchCurrentCustomerSafely() async {
    try {
      return await profileRepository.fetchCurrentCustomer();
    } catch (_) {
      return null;
    }
  }

  Future<CustomerProfile?> _loadCachedCustomerProfile() async {
    final prefs = await _prefsLoader();
    final cachedPayload = prefs.getString(_customerProfileCacheKey);
    if (cachedPayload == null || cachedPayload.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(cachedPayload);
      if (decoded is! Map) {
        await prefs.remove(_customerProfileCacheKey);
        return null;
      }

      return CustomerProfile.fromMap(decoded.cast<String, dynamic>());
    } catch (_) {
      await prefs.remove(_customerProfileCacheKey);
      return null;
    }
  }

  Future<void> _storeCachedCustomerProfile(CustomerProfile? customer) async {
    final prefs = await _prefsLoader();
    if (customer == null) {
      await prefs.remove(_customerProfileCacheKey);
      return;
    }

    await prefs.setString(
      _customerProfileCacheKey,
      jsonEncode(customer.toJson()),
    );
  }

  void _applyAuthenticatedSession({
    required CustomerProfile customer,
    required String? joinCode,
    required SalonLandingData? landingData,
    required bool requiresBiometricUnlock,
  }) {
    _session = AppSession(
      customer: customer,
      joinCode: joinCode,
      landingData: landingData,
    );
    _stage = SessionStage.authenticated;
    _requiresBiometricUnlock = requiresBiometricUnlock;
    notifyListeners();
  }

  bool _sameCustomerProfile(CustomerProfile current, CustomerProfile next) {
    return current.id == next.id &&
        current.salonId == next.salonId &&
        current.authUserId == next.authUserId &&
        current.name == next.name &&
        current.phone == next.phone &&
        current.email == next.email &&
        dateOnlyToIsoString(current.birthDate) ==
            dateOnlyToIsoString(next.birthDate) &&
        current.profileImagePath == next.profileImagePath &&
        current.referralCode == next.referralCode &&
        current.consentStatus == next.consentStatus;
  }

  String? _normalizeStoredJoinCode(String? value) {
    final normalized = normalizeJoinCode(value ?? '');
    return normalized.isEmpty ? null : normalized;
  }

  String _presentableError(Object error) {
    final raw = '$error'.replaceFirst('Exception: ', '').trim();
    final normalized = raw.toLowerCase();
    if (normalized.contains('invalid_salon_code')) {
      return 'Código do salão inválido. Confira o código no painel do salão e tente novamente.';
    }

    return raw.isEmpty
        ? 'Não foi possível concluir agora. Tente novamente.'
        : raw;
  }
}
