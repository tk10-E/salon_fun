import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test(
    'restoreSession reloads the saved salon identity after app reopen',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'd1e438',
      });

      final publicSalonRepository = _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
      );
      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: publicSalonRepository,
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(controller.stage, SessionStage.authenticated);
      expect(controller.session?.joinCode, 'D1E438');
      await pumpEventQueue();
      expect(
        controller.session?.landingData?.preview.heroHeadline,
        'Transformação com cara do seu salão',
      );
      expect(publicSalonRepository.requestedJoinCodes, <String>['D1E438']);
    },
  );

  test('signIn persists the salon code for the next app open', () async {
    final publicSalonRepository = _FakePublicSalonRepository(
      responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
    );
    final controller = SessionController(
      authService: _FakeAuthService(),
      biometricLockService: _FakeBiometricLockService(),
      profileRepository: _FakeProfileRepository(),
      publicSalonRepository: publicSalonRepository,
      defaultJoinCode: '',
      prefsLoader: SharedPreferences.getInstance,
    );

    final success = await controller.signIn(
      joinCode: 'd1e438',
      email: 'cliente@teste.com',
      password: '123456',
      customerName: 'Wesley',
    );

    final prefs = await SharedPreferences.getInstance();
    await pumpEventQueue();

    expect(success, isTrue);
    expect(prefs.getString('auth.last_join_code'), 'D1E438');
    expect(prefs.getString('auth.cached_landing_data'), isNotEmpty);
  });

  test('signIn ignores spaces and separators in the salon code', () async {
    final authService = _FakeAuthService();
    final publicSalonRepository = _FakePublicSalonRepository(
      responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
    );
    final controller = SessionController(
      authService: authService,
      biometricLockService: _FakeBiometricLockService(),
      profileRepository: _FakeProfileRepository(),
      publicSalonRepository: publicSalonRepository,
      defaultJoinCode: '',
      prefsLoader: SharedPreferences.getInstance,
    );

    final success = await controller.signIn(
      joinCode: ' d1 e-438 ',
      email: 'cliente@teste.com',
      password: '123456',
      customerName: 'Wesley',
    );

    final prefs = await SharedPreferences.getInstance();

    expect(success, isTrue);
    expect(authService.lastSignInJoinCode, 'D1E438');
    expect(prefs.getString('auth.last_join_code'), 'D1E438');
    expect(controller.session?.joinCode, 'D1E438');
  });

  test('signIn shows a friendly message for invalid salon codes', () async {
    final controller = SessionController(
      authService: _FakeAuthService(
        signInError: Exception(
          'PostgrestException(message: invalid_salon_code, code: P0001)',
        ),
      ),
      biometricLockService: _FakeBiometricLockService(),
      profileRepository: _FakeProfileRepository(),
      publicSalonRepository: _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{},
      ),
      defaultJoinCode: '',
      prefsLoader: SharedPreferences.getInstance,
    );

    final success = await controller.signIn(
      joinCode: 'errado',
      email: 'cliente@teste.com',
      password: '123456',
      customerName: 'Wesley',
    );

    expect(success, isFalse);
    expect(
      controller.message,
      'Código do salão inválido. Confira o código no painel do salão e tente novamente.',
    );
  });

  test(
    'signInWithGoogle persists the salon code for the next app open',
    () async {
      final publicSalonRepository = _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
      );
      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: publicSalonRepository,
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      final success = await controller.signInWithGoogle(joinCode: 'd1e438');

      final prefs = await SharedPreferences.getInstance();
      await pumpEventQueue();

      expect(success, isTrue);
      expect(prefs.getString('auth.last_join_code'), 'D1E438');
      expect(prefs.getString('auth.cached_landing_data'), isNotEmpty);
    },
  );

  test('signOut clears the saved salon code', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'auth.last_join_code': 'D1E438',
      'auth.cached_landing_data': jsonEncode(_sampleLandingData().toJson()),
      'auth.cached_customer_profile': jsonEncode(
        _sampleCustomerProfile.toJson(),
      ),
      'auth.biometric_enabled': true,
    });

    final controller = SessionController(
      authService: _FakeAuthService(),
      biometricLockService: _FakeBiometricLockService(),
      profileRepository: _FakeProfileRepository(),
      publicSalonRepository: _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
      ),
      defaultJoinCode: '',
      prefsLoader: SharedPreferences.getInstance,
    );

    await controller.restoreSession();
    await controller.signOut();

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.containsKey('auth.last_join_code'), isFalse);
    expect(prefs.containsKey('auth.cached_landing_data'), isFalse);
    expect(prefs.containsKey('auth.cached_customer_profile'), isFalse);
    expect(prefs.containsKey('auth.biometric_enabled'), isFalse);
    expect(controller.stage, SessionStage.signedOut);
  });

  test(
    'restoreSession keeps the last valid salon branding when refresh fails',
    () async {
      final cachedLanding = _sampleLandingData();
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_landing_data': jsonEncode(cachedLanding.toJson()),
      });

      final publicSalonRepository = _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{},
        throwOn: <String>{'D1E438'},
      );
      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: publicSalonRepository,
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(controller.stage, SessionStage.authenticated);
      expect(controller.session?.joinCode, 'D1E438');
      expect(
        controller.session?.landingData?.preview.heroHeadline,
        cachedLanding.preview.heroHeadline,
      );
      expect(
        controller.session?.landingData?.preview.heroImageUrl,
        cachedLanding.preview.heroImageUrl,
      );
    },
  );

  test(
    'restoreSession ignores corrupted landing cache without breaking the login',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_landing_data': '{invalid json',
      });

      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      final prefs = await SharedPreferences.getInstance();
      expect(controller.stage, SessionStage.authenticated);
      await pumpEventQueue();
      expect(controller.session?.landingData?.preview.joinCode, 'D1E438');
      expect(prefs.containsKey('auth.cached_landing_data'), isTrue);
    },
  );

  test(
    'restoreSession locks the reopened app behind device security when available',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(controller.stage, SessionStage.authenticated);
      expect(controller.requiresBiometricUnlock, isTrue);
    },
  );

  test('biometric lock restores the saved preference when device security exists', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'auth.biometric_enabled': true,
    });

    final biometricLockService = BiometricLockService(
      authenticator: _FakeDeviceAuthenticator(
        isDeviceSupportedResult: true,
      ),
    );

    await biometricLockService.initialize();

    final prefs = await SharedPreferences.getInstance();
    expect(biometricLockService.canUseBiometricLock, isTrue);
    expect(prefs.getBool('auth.biometric_enabled'), isTrue);
  });

  test('biometric lock preference is cleared when device security is unavailable', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'auth.biometric_enabled': true,
    });

    final biometricLockService = BiometricLockService(
      authenticator: _FakeDeviceAuthenticator(),
    );

    await biometricLockService.initialize();

    final prefs = await SharedPreferences.getInstance();
    expect(biometricLockService.canUseBiometricLock, isFalse);
    expect(prefs.containsKey('auth.biometric_enabled'), isFalse);
  });

  test('biometric lock can be enabled when only biometrics are available', () async {
    final biometricLockService = BiometricLockService(
      authenticator: _FakeDeviceAuthenticator(
        canCheckBiometricsResult: true,
      ),
    );

    await biometricLockService.markEnabledAfterLogin();

    final prefs = await SharedPreferences.getInstance();
    expect(biometricLockService.canUseBiometricLock, isTrue);
    expect(prefs.getBool('auth.biometric_enabled'), isTrue);
  });

  test('biometric lock authenticate follows the device authenticator result', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'auth.biometric_enabled': true,
    });

    final biometricLockService = BiometricLockService(
      authenticator: _FakeDeviceAuthenticator(
        isDeviceSupportedResult: true,
        authenticateResult: false,
      ),
    );

    await biometricLockService.initialize();

    expect(await biometricLockService.authenticate(), isFalse);
  });

  test(
    'restoreSession defers post-restore session sync until biometric unlock',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final authService = _FakeAuthService(
        onRestoreSupabaseSession: (callCount) async => true,
      );
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();
      await pumpEventQueue();

      expect(controller.requiresBiometricUnlock, isTrue);
      expect(authService.restoreSupabaseSessionCallCount, 1);

      final unlocked = await controller.unlockWithBiometrics();

      expect(unlocked, isTrue);
      expect(controller.requiresBiometricUnlock, isFalse);
      expect(authService.restoreSupabaseSessionCallCount, 2);
    },
  );

  test(
    'unlockWithBiometrics waits for session refresh before releasing the app',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final refreshCompleter = Completer<bool>();
      final authService = _FakeAuthService(
        onRestoreSupabaseSession: (callCount) async {
          if (callCount == 1) {
            return true;
          }

          return refreshCompleter.future;
        },
      );
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      bool? unlockResult;
      final unlockFuture = controller.unlockWithBiometrics().then((value) {
        unlockResult = value;
      });
      await pumpEventQueue();

      expect(controller.requiresBiometricUnlock, isTrue);
      expect(unlockResult, isNull);

      refreshCompleter.complete(true);
      await unlockFuture;

      expect(unlockResult, isTrue);
      expect(controller.requiresBiometricUnlock, isFalse);
    },
  );

  test(
    'unlockWithBiometrics retries the backend session restore before opening the app',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final authService = _FakeAuthService(
        onRestoreSupabaseSession: (callCount) async {
          if (callCount == 1) {
            return true;
          }

          return callCount >= 3;
        },
      );
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(customer: null),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();
      expect(controller.requiresBiometricUnlock, isTrue);

      final unlocked = await controller.unlockWithBiometrics();

      expect(unlocked, isTrue);
      expect(controller.requiresBiometricUnlock, isFalse);
      expect(
        authService.restoreSupabaseSessionCallCount,
        greaterThanOrEqualTo(3),
      );
    },
  );

  test(
    'unlockWithBiometrics keeps the app locked when the backend session is still unavailable',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final authService = _FakeAuthService(
        onRestoreSupabaseSession: (callCount) async => callCount == 1,
      );
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(customer: null),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();
      expect(controller.requiresBiometricUnlock, isTrue);

      final unlocked = await controller.unlockWithBiometrics();

      expect(unlocked, isFalse);
      expect(controller.requiresBiometricUnlock, isTrue);
      expect(
        controller.message,
        'Ainda estamos retomando sua sessao neste aparelho. Tente novamente em alguns segundos.',
      );
    },
  );

  test(
    'restoreSession keeps the customer inside the app when profile refresh fails temporarily',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
        'auth.cached_customer_profile': jsonEncode(
          _sampleCustomerProfile.toJson(),
        ),
      });

      final controller = SessionController(
        authService: _FakeAuthService(persistedSessionAvailable: true),
        biometricLockService: _FakeBiometricLockService(
          canUseBiometricLock: true,
        ),
        profileRepository: _FakeProfileRepository(
          error: Exception('network unavailable'),
        ),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(controller.stage, SessionStage.authenticated);
      expect(controller.session?.customer.id, _sampleCustomerProfile.id);
      expect(controller.requiresBiometricUnlock, isTrue);
      expect(controller.message, isNull);
    },
  );

  test(
    'restoreSession clears a provider session that survived app reinstall',
    () async {
      final authService = _FakeAuthService(persistedSessionAvailable: true);
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(customer: null),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{},
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(authService.signOutCallCount, 1);
      expect(controller.stage, SessionStage.signedOut);
    },
  );

  test(
    'restoreSession keeps the current session during upgrade migration when local state exists',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
      });

      final authService = _FakeAuthService(persistedSessionAvailable: true);
      final controller = SessionController(
        authService: authService,
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: _FakePublicSalonRepository(
          responses: <String, SalonLandingData?>{
            'D1E438': _sampleLandingData(),
          },
        ),
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();

      expect(authService.signOutCallCount, 0);
      expect(controller.stage, SessionStage.authenticated);
    },
  );

  test(
    'refreshLandingDataIfNeeded avoids an immediate duplicate fetch after a fresh sync',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'auth.last_join_code': 'D1E438',
      });

      final publicSalonRepository = _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{'D1E438': _sampleLandingData()},
      );
      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: publicSalonRepository,
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      await controller.restoreSession();
      await controller.refreshLandingData();
      publicSalonRepository.requestedJoinCodes.clear();

      final skipped = await controller.refreshLandingDataIfNeeded();
      final forced = await controller.refreshLandingData();

      expect(skipped, isFalse);
      expect(forced, isTrue);
      expect(publicSalonRepository.requestedJoinCodes, <String>['D1E438']);
    },
  );

  test(
    'signIn authenticates before the salon landing refresh finishes',
    () async {
      final landingCompleter = Completer<SalonLandingData?>();
      final publicSalonRepository = _FakePublicSalonRepository(
        responses: <String, SalonLandingData?>{},
        pendingResponses: <String, Completer<SalonLandingData?>>{
          'D1E438': landingCompleter,
        },
      );
      final controller = SessionController(
        authService: _FakeAuthService(),
        biometricLockService: _FakeBiometricLockService(),
        profileRepository: _FakeProfileRepository(),
        publicSalonRepository: publicSalonRepository,
        defaultJoinCode: '',
        prefsLoader: SharedPreferences.getInstance,
      );

      final signInFuture = controller.signIn(
        joinCode: 'd1e438',
        email: 'cliente@teste.com',
        password: '123456',
        customerName: 'Wesley',
      );

      final success = await signInFuture.timeout(
        const Duration(milliseconds: 100),
      );

      expect(success, isTrue);
      expect(controller.stage, SessionStage.authenticated);
      expect(controller.session?.joinCode, 'D1E438');
      expect(controller.session?.landingData, isNull);
      expect(landingCompleter.isCompleted, isFalse);

      landingCompleter.complete(_sampleLandingData());
      await pumpEventQueue();

      expect(controller.session?.landingData?.preview.joinCode, 'D1E438');
    },
  );
}

