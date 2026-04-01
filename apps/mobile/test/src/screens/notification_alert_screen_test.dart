import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/repositories/salon_repository.dart';
import 'package:salon_client/src/screens/notification_alert_screen.dart';
import 'package:salon_client/src/services/push_notification_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final SupabaseClient _sharedNotificationAlertTestClient = (() {
  final client = SupabaseClient('https://example.supabase.co', 'test-anon-key');
  client.auth.stopAutoRefresh();
  return client;
})();

void main() {
  _sharedNotificationAlertTestClient;

  group('NotificationAlertScreen', () {
    testWidgets('renders a feed post preview and closes the alert', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(1200, 1800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: _NotificationAlertRouteHost(
            repository: _FakeNotificationAlertRepository(),
            notification: _feedNotification(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Novo resultado no feed'), findsOneWidget);
      expect(find.text('Camadas com brilho intenso'), findsOneWidget);
      expect(
        find.text('Corte em camadas com finalização glossy.'),
        findsOneWidget,
      );
      expect(find.text('Corte premium'), findsOneWidget);
      expect(
        find.text(
          'Abra a aba Feed do salão para ver a publicação completa, curtir, comentar ou usar esse resultado para decidir seu próximo agendamento.',
        ),
        findsOneWidget,
      );
      expect(find.text('Próximo passo'), findsOneWidget);
      expect(
        find.textContaining('Use essa referência para decidir'),
        findsOneWidget,
      );

      await tester.tap(find.text('Entendi'));
      await tester.pumpAndSettle();

      expect(find.text('Alert host'), findsOneWidget);
    });

    testWidgets(
      'opens the linked service destination with real repository data',
      (tester) async {
        final repository = _FakeNotificationAlertRepository();

        await _pumpNotificationAlertScreen(
          tester,
          repository: repository,
          notification: NotificationTapPayload(
            type: 'service_updated',
            title: 'Serviço atualizado',
            body: 'O salão atualizou os detalhes do serviço.',
            receivedAt: DateTime(2099, 4, 10, 16),
            data: {'serviceId': 'service-1', 'serviceName': 'Corte premium'},
          ),
        );

        expect(find.text('Ver serviço'), findsOneWidget);

        await tester.tap(find.text('Ver serviço'));
        await tester.pump();
        await tester.pumpAndSettle();

        expect(find.text('Detalhe do servico'), findsOneWidget);
        expect(find.text('Corte premium'), findsAtLeastNWidgets(1));
        expect(find.text('O que esperar'), findsOneWidget);
      },
    );

    testWidgets('confirms attendance and shows the success resolution', (
      tester,
    ) async {
      final repository = _FakeNotificationAlertRepository();

      await _pumpNotificationAlertScreen(
        tester,
        repository: repository,
        notification: _attendanceNotification(),
      );

      expect(find.text('Confirmar presença'), findsOneWidget);
      expect(find.text('Cancelar horário'), findsOneWidget);
      expect(find.text('Próximo passo'), findsOneWidget);
      expect(
        find.textContaining(
          'Confirme agora para manter Hidratação premium com Ana',
        ),
        findsOneWidget,
      );

      await tester.tap(find.text('Confirmar presença'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(repository.confirmedAppointmentIds, ['appointment-1']);
      expect(find.text('Presença confirmada'), findsOneWidget);
      expect(
        find.textContaining('continua reservado para você'),
        findsOneWidget,
      );
      expect(find.textContaining('vaga protegida'), findsOneWidget);
      expect(find.text('Confirmar presença'), findsNothing);
      expect(find.text('Cancelar horário'), findsNothing);
    });

    testWidgets('cancels the appointment after the user provides a reason', (
      tester,
    ) async {
      final repository = _FakeNotificationAlertRepository();

      await _pumpNotificationAlertScreen(
        tester,
        repository: repository,
        notification: _attendanceNotification(),
      );

      await tester.tap(find.text('Cancelar horário'));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byType(TextField),
        '  Tive um compromisso inesperado.  ',
      );
      await tester.tap(find.text('Confirmar cancelamento'));
      await tester.pumpAndSettle();

      expect(repository.cancelledAppointmentIds, ['appointment-1']);
      expect(repository.cancellationReasons, [
        'Tive um compromisso inesperado.',
      ]);
      expect(find.text('Horário cancelado'), findsOneWidget);
      expect(
        find.textContaining('o horário foi liberado para a agenda'),
        findsOneWidget,
      );
      expect(find.textContaining('reaproveitar esse encaixe'), findsOneWidget);
      expect(find.text('Confirmar presença'), findsNothing);
      expect(find.text('Cancelar horário'), findsNothing);
    });
  });
}

Future<void> _pumpNotificationAlertScreen(
  WidgetTester tester, {
  required _FakeNotificationAlertRepository repository,
  required NotificationTapPayload notification,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 1800));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: NotificationAlertScreen(
        repository: repository,
        notification: notification,
      ),
    ),
  );
  await tester.pump();
}

