import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/home/home_data.dart';
import 'package:salon_client/src/features/home/home_data_loader.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/home_screen.dart';
import 'package:salon_client/src/services/push_token_sync_service.dart';
import 'package:salon_client/src/widgets/salon_feed_post_card.dart';
import 'package:salon_client/src/widgets/salon_home_skeleton.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedTestClient;

  group('HomeScreen', () {
    testWidgets('shows the loading skeleton while data is pending', (
      tester,
    ) async {
      final completer = Completer<HomeData>();
      final loader = _FakeHomeDataLoader(onLoad: (_) => completer.future);

      await _pumpHomeScreen(
        tester,
        repository: _FakeSalonRepository(),
        loader: loader,
      );

      expect(find.byType(SalonHomeSkeleton), findsOneWidget);
      expect(find.text('Salon Fun'), findsOneWidget);
      expect(loader.loadCount, 1);
    });

    testWidgets('renders loaded data and lets the user switch tabs', (
      tester,
    ) async {
      CustomerProfile? activeProfile;
      final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

      await _pumpHomeScreen(
        tester,
        repository: _FakeSalonRepository(),
        loader: loader,
        onActiveProfileChanged: (profile) {
          activeProfile = profile;
        },
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(activeProfile?.id, 'customer-1');
      expect(find.text('Salon Fun'), findsAtLeastNWidgets(2));
      expect(find.text('Beleza com cuidado'), findsWidgets);
      expect(find.text('Serviços em destaque'), findsOneWidget);

      await tester.tap(find.text('Galeria'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(
        find.text('Os próximos resultados do salão vão aparecer aqui'),
        findsOneWidget,
      );

      await tester.tap(find.text('Agenda'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Sua jornada com o salão em um olhar'), findsOneWidget);
      expect(find.text('Hidratação premium'), findsOneWidget);
      expect(find.text('Confirmar presença'), findsOneWidget);
    });

    testWidgets(
      'uses a conversion-focused hero subtitle when the salon has no tagline',
      (tester) async {
        final loader = _FakeHomeDataLoader(
          onLoad: (_) async => _homeData(
            offers: [_membershipOffer()],
            clearNextAvailableAt: true,
          ),
        );

        await _pumpHomeScreen(
          tester,
          repository: _FakeSalonRepository(),
          loader: loader,
          profile: _profile(salonTagline: null),
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(
          find.text('Planos e horários do salão em uma leitura rápida.'),
          findsWidgets,
        );
      },
    );

    testWidgets('adapts the app bar label for the barbershop preset', (
      tester,
    ) async {
      final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

      await _pumpHomeScreen(
        tester,
        repository: _FakeSalonRepository(),
        loader: loader,
        profile: _profile(salonBusinessSegment: 'barbershop'),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Sua barbearia no app'), findsOneWidget);
    });

    testWidgets('shows an error state and retries the load successfully', (
      tester,
    ) async {
      var loadAttemptCount = 0;
      final loader = _FakeHomeDataLoader(
        onLoad: (_) async {
          loadAttemptCount += 1;
          if (loadAttemptCount == 1) {
            throw Exception('load_failed');
          }

          return _homeData();
        },
      );

      await _pumpHomeScreen(
        tester,
        repository: _FakeSalonRepository(),
        loader: loader,
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Não foi possível carregar o salão'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);

      final retryButton = find.byWidgetPredicate(
        (widget) => widget is FilledButton,
      );
      final retryButtonWidget = tester.widget<FilledButton>(retryButton);
      retryButtonWidget.onPressed?.call();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Serviços em destaque'), findsOneWidget);
      expect(loadAttemptCount, 2);
    });

    testWidgets(
      'shows the feed-specific error state and retries successfully',
      (tester) async {
        var loadAttemptCount = 0;
        final loader = _FakeHomeDataLoader(
          onLoad: (_) async {
            loadAttemptCount += 1;
            if (loadAttemptCount == 1) {
              throw Exception('feed_load_failed');
            }

            return _homeData(posts: [_feedPost()]);
          },
        );

        await _pumpHomeScreen(
          tester,
          repository: _FakeSalonRepository(),
          loader: loader,
        );

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(
          find.text('Não foi possível carregar a galeria do salão'),
          findsOneWidget,
        );
        expect(find.text('Tentar novamente'), findsOneWidget);

        final retryButton = find.byWidgetPredicate(
          (widget) => widget is FilledButton,
        );
        final retryButtonWidget = tester.widget<FilledButton>(retryButton);
        retryButtonWidget.onPressed?.call();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(find.text('Resultado glossy'), findsOneWidget);
        expect(loadAttemptCount, 2);
      },
    );

    testWidgets(
      'likes a feed post, updates the UI locally and refreshes in background',
      (tester) async {
        final repository = _FakeSalonRepository();
        final refreshCompleter = Completer<HomeData>();
        var loadAttemptCount = 0;
        final initialPost = _feedPost();
        final loader = _FakeHomeDataLoader(
          onLoad: (_) {
            loadAttemptCount += 1;
            if (loadAttemptCount == 1) {
              return Future<HomeData>.value(_homeData(posts: [initialPost]));
            }

            return refreshCompleter.future;
          },
        );

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('0 curtidas'), findsOneWidget);

        final card = tester.widget<SalonFeedPostCard>(
          find.byType(SalonFeedPostCard),
        );
        card.onToggleLike();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.likedPostIds, ['post-1']);
        expect(find.text('1 curtida'), findsOneWidget);
        expect(loader.loadCount, 2);

        refreshCompleter.complete(
          _homeData(
            posts: [initialPost.copyWith(likedByMe: true, likeCount: 1)],
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      },
    );

    testWidgets(
      'keeps the current feed state visible when the background refresh fails',
      (tester) async {
        final repository = _FakeSalonRepository();
        var loadAttemptCount = 0;
        final initialPost = _feedPost();
        final loader = _FakeHomeDataLoader(
          onLoad: (_) async {
            loadAttemptCount += 1;
            if (loadAttemptCount == 1) {
              return _homeData(posts: [initialPost]);
            }

            throw Exception('background_refresh_failed');
          },
        );

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        final card = tester.widget<SalonFeedPostCard>(
          find.byType(SalonFeedPostCard),
        );
        card.onToggleLike();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(repository.likedPostIds, ['post-1']);
        expect(find.text('1 curtida'), findsOneWidget);
        expect(find.text('Resultado glossy'), findsOneWidget);
        expect(
          find.text('Não foi possível carregar a galeria do salão'),
          findsNothing,
        );
        expect(loadAttemptCount, 2);
      },
    );

    testWidgets(
      'unlikes a feed post, updates the UI locally and refreshes in background',
      (tester) async {
        final repository = _FakeSalonRepository();
        final refreshCompleter = Completer<HomeData>();
        var loadAttemptCount = 0;
        final initialPost = _feedPost(likeCount: 1, likedByMe: true);
        final loader = _FakeHomeDataLoader(
          onLoad: (_) {
            loadAttemptCount += 1;
            if (loadAttemptCount == 1) {
              return Future<HomeData>.value(_homeData(posts: [initialPost]));
            }

            return refreshCompleter.future;
          },
        );

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('1 curtida'), findsOneWidget);

        final card = tester.widget<SalonFeedPostCard>(
          find.byType(SalonFeedPostCard),
        );
        card.onToggleLike();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        expect(repository.unlikedPostIds, ['post-1']);
        expect(repository.unlikeCustomerIds, ['customer-1']);
        expect(find.text('0 curtidas'), findsOneWidget);
        expect(loader.loadCount, 2);

        refreshCompleter.complete(
          _homeData(
            posts: [initialPost.copyWith(likedByMe: false, likeCount: 0)],
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      },
    );

    testWidgets('keeps the like state when unlike fails on the backend', (
      tester,
    ) async {
      final repository = _FakeSalonRepository(
        unlikePostError: const PostgrestException(
          message: 'row-level security',
        ),
      );
      final loader = _FakeHomeDataLoader(
        onLoad: (_) async =>
            _homeData(posts: [_feedPost(likeCount: 1, likedByMe: true)]),
      );

      await _pumpHomeScreen(tester, repository: repository, loader: loader);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      await tester.tap(find.text('Galeria'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final card = tester.widget<SalonFeedPostCard>(
        find.byType(SalonFeedPostCard),
      );
      card.onToggleLike();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(repository.unlikeAttemptedPostIds, ['post-1']);
      expect(repository.unlikeAttemptedCustomerIds, ['customer-1']);
      expect(
        find.text('Não foi possível concluir sua interação agora.'),
        findsOneWidget,
      );
      expect(find.text('1 curtida'), findsOneWidget);
      expect(loader.loadCount, 1);
    });

    testWidgets('shows a friendly message when a feed interaction fails', (
      tester,
    ) async {
      final repository = _FakeSalonRepository(
        likePostError: const PostgrestException(message: 'duplicate key'),
      );
      final loader = _FakeHomeDataLoader(
        onLoad: (_) async => _homeData(posts: [_feedPost()]),
      );

      await _pumpHomeScreen(tester, repository: repository, loader: loader);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      await tester.tap(find.text('Galeria'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      final card = tester.widget<SalonFeedPostCard>(
        find.byType(SalonFeedPostCard),
      );
      card.onToggleLike();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(repository.likeAttemptedPostIds, ['post-1']);
      expect(find.text('Você já curtiu esta foto.'), findsOneWidget);
      expect(find.text('0 curtidas'), findsOneWidget);
      expect(loader.loadCount, 1);
    });

    testWidgets(
      'submits a feed comment, shows success feedback and refreshes in background',
      (tester) async {
        final repository = _FakeSalonRepository();
        final refreshCompleter = Completer<HomeData>();
        var loadAttemptCount = 0;
        final initialPost = _feedPost(commentCount: 0, comments: const []);
        final loader = _FakeHomeDataLoader(
          onLoad: (_) {
            loadAttemptCount += 1;
            if (loadAttemptCount == 1) {
              return Future<HomeData>.value(_homeData(posts: [initialPost]));
            }

            return refreshCompleter.future;
          },
        );

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        final card = tester.widget<SalonFeedPostCard>(
          find.byType(SalonFeedPostCard),
        );
        card.onOpenComments();
        await tester.pumpAndSettle();

        await tester.enterText(
          find.byType(TextField),
          '  Ficou lindo demais!  ',
        );
        await tester.ensureVisible(find.text('Enviar comentário'));
        await tester.tap(find.text('Enviar comentário'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(repository.commentedPostIds, ['post-1']);
        expect(repository.commentBodies, ['Ficou lindo demais!']);
        expect(find.text('Comentário enviado com sucesso.'), findsOneWidget);
        expect(loader.loadCount, 2);

        refreshCompleter.complete(
          _homeData(
            posts: [
              initialPost.copyWith(
                commentCount: 1,
                comments: [
                  SalonPostComment(
                    id: 'comment-2',
                    customerId: 'customer-1',
                    customerName: 'Talita',
                    body: 'Ficou lindo demais!',
                    createdAt: DateTime(2099, 4, 10, 16, 30),
                  ),
                ],
              ),
            ],
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));
      },
    );

    testWidgets(
      'shows a friendly message when comment submission fails from the home screen',
      (tester) async {
        final repository = _FakeSalonRepository(
          addPostCommentError: Exception('comment_failed'),
        );
        final loader = _FakeHomeDataLoader(
          onLoad: (_) async => _homeData(
            posts: [_feedPost(commentCount: 0, comments: const [])],
          ),
        );

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.text('Galeria'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        final card = tester.widget<SalonFeedPostCard>(
          find.byType(SalonFeedPostCard),
        );
        card.onOpenComments();
        await tester.pumpAndSettle();

        await tester.enterText(find.byType(TextField), 'Amei o resultado.');
        await tester.ensureVisible(find.text('Enviar comentário'));
        await tester.tap(find.text('Enviar comentário'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(repository.commentAttemptedPostIds, ['post-1']);
        expect(repository.commentAttemptedBodies, ['Amei o resultado.']);
        expect(
          find.text('Não foi possível enviar seu comentário agora.'),
          findsOneWidget,
        );
        expect(find.text('Comentários'), findsOneWidget);
        expect(loader.loadCount, 1);
      },
    );

    testWidgets(
      'opens notifications center and marks unread notifications as read',
      (tester) async {
        final repository = _FakeSalonRepository();
        final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

        await _pumpHomeScreen(tester, repository: repository, loader: loader);

        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        await tester.tap(find.byTooltip('Notificações'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(find.text('Notificações do salão'), findsOneWidget);
        expect(find.text('Promoção da semana'), findsOneWidget);

        final sheetContext = tester.element(find.text('Notificações do salão'));
        Navigator.of(sheetContext).pop();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));

        expect(repository.markedNotificationsReadBatches, hasLength(1));
        expect(
          repository.markedNotificationsReadBatches.single.single.id,
          'notif-1',
        );
      },
    );

    testWidgets('archives notifications from the notifications center', (
      tester,
    ) async {
      final repository = _FakeSalonRepository();
      final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

      await _pumpHomeScreen(tester, repository: repository, loader: loader);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      await tester.tap(find.byTooltip('Notificações'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await tester.tap(find.text('Apagar avisos'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(repository.archivedNotificationsBatches, hasLength(1));
      expect(
        repository.archivedNotificationsBatches.single.single.id,
        'notif-1',
      );
      expect(find.text('Nenhum aviso por enquanto'), findsOneWidget);
    });

    testWidgets('opens profile and wallet from the account menu', (
      tester,
    ) async {
      final repository = _FakeSalonRepository();
      final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

      await _pumpHomeScreen(tester, repository: repository, loader: loader);

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final accountMenuFinder = find.byWidgetPredicate(
        (widget) => widget is PopupMenuButton,
      );
      (tester.state(accountMenuFinder) as dynamic).showButtonMenu();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text('Minha conta').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Sair da conta'), findsOneWidget);

      await tester.pageBack();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      (tester.state(accountMenuFinder) as dynamic).showButtonMenu();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text('Minha carteira').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Movimentos recentes'), findsOneWidget);
      expect(repository.loyaltyTransactionsRequestCount, 1);
    });

    testWidgets('signs out from the account menu', (tester) async {
      final repository = _FakeSalonRepository();
      final pushTokenSyncService = _FakePushTokenSyncService();
      final loader = _FakeHomeDataLoader(onLoad: (_) async => _homeData());

      await _pumpHomeScreen(
        tester,
        repository: repository,
        loader: loader,
        pushTokenSyncService: pushTokenSyncService,
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final accountMenuFinder = find.byWidgetPredicate(
        (widget) => widget is PopupMenuButton,
      );
      (tester.state(accountMenuFinder) as dynamic).showButtonMenu();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.text('Sair').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(pushTokenSyncService.deactivateCount, 1);
      expect(repository.signOutCount, 1);
    });
  });
}

Future<void> _pumpHomeScreen(
  WidgetTester tester, {
  required _FakeSalonRepository repository,
  required _FakeHomeDataLoader loader,
  CustomerProfile? profile,
  ValueChanged<CustomerProfile?>? onActiveProfileChanged,
  PushTokenSyncService? pushTokenSyncService,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 2600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: HomeScreen(
        repository: repository,
        profile: profile ?? _profile(),
        homeDataLoader: loader,
        onActiveProfileChanged: onActiveProfileChanged,
        pushTokenSyncService: pushTokenSyncService,
        enableRealtime: false,
        enablePushTokenSync: false,
      ),
    ),
  );
  await tester.pump();
}

CustomerProfile _profile({
  String? salonTagline = 'Beleza com cuidado',
  String? salonBusinessSegment = 'beauty_salon',
}) {
  return CustomerProfile(
    id: 'customer-1',
    name: 'Talita',
    salonId: 'salon-1',
    salonName: 'Salon Fun',
    salonTagline: salonTagline,
    salonBrandColor: '#C56B43',
    salonBusinessSegment: salonBusinessSegment,
  );
}

ServiceItem _service() {
  return const ServiceItem(
    id: 'service-1',
    name: 'Corte premium',
    price: 120,
    duration: 60,
    sortOrder: 0,
    category: 'Cabelo',
    description: 'Corte com acabamento e finalização.',
  );
}

AppointmentItem _appointment() {
  return AppointmentItem(
    id: 'appointment-1',
    date: DateTime(2099, 4, 10, 14),
    endsAt: DateTime(2099, 4, 10, 15),
    status: 'confirmed',
    customerConfirmationRequestedAt: DateTime(2099, 4, 10, 11),
    serviceName: 'Hidratação premium',
    serviceDuration: 60,
    servicePrice: 140,
    staffMemberName: 'Ana',
  );
}

HomeData _homeData({
  List<ServiceItem>? services,
  List<AppointmentItem>? appointments,
  List<SalonPost>? posts,
  List<SalonOfferItem>? offers,
  List<CustomerNotificationItem>? notifications,
  DateTime? nextAvailableAt,
  bool clearNextAvailableAt = false,
}) {
  return HomeData(
    services: services ?? [_service()],
    appointments: appointments ?? [_appointment()],
    vacancyAlerts: const [],
    posts: posts ?? const [],
    offers: offers ?? const [],
    growthSuggestions: null,
    loyaltySummary: _loyaltySummary(),
    referralSummary: _referralSummary(),
    notifications:
        notifications ??
        [
          CustomerNotificationItem(
            id: 'notif-1',
            sourceType: 'salon_notification',
            type: 'update',
            title: 'Promoção da semana',
            body: 'Confira as novidades do salão.',
            createdAt: DateTime(2099, 4, 10, 9),
          ),
        ],
    nextAvailableAt: clearNextAvailableAt
        ? null
        : nextAvailableAt ?? DateTime(2099, 4, 10, 15, 30),
    smartSchedule: null,
  );
}

SalonOfferItem _membershipOffer() {
  return const SalonOfferItem(
    id: 'offer-1',
    kind: 'membership',
    title: 'Plano glow mensal',
    description:
        'Escova e finalização com valor melhor para quem volta sempre.',
    isActive: true,
    sortOrder: 0,
    price: 189,
  );
}

class _FakeSalonRepository extends SalonRepository {
  _FakeSalonRepository({
    this.likePostError,
    this.unlikePostError,
    this.addPostCommentError,
  }) : super(_sharedTestClient);

  final List<List<CustomerNotificationItem>> markedNotificationsReadBatches =
      [];
  final List<List<CustomerNotificationItem>> archivedNotificationsBatches = [];
  final List<String> likeAttemptedPostIds = [];
  final List<String> likedPostIds = [];
  final List<String> unlikeAttemptedPostIds = [];
  final List<String> unlikeAttemptedCustomerIds = [];
  final List<String> unlikedPostIds = [];
  final List<String> unlikeCustomerIds = [];
  final List<String> commentAttemptedPostIds = [];
  final List<String> commentAttemptedBodies = [];
  final List<String> commentedPostIds = [];
  final List<String> commentBodies = [];
  final PostgrestException? likePostError;
  final PostgrestException? unlikePostError;
  final Object? addPostCommentError;
  int loyaltyTransactionsRequestCount = 0;
  int signOutCount = 0;

  @override
  Future<void> markNotificationsRead(
    List<CustomerNotificationItem> notifications,
  ) async {
    markedNotificationsReadBatches.add(
      List<CustomerNotificationItem>.from(notifications),
    );
  }

  @override
  Future<void> archiveNotifications(
    List<CustomerNotificationItem> notifications,
  ) async {
    archivedNotificationsBatches.add(
      List<CustomerNotificationItem>.from(notifications),
    );
  }

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() async =>
      _loyaltySummary();

  @override
  Future<ReferralSummary?> getReferralSummary() async => _referralSummary();

  @override
  Future<List<LoyaltyTransactionItem>> getLoyaltyTransactions({
    int limit = 20,
  }) async {
    loyaltyTransactionsRequestCount += 1;
    return const [];
  }

  @override
  Future<void> signOut() async {
    signOutCount += 1;
  }

  @override
  Future<void> likePost({required String postId}) async {
    likeAttemptedPostIds.add(postId);
    if (likePostError != null) {
      throw likePostError!;
    }
    likedPostIds.add(postId);
  }

  @override
  Future<void> unlikePost({
    required String postId,
    required String customerId,
  }) async {
    unlikeAttemptedPostIds.add(postId);
    unlikeAttemptedCustomerIds.add(customerId);
    if (unlikePostError != null) {
      throw unlikePostError!;
    }
    unlikedPostIds.add(postId);
    unlikeCustomerIds.add(customerId);
  }

  @override
  Future<void> addPostComment({
    required String postId,
    required String body,
  }) async {
    commentAttemptedPostIds.add(postId);
    commentAttemptedBodies.add(body.trim());
    if (addPostCommentError != null) {
      throw addPostCommentError!;
    }
    commentedPostIds.add(postId);
    commentBodies.add(body.trim());
  }
}

SalonPost _feedPost({
  int likeCount = 0,
  int commentCount = 1,
  bool likedByMe = false,
  List<SalonPostComment>? comments,
}) {
  return SalonPost(
    id: 'post-1',
    title: 'Resultado glossy',
    caption: 'Finalização com brilho intenso e corte em camadas.',
    imageUrls: const ['https://example.com/post.jpg'],
    createdAt: DateTime(2099, 4, 10, 16),
    likeCount: likeCount,
    commentCount: commentCount,
    likedByMe: likedByMe,
    comments:
        comments ??
        [
          SalonPostComment(
            id: 'comment-1',
            customerId: 'customer-2',
            customerName: 'Camila',
            body: 'Ficou maravilhoso.',
            createdAt: DateTime(2099, 4, 10, 16, 20),
          ),
        ],
    linkedService: _service(),
  );
}

CustomerLoyaltySummary _loyaltySummary() {
  const bronzeTier = LoyaltyTierBenefit(
    label: 'Bronze',
    minVisits: 0,
    discountPercent: 0,
    isVip: false,
  );
  const silverTier = LoyaltyTierBenefit(
    label: 'Prata',
    minVisits: 5,
    discountPercent: 5,
    isVip: false,
  );

  return const CustomerLoyaltySummary(
    program: LoyaltyProgramInfo(
      title: 'Clube Salon Fun',
      pointsPerVisit: 10,
      cashbackPercent: 5,
      isActive: true,
      tiers: [bronzeTier, silverTier],
    ),
    pointsBalance: 120,
    totalPointsEarned: 240,
    cashbackBalance: 18,
    totalCashbackEarned: 30,
    completedVisits: 4,
    rankPosition: 8,
    rankedCustomers: 56,
    currentTier: bronzeTier,
    nextTier: silverTier,
    visitsToNextTier: 1,
  );
}

ReferralSummary _referralSummary() {
  return ReferralSummary(
    referralCode: 'TALITA10',
    pendingCount: 1,
    qualifiedCount: 2,
    currentCycleProgress: 2,
    nextRewardRemaining: 1,
    unlockedRewardsCount: 0,
    availableRewardsCount: 0,
    program: const ReferralProgramInfo(
      title: 'Indique e ganhe',
      rewardForReferrer: 'Brinde no próximo atendimento',
      requiredQualifiedReferrals: 3,
      isActive: true,
    ),
    referrals: [
      ReferralProgressItem(
        id: 'ref-1',
        customerName: 'Camila',
        status: 'qualified',
        createdAt: DateTime(2099, 4, 1, 10),
        qualifiedAt: DateTime(2099, 4, 3, 16),
      ),
    ],
    rewardUnlocks: const [],
  );
}

class _FakeHomeDataLoader extends HomeDataLoader {
  _FakeHomeDataLoader({
    required Future<HomeData> Function(String customerId) onLoad,
  }) : _onLoad = onLoad,
       super(repository: _NoopHomeDataRepository());

  final Future<HomeData> Function(String customerId) _onLoad;
  int loadCount = 0;

  @override
  Future<HomeData> load({required String customerId}) {
    loadCount += 1;
    return _onLoad(customerId);
  }
}

class _FakePushTokenSyncService extends PushTokenSyncService {
  _FakePushTokenSyncService()
    : super(repository: _NoopPushTokenSyncRepository());

  int deactivateCount = 0;

  @override
  Future<void> start() async {}

  @override
  Future<void> deactivateCurrentToken() async {
    deactivateCount += 1;
  }

  @override
  Future<void> dispose() async {}
}

class _NoopHomeDataRepository implements HomeDataRepository {
  @override
  Future<List<AppointmentItem>> getAppointments() {
    throw UnimplementedError();
  }

  @override
  Future<Set<String>> getFavoriteServiceIds() {
    throw UnimplementedError();
  }

  @override
  Future<List<CustomerNotificationItem>> getCustomerNotifications() {
    throw UnimplementedError();
  }

  @override
  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions() {
    throw UnimplementedError();
  }

  @override
  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<List<SalonPost>> getFeedPosts({required String customerId}) {
    throw UnimplementedError();
  }

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() {
    throw UnimplementedError();
  }

  @override
  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() {
    throw UnimplementedError();
  }

  @override
  Future<ReferralSummary?> getReferralSummary() {
    throw UnimplementedError();
  }

  @override
  Future<List<SalonOfferItem>> getSalonOffers() {
    throw UnimplementedError();
  }

  @override
  Future<List<ServiceItem>> getServices() {
    throw UnimplementedError();
  }

  @override
  Future<SmartScheduleOpportunityFeed?> getSmartScheduleOpportunities({
    DateTime? targetDay,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<List<VacancyAlert>> getVacancyAlerts() {
    throw UnimplementedError();
  }
}

class _NoopPushTokenSyncRepository implements PushTokenSyncRepository {
  @override
  Future<void> deactivatePushToken({required String token}) async {}

  @override
  Future<void> registerPushToken({
    required String token,
    required String platform,
    String? deviceLabel,
  }) async {}
}