class _FakeAuthService extends AuthService {
  _FakeAuthService({
    this.persistedSessionAvailable = true,
    this.onRestoreSupabaseSession,
    this.signInError,
  }) : super(
         environment: AppEnvironment.testing(),
         client: http.Client(),
         supabaseClient: null,
       );

  bool persistedSessionAvailable;
  final Future<bool> Function(int callCount)? onRestoreSupabaseSession;
  final Object? signInError;
  int restoreSupabaseSessionCallCount = 0;
  int signOutCallCount = 0;
  String? lastSignInJoinCode;
  String? lastGoogleJoinCode;

  @override
  Future<void> signIn({
    required String joinCode,
    required String email,
    required String password,
    required String customerName,
  }) async {
    if (signInError != null) {
      throw signInError!;
    }
    lastSignInJoinCode = joinCode;
  }

  @override
  Future<void> signInWithGoogle({
    required String joinCode,
    String customerName = '',
  }) async {
    lastGoogleJoinCode = joinCode;
  }

  @override
  bool get hasPersistedAuthenticatedSession => persistedSessionAvailable;

  @override
  Future<bool> restoreSupabaseSessionFromFirebase() async {
    restoreSupabaseSessionCallCount += 1;
    if (onRestoreSupabaseSession != null) {
      final restored = await onRestoreSupabaseSession!(
        restoreSupabaseSessionCallCount,
      );
      persistedSessionAvailable = restored;
      return restored;
    }

    return persistedSessionAvailable;
  }