NotificationTapPayload _feedNotification() {
  return NotificationTapPayload(
    type: 'feed_post_published',
    title: 'Novo resultado no feed',
    body: 'Veja a transformação completa publicada hoje.',
    receivedAt: DateTime(2099, 4, 10, 15, 30),
    data: {
      'postTitle': 'Camadas com brilho intenso',
      'postCaption': 'Corte em camadas com finalização glossy.',
      'serviceName': 'Corte premium',
      'postPublishedAt': DateTime(2099, 4, 10, 15).toIso8601String(),
    },
  );
}

NotificationTapPayload _attendanceNotification() {
  return NotificationTapPayload(
    type: 'appointment_confirmation_required',
    title: 'Confirme sua presença',
    body: 'Seu horário está chegando. Confirme se vai comparecer.',
    receivedAt: DateTime(2099, 4, 10, 9),
    data: {
      'appointmentId': 'appointment-1',
      'serviceName': 'Hidratação premium',
      'staffMemberName': 'Ana',
      'appointmentAt': DateTime(2099, 4, 10, 14).toIso8601String(),
    },
  );
}

class _FakeNotificationAlertRepository extends SalonRepository {
  _FakeNotificationAlertRepository()
    : super(_sharedNotificationAlertTestClient);

  final List<String> confirmedAppointmentIds = [];
  final List<String> cancelledAppointmentIds = [];
  final List<String> cancellationReasons = [];
  final CustomerProfile profile = const CustomerProfile(
    id: 'customer-1',
    name: 'Cliente Teste',
    salonId: 'salon-1',
    salonName: 'Studio Premium',
    salonTagline: 'Experiencias premium para cabelo e cor.',
    salonBrandColor: '#C56B43',
  );
  final List<ServiceItem> services = const [
    ServiceItem(
      id: 'service-1',
      name: 'Corte premium',
      price: 180,
      duration: 75,
      sortOrder: 0,
      category: 'Corte',
      description: 'Corte com consultoria, finalização e brilho premium.',
    ),
  ];

  @override
  Future<CustomerProfile?> getCustomerProfile() async => profile;

  @override
  Future<List<ServiceItem>> getServices() async => services;

  @override
  Future<List<SalonTeamMemberProfile>> getSalonTeamProfiles({
    int limit = 12,
  }) async => const <SalonTeamMemberProfile>[];

  @override
  Future<List<SalonRetailProduct>> getRetailProducts({int limit = 24}) async =>
      const <SalonRetailProduct>[];

  @override
  Future<Set<String>> getFavoriteServiceIds() async => const <String>{};

  @override
  Future<Set<String>> getFavoriteStaffMemberIds() async => const <String>{};

  @override
  Future<List<AppointmentItem>> getAppointments() async =>
      const <AppointmentItem>[];

  @override
  Future<List<VacancyAlert>> getVacancyAlerts() async => const <VacancyAlert>[];

  @override
  Future<List<SalonPost>> getFeedPosts({required String customerId}) async =>
      const <SalonPost>[];

  @override
  Future<List<SalonOfferItem>> getSalonOffers() async =>
      const <SalonOfferItem>[];

  @override
  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions() async =>
      null;

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() async => null;

  @override
  Future<ReferralSummary?> getReferralSummary() async => null;

  @override
  Future<List<CustomerNotificationItem>> getCustomerNotifications() async =>
      const <CustomerNotificationItem>[];

  @override
  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() async =>
      const NotificationReceiptSnapshot(
        readKeys: <String>{},
        archivedKeys: <String>{},
      );

  @override
  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    return DayAvailability(
      day: DateTime(2099, 4, 10),
      timezone: 'America/Sao_Paulo',
      serviceDuration: 75,
      isOpen: true,
      slotStepMinutes: 30,
      opensAt: '09:00:00',
      closesAt: '18:00:00',
      staffMembers: <StaffMemberItem>[],
      availableSlots: <AvailableSlot>[],
    );
  }

  @override
  Future<SmartScheduleOpportunityFeed?> getSmartScheduleOpportunities({
    DateTime? targetDay,
  }) async => null;

  @override
  Future<void> confirmUpcomingAppointmentPresence({
    required String appointmentId,
  }) async {
    confirmedAppointmentIds.add(appointmentId);
  }

  @override
  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
  }) async {
    cancelledAppointmentIds.add(appointmentId);
    cancellationReasons.add(reason.trim());
  }
}

class _NotificationAlertRouteHost extends StatefulWidget {
  const _NotificationAlertRouteHost({
    required this.repository,
    required this.notification,
  });

  final _FakeNotificationAlertRepository repository;
  final NotificationTapPayload notification;

  @override
  State<_NotificationAlertRouteHost> createState() =>
      _NotificationAlertRouteHostState();
}

class _NotificationAlertRouteHostState
    extends State<_NotificationAlertRouteHost> {
  bool _didPush = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didPush) {
      return;
    }

    _didPush = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => NotificationAlertScreen(
            repository: widget.repository,
            notification: widget.notification,
          ),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Alert host')));
  }
}
