import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
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
import 'package:mobile/src/features/profile/loyalty_page.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:mobile/src/features/store/store_repository.dart';

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await initializeDateFormatting('pt_BR');
  });

  testWidgets(
    'renders loyalty history with the assigned professional signature',
    (WidgetTester tester) async {
      final customer = const CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: '19999999999',
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
          home: LoyaltyPage(
            bootstrap: bootstrap,
            notificationsController: notificationsController,
            session: session,
            customer: customer,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Programa ativo'), findsOneWidget);
      await tester.dragUntilVisible(
        find.text('Corte VIP'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();
      expect(find.text('Escada de niveis'), findsOneWidget);
      await tester.dragUntilVisible(
        find.text('Com Maria'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();
      expect(find.text('Com Maria'), findsOneWidget);
      await tester.dragUntilVisible(
        find.text('Resgate de cashback'),
        find.byType(ListView),
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();
      expect(find.text('Resgate de cashback'), findsOneWidget);
    },
  );
}

class _TestSessionController extends SessionController {
  _TestSessionController(this._session)
    : super(
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

  @override
  AppSession? get session => _session;

  @override
  Future<bool> refreshLandingData() async => false;

  @override
  Future<bool> refreshAuthenticatedSession() async => false;
}

class _TestProfileRepository extends ProfileRepository {
  _TestProfileRepository(this._customer) : super(client: null);

  final CustomerProfile _customer;

  @override
  Future<CustomerProfile?> fetchCurrentCustomer() async => _customer;

  @override
  Future<LoyaltySummary?> fetchLoyaltySummary() async {
    return LoyaltySummary.fromJson(<String, dynamic>{
      'program': <String, dynamic>{
        'title': 'Clube de fidelidade',
        'description': 'Visitas concluidas viram pontos, cashback e niveis.',
        'points_per_visit': 1000,
        'cashback_percent': 5,
        'is_active': true,
        'vip_reward_service_id': 'service-vip',
        'vip_reward_service_name': 'Corte VIP',
        'tiers': <Map<String, dynamic>>[
          <String, dynamic>{
            'label': 'Bronze',
            'min_visits': 3,
            'discount_percent': 3,
            'is_vip': false,
          },
          <String, dynamic>{
            'label': 'Prata',
            'min_visits': 6,
            'discount_percent': 6,
            'is_vip': false,
          },
          <String, dynamic>{
            'label': 'Ouro',
            'min_visits': 10,
            'discount_percent': 10,
            'is_vip': true,
          },
        ],
      },
      'points_balance': 3200,
      'total_points_earned': 4200,
      'cashback_balance': 38.5,
      'total_cashback_earned': 58.5,
      'completed_visits': 4,
      'rank_position': 1,
      'ranked_customers': 7,
      'current_tier': <String, dynamic>{
        'label': 'Bronze',
        'min_visits': 3,
        'discount_percent': 3,
        'is_vip': false,
      },
      'next_tier': <String, dynamic>{
        'label': 'Prata',
        'min_visits': 6,
        'discount_percent': 6,
        'is_vip': false,
      },
      'visits_to_next_tier': 2,
      'last_reward_at': DateTime(2026, 4, 16, 19, 30).toIso8601String(),
    });
  }

  @override
  Future<List<CustomerLoyaltyTransaction>> fetchLoyaltyTransactions({
    required String customerId,
    int limit = 12,
  }) async {
    return <CustomerLoyaltyTransaction>[
      CustomerLoyaltyTransaction.fromJson(<String, dynamic>{
        'id': 'txn-1',
        'transaction_kind': 'visit_reward',
        'points_delta': 1000,
        'cashback_delta': 12.5,
        'completed_visit_delta': 1,
        'description': 'Recompensa automatica por atendimento concluido.',
        'metadata': <String, dynamic>{
          'serviceName': 'Corte premium',
          'staffMemberName': 'Maria',
          'staffMemberImageUrl': 'https://example.com/maria.jpg',
          'completedAt': DateTime(2026, 4, 16, 19, 30).toIso8601String(),
        },
        'created_at': DateTime(2026, 4, 16, 19, 35).toIso8601String(),
      }),
      CustomerLoyaltyTransaction.fromJson(<String, dynamic>{
        'id': 'txn-2',
        'transaction_kind': 'cashback_redemption',
        'points_delta': 0,
        'cashback_delta': -10,
        'completed_visit_delta': 0,
        'description': 'Parte do saldo foi utilizada no caixa.',
        'metadata': const <String, dynamic>{},
        'created_at': DateTime(2026, 4, 10, 15, 10).toIso8601String(),
      }),
    ];
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
    landingData: SalonLandingData.fromJson(<String, dynamic>{
      'preview': <String, dynamic>{
        'salonId': 'salon-1',
        'joinCode': 'SALAO7',
        'name': 'Studio Premium',
        'appDisplayName': 'Studio Premium',
        'tagline': 'Beleza com ritmo real',
        'brandColor': '#C15F43',
        'secondaryColor': '#22443C',
        'accentColor': '#E7B36A',
        'experienceModel': 'beauty_signature',
        'homeEmphasis': 'services',
        'logoUrl': null,
        'heroImageUrl': null,
        'galleryCoverImageUrl': null,
        'profileCoverImageUrl': null,
        'shareImageUrl': null,
        'heroHeadline': 'Seu melhor visual comeca aqui',
        'heroSupportLine': null,
        'welcomeHeadline': 'Seu salao em ritmo premium',
        'welcomeMessage':
            'Agenda, feed e loja alinhados em uma experiencia bonita.',
        'primaryCtaLabel': 'Agendar',
        'visualStyle': null,
        'themeMode': null,
        'buttonStyle': null,
        'cardStyle': null,
        'bannerStyle': null,
        'promotionHeadline': null,
        'segmentLabel': 'Salao',
        'segmentDescription': 'Cuidado e experiencia',
        'visibleHomeModules': <String>['shortcuts', 'loyalty', 'feed'],
        'moduleLabels': <String>['Agenda', 'Loja', 'Feed'],
        'addressLabel': 'Rua Augusta, 500 - Centro',
        'whatsappPhone': '5516981389756',
        'mapUrl': 'https://maps.example.com/studiopremium',
        'supportUrl': null,
        'supportEmail': 'oi@studio.com',
        'ratingValue': 4.9,
        'ratingCount': 120,
        'bookingPolicyEnabled': false,
      },
      'featuredServices': <Map<String, dynamic>>[],
      'activeOffers': <Map<String, dynamic>>[],
      'recentPosts': <Map<String, dynamic>>[],
      'recentReviews': <Map<String, dynamic>>[],
      'centralCampaigns': <Map<String, dynamic>>[],
      'stats': <String, dynamic>{
        'servicesCount': 8,
        'activeOffersCount': 1,
        'recentPostsCount': 5,
      },
      'links': <String, dynamic>{
        'whatsappUrl': 'https://wa.me/5516981389756',
        'instagramUrl': 'https://instagram.com/studiopremium',
        'mapUrl': 'https://maps.example.com/studiopremium',
        'supportUrl': null,
        'supportEmail': 'oi@studio.com',
        'privacyPolicyUrl': 'https://studio.com/privacidade',
        'termsOfUseUrl': 'https://studio.com/termos',
      },
    }),
  );
}