  @override
  Future<void> signOut() async {
    signOutCallCount += 1;
    persistedSessionAvailable = false;
  }
}

class _FakeBiometricLockService extends BiometricLockService {
  _FakeBiometricLockService({this.canUseBiometricLock = false})
    : super(disableBiometrics: true);

  @override
  final bool canUseBiometricLock;
  int authenticateCallCount = 0;

  @override
  Future<void> initialize() async {}

  @override
  Future<void> markEnabledAfterLogin() async {}

  @override
  Future<void> clearSavedLockPreference() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth.biometric_enabled');
  }

  @override
  Future<bool> authenticate() async {
    authenticateCallCount += 1;
    return true;
  }
}

class _FakeDeviceAuthenticator implements DeviceAuthenticator {
  _FakeDeviceAuthenticator({
    this.isDeviceSupportedResult = false,
    this.canCheckBiometricsResult = false,
    this.authenticateResult = true,
  });

  final bool isDeviceSupportedResult;
  final bool canCheckBiometricsResult;
  final bool authenticateResult;

  @override
  Future<bool> authenticate({required String localizedReason}) async {
    return authenticateResult;
  }

  @override
  Future<bool> canCheckBiometrics() async {
    return canCheckBiometricsResult;
  }

  @override
  Future<bool> isDeviceSupported() async {
    return isDeviceSupportedResult;
  }
}

