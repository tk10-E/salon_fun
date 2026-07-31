import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/src/bootstrap/app_bootstrap.dart';
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/core/observability/client_performance_reporter.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/features/agenda/booking_repository.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/feed/feed_repository.dart';
import 'package:mobile/src/features/notifications/customer_notifications_controller.dart';
import 'package:mobile/src/features/notifications/device_notification_service.dart';
import 'package:mobile/src/features/notifications/notification_repository.dart';
import 'package:mobile/src/features/profile/profile_page.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:mobile/src/features/store/store_repository.dart';

void main() {
  testWidgets(
    'renders indicate-and-earn with customer self-service profile and no duplicate referral code cards',
    (WidgetTester tester) async {
      final customer = const CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: '1981389756',
        email: 'ana@example.com',
        referralCode: 'ANA123',
        consentStatus: 'not_required',
      );
      final session = _buildSampleSession(customer: customer);
      final sessionController = _TestSessionController(session);
      final profileRepository = _TestProfileRepository(customer);
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: profileRepository,
      );
      final notificationsController = CustomerNotificationsController(
        client: null,
        sessionController: sessionController,
        notificationRepository: NotificationRepository(client: null),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: ProfilePage(
            bootstrap: bootstrap,
            notificationsController: notificationsController,
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Clube de fidelidade'), findsNothing);
      expect(find.text('Indique e ganhe'), findsOneWidget);
      expect(find.text('Canais do salão'), findsNothing);
      expect(find.byKey(const ValueKey('profile-referral-qr')), findsOneWidget);
      expect(
        find.text(
          'Seu perfil organiza indicação e cadastro do jeito que o salão precisa.',
        ),
        findsNothing,
      );
      expect(find.text('Perfil do cliente'), findsNothing);

      await tester.dragUntilVisible(
        find.text('Meu cadastro no salão'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      expect(find.text('Meu cadastro no salão'), findsOneWidget);

      await tester.dragUntilVisible(
        find.text('Salvar meu cadastro'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Nome no cadastro'),
        'Ana Paula Souza',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Telefone principal'),
        '(19) 8138-9756',
      );
      await tester.ensureVisible(find.text('Salvar meu cadastro'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salvar meu cadastro'), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(profileRepository.lastSavedName, 'Ana Paula Souza');
      expect(profileRepository.lastSavedPhone, '1981389756');
      expect(profileRepository.lastSavedEmail, 'ana@example.com');
      await tester.dragUntilVisible(
        find.text('Privacidade, termos e suporte'),
        find.byType(ListView),
        const Offset(0, 220),
      );
      await tester.pumpAndSettle();
      expect(find.text('Privacidade, termos e suporte'), findsOneWidget);
      expect(find.text('Política de privacidade'), findsOneWidget);
      expect(find.text('Termos de uso'), findsOneWidget);
    },
  );

  testWidgets(
    'keeps the updated customer profile on screen even if post-save refresh oscillates',
    (WidgetTester tester) async {
      final customer = const CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: '1981389756',
        email: 'ana@example.com',
        referralCode: 'ANA123',
        consentStatus: 'not_required',
      );
      final session = _buildSampleSession(customer: customer);
      final sessionController = _TestSessionController(
        session,
        failRefreshAuthenticatedSession: true,
      );
      final profileRepository = _TestProfileRepository(
        customer,
        failFetchAfterSave: true,
      );
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: profileRepository,
      );
      final notificationsController = CustomerNotificationsController(
        client: null,
        sessionController: sessionController,
        notificationRepository: NotificationRepository(client: null),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: ProfilePage(
            bootstrap: bootstrap,
            notificationsController: notificationsController,
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Salvar meu cadastro'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, 'Nome no cadastro'),
        'Ana Paula Souza',
      );
      await tester.ensureVisible(find.text('Salvar meu cadastro'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salvar meu cadastro'), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(find.text('Ana Paula Souza'), findsWidgets);
      expect(find.text('refresh oscillating'), findsNothing);
    },
  );
}

class _TestSessionController extends SessionController {
  _TestSessionController(
    this._session, {
    this.failRefreshAuthenticatedSession = false,
  }) : super(
         authService: AuthService(
           environment: AppEnvironment.testing(),
           client: http.Client(),
           supabaseClient: null,
         ),
         biometricLockService: BiometricLockService(disableBiometrics: true),
         profileRepository: ProfileRepository(client: null),
         publicSalonRepository: PublicSalonRepository(
           environment: AppEnvironment.testing(),
           client: http.Client(),
         ),
         defaultJoinCode: '',
       );

  final AppSession _session;
  final bool failRefreshAuthenticatedSession;

  @override
  AppSession? get session => _session;

  @override
  Future<bool> refreshLandingData() async => false;

  @override
  Future<bool> refreshLandingDataIfNeeded() async => false;

  @override
  Future<bool> refreshAuthenticatedSessionIfNeeded() async => false;

  @override
  Future<bool> refreshAuthenticatedSession() async {
    if (failRefreshAuthenticatedSession) {
      throw Exception('refresh oscillating');
    }
    return false;
  }
}

class _TestProfileRepository extends ProfileRepository {
  _TestProfileRepository(this._customer, {this.failFetchAfterSave = false})
    : super(client: null);

  CustomerProfile _customer;
  final bool failFetchAfterSave;
  bool _savedOnce = false;
  String? lastSavedName;
  String? lastSavedPhone;
  String? lastSavedEmail;

  @override
  Future<CustomerProfile?> fetchCurrentCustomer() async {
    if (failFetchAfterSave && _savedOnce) {
      throw Exception('temporary read failure');
    }
    return _customer;
  }

  @override
  Future<ReferralSummary?> fetchReferralSummary() async => null;

  @override
  Future<CustomerProfile> saveCustomerProfile({
    required String customerId,
    required String name,
    String? phone,
    String? email,
    required DateTime? birthDate,
  }) async {
    final normalizedPhone = phone?.replaceAll(RegExp(r'\D'), '');
    lastSavedName = name;
    lastSavedPhone = normalizedPhone;
    lastSavedEmail = email;
    _savedOnce = true;
    _customer = CustomerProfile(
      id: _customer.id,
      salonId: _customer.salonId,
      authUserId: _customer.authUserId,
      name: name,
      phone: normalizedPhone,
      email: email,
      birthDate: birthDate,
      profileImagePath: _customer.profileImagePath,
      profileImageUrl: _customer.profileImageUrl,
      referralCode: _customer.referralCode,
      consentStatus: _customer.consentStatus,
    );
    return _customer;
  }
}

AppBootstrap _buildTestBootstrap({
  required SessionController sessionController,
  required ProfileRepository profileRepository,
}) {
  final environment = AppEnvironment.testing();
  return AppBootstrap(
    environment: environment,
    supabaseClient: null,
    authService: AuthService(
      environment: environment,
      client: http.Client(),
      supabaseClient: null,
    ),
    biometricLockService: BiometricLockService(disableBiometrics: true),
    sessionController: sessionController,
    clientPerformanceReporter: ClientPerformanceReporter(
      environment: environment,
      httpClient: http.Client(),
    ),
    publicSalonRepository: PublicSalonRepository(
      environment: environment,
      client: http.Client(),
    ),
    profileRepository: profileRepository,
    bookingRepository: BookingRepository(client: null),
    feedRepository: FeedRepository(client: null),
    deviceNotificationService: DeviceNotificationService(
      environment: environment,
      supabaseClient: null,
      disablePush: true,
    ),
    notificationRepository: NotificationRepository(client: null),
    storeRepository: StoreRepository(client: null),
  );
}

AppSession _buildSampleSession({required CustomerProfile customer}) {
  return AppSession(
    customer: customer,
    joinCode: 'SALAO7',
    landingData: SalonLandingData(
      preview: const SalonPreview(
        salonId: 'salon-1',
        joinCode: 'SALAO7',
        name: 'Studio Premium',
        appDisplayName: 'Studio Premium',
        tagline: 'Beleza com ritmo real',
        brandColor: '#C15F43',
        secondaryColor: '#22443C',
        accentColor: '#E7B36A',
        logoUrl: null,
        heroImageUrl: null,
        heroHeadline: 'Seu melhor visual começa aqui',
        welcomeHeadline: 'Seu salão em ritmo premium',
        welcomeMessage:
            'Agenda, feed e loja alinhados em uma experiência bonita.',
        primaryCtaLabel: 'Agendar',
        visualStyle: null,
        themeMode: null,
        buttonStyle: null,
        cardStyle: null,
        bannerStyle: null,
        promotionHeadline: null,
        segmentLabel: 'Salão',
        segmentDescription: 'Cuidado e experiência',
        moduleLabels: ['Agenda', 'Loja', 'Feed'],
        mapUrl: null,
        supportUrl: null,
        supportEmail: 'oi@studio.com',
        ratingValue: 4.9,
        ratingCount: 120,
        whatsappPhone: '5516981389756',
        profileCoverImageUrl: null,
        heroSupportLine: null,
        addressLabel: 'Rua Augusta, 500 - Centro',
      ),
      featuredServices: const [],
      activeOffers: const [],
      recentPosts: const [],
      centralCampaigns: const [],
      stats: const SalonStats(
        servicesCount: 8,
        activeOffersCount: 1,
        recentPostsCount: 5,
      ),
      links: const SalonLinks(
        whatsappUrl: 'https://wa.me/5516981389756',
        mapUrl: 'https://maps.example.com/studiopremium',
        supportUrl: null,
        supportEmail: 'oi@studio.com',
        privacyPolicyUrl: 'https://studio.com/privacidade',
        termsOfUseUrl: 'https://studio.com/termos',
      ),
    ),
  );
}
