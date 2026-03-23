import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/home/home_data.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/theme/salon_branding.dart';
import 'package:salon_client/src/widgets/home/home_feed_tab.dart';
import 'package:salon_client/src/widgets/home/home_history_tab.dart';
import 'package:salon_client/src/widgets/home/home_services_tab.dart';

void main() {
  group('Home tabs', () {
    testWidgets('shows history empty state and opens WhatsApp action', (
      tester,
    ) async {
      var whatsappTapCount = 0;

      await _pumpHomeTestApp(
        tester,
        HomeHistoryTab(
          profile: _profile(),
          branding: _branding(),
          appointments: const [],
          onCancelAppointment: (_) async {},
          onConfirmAppointmentPresence: (_) async {},
          onRefresh: () async {},
          onWhatsApp: () {
            whatsappTapCount += 1;
          },
        ),
      );

      expect(find.text('Seu histórico está vazio'), findsOneWidget);
      expect(find.text('Falar com o salão'), findsOneWidget);

      await tester.scrollUntilVisible(find.text('Falar com o salão'), 200);
      await tester.tap(find.text('Falar com o salão'));
      await tester.pump();

      expect(whatsappTapCount, 1);
    });

    testWidgets(
      'renders appointment actions when presence confirmation is required',
      (tester) async {
        AppointmentItem? cancelledAppointment;
        AppointmentItem? confirmedAppointment;
        final appointment = _appointmentRequiringPresence();

        await _pumpHomeTestApp(
          tester,
          HomeHistoryTab(
            profile: _profile(),
            branding: _branding(),
            appointments: [appointment],
            onCancelAppointment: (item) async {
              cancelledAppointment = item;
            },
            onConfirmAppointmentPresence: (item) async {
              confirmedAppointment = item;
            },
            onRefresh: () async {},
            onWhatsApp: () {},
          ),
        );

        expect(find.text('Hidratação premium'), findsOneWidget);
        expect(find.text('Confirmar presença'), findsOneWidget);
        expect(find.text('Cancelar horário'), findsOneWidget);

        await tester.scrollUntilVisible(find.text('Confirmar presença'), 200);
        await tester.tap(find.text('Confirmar presença'));
        await tester.pump();
        await tester.scrollUntilVisible(find.text('Cancelar horário'), 200);
        await tester.tap(find.text('Cancelar horário'));
        await tester.pump();

        expect(confirmedAppointment?.id, appointment.id);
        expect(cancelledAppointment?.id, appointment.id);
      },
    );

    testWidgets(
      'turns history into a return channel with rebook and wallet actions',
      (tester) async {
        ServiceItem? bookedService;
        CustomerGrowthSuggestionItem? bookedSuggestion;
        var walletTapCount = 0;
        var whatsappTapCount = 0;

        await _pumpHomeTestApp(
          tester,
          HomeHistoryTab(
            profile: _profile(),
            branding: _branding(),
            appointments: [_completedAppointment()],
            onCancelAppointment: (_) async {},
            onConfirmAppointmentPresence: (_) async {},
            onRefresh: () async {},
            onWhatsApp: () {
              whatsappTapCount += 1;
            },
            insightData: _historyInsightData(),
            onOpenWallet: () {
              walletTapCount += 1;
            },
            onBookGrowthSuggestion: (service, suggestion) async {
              bookedService = service;
              bookedSuggestion = suggestion;
            },
          ),
        );

        expect(
          find.text('Seu histórico agora ajuda no próximo retorno'),
          findsOneWidget,
        );
        expect(
          find.text('O melhor momento para voltar já apareceu no app'),
          findsOneWidget,
        );
        expect(
          find.text('Seu próximo Corte premium já entrou na janela ideal'),
          findsOneWidget,
        );
        expect(
          find.text('Seu próximo retorno pode render vantagem dupla'),
          findsOneWidget,
        );
        expect(find.text('Abrir carteira'), findsOneWidget);

        await tester.scrollUntilVisible(
          find.text('Agendar próximo horário'),
          200,
        );
        await tester.tap(find.text('Agendar próximo horário'));
        await tester.pump();

        await tester.scrollUntilVisible(find.text('Abrir carteira'), 200);
        await tester.tap(find.text('Abrir carteira'));
        await tester.pump();

        await tester.scrollUntilVisible(find.text('Falar com o salão'), 200);
        await tester.tap(find.text('Falar com o salão').last);
        await tester.pump();

        expect(bookedService?.id, 'service-1');
        expect(bookedSuggestion?.id, 'growth-1');
        expect(walletTapCount, 1);
        expect(whatsappTapCount, 1);
      },
    );

    testWidgets('shows feed empty state and opens WhatsApp action', (
      tester,
    ) async {
      var whatsappTapCount = 0;

      await _pumpHomeTestApp(
        tester,
        HomeFeedTab(
          profile: _profile(),
          branding: _branding(),
          posts: const [],
          onRefresh: () async {},
          onWhatsApp: () {
            whatsappTapCount += 1;
          },
          onToggleLike: (_) async {},
          onOpenComments: (_) async {},
          onBookService: (_) async {},
          busyPostIds: const {},
        ),
      );

      expect(find.text('Feed do salão'), findsNWidgets(2));
      expect(
        find.text('Seu próximo visual favorito vai aparecer aqui'),
        findsOneWidget,
      );

      await tester.scrollUntilVisible(find.text('Falar com o salão'), 200);
      await tester.tap(find.text('Falar com o salão'));
      await tester.pump();

      expect(whatsappTapCount, 1);
    });

    testWidgets('adapts the feed copy for the barbershop preset', (
      tester,
    ) async {
      await _pumpHomeTestApp(
        tester,
        HomeFeedTab(
          profile: _profile(salonBusinessSegment: 'barbershop'),
          branding: _branding(businessSegment: 'barbershop'),
          posts: const [],
          onRefresh: () async {},
          onWhatsApp: () {},
          onToggleLike: (_) async {},
          onOpenComments: (_) async {},
          onBookService: (_) async {},
          busyPostIds: const {},
        ),
      );

      expect(find.text('Portfólio da barbearia'), findsNWidgets(2));
      expect(
        find.text('Cortes, acabamentos e assinatura dos profissionais'),
        findsOneWidget,
      );
      expect(
        find.text('Seu próximo corte favorito vai aparecer aqui'),
        findsOneWidget,
      );
    });

    testWidgets('opens like, comment and booking actions from a feed card', (
      tester,
    ) async {
      SalonPost? likedPost;
      SalonPost? commentedPost;
      ServiceItem? bookedService;
      var whatsappTapCount = 0;
      final post = _feedPost();

      await _pumpHomeTestApp(
        tester,
        HomeFeedTab(
          profile: _profile(),
          branding: _branding(),
          posts: [post],
          onRefresh: () async {},
          onWhatsApp: () {
            whatsappTapCount += 1;
          },
          onToggleLike: (item) async {
            likedPost = item;
          },
          onOpenComments: (item) async {
            commentedPost = item;
          },
          onBookService: (service) async {
            bookedService = service;
          },
          busyPostIds: const {},
        ),
      );

      expect(find.text('Resultado glossy'), findsOneWidget);
      expect(find.text('1 comentário'), findsOneWidget);
      expect(find.text('Talita'), findsOneWidget);
      expect(
        find.text('Seu próximo visual pode sair do feed de hoje'),
        findsOneWidget,
      );

      await tester.ensureVisible(find.text('0 curtidas'));
      await tester.tap(find.text('0 curtidas'));
      await tester.pump();

      await tester.ensureVisible(find.text('1 comentário'));
      await tester.tap(find.text('1 comentário'));
      await tester.pump();

      await tester.ensureVisible(find.text('Quero esse resultado'));
      await tester.tap(find.text('Quero esse resultado'));
      await tester.pump();

      await tester.ensureVisible(find.text('Falar com o salão').first);
      await tester.tap(find.text('Falar com o salão').first);
      await tester.pump();

      expect(likedPost?.id, post.id);
      expect(commentedPost?.id, post.id);
      expect(bookedService?.id, post.linkedService?.id);
      expect(whatsappTapCount, 1);
    });

    testWidgets(
      'keeps feed card interactions disabled while the post is busy',
      (tester) async {
        var likeTapCount = 0;
        var commentTapCount = 0;
        final post = _feedPost();

        await _pumpHomeTestApp(
          tester,
          HomeFeedTab(
            profile: _profile(),
            branding: _branding(),
            posts: [post],
            onRefresh: () async {},
            onWhatsApp: () {},
            onToggleLike: (_) async {
              likeTapCount += 1;
            },
            onOpenComments: (_) async {
              commentTapCount += 1;
            },
            onBookService: (_) async {},
            busyPostIds: {post.id},
          ),
        );

        await tester.ensureVisible(find.text('0 curtidas'));
        await tester.tap(find.text('0 curtidas'));
        await tester.pump();

        await tester.ensureVisible(find.text('1 comentário'));
        await tester.tap(find.text('1 comentário'));
        await tester.pump();

        expect(likeTapCount, 0);
        expect(commentTapCount, 0);
      },
    );

    testWidgets('renders services tab and books a listed service', (
      tester,
    ) async {
      ServiceItem? bookedService;
      ServiceItem? toggledFavoriteService;
      final service = _service();

      await _pumpHomeTestApp(
        tester,
        HomeServicesTab(
          profile: _profile(),
          branding: _branding(),
          data: _homeData(services: [service]),
          onRefresh: () async {},
          onWhatsApp: () {},
          busyVacancyAlertIds: const {},
          bookedVacancyAlertIds: const {},
          onBookVacancyAlert: (_) async {},
          onCopyReferral: (_) async {},
          onBook: (item) async {
            bookedService = item;
          },
          onBookGrowthSuggestion: (_, _) async {},
          onBookSuggested: (_, _) async {},
          heroSubtitle: 'Seu salão favorito em um só lugar.',
          nextAvailableLabel: 'Hoje, 15:30',
          todayAttendanceLabel: '1 horário confirmado',
          favoriteServiceIds: const {'service-1'},
          busyFavoriteServiceIds: const {},
          onToggleFavoriteService: (item) async {
            toggledFavoriteService = item;
          },
        ),
      );

      expect(find.text('Destaques do dia'), findsOneWidget);
      expect(find.text('Escolha seu próximo cuidado'), findsOneWidget);
      expect(find.text('Corte premium'), findsOneWidget);
      expect(
        find.text(
          'Seus serviços salvos aparecem primeiro para você voltar mais rápido ao que já gosta.',
        ),
        findsOneWidget,
      );
      expect(
        find.text(
          'Salvo nos seus favoritos para facilitar o próximo agendamento.',
        ),
        findsOneWidget,
      );

      final bookButton = find.text('Agendar');
      await tester.tap(bookButton);
      await tester.pump();

      await tester.tap(find.byTooltip('Remover dos favoritos'));
      await tester.pump();

      expect(bookedService?.id, service.id);
      expect(toggledFavoriteService?.id, service.id);
    });
  });
}

