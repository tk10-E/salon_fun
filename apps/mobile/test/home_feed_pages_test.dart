import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/src/bootstrap/app_bootstrap.dart';
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/core/widgets/salon_brand_hero.dart';
import 'package:mobile/src/core/widgets/salon_ui.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/feed/feed_page.dart';
import 'package:mobile/src/features/feed/feed_repository.dart';
import 'package:mobile/src/features/home/home_dashboard_page.dart';
import 'package:mobile/src/features/home/home_shell.dart';
import 'package:mobile/src/features/notifications/customer_notifications_controller.dart';
import 'package:mobile/src/features/notifications/notification_repository.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:mobile/src/features/store/store_page.dart';
import 'package:mobile/src/features/store/store_repository.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  testWidgets('renders the branded home shell', (WidgetTester tester) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(_sampleSession);
    final notificationsController = CustomerNotificationsController(
      client: null,
      sessionController: sessionController,
      notificationRepository: NotificationRepository(client: null),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: HomeDashboardPage(
          bootstrap: bootstrap,
          sessionController: sessionController,
          notificationsController: notificationsController,
          onNavigate: (_) {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Salão'), findsOneWidget);
    expect(find.text('Seu melhor visual começa aqui'), findsOneWidget);
    expect(find.text('Código SALAO7'), findsOneWidget);
    expect(find.text('Próximo horário'), findsOneWidget);
  });

  testWidgets('renders the shared salon brand hero with image area', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(preview: _sampleSession.landingData!.preview),
        home: Scaffold(
          body: SalonBrandHero(
            preview: _sampleSession.landingData!.preview,
            greeting: 'Olá, Ana',
            joinCode: _sampleSession.joinCode,
          ),
        ),
      ),
    );

    await tester.pump();

    expect(find.text('Olá, Ana'), findsOneWidget);
    expect(find.text('Seu melhor visual começa aqui'), findsOneWidget);
    expect(find.text('Código SALAO7'), findsOneWidget);
    expect(find.byType(NetworkCardImage), findsOneWidget);
  });

  testWidgets('renders the premium feed shell', (WidgetTester tester) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: FeedPage(
          feedRepository: FeedRepository(client: null),
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: sessionController,
            notificationRepository: NotificationRepository(client: null),
          ),
          session: _sampleSession,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      find.text('Feed com cara de vitrine viva e conversa real.'),
      findsOneWidget,
    );
    expect(find.text('Posts ativos'), findsOneWidget);
  });

  test('shows daily highlights only for posts from today', () {
    final todayPost = _sampleFeedPost(
      id: 'post-today',
      title: 'Hoje no salão',
      createdAt: DateTime.now(),
    );
    final oldPost = _sampleFeedPost(
      id: 'post-old',
      title: 'Semana passada',
      createdAt: DateTime.now().subtract(const Duration(days: 2)),
    );

    expect(isFeedHighlightForDay(todayPost, DateTime.now()), isTrue);
    expect(isFeedHighlightForDay(oldPost, DateTime.now()), isFalse);
  });

  test('hides raw url from caption when post has image', () {
    const rawUrl = 'https://www.instagram.com/p/DWRY_rjES9f/';
    final imagePost = _sampleFeedPost(
      id: 'post-image',
      title: 'Post com foto',
      caption: 'Tecnologijc top $rawUrl',
      imageUrls: const ['https://example.com/photo.jpg'],
      createdAt: DateTime.now(),
    );

    expect(visibleFeedCaptionForDisplay(imagePost), 'Tecnologijc top');
  });

  testWidgets('renders the premium store shell', (WidgetTester tester) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: StorePage(
          storeRepository: StoreRepository(client: null),
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: sessionController,
            notificationRepository: NotificationRepository(client: null),
          ),
          session: _sampleSession,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      find.text('Loja virtual do salão com cara de vitrine de verdade.'),
      findsOneWidget,
    );
    expect(find.text('Carrinho'), findsOneWidget);
  });

  testWidgets('renders the notifications bell in the app shell', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(_sampleSession);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: HomeShell(
          bootstrap: bootstrap,
          sessionController: sessionController,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Avisos'), findsOneWidget);
    expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);
  });
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
}

