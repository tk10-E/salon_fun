import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:salon_client/src/data/salon_repository.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/models/client_app_config.dart';
import 'package:salon_client/src/screens/client_shell_screen.dart';
import 'package:salon_client/src/theme/app_theme.dart';
import 'package:salon_client/src/widgets/premium_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  Finder verticalScrollView() => find.byWidgetPredicate(
    (widget) =>
        widget is Scrollable && widget.axisDirection == AxisDirection.down,
  );

  Finder verticalScrollViewForText(String text) =>
      find.ancestor(of: find.text(text).first, matching: verticalScrollView());

  testWidgets('renderiza as abas principais em largura de celular', (
    tester,
  ) async {
    final repository = _FakeSalonRepository();
    final profile = CustomerProfile(
      id: 'customer-1',
      name: 'Ana',
      salonId: 'salon-1',
      salonName: 'Studio Salon Fun',
      salonTagline: 'Experiência do salão',
      salonBusinessSegment: 'beleza',
      salonClientAppConfig: SalonClientAppConfig(
        centralCampaigns: <SalonCentralCampaign>[
          SalonCentralCampaign(
            id: 'campaign-1',
            isActive: true,
            priority: SalonCentralCampaignPriority.high,
            startsAt: DateTime(2020, 1, 1, 9),
            endsAt: DateTime(2100, 1, 1, 22),
            audience: SalonCentralCampaignAudience.withUpcomingAppointment,
            title: 'Volte essa semana',
            message: 'Uma campanha publicada no painel ja aparece no app.',
            ctaTarget: SalonCentralCampaignTarget.explore,
            ctaLabel: 'Reservar agora',
          ),
          SalonCentralCampaign(
            id: 'campaign-2',
            isActive: true,
            priority: SalonCentralCampaignPriority.medium,
            startsAt: DateTime(2100, 1, 2, 9),
            audience: SalonCentralCampaignAudience.withoutUpcomingAppointment,
            title: 'Campanha futura',
            message: 'Essa publicacao nao deveria aparecer para este perfil.',
            ctaTarget: SalonCentralCampaignTarget.feed,
          ),
        ],
      ),
    );

    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: buildSalonTheme(profile),
        home: ClientShellScreen(
          repository: repository,
          profile: profile,
          onProfileChanged: (_) {},
          onSignOutRequested: () async {},
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(
      find.text('Tudo o que o salão publicar para você agora vive aqui.'),
      findsOneWidget,
    );
    expect(find.text('Campanha futura'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Reservar'));
    await tester.pumpAndSettle();
    expect(find.text('Serviços do salão'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Agenda'));
    await tester.pumpAndSettle();
    expect(find.text('Sua jornada na agenda'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Feed'));
    await tester.pumpAndSettle();
    expect(find.text('Feed do salão'), findsWidgets);
    expect(find.text('Destaques do feed'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Resultado real publicado pelo salão'),
      280,
      scrollable: verticalScrollViewForText('Destaques do feed').first,
    );
    expect(find.text('Instagram'), findsWidgets);
    expect(find.textContaining('instagram.com'), findsNothing);
    expect(find.text('Abrir no Instagram'), findsNothing);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Perfil'));
    await tester.pumpAndSettle();
    expect(find.text('Seu perfil de beleza'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('mantem cards compactos mesmo com textos longos e sujos', (
    tester,
  ) async {
    final repository = _FakeSalonRepository(
      offerDescription: 'Oferta relampago${'\n \n' * 220}com retorno',
      historyNotes:
          'Observacao interna do atendimento${'\n\n   ' * 260}finalizada',
    );
    final profile = CustomerProfile(
      id: 'customer-1',
      name: 'Ana',
      salonId: 'salon-1',
      salonName: 'Studio Salon Fun',
      salonTagline: 'Experiência do salão',
      salonBusinessSegment: 'beleza',
      salonClientAppConfig: const SalonClientAppConfig(),
    );

    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: buildSalonTheme(profile),
        home: ClientShellScreen(
          repository: repository,
          profile: profile,
          onProfileChanged: (_) {},
          onSignOutRequested: () async {},
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.text('Reservar'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Campanhas em evidência'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    final campaignsCard = find.ancestor(
      of: find.text('Campanhas em evidência'),
      matching: find.byType(PremiumCard),
    );
    expect(tester.getSize(campaignsCard.first).height, lessThan(520));

    await tester.tap(find.text('Agenda'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Histórico'),
      220,
      scrollable: find.byType(Scrollable).first,
    );
    final historyCard = find.ancestor(
      of: find.text('Histórico'),
      matching: find.byType(PremiumCard),
    );
    expect(tester.getSize(historyCard.first).height, lessThan(560));

    await tester.tap(find.text('Feed'));
    await tester.pumpAndSettle();
    expect(find.text('Destaques do feed'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Resultado real publicado pelo salão'),
      220,
      scrollable: verticalScrollViewForText('Destaques do feed').first,
    );
    await tester.pumpAndSettle();
    expect(find.text('Resultado real publicado pelo salão'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _FakeSalonRepository implements SalonRepository {
  _FakeSalonRepository({
    this.offerDescription = 'Oferta com leitura curta para mobile.',
    this.historyNotes = 'Visita registrada no arquivo do cliente.',
  });

  final String offerDescription;
  final String historyNotes;

  static const _service = ServiceItem(
    id: 'service-1',
    name: 'corte masculino',
    price: 45,
    duration: 30,
    category: 'Geral',
    description: 'Leitura rápida para reservar sem sair do ritmo do salão.',
  );

  static const _teamMember = TeamMember(
    id: 'team-1',
    name: 'wesley',
    role: 'cabeleireiro',
    isWorkingToday: true,
    opensAt: '09:00',
    closesAt: '18:00',
  );

  OfferItem get _offer => OfferItem(
    id: 'offer-1',
    kind: 'promotion',
    title: 'Campanha da semana',
    isActive: true,
    sortOrder: 1,
    description: offerDescription,
  );

  FeedPost get _post => FeedPost(
    id: 'post-1',
    title: 'Resultado real publicado pelo salão',
    caption: 'https://www.instagram.com/p/DWRY_rjES9f/',
    imageUrls: const [''],
    createdAt: DateTime(2026, 4, 1, 12),
    likeCount: 5,
    commentCount: 2,
    likedByMe: false,
    comments: const <FeedComment>[],
    linkedService: _service,
    sourceType: 'instagram_mention',
    externalPlatform: 'instagram',
    externalAuthorUsername: 'studio.salonfun',
    externalPermalink: 'https://instagram.com/p/post-1',
  );

  AppointmentItem get _appointment {
    final baseDate = DateTime(2026, 4, 4, 10);
    return AppointmentItem(
      id: 'appointment-1',
      date: baseDate,
      endsAt: baseDate.add(const Duration(minutes: 30)),
      status: 'confirmed',
      serviceName: _service.name,
      serviceDuration: _service.duration,
      servicePrice: _service.price,
      staffMemberName: _teamMember.name,
    );
  }

  AppointmentItem get _historyAppointment {
    final baseDate = DateTime(2026, 3, 18, 14);
    return AppointmentItem(
      id: 'appointment-history-1',
      date: baseDate,
      endsAt: baseDate.add(const Duration(minutes: 30)),
      status: 'completed',
      serviceName: _service.name,
      serviceDuration: _service.duration,
      servicePrice: _service.price,
      staffMemberName: _teamMember.name,
      completedAt: baseDate.add(const Duration(minutes: 30)),
      depositNotes: historyNotes,
    );
  }

  @override
  User? get currentUser => null;

  @override
  Stream<AuthState> get authChanges => const Stream<AuthState>.empty();

  @override
  Future<CachedView<HomeSnapshot>> loadHomeSnapshot({
    required String customerId,
  }) async {
    return CachedView<HomeSnapshot>(
      isFromCache: false,
      data: HomeSnapshot(
        services: const <ServiceItem>[_service],
        teamMembers: const <TeamMember>[_teamMember],
        offers: <OfferItem>[_offer],
        products: const <RetailProduct>[],
        appointments: <AppointmentItem>[_appointment],
        vacancyAlerts: const <VacancyAlert>[],
        posts: <FeedPost>[_post],
        notifications: const <CustomerNotificationItem>[],
        loyaltySummary: null,
        referralSummary: null,
      ),
    );
  }

  @override
  Future<CachedView<ExploreSnapshot>> loadExploreSnapshot() async {
    return CachedView<ExploreSnapshot>(
      isFromCache: false,
      data: ExploreSnapshot(
        services: <ServiceItem>[_service],
        teamMembers: <TeamMember>[_teamMember],
        offers: <OfferItem>[_offer],
        products: <RetailProduct>[],
      ),
    );
  }

  @override
  Future<CachedView<AppointmentsSnapshot>> loadAppointmentsSnapshot() async {
    return CachedView<AppointmentsSnapshot>(
      isFromCache: false,
      data: AppointmentsSnapshot(
        appointments: <AppointmentItem>[_appointment, _historyAppointment],
        vacancyAlerts: const <VacancyAlert>[],
      ),
    );
  }

  @override
  Future<CachedView<FeedSnapshot>> loadFeedSnapshot({
    required String customerId,
  }) async {
    return CachedView<FeedSnapshot>(
      isFromCache: false,
      data: FeedSnapshot(posts: <FeedPost>[_post]),
    );
  }

  @override
  Future<CachedView<ProfileSnapshot>> loadProfileSnapshot() async {
    return CachedView<ProfileSnapshot>(
      isFromCache: false,
      data: ProfileSnapshot(
        loyaltySummary: null,
        referralSummary: null,
        unreadNotificationsCount: 0,
        storeOrders: <CustomerStoreOrder>[
          CustomerStoreOrder(
            id: 'order-1',
            orderNumber: 204,
            status: 'ready',
            totalItems: 3,
            subtotalAmount: 134.7,
            createdAt: DateTime(2026, 4, 3, 10),
            readyAt: DateTime(2026, 4, 4, 9, 30),
            items: <CustomerStoreOrderItem>[
              CustomerStoreOrderItem(
                id: 'order-item-1',
                productName: 'Shampoo reconstrutor',
                brand: 'Glow Care',
                quantity: 2,
                unit: 'un',
                unitPrice: 44.9,
                lineTotalAmount: 89.8,
                imageUrl:
                    'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
              ),
              CustomerStoreOrderItem(
                id: 'order-item-2',
                productName: 'Mascara nutritiva',
                quantity: 1,
                unit: 'un',
                unitPrice: 44.9,
                lineTotalAmount: 44.9,
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Future<void> likePost({required String postId}) async {}

  @override
  Future<void> unlikePost({
    required String postId,
    required String customerId,
  }) async {}

  @override
  Future<void> addPostComment({
    required String postId,
    required String body,
  }) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) {
    return super.noSuchMethod(invocation);
  }
}
