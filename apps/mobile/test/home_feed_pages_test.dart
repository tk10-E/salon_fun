import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/src/bootstrap/app_bootstrap.dart';
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/core/observability/client_performance_reporter.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/core/widgets/salon_brand_hero.dart';
import 'package:mobile/src/core/widgets/salon_ui.dart';
import 'package:mobile/src/features/agenda/booking_repository.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/feed/feed_page.dart';
import 'package:mobile/src/features/feed/feed_repository.dart';
import 'package:mobile/src/features/home/home_dashboard_page.dart';
import 'package:mobile/src/features/home/home_shell.dart';
import 'package:mobile/src/features/notifications/device_notification_service.dart';
import 'package:mobile/src/features/notifications/customer_notifications_controller.dart';
import 'package:mobile/src/features/notifications/notification_repository.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:mobile/src/features/store/store_page.dart';
import 'package:mobile/src/features/store/store_repository.dart';

DateTime _testDateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

DateTime _activeMembershipStart([DateTime? reference]) => _testDateOnly(
  reference ?? DateTime.now(),
).subtract(const Duration(days: 7));

DateTime _activeMembershipExpiry([DateTime? reference]) =>
    _testDateOnly(reference ?? DateTime.now()).add(const Duration(days: 14));

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  testWidgets('renders the branded home shell', (WidgetTester tester) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(_sampleSessionWithLogo);
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

    expect(find.byKey(const ValueKey('home-salon-logo-orb')), findsOneWidget);
    expect(
      find.text('Sua experiência no salão, organizada em um só lugar'),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('home-salon-name-banner')),
      findsOneWidget,
    );
    expect(find.text('Salão conectado'), findsOneWidget);
    expect(find.text('Studio Premium'), findsOneWidget);
    expect(
      find.text(
        'Acompanhe agenda, benefícios, loja e novidades com clareza, segurança e o padrão definido pelo salão.',
      ),
      findsOneWidget,
    );
    expect(find.text('Próximo horário'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('home-customer-name-pill')),
      findsOneWidget,
    );
    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text('Sua conta no app'), findsNothing);
    expect(find.text('Seu aniversario no salao'), findsNothing);
    expect(find.text('Código SALAO7'), findsNothing);

    await tester.dragUntilVisible(
      find.text('Oferta em destaque'),
      find.byType(ListView),
      const Offset(0, -260),
    );
    await tester.pumpAndSettle();

    expect(find.text('Oferta em destaque'), findsOneWidget);
    expect(find.text('Combo da semana'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Kit completo beleza'),
      find.byType(ListView),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();
    expect(find.text('Kit completo beleza'), findsOneWidget);
    expect(find.text('Plano'), findsWidgets);
  });

  testWidgets(
    'prefers the salon profile image on the home feed preview for Instagram posts',
    (WidgetTester tester) async {
      expect(
        previewAvatarCandidatesForHomeFeed(
          imageUrl: 'https://example.com/external-avatar.png',
          fallbackImageUrl: 'https://example.com/logo.png',
          sourceLabel: 'Instagram do salão • @studio',
        ),
        const [
          'https://example.com/logo.png',
          'https://example.com/external-avatar.png',
        ],
      );
    },
  );

  testWidgets(
    'keeps the home stable when the salon has no valid display name for the identity banner',
    (WidgetTester tester) async {
      final bootstrap = AppBootstrap.testing();
      final sessionController = _TestSessionController(
        _sampleSessionWithLogo.copyWith(
          landingData: SalonLandingData(
            preview: const SalonPreview(
              salonId: 'salon-1',
              joinCode: 'SALAO7',
              name: '   ',
              appDisplayName: '   ',
              tagline: 'Beleza com ritmo real',
              brandColor: '#C15F43',
              secondaryColor: '#22443C',
              accentColor: '#E7B36A',
              logoUrl: 'https://example.com/logo.png',
              heroImageUrl: 'https://example.com/hero.png',
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
              activeOffersCount: 2,
              recentPostsCount: 5,
            ),
            links: const SalonLinks(
              whatsappUrl: null,
              mapUrl: null,
              supportUrl: null,
              supportEmail: 'oi@studio.com',
              privacyPolicyUrl: null,
              termsOfUseUrl: null,
            ),
          ),
        ),
      );
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

      expect(
        find.byKey(const ValueKey('home-salon-name-banner')),
        findsNothing,
      );
      expect(
        find.text('Sua experiência no salão, organizada em um só lugar'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'shows the loyalty entry on the home only when the salon has an active program',
    (WidgetTester tester) async {
      final sessionController = _TestSessionController(_sampleSessionWithLogo);
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: _TestProfileRepository(
          loyaltySummary: _sampleActiveLoyaltySummary(),
        ),
      );
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
      await tester.dragUntilVisible(
        find.text('Abrir fidelidade completa'),
        find.byType(ListView).first,
        const Offset(0, -240),
      );
      await tester.pumpAndSettle();

      expect(find.text('Clube de fidelidade'), findsWidgets);
      expect(find.text('Abrir fidelidade completa'), findsOneWidget);
    },
  );

  testWidgets(
    'renders the birthday card only when the salon configured it for the client day',
    (WidgetTester tester) async {
      final sessionController = _TestSessionController(_sampleSessionWithLogo);
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: _TestProfileRepository(
          birthdayExperience: BirthdayHomeExperience(
            id: 'birthday-1',
            title: 'Seu dia merece um cuidado especial',
            message:
                'Parabens pelo seu aniversario. Hoje o salao preparou esse carinho para voce.',
            customerName: 'Ana Souza',
            salonName: 'Studio Premium',
            birthDate: DateTime(1994, 4, 16),
            mediaKind: 'image',
            imageUrl: 'https://example.com/birthday.jpg',
          ),
        ),
      );
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

      await tester.dragUntilVisible(
        find.text('Seu aniversario no salao'),
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      expect(find.text('Seu aniversario no salao'), findsOneWidget);
      expect(find.text('Seu dia merece um cuidado especial'), findsOneWidget);
      expect(find.text('Feliz aniversario, Ana.'), findsOneWidget);
      expect(
        find.text(
          'Parabens pelo seu aniversario. Hoje o salao preparou esse carinho para voce.',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets('removes the birthday card when its daily window expires', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSessionWithLogo);
    final profileRepository = _TestProfileRepository(
      birthdayExperience: BirthdayHomeExperience(
        id: 'birthday-expiring-1',
        title: 'Seu presente vale hoje',
        message: 'A homenagem some sozinha depois da virada do dia.',
        customerName: 'Ana Souza',
        salonName: 'Studio Premium',
        birthDate: DateTime(1994, 4, 16),
        mediaKind: 'image',
        imageUrl: 'https://example.com/birthday.jpg',
        expiresAt: DateTime.now().add(const Duration(minutes: 10)),
      ),
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
        home: HomeDashboardPage(
          bootstrap: bootstrap,
          sessionController: sessionController,
          notificationsController: notificationsController,
          onNavigate: (_) {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.dragUntilVisible(
      find.text('Seu aniversario no salao'),
      find.byType(ListView).first,
      const Offset(0, -180),
    );
    await tester.pumpAndSettle();

    expect(find.text('Seu aniversario no salao'), findsOneWidget);

    profileRepository.birthdayExperience = null;
    await tester.pump(const Duration(minutes: 11));
    await tester.pumpAndSettle();

    expect(find.text('Seu aniversario no salao'), findsNothing);
  });

  testWidgets(
    'keeps the active membership action visible and routes fixed-series scheduling',
    (WidgetTester tester) async {
      final reference = DateTime.now();
      final sessionController = _TestSessionController(_sampleSessionWithLogo);
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: _TestProfileRepository(
          membershipOverview: CustomerMembershipOverview(
            memberships: [
              CustomerMembershipPlan(
                id: 'membership-1',
                offerId: 'offer-2',
                title: 'Kit completo beleza',
                serviceId: 'service-2',
                serviceName: 'corte + barba + sobrancelha',
                status: 'active',
                sessionsIncluded: 3,
                sessionsUsed: 0,
                startedAt: _activeMembershipStart(reference),
                expiresAt: _activeMembershipExpiry(reference),
                priceSnapshot: 149.9,
              ),
            ],
            pendingRequests: const [],
          ),
        ),
      );
      final notificationsController = CustomerNotificationsController(
        client: null,
        sessionController: sessionController,
        notificationRepository: NotificationRepository(client: null),
      );
      SalonOfferHighlight? selectedOffer;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: HomeDashboardPage(
            bootstrap: bootstrap,
            sessionController: sessionController,
            notificationsController: notificationsController,
            onNavigate: (_) {},
            onOpenOfferBooking: (offer) => selectedOffer = offer,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey('home-active-plan-verified-pill')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('home-salon-name-banner')),
        findsOneWidget,
      );
      expect(find.text('Studio Premium'), findsOneWidget);

      await tester.dragUntilVisible(
        find.text('Kit completo beleza'),
        find.byType(ListView),
        const Offset(0, -240),
      );
      await tester.pumpAndSettle();

      expect(find.text('Escolher horario fixo'), findsOneWidget);
      expect(
        find.textContaining(
          'Seu plano ja esta ativo. Escolha so um dia e horario para corte + barba + sobrancelha',
        ),
        findsOneWidget,
      );
      expect(find.text('3 sessoes restantes'), findsWidgets);
      expect(
        find.text('Plano ativo pronto para reservar a serie'),
        findsOneWidget,
      );
      expect(
        find.text('Escolher horario fixo de corte + barba + sobrancelha'),
        findsOneWidget,
      );

      await tester.tap(find.text('Escolher horario fixo'));
      await tester.pumpAndSettle();

      expect(selectedOffer?.id, 'membership-plan:membership-1');
      expect(selectedOffer?.kind, 'membership');
      expect(selectedOffer?.bookingServiceId, 'service-2');
    },
  );

  testWidgets('opens the agenda from the active plan first-slot reminder', (
    WidgetTester tester,
  ) async {
    final reference = DateTime.now();
    final sessionController = _TestSessionController(_sampleSessionWithLogo);
    final bootstrap = _buildTestBootstrap(
      sessionController: sessionController,
      profileRepository: _TestProfileRepository(
        membershipOverview: CustomerMembershipOverview(
          memberships: [
            CustomerMembershipPlan(
              id: 'membership-1',
              offerId: 'offer-2',
              title: 'Kit completo beleza',
              serviceId: 'service-2',
              serviceName: 'corte + barba + sobrancelha',
              status: 'active',
              sessionsIncluded: 3,
              sessionsUsed: 0,
              startedAt: _activeMembershipStart(reference),
              expiresAt: _activeMembershipExpiry(reference),
              priceSnapshot: 149.9,
            ),
          ],
          pendingRequests: const [],
        ),
      ),
    );
    final notificationsController = CustomerNotificationsController(
      client: null,
      sessionController: sessionController,
      notificationRepository: NotificationRepository(client: null),
    );
    int? navigatedTo;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: HomeDashboardPage(
          bootstrap: bootstrap,
          sessionController: sessionController,
          notificationsController: notificationsController,
          onNavigate: (index) => navigatedTo = index,
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.byKey(const ValueKey('home-open-membership-plan-membership-1')),
      find.byType(ListView),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('home-open-membership-plan-membership-1')),
    );
    await tester.pumpAndSettle();

    expect(navigatedTo, 1);
  });

  testWidgets('routes the highlighted offer into the booking flow', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(_sampleSessionWithLogo);
    final notificationsController = CustomerNotificationsController(
      client: null,
      sessionController: sessionController,
      notificationRepository: NotificationRepository(client: null),
    );
    SalonOfferHighlight? selectedOffer;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: HomeDashboardPage(
          bootstrap: bootstrap,
          sessionController: sessionController,
          notificationsController: notificationsController,
          onNavigate: (_) {},
          onOpenOfferBooking: (offer) => selectedOffer = offer,
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Agendar corte premium'),
      find.byType(ListView),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Agendar corte premium'));
    await tester.pumpAndSettle();

    expect(selectedOffer?.id, 'offer-1');
    expect(selectedOffer?.bookingServiceId, 'service-1');
  });

  testWidgets('renders every extra active offer beyond the main highlights', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(
      _buildSampleSession(
        activeOffers: const [
          SalonOfferHighlight(
            id: 'offer-1',
            kind: 'promotion',
            title: 'Combo da semana',
            description: 'Escova e hidratação em condição especial.',
            highlightText: null,
            imageUrl: 'https://example.com/offer.jpg',
            bookingServiceId: 'service-1',
            bookingServiceName: 'Corte premium',
            actionKind: 'book_service',
            kindLabel: 'Oferta',
            priceLabel: 'R\$ 139,90',
            lifecycleLabel: 'Agora',
          ),
          SalonOfferHighlight(
            id: 'offer-2',
            kind: 'membership',
            title: 'Kit completo beleza',
            description: 'Corte, barba e sobrancelha em um plano recorrente.',
            highlightText: '3 sessoes',
            imageUrl: 'https://example.com/membership.jpg',
            bookingServiceId: 'service-1',
            bookingServiceName: 'Corte premium',
            actionKind: 'request_membership',
            kindLabel: 'Plano',
            priceLabel: 'R\$ 149,90',
            lifecycleLabel: 'Agora',
          ),
          SalonOfferHighlight(
            id: 'offer-3',
            kind: 'promotion',
            title: 'Coloração express',
            description: 'Uma condição extra publicada pelo salão.',
            highlightText: null,
            imageUrl: null,
            bookingServiceId: 'service-2',
            bookingServiceName: 'Coloração express',
            actionKind: 'book_service',
            kindLabel: 'Oferta',
            priceLabel: 'R\$ 179,90',
            lifecycleLabel: 'Agora',
          ),
        ],
      ),
    );
    final notificationsController = CustomerNotificationsController(
      client: null,
      sessionController: sessionController,
      notificationRepository: NotificationRepository(client: null),
    );
    SalonOfferHighlight? selectedOffer;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: HomeDashboardPage(
          bootstrap: bootstrap,
          sessionController: sessionController,
          notificationsController: notificationsController,
          onNavigate: (_) {},
          onOpenOfferBooking: (offer) => selectedOffer = offer,
        ),
      ),
    );

    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Mais ofertas do salão'),
      find.byType(ListView).first,
      const Offset(0, -260),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mais ofertas do salão'), findsOneWidget);
    expect(find.text('Coloração express'), findsOneWidget);

    await tester.tap(
      find.widgetWithText(AsyncButton, 'Agendar coloração express'),
    );
    await tester.pumpAndSettle();

    expect(selectedOffer?.id, 'offer-3');
  });

  testWidgets('filters campaigns that require an upcoming appointment', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    final sessionController = _TestSessionController(
      _buildSampleSession(
        centralCampaigns: const [
          SalonCampaign(
            id: 'campaign-1',
            isActive: true,
            priority: 'high',
            startsAt: '2000-04-01T09:00:00Z',
            endsAt: '2099-04-07T20:00:00Z',
            audience: 'with_upcoming_appointment',
            eyebrow: 'Agenda',
            title: 'Só para quem já tem horário',
            message: 'Essa não deve aparecer sem agendamento futuro.',
            campaignLabel: 'Retenção',
            ctaLabel: 'Ver agenda',
            ctaTarget: 'appointments',
          ),
          SalonCampaign(
            id: 'campaign-2',
            isActive: true,
            priority: 'medium',
            startsAt: '2000-04-01T09:00:00Z',
            endsAt: '2099-04-07T20:00:00Z',
            audience: 'without_upcoming_appointment',
            eyebrow: 'Retorno',
            title: 'Campanha para voltar ao salão',
            message: 'Essa precisa aparecer para quem está sem agenda.',
            campaignLabel: 'Reativação',
            ctaLabel: 'Reservar',
            ctaTarget: 'appointments',
          ),
        ],
      ),
    );
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
    await tester.dragUntilVisible(
      find.text('Campanha para voltar ao salão'),
      find.byType(ListView).first,
      const Offset(0, -220),
    );
    await tester.pumpAndSettle();

    expect(find.text('Campanha para voltar ao salão'), findsOneWidget);
    expect(find.text('Só para quem já tem horário'), findsNothing);
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
    expect(find.text('Codigo SALAO7'), findsOneWidget);
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

    expect(find.text('Feed do salao'), findsOneWidget);
    expect(find.text('Acompanhe novidades e transformacoes'), findsOneWidget);
    expect(find.text('Seu story'), findsOneWidget);
    expect(find.text('Todos'), findsOneWidget);
  });

  testWidgets('renders real stories and removes fake highlight chips', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: FeedPage(
          feedRepository: _LoadedFeedRepository(
            posts: [
              _sampleFeedPost(
                id: 'post-1',
                title: 'Corte em alta',
                createdAt: DateTime.now(),
                imageUrls: const ['https://example.com/feed.jpg'],
              ),
            ],
            stories: [
              _sampleFeedStory(
                id: 'story-1',
                title: 'Vaga de hoje',
                serviceName: 'Corte masculino',
              ),
            ],
          ),
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

    expect(find.textContaining('Corte mascul'), findsOneWidget);
    expect(find.text('Seu story'), findsOneWidget);
    expect(find.text('Destaque'), findsNothing);
    expect(find.textContaining('Story ativa desde'), findsOneWidget);
  });

  testWidgets(
    'opens stories with visible CTA and auto advances like Instagram',
    (WidgetTester tester) async {
      final sessionController = _TestSessionController(_sampleSession);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: FeedPage(
            feedRepository: _LoadedFeedRepository(
              posts: const [],
              stories: [
                _sampleFeedStory(
                  id: 'story-1',
                  title: 'Vaga de hoje',
                  serviceName: 'Corte masculino',
                ),
                _sampleFeedStory(
                  id: 'story-2',
                  title: 'Antes e depois',
                  serviceName: 'Hidratacao',
                ),
              ],
            ),
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: sessionController,
              notificationRepository: NotificationRepository(client: null),
            ),
            session: _sampleSession,
            onNavigateToAgenda: () {},
          ),
        ),
      );

      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Corte mascul'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 320));

      expect(find.text('Vaga de hoje'), findsOneWidget);
      expect(find.text('Agendar agora'), findsOneWidget);

      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(milliseconds: 260));

      expect(find.text('Antes e depois'), findsOneWidget);
    },
  );

  testWidgets('opens the real actions menu from the feed card', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: FeedPage(
          feedRepository: _LoadedFeedRepository(
            posts: [
              _sampleFeedPost(
                id: 'post-1',
                title: 'Acabamento premium',
                createdAt: DateTime.now(),
                caption: 'Texto da legenda',
                imageUrls: const ['https://example.com/feed.jpg'],
              ),
            ],
          ),
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
    await tester.tap(find.byIcon(Icons.more_vert_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Ver fotos da publicacao'), findsOneWidget);
    expect(find.text('Copiar legenda'), findsOneWidget);
  });

  testWidgets('keeps the feed responsive when the panel connection oscillates', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: FeedPage(
          feedRepository: _FailingFeedRepository(),
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: sessionController,
            notificationRepository: NotificationRepository(client: null),
          ),
          session: _sampleSession,
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('Feed do salao'), findsOneWidget);
    expect(
      find.text(
        'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
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

  testWidgets('renders store catalog photos without cropping the product', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final sessionController = _TestSessionController(_sampleSession);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: StorePage(
          storeRepository: _LoadedStoreRepository(
            catalog: const [
              StoreProduct(
                id: 'product-image',
                name: 'Shampoo clean',
                brand: 'Salon',
                description: 'Foto precisa aparecer inteira na vitrine.',
                price: 39,
                stock: 12,
                unit: 'un',
                maxPurchaseQuantity: 4,
                imageUrl: 'https://example.com/shampoo.png',
                updatedAt: null,
              ),
            ],
          ),
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
    await tester.dragUntilVisible(
      find.text('Shampoo clean'),
      find.byType(ListView),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();

    final image = tester.widget<Image>(find.byType(Image).first);
    expect(image.fit, BoxFit.contain);
  });

  testWidgets(
    'keeps products with fractional stock out of the cart until a full unit exists',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1280, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final sessionController = _TestSessionController(_sampleSession);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: StorePage(
            storeRepository: _LoadedStoreRepository(
              catalog: const [
                StoreProduct(
                  id: 'product-fractional',
                  name: 'Ampola glow',
                  brand: 'Salon',
                  description: 'Tratamento de vitrine.',
                  price: 35,
                  stock: 0.5,
                  unit: 'un',
                  maxPurchaseQuantity: 3,
                  imageUrl: null,
                  updatedAt: null,
                ),
              ],
            ),
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
      await tester.dragUntilVisible(
        find.text('Ampola glow'),
        find.byType(ListView),
        const Offset(0, -240),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('menos de 1 un'), findsOneWidget);
      await tester.tap(find.text('Adicionar'), warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.textContaining('itens no carrinho'), findsNothing);
    },
  );

  testWidgets('caps the cart quantity to the whole units actually available', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 1600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: StorePage(
          storeRepository: _LoadedStoreRepository(
            catalog: const [
              StoreProduct(
                id: 'product-limited',
                name: 'Pomada matte',
                brand: 'Salon',
                description: 'Fixação forte.',
                price: 55,
                stock: 2.9,
                unit: 'un',
                maxPurchaseQuantity: 5,
                imageUrl: null,
                updatedAt: null,
              ),
            ],
          ),
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
    await tester.dragUntilVisible(
      find.text('Pomada matte'),
      find.byType(ListView),
      const Offset(0, -240),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Adicionar'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byIcon(Icons.add_rounded).first);
    await tester.tap(find.byIcon(Icons.add_rounded).first);
    await tester.pumpAndSettle();

    expect(find.text('2 itens no carrinho'), findsOneWidget);
    final incrementButton = tester.widget<IconButton>(
      find.byType(IconButton).last,
    );
    expect(incrementButton.onPressed, isNull);
  });

  testWidgets('shows product photo in recent orders', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: StorePage(
          storeRepository: _LoadedStoreRepository(
            orders: [
              StoreOrder(
                id: 'order-1',
                orderNumber: 1,
                status: 'completed',
                totalItems: 1,
                subtotalAmount: 55,
                createdAt: DateTime(2026, 4, 9, 1, 13),
                confirmedAt: null,
                readyAt: null,
                completedAt: null,
                cancelledAt: null,
                cancellationReason: null,
                notes: null,
                items: const [
                  StoreOrderItem(
                    id: 'item-1',
                    productName: 'pasta modeladora',
                    brand: 'Salon',
                    imageUrl: 'https://example.com/pasta.jpg',
                    quantity: 1,
                    unitPrice: 55,
                    lineTotal: 55,
                  ),
                ],
              ),
            ],
          ),
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
    await tester.dragUntilVisible(
      find.text('Pedidos recentes'),
      find.byType(ListView),
      const Offset(0, -220),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pedidos recentes'), findsOneWidget);
    expect(find.text('pasta modeladora'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('store-order-item-image-item-1')),
      findsOneWidget,
    );
  });

  testWidgets('keeps the store responsive when the panel connection oscillates', (
    WidgetTester tester,
  ) async {
    final sessionController = _TestSessionController(_sampleSession);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: StorePage(
          storeRepository: _FailingStoreRepository(),
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: sessionController,
            notificationRepository: NotificationRepository(client: null),
          ),
          session: _sampleSession,
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));

    expect(
      find.text('Loja virtual do salão com cara de vitrine de verdade.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
      ),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
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

  testWidgets(
    'shows a reminder activation card inside the inbox when push needs attention',
    (WidgetTester tester) async {
      final bootstrap = AppBootstrap.testing();
      bootstrap.deviceNotificationService.overrideHealthState(
        const DeviceNotificationHealthState(
          health: DeviceNotificationHealth.permissionDenied,
          systemStatus: 'denied',
        ),
      );
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
      await tester.tap(find.text('Avisos'));
      await tester.pumpAndSettle();

      expect(find.text('Ative os lembretes do aparelho'), findsOneWidget);
      expect(find.text('Atualizar lembretes'), findsOneWidget);
      expect(find.text('denied'), findsOneWidget);
    },
  );

  testWidgets(
    'reloads the home when returning to the tab and shows a new birthday campaign',
    (WidgetTester tester) async {
      final sessionController = _TestSessionController(_sampleSessionWithLogo);
      final profileRepository = _TestProfileRepository();
      final bootstrap = _buildTestBootstrap(
        sessionController: sessionController,
        profileRepository: profileRepository,
      );

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

      expect(find.text('Seu aniversario no salao'), findsNothing);

      profileRepository.birthdayExperience = BirthdayHomeExperience(
        id: 'birthday-live-1',
        title: 'Seu presente está te esperando',
        message:
            'Hoje a homenagem já está publicada e precisa aparecer ao voltar para a home.',
        customerName: 'T.K Borges',
        salonName: 'Studio Premium',
        birthDate: DateTime(1991, 4, 16),
        mediaKind: 'image',
        imageUrl: 'https://example.com/birthday-live.jpg',
      );

      await tester.tap(find.text('Agenda'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Início'));
      await tester.pump();
      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Seu aniversario no salao'),
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      expect(find.text('Seu aniversario no salao'), findsOneWidget);
      expect(find.text('Seu presente está te esperando'), findsOneWidget);
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
}

AppBootstrap _buildTestBootstrap({
  required SessionController sessionController,
  ProfileRepository? profileRepository,
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
    profileRepository: profileRepository ?? ProfileRepository(client: null),
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

class _TestProfileRepository extends ProfileRepository {
  _TestProfileRepository({
    this.membershipOverview = const CustomerMembershipOverview.empty(),
    this.birthdayExperience,
    this.loyaltySummary,
  }) : super(client: null);

  final CustomerMembershipOverview membershipOverview;
  BirthdayHomeExperience? birthdayExperience;
  final LoyaltySummary? loyaltySummary;

  @override
  Future<LoyaltySummary?> fetchLoyaltySummary() async => loyaltySummary;

  @override
  Future<ReferralSummary?> fetchReferralSummary() async => null;

  @override
  Future<CustomerMembershipOverview> fetchMembershipOverview({
    required String customerId,
  }) async => membershipOverview;

  @override
  Future<BirthdayHomeExperience?> fetchBirthdayHomeExperience() async =>
      birthdayExperience;
}

LoyaltySummary _sampleActiveLoyaltySummary() {
  return LoyaltySummary.fromJson(<String, dynamic>{
    'program': <String, dynamic>{
      'title': 'Clube de fidelidade',
      'description': 'Visitas concluídas viram pontos, cashback e níveis.',
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
  });
}

class _FailingFeedRepository extends FeedRepository {
  _FailingFeedRepository() : super(client: null);

  @override
  Future<List<FeedPost>> fetchPosts({required String customerId}) async {
    throw Exception(
      'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
    );
  }
}

class _LoadedFeedRepository extends FeedRepository {
  _LoadedFeedRepository({
    this.posts = const <FeedPost>[],
    this.stories = const <FeedStory>[],
  }) : super(client: null);

  final List<FeedPost> posts;
  final List<FeedStory> stories;

  @override
  Future<List<FeedPost>> fetchPosts({required String customerId}) async =>
      posts;

  @override
  Future<List<FeedStory>> fetchStories() async => stories;
}

class _FailingStoreRepository extends StoreRepository {
  _FailingStoreRepository() : super(client: null);

  @override
  Future<List<StoreProduct>> fetchCatalog() async {
    throw Exception(
      'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
    );
  }

  @override
  Future<List<StoreOrder>> fetchOrders() async {
    throw Exception(
      'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
    );
  }
}

class _LoadedStoreRepository extends StoreRepository {
  _LoadedStoreRepository({
    this.catalog = const <StoreProduct>[],
    this.orders = const <StoreOrder>[],
  }) : super(client: null);

  final List<StoreProduct> catalog;
  final List<StoreOrder> orders;

  @override
  Future<List<StoreProduct>> fetchCatalog() async => catalog;

  @override
  Future<List<StoreOrder>> fetchOrders() async => orders;
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

FeedStory _sampleFeedStory({
  required String id,
  required String title,
  String? serviceName,
  String? sourceType,
  String? authorUsername,
  String? ownerCustomerId,
}) {
  return FeedStory(
    id: id,
    title: title,
    caption: 'Story do salao',
    imageUrl: 'https://example.com/story.jpg',
    createdAt: DateTime.now(),
    expiresAt: DateTime.now().add(const Duration(hours: 8)),
    serviceName: serviceName,
    staffName: 'Equipe Studio',
    staffRole: 'Barbeiro',
    authorAvatarUrl: 'https://example.com/story-author.jpg',
    authorUsername: authorUsername,
    sourceType: sourceType,
    ownerCustomerId: ownerCustomerId,
  );
}

final AppSession _sampleSession = _buildSampleSession();
final AppSession _sampleSessionWithLogo = _buildSampleSession(
  logoUrl: 'https://example.com/logo.png',
  includeCampaigns: false,
);

AppSession _buildSampleSession({
  String? logoUrl,
  bool includeCampaigns = true,
  List<SalonOfferHighlight>? activeOffers,
  List<SalonGalleryHighlight>? recentPosts,
  List<SalonCampaign>? centralCampaigns,
}) {
  return AppSession(
    customer: const CustomerProfile(
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
        logoUrl: logoUrl,
        heroImageUrl: null,
        heroHeadline: 'Seu melhor visual começa aqui',
        welcomeHeadline: 'Seu salão em ritmo premium',
        welcomeMessage:
            'Agenda, feed e loja alinhados em uma experiência bonita.',
        primaryCtaLabel: 'Agendar',
        promotionHeadline: 'Tudo organizado para resolver em poucos toques.',
        segmentLabel: 'Salão',
        segmentDescription: 'Cuidado e experiência',
        moduleLabels: const ['Agenda', 'Loja', 'Feed'],
        mapUrl: null,
        supportUrl: null,
        supportEmail: 'oi@studio.com',
        ratingValue: 4.9,
        ratingCount: 120,
      ),
      featuredServices: const [
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
      activeOffers:
          activeOffers ??
          const [
            SalonOfferHighlight(
              id: 'offer-1',
              kind: 'promotion',
              title: 'Combo da semana',
              description: 'Escova e hidratação em condição especial.',
              highlightText: null,
              imageUrl: 'https://example.com/offer.jpg',
              bookingServiceId: 'service-1',
              bookingServiceName: 'Corte premium',
              actionKind: 'book_service',
              kindLabel: 'Oferta',
              priceLabel: 'R\$ 139,90',
              lifecycleLabel: 'Agora',
            ),
            SalonOfferHighlight(
              id: 'offer-2',
              kind: 'membership',
              title: 'Kit completo beleza',
              description: 'Corte, barba e sobrancelha em um plano recorrente.',
              highlightText: '3 sessoes',
              imageUrl: 'https://example.com/membership.jpg',
              bookingServiceId: 'service-1',
              bookingServiceName: 'Corte premium',
              actionKind: 'request_membership',
              kindLabel: 'Plano',
              priceLabel: 'R\$ 149,90',
              lifecycleLabel: 'Agora',
            ),
          ],
      recentPosts:
          recentPosts ??
          const [
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
      centralCampaigns:
          centralCampaigns ??
          (includeCampaigns
              ? const [
                  SalonCampaign(
                    id: 'campaign-1',
                    isActive: true,
                    priority: 'high',
                    startsAt: '2000-04-01T09:00:00Z',
                    endsAt: '2099-04-07T20:00:00Z',
                    audience: 'all',
                    eyebrow: 'Hoje',
                    title: 'Reserve o horário mais concorrido',
                    message: 'A agenda abriu novos encaixes para esta semana.',
                    campaignLabel: 'Agenda',
                    ctaLabel: 'Agendar agora',
                    ctaTarget: 'appointments',
                  ),
                ]
              : const []),
      stats: const SalonStats(
        servicesCount: 8,
        activeOffersCount: 2,
        recentPostsCount: 5,
      ),
      links: const SalonLinks(
        whatsappUrl: null,
        mapUrl: null,
        supportUrl: null,
        supportEmail: 'oi@studio.com',
        privacyPolicyUrl: null,
        termsOfUseUrl: null,
      ),
    ),
  );
}
