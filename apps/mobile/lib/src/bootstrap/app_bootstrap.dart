import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/config/app_environment.dart';
import '../features/agenda/booking_repository.dart';
import '../features/auth/auth_service.dart';
import '../features/auth/biometric_lock_service.dart';
import '../features/auth/session_controller.dart';
import '../features/feed/feed_repository.dart';
import '../features/notifications/device_notification_service.dart';
import '../features/notifications/notification_repository.dart';
import '../features/profile/profile_repository.dart';
import '../features/shared/public_salon_repository.dart';
import '../features/store/store_repository.dart';

class AppBootstrap {
  AppBootstrap({
    required this.environment,
    required this.supabaseClient,
    required this.authService,
    required this.biometricLockService,
    required this.sessionController,
    required this.publicSalonRepository,
    required this.profileRepository,
    required this.bookingRepository,
    required this.feedRepository,
    required this.deviceNotificationService,
    required this.notificationRepository,
    required this.storeRepository,
  });

  final AppEnvironment environment;
  final SupabaseClient? supabaseClient;
  final AuthService authService;
  final BiometricLockService biometricLockService;
  final SessionController sessionController;
  final PublicSalonRepository publicSalonRepository;
  final ProfileRepository profileRepository;
  final BookingRepository bookingRepository;
  final FeedRepository feedRepository;
  final DeviceNotificationService deviceNotificationService;
  final NotificationRepository notificationRepository;
  final StoreRepository storeRepository;

  static Future<AppBootstrap> initialize() async {
    final environment = AppEnvironment.fromEnvironment();
    return _build(environment);
  }

  factory AppBootstrap.testing() {
    final environment = AppEnvironment.testing();
    return _buildSync(environment, disableBiometrics: true);
  }

  static Future<AppBootstrap> _build(AppEnvironment environment) async {
    if (environment.hasSupabase) {
      await Supabase.initialize(
        url: environment.supabaseUrl,
        anonKey: environment.supabaseAnonKey,
      );
    }

    final firebaseOptions = environment.firebaseOptions;
    if (Firebase.apps.isEmpty) {
      if (firebaseOptions != null) {
        await Firebase.initializeApp(options: firebaseOptions);
      } else if (environment.canBootstrapFirebaseNatively && !kIsWeb) {
        await Firebase.initializeApp();
      }
    }

    final bootstrap = _buildSync(environment);
    await bootstrap.deviceNotificationService.initialize();
    await bootstrap.biometricLockService.initialize();
    await bootstrap.sessionController.restoreSession();
    return bootstrap;
  }

  static AppBootstrap _buildSync(
    AppEnvironment environment, {
    bool disableBiometrics = false,
  }) {
    final httpClient = http.Client();
    final supabaseClient = environment.hasSupabase
        ? Supabase.instance.client
        : null;
    final publicSalonRepository = PublicSalonRepository(
      environment: environment,
      client: httpClient,
    );
    final profileRepository = ProfileRepository(client: supabaseClient);
    final authService = AuthService(
      environment: environment,
      client: httpClient,
      supabaseClient: supabaseClient,
    );
    final biometricLockService = BiometricLockService(
      disableBiometrics: disableBiometrics,
    );
    final sessionController = SessionController(
      authService: authService,
      biometricLockService: biometricLockService,
      profileRepository: profileRepository,
      publicSalonRepository: publicSalonRepository,
      defaultJoinCode: environment.defaultJoinCode,
    );

    return AppBootstrap(
      environment: environment,
      supabaseClient: supabaseClient,
      authService: authService,
      biometricLockService: biometricLockService,
      sessionController: sessionController,
      publicSalonRepository: publicSalonRepository,
      profileRepository: profileRepository,
      bookingRepository: BookingRepository(client: supabaseClient),
      feedRepository: FeedRepository(client: supabaseClient),
      deviceNotificationService: DeviceNotificationService(
        environment: environment,
        supabaseClient: supabaseClient,
        disablePush: disableBiometrics,
      ),
      notificationRepository: NotificationRepository(client: supabaseClient),
      storeRepository: StoreRepository(client: supabaseClient),
    );
  }
}