Future<void> _pumpHomeTestApp(WidgetTester tester, Widget child) async {
  await tester.binding.setSurfaceSize(const Size(1200, 2600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(MaterialApp(home: Scaffold(body: child)));
  await tester.pump();
}

CustomerProfile _profile({String? salonBusinessSegment = 'beauty_salon'}) {
  return CustomerProfile(
    id: 'customer-1',
    name: 'Talita',
    salonId: 'salon-1',
    salonName: 'Salon Fun',
    salonTagline: 'Beleza com cuidado',
    salonBrandColor: '#C56B43',
    salonBusinessSegment: salonBusinessSegment,
    salonWhatsappPhone: '5511999999999',
  );
}

SalonBranding _branding({String? businessSegment = 'beauty_salon'}) {
  return SalonBranding.fromName(
    'Salon Fun',
    overrideHexColor: '#C56B43',
    businessSegment: businessSegment,
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

AppointmentItem _appointmentRequiringPresence() {
  return AppointmentItem(
    id: 'appointment-1',
    date: DateTime(2099, 4, 10, 14),
    endsAt: DateTime(2099, 4, 10, 15),
    status: 'confirmed',
    customerConfirmationRequestedAt: DateTime(2099, 4, 10, 10),
    serviceName: 'Hidratação premium',
    serviceDuration: 60,
    servicePrice: 140,
    staffMemberName: 'Ana',
  );
}

SalonPost _feedPost() {
  return SalonPost(
    id: 'post-1',
    title: 'Resultado glossy',
    caption: 'Finalização com brilho intenso e corte em camadas.',
    imageUrls: const ['https://example.com/post.jpg'],
    createdAt: DateTime(2099, 4, 10, 16),
    likeCount: 0,
    commentCount: 1,
    likedByMe: false,
    comments: [
      SalonPostComment(
        id: 'comment-1',
        customerId: 'customer-1',
        customerName: 'Talita',
        body: 'Amei o resultado final.',
        createdAt: DateTime(2099, 4, 10, 16, 20),
      ),
    ],
    linkedService: _service(),
  );
}

HomeData _homeData({required List<ServiceItem> services}) {
  return HomeData(
    services: services,
    appointments: const [],
    vacancyAlerts: const [],
    posts: const [],
    offers: const [],
    growthSuggestions: null,
    loyaltySummary: null,
    referralSummary: null,
    notifications: const [],
    nextAvailableAt: null,
    smartSchedule: null,
  );
}

HomeData _historyInsightData() {
  return HomeData(
    services: [_service()],
    appointments: [_completedAppointment()],
    vacancyAlerts: const [],
    posts: const [],
    offers: [_membershipOffer()],
    growthSuggestions: CustomerGrowthSuggestionFeed(
      suggestions: [_growthSuggestion()],
      lastVisitAt: DateTime(2026, 2, 10, 15),
      lastVisitServiceName: 'Corte premium',
      inactiveDays: 40,
    ),
    loyaltySummary: _loyaltySummary(),
    referralSummary: null,
    notifications: const [],
    nextAvailableAt: null,
    smartSchedule: null,
  );
}

AppointmentItem _completedAppointment() {
  return AppointmentItem(
    id: 'appointment-2',
    date: DateTime(2026, 2, 10, 15),
    endsAt: DateTime(2026, 2, 10, 16),
    status: 'completed',
    completedAt: DateTime(2026, 2, 10, 16),
    serviceName: 'Corte premium',
    serviceDuration: 60,
    servicePrice: 120,
    staffMemberName: 'Ana',
  );
}

CustomerGrowthSuggestionItem _growthSuggestion() {
  return CustomerGrowthSuggestionItem(
    id: 'growth-1',
    type: 'rebooking',
    serviceId: 'service-1',
    serviceName: 'Corte premium',
    basedOnServiceName: 'Corte premium',
    lastVisitAt: DateTime(2026, 2, 10, 15),
    urgency: 'due_now',
    serviceCategory: 'Cabelo',
    servicePrice: 120,
    serviceDuration: 60,
    recommendedIntervalDays: 30,
    recommendedBookingDate: DateTime(2026, 3, 12),
    inactiveDays: 40,
  );
}

SalonOfferItem _membershipOffer() {
  return const SalonOfferItem(
    id: 'offer-1',
    kind: 'membership',
    title: 'Plano glow mensal',
    description:
        'Escova e finalização com valor melhor para quem volta sempre.',
    highlightText: 'Pacote com valor melhor para manter sua rotina ativa.',
    isActive: true,
    sortOrder: 0,
    price: 189,
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