class _FakeProfileRepository extends ProfileRepository {
  _FakeProfileRepository({this.customer = _sampleCustomerProfile, this.error})
    : super(client: null);

  final CustomerProfile? customer;
  final Object? error;

  @override
  Future<CustomerProfile?> fetchCurrentCustomer() async {
    if (error != null) {
      throw error!;
    }

    return customer;
  }
}

class _FakePublicSalonRepository extends PublicSalonRepository {
  _FakePublicSalonRepository({
    required this.responses,
    this.pendingResponses = const <String, Completer<SalonLandingData?>>{},
    this.throwOn = const <String>{},
  }) : super(environment: AppEnvironment.testing(), client: http.Client());

  final Map<String, SalonLandingData?> responses;
  final Map<String, Completer<SalonLandingData?>> pendingResponses;
  final Set<String> throwOn;
  final List<String> requestedJoinCodes = <String>[];

  @override
  Future<SalonLandingData?> fetchLanding(
    String joinCode, {
    bool bypassCache = false,
  }) async {
    final normalized = joinCode.trim().toUpperCase();
    requestedJoinCodes.add(normalized);
    if (throwOn.contains(normalized)) {
      throw Exception('network unavailable');
    }
    final pendingResponse = pendingResponses[normalized];
    if (pendingResponse != null) {
      return pendingResponse.future;
    }
    return responses[normalized];
  }
}