FeedPost _sampleFeedPost({
  required String id,
  required String title,
  required DateTime createdAt,
  String? caption,
  List<String> imageUrls = const [],
  String? authorAvatarUrl,
  String? authorUsername,
  String? sourceType,
}) {
  return FeedPost(
    id: id,
    title: title,
    caption: caption,
    postType: 'standard',
    createdAt: createdAt,
    imageUrls: imageUrls,
    authorAvatarUrl: authorAvatarUrl,
    authorUsername: authorUsername,
    sourceType: sourceType,
    serviceName: null,
    staffName: null,
    staffRole: null,
    likesCount: 1,
    comments: const [],
    isLikedByCustomer: false,
  );
}

const AppSession _sampleSession = AppSession(
  customer: CustomerProfile(
    id: 'customer-1',
    salonId: 'salon-1',
    authUserId: 'auth-1',
    name: 'Ana Souza',
    phone: null,
    referralCode: 'ANA123',
    consentStatus: 'granted',
  ),
  joinCode: 'SALAO7',
  landingData: SalonLandingData(
    preview: SalonPreview(
      salonId: 'salon-1',
      joinCode: 'SALAO7',
      name: 'Studio Premium',
      appDisplayName: 'Studio Premium',
      tagline: 'Beleza com ritmo real',
      brandColor: '#C15F43',
      logoUrl: null,
      heroImageUrl: null,
      heroHeadline: 'Seu melhor visual começa aqui',
      welcomeHeadline: 'Seu salão em ritmo premium',
      welcomeMessage:
          'Agenda, feed e loja alinhados em uma experiência bonita.',
      primaryCtaLabel: 'Agendar',
      promotionHeadline: 'Tudo organizado para resolver em poucos toques.',
      segmentLabel: 'Salão',
      segmentDescription: 'Cuidado e experiência',
      moduleLabels: ['Agenda', 'Loja', 'Feed'],
      instagramUrl: null,
      instagramProfileImageUrl: null,
      mapUrl: null,
      supportUrl: null,
      supportEmail: 'oi@studio.com',
      ratingValue: 4.9,
      ratingCount: 120,
    ),
    featuredServices: [
      SalonServiceHighlight(
        id: 'service-1',
        name: 'Corte premium',
        category: 'Cabelo',
        description: 'Acabamento refinado com leitura de estilo.',
        duration: 50,
        price: 89.9,
        imageUrl: null,
      ),
    ],
    activeOffers: [
      SalonOfferHighlight(
        id: 'offer-1',
        title: 'Combo da semana',
        description: 'Escova e hidratação em condição especial.',
        highlightText: null,
        kindLabel: 'Oferta',
        priceLabel: 'R\$ 139,90',
        lifecycleLabel: 'Agora',
      ),
    ],
    recentPosts: [
      SalonGalleryHighlight(
        id: 'post-1',
        title: 'Loiro iluminado',
        caption: 'Resultado fresco saindo do salão.',
        imageUrl: null,
        badge: 'Novo',
        serviceName: 'Coloração',
        staffLabel: 'Equipe Studio',
        authorAvatarUrl: null,
        sourceLabel: null,
      ),
    ],
    centralCampaigns: [
      SalonCampaign(
        id: 'campaign-1',
        isActive: true,
        priority: 'high',
        eyebrow: 'Hoje',
        title: 'Reserve o horário mais concorrido',
        message: 'A agenda abriu novos encaixes para esta semana.',
        campaignLabel: 'Agenda',
        ctaLabel: 'Agendar agora',
        ctaTarget: 'appointments',
      ),
    ],
    stats: SalonStats(
      servicesCount: 8,
      activeOffersCount: 2,
      recentPostsCount: 5,
    ),
    links: SalonLinks(
      whatsappUrl: null,
      instagramUrl: null,
      mapUrl: null,
      supportUrl: null,
      supportEmail: 'oi@studio.com',
      privacyPolicyUrl: null,
      termsOfUseUrl: null,
    ),
  ),
);