SalonLandingData _sampleLandingData() {
  return const SalonLandingData(
    preview: SalonPreview(
      salonId: 'salon-1',
      joinCode: 'D1E438',
      name: 'Barbershop Premium',
      appDisplayName: 'Barbershop Premium',
      tagline: 'Visual alinhado com seu salão',
      brandColor: '#4B6B4F',
      logoUrl: 'https://example.com/logo.png',
      heroImageUrl: 'https://example.com/hero.png',
      heroHeadline: 'Transformação com cara do seu salão',
      welcomeHeadline: 'Seu salão no app',
      welcomeMessage: 'Agenda, vitrine e beneficios com linguagem da marca.',
      primaryCtaLabel: 'Agendar',
      promotionHeadline: 'Tudo configurado do seu jeito.',
      segmentLabel: 'Salão feminino',
      segmentDescription: 'Cuidado e beleza',
      moduleLabels: <String>['Agenda', 'Loja', 'Feed'],
      mapUrl: null,
      supportUrl: null,
      supportEmail: 'oi@barbershop.com',
      ratingValue: 4.9,
      ratingCount: 120,
    ),
    featuredServices: <SalonServiceHighlight>[],
    activeOffers: <SalonOfferHighlight>[],
    recentPosts: <SalonGalleryHighlight>[],
    centralCampaigns: <SalonCampaign>[],
    stats: SalonStats(
      servicesCount: 8,
      activeOffersCount: 2,
      recentPostsCount: 5,
    ),
    links: SalonLinks(
      whatsappUrl: null,
      mapUrl: null,
      supportUrl: null,
      supportEmail: 'oi@barbershop.com',
      privacyPolicyUrl: null,
      termsOfUseUrl: null,
    ),
  );
}

const _sampleCustomerProfile = CustomerProfile(
  id: 'customer-1',
  salonId: 'salon-1',
  authUserId: 'auth-1',
  name: 'Wesley Silva',
  phone: null,
  referralCode: 'WES123',
  consentStatus: 'not_required',
);
