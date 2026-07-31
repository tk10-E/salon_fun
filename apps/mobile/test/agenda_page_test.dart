import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/features/agenda/agenda_page.dart';
import 'package:mobile/src/features/agenda/booking_repository.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/notifications/customer_notifications_controller.dart';
import 'package:mobile/src/features/notifications/notification_repository.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';
import 'package:mobile/src/core/config/app_environment.dart';

DateTime _testDateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

DateTime _activeMembershipStart([DateTime? reference]) => _testDateOnly(
  reference ?? DateTime.now(),
).subtract(const Duration(days: 7));

DateTime _activeMembershipExpiry([DateTime? reference]) =>
    _testDateOnly(reference ?? DateTime.now()).add(const Duration(days: 14));

DateTime _futureSlotStart([DateTime? reference]) {
  final base = _testDateOnly(
    reference ?? DateTime.now(),
  ).add(const Duration(days: 2));
  return DateTime(base.year, base.month, base.day, 15, 30);
}

DateTime _futureSlotEnd([DateTime? reference]) {
  final base = _testDateOnly(
    reference ?? DateTime.now(),
  ).add(const Duration(days: 2));
  return DateTime(base.year, base.month, base.day, 16, 20);
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  test('parses Postgres time fields on the availability target day', () {
    final availability = DayAvailability.fromJson({
      'target_day': '2026-04-12',
      'timezone': 'America/Sao_Paulo',
      'slot_step_minutes': 30,
      'service_duration': 50,
      'is_open': true,
      'opens_at': '09:00:00',
      'closes_at': '18:00:00',
      'staff_members': [
        {
          'id': 'staff-1',
          'name': 'Marina',
          'role': 'Colorista',
          'image_url': 'https://example.com/staff/marina.jpg',
          'is_open': true,
          'opens_at': '09:30:00',
          'closes_at': '17:30:00',
          'available_slots_count': 4,
          'next_available_at': null,
          'status': 'available',
          'status_detail': 'Atende de 09:30 as 17:30.',
        },
      ],
      'available_slots': const [],
    });

    expect(availability.isOpen, isTrue);
    expect(availability.opensAt, DateTime(2026, 4, 12, 9));
    expect(availability.closesAt, DateTime(2026, 4, 12, 18));
    expect(
      availability.staffMembers.single.opensAt,
      DateTime(2026, 4, 12, 9, 30),
    );
    expect(
      availability.staffMembers.single.closesAt,
      DateTime(2026, 4, 12, 17, 30),
    );
    expect(
      availability.staffMembers.single.imageUrl,
      'https://example.com/staff/marina.jpg',
    );
  });

  testWidgets('renders the premium agenda shell and empty states', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const session = AppSession(
      customer: CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: null,
        referralCode: null,
        consentStatus: 'granted',
      ),
    );

    final sessionController = _TestSessionController(session);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: AgendaPage(
          bookingRepository: _FakeBookingRepository(),
          focusedOffer: const SalonOfferHighlight(
            id: 'offer-1',
            kind: 'promotion',
            title: 'Combo da semana',
            description: 'Escova e hidrataÃ§Ã£o em condiÃ§Ã£o especial.',
            highlightText: null,
            imageUrl: null,
            bookingServiceId: 'service-1',
            bookingServiceName: 'Escova premium',
            actionKind: 'book_service',
            kindLabel: 'Oferta',
            priceLabel: 'R\$ 139,90',
            lifecycleLabel: 'Agora',
          ),
          focusedOfferRevision: 1,
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: sessionController,
            notificationRepository: NotificationRepository(client: null),
          ),
          session: session,
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(
      find.text('Reserva rapida, leitura clara e encaixe certeiro.'),
      findsOneWidget,
    );
    expect(find.text('Agenda premium'), findsOneWidget);
    expect(find.text('Proximo horario'), findsOneWidget);
    await tester.dragUntilVisible(
      find.text('Combo da semana'),
      find.byType(ListView).first,
      const Offset(0, -180),
    );
    await tester.pumpAndSettle();
    expect(find.text('Oferta aplicada'), findsOneWidget);
    expect(find.text('Combo da semana'), findsOneWidget);
    expect(find.textContaining('Escova premium'), findsWidgets);
  });

  testWidgets(
    'shows retry state instead of infinite loading on availability failure',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: _FakeBookingRepository(
              availabilityErrorMessage: 'Agenda indisponivel no momento.',
            ),
            focusedOffer: const SalonOfferHighlight(
              id: 'offer-1',
              kind: 'promotion',
              title: 'Combo da semana',
              description: 'Escova e hidratacao em condicao especial.',
              highlightText: null,
              imageUrl: null,
              bookingServiceId: 'service-1',
              bookingServiceName: 'Escova premium',
              actionKind: 'book_service',
              kindLabel: 'Oferta',
              priceLabel: 'R\$ 139,90',
              lifecycleLabel: 'Agora',
            ),
            focusedOfferRevision: 1,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('A agenda travou neste recorte'), findsOneWidget);
      expect(find.text('Agenda indisponivel no momento.'), findsOneWidget);
      expect(find.text('Tentar novamente'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    },
  );

  testWidgets('does not mask a service load failure as an empty agenda', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const session = AppSession(
      customer: CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: null,
        referralCode: null,
        consentStatus: 'granted',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: AgendaPage(
          bookingRepository: _FakeBookingRepository(
            servicesErrorMessage:
                'Sua sessao do app expirou. Entre novamente para carregar a agenda.',
          ),
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: _TestSessionController(session),
            notificationRepository: NotificationRepository(client: null),
          ),
          session: session,
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.dragUntilVisible(
      find.text('A agenda travou neste recorte'),
      find.byType(ListView).first,
      const Offset(0, -180),
    );
    await tester.pumpAndSettle();

    expect(find.text('A agenda travou neste recorte'), findsOneWidget);
    expect(
      find.text(
        'Sua sessao do app expirou. Entre novamente para carregar a agenda.',
      ),
      findsOneWidget,
    );
    expect(find.text('Sem servicos disponiveis'), findsNothing);
    expect(find.text('Sem servico selecionado'), findsNothing);
  });

  testWidgets('separates appointment history and clears it from the app', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const session = AppSession(
      customer: CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: null,
        referralCode: null,
        consentStatus: 'granted',
      ),
    );
    final repository = _FakeBookingRepository(
      appointments: [
        _fakeAppointment(
          id: 'active-1',
          date: DateTime(2099, 4, 12, 15, 30),
          status: 'confirmed',
        ),
        _fakeAppointment(
          id: 'cancelled-1',
          date: DateTime(2026, 3, 21, 11, 30),
          status: 'cancelled',
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: AgendaPage(
          bookingRepository: repository,
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: _TestSessionController(session),
            notificationRepository: NotificationRepository(client: null),
          ),
          session: session,
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.dragUntilVisible(
      find.text('Historico'),
      find.byType(ListView).first,
      const Offset(0, -220),
    );
    await tester.pumpAndSettle();

    expect(find.text('Historico'), findsOneWidget);
    expect(find.text('Limpar'), findsOneWidget);

    await tester.tap(find.text('Limpar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Limpar historico'));
    await tester.pumpAndSettle();

    expect(repository.clearHistoryCalls, 1);
    expect(find.text('Historico'), findsNothing);
  });

  testWidgets(
    'keeps unresolved past appointments out of the clear-history batch',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );
      final now = DateTime.now();
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'cancelled-1',
            date: now.subtract(const Duration(days: 2)),
            status: 'cancelled',
          ),
          _fakeAppointment(
            id: 'pending-old-1',
            date: now.subtract(const Duration(hours: 1)),
            status: 'confirmed',
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: repository,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Limpar'),
        find.byType(ListView).first,
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Limpar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Limpar historico'));
      await tester.pumpAndSettle();

      expect(repository.clearHistoryCalls, 1);
      expect(find.text('Historico'), findsOneWidget);
      expect(find.text('Concluir atendimento'), findsOneWidget);
    },
  );

  testWidgets(
    'lets the customer reschedule the same appointment without tripping the same-day lock',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );
      final appointmentDay = DateTime(2099, 4, 12);
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'active-1',
            date: DateTime(2099, 4, 12, 15, 30),
            status: 'confirmed',
          ),
        ],
        staffMembers: [
          _fakeStaffAvailability(
            id: 'staff-2',
            name: 'Marina',
            nextAvailableAt: DateTime(2099, 4, 12, 16, 30),
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: DateTime(2099, 4, 12, 16, 30),
            endsAt: DateTime(2099, 4, 12, 17),
            staffMemberId: 'staff-2',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: repository,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Remarcar horario'),
        find.byType(ListView).first,
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Remarcar horario'));
      await tester.pumpAndSettle();

      expect(find.text('Remarcando horario'), findsOneWidget);
      expect(find.text('Remarcar para este horario'), findsOneWidget);

      final dayFinder = _findDayCard(appointmentDay);
      expect(dayFinder, findsWidgets);

      await tester.tap(find.text('Remarcar para este horario'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Confirmar remarcacao').last);
      await tester.pumpAndSettle();

      expect(repository.rescheduleCalls, 1);
      expect(repository.lastRescheduledAppointmentId, 'active-1');
      expect(repository.lastRescheduledStaffMemberId, 'staff-2');
      expect(find.text('Remarcando horario'), findsNothing);
    },
  );

  testWidgets(
    'only unlocks appointment completion 3 minutes after the scheduled time',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'locked-1',
            date: DateTime.now().subtract(const Duration(minutes: 2)),
            status: 'confirmed',
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: repository,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.textContaining('A conclusao libera 3 minutos'),
        find.byType(ListView).first,
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      expect(find.text('Concluir atendimento'), findsNothing);
      expect(repository.completeCalls, 0);
    },
  );

  testWidgets(
    'lets the customer conclude the appointment after the release window',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'complete-1',
            date: DateTime.now().subtract(const Duration(minutes: 4)),
            status: 'confirmed',
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: repository,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Concluir atendimento'),
        find.byType(ListView).first,
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Concluir atendimento'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();

      expect(repository.completeCalls, 1);
      expect(repository.lastCompletedAppointmentId, 'complete-1');
      expect(find.text('Avaliar atendimento'), findsOneWidget);
    },
  );

  testWidgets(
    'removes old history locally when the backend no longer finds it',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      const session = AppSession(
        customer: CustomerProfile(
          id: 'customer-1',
          salonId: 'salon-1',
          authUserId: 'auth-1',
          name: 'Ana Souza',
          phone: null,
          referralCode: null,
          consentStatus: 'granted',
        ),
      );
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'ghost-1',
            date: DateTime(2026, 3, 21, 11, 30),
            status: 'cancelled',
          ),
        ],
        archiveNotFoundIds: const {'ghost-1'},
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: AgendaPage(
            bookingRepository: repository,
            notificationsController: CustomerNotificationsController(
              client: null,
              sessionController: _TestSessionController(session),
              notificationRepository: NotificationRepository(client: null),
            ),
            session: session,
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Remover do app'),
        find.byType(ListView).first,
        const Offset(0, -220),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Remover do app'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Remover'));
      await tester.pumpAndSettle();

      expect(repository.archiveCalls, 1);
      expect(find.text('Historico'), findsNothing);
      expect(find.textContaining('appointment_not_found'), findsNothing);
    },
  );

  testWidgets('captures the planned payment method when booking a slot', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    const session = AppSession(
      customer: CustomerProfile(
        id: 'customer-1',
        salonId: 'salon-1',
        authUserId: 'auth-1',
        name: 'Ana Souza',
        phone: null,
        referralCode: null,
        consentStatus: 'granted',
      ),
    );
    final reference = DateTime.now();
    final repository = _FakeBookingRepository(
      availableSlots: [
        AppointmentSlot(
          startAt: _futureSlotStart(reference),
          endsAt: _futureSlotEnd(reference),
          staffMemberId: 'staff-1',
          staffMemberName: 'Marina',
          staffMemberImageUrl: null,
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(),
        home: AgendaPage(
          bookingRepository: repository,
          notificationsController: CustomerNotificationsController(
            client: null,
            sessionController: _TestSessionController(session),
            notificationRepository: NotificationRepository(client: null),
          ),
          session: session,
        ),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.text('Reservar agora').first);
    await tester.pumpAndSettle();

    expect(find.text('Forma prevista de pagamento'), findsOneWidget);

    await tester.tap(find.text('Pix'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Fechar agendamento'));
    await tester.pumpAndSettle();

    expect(repository.lastCreatedPaymentPreference, 'pix');
    expect(find.textContaining('Forma prevista'), findsOneWidget);
  });

  testWidgets(
    'uses the monthly plan flow when an active plan matches the service',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final now = DateTime.now();
      final membershipStart = _activeMembershipStart(now);
      final membershipExpiry = _activeMembershipExpiry(now);
      final slotStart = _futureSlotStart(now);
      final slotEnd = _futureSlotEnd(now);

      final repository = _FakeBookingRepository(
        membershipPlans: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano brilho',
            serviceId: 'service-1',
            serviceName: 'Escova premium',
            status: 'active',
            sessionsIncluded: 4,
            sessionsUsed: 1,
            startedAt: membershipStart,
            expiresAt: membershipExpiry,
            priceSnapshot: 249.9,
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: slotStart,
            endsAt: slotEnd,
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(_buildAgendaHarness(repository));
      await tester.pumpAndSettle();
      await tester.dragUntilVisible(
        find.text('Reservar agora').first,
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Reservar agora').first);
      await tester.pumpAndSettle();

      expect(find.text('Usar plano mensal'), findsOneWidget);
      expect(find.text('Pagar avulso'), findsOneWidget);
      expect(find.text('Forma prevista de pagamento'), findsNothing);
      expect(
        find.textContaining(
          'O primeiro horario escolhido vira fixo e o app replica as proximas sessoes',
        ),
        findsOneWidget,
      );

      await tester.tap(find.text('Fixar plano'));
      await tester.pumpAndSettle();

      expect(repository.planScheduleCalls, 1);
      expect(find.textContaining('Plano fixado:'), findsOneWidget);
      expect(find.text('Plano • Plano brilho'), findsOneWidget);
      expect(find.textContaining('Sessao 1/4'), findsOneWidget);
    },
  );

  testWidgets('highlights active plans that still need the fixed series slot', (
    WidgetTester tester,
  ) async {
    final reference = DateTime.now();
    final repository = _FakeBookingRepository(
      membershipPlans: [
        CustomerMembershipPlan(
          id: 'membership-1',
          offerId: 'offer-1',
          title: 'Plano brilho',
          serviceId: 'service-1',
          serviceName: 'Escova premium',
          status: 'active',
          sessionsIncluded: 4,
          sessionsUsed: 1,
          startedAt: _activeMembershipStart(reference),
          expiresAt: _activeMembershipExpiry(reference),
          priceSnapshot: 249.9,
        ),
      ],
    );

    await tester.pumpWidget(_buildAgendaHarness(repository));
    await tester.pumpAndSettle();
    await tester.dragUntilVisible(
      find.text('Plano ativo pronto para travar a serie'),
      find.byType(ListView).first,
      const Offset(0, -180),
    );
    await tester.pumpAndSettle();

    expect(find.text('Plano ativo pronto para travar a serie'), findsOneWidget);
    expect(
      find.textContaining(
        'Servico ja focado abaixo. Agora escolha o dia e o horario-base da serie.',
      ),
      findsOneWidget,
    );
  });

  testWidgets(
    'stops offering the first-slot plan CTA again even if the refreshed appointment is still stale',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final now = DateTime.now();
      final membershipStart = _activeMembershipStart(now);
      final membershipExpiry = _activeMembershipExpiry(now);
      final slotStart = _futureSlotStart(now);
      final slotEnd = _futureSlotEnd(now);

      final repository = _FakeBookingRepository(
        returnStaleMembershipAppointments: true,
        membershipPlans: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano brilho',
            serviceId: 'service-1',
            serviceName: 'Escova premium',
            status: 'active',
            sessionsIncluded: 4,
            sessionsUsed: 0,
            startedAt: membershipStart,
            expiresAt: membershipExpiry,
            priceSnapshot: 249.9,
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: slotStart,
            endsAt: slotEnd,
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(_buildAgendaHarness(repository));
      await tester.pumpAndSettle();
      await tester.dragUntilVisible(
        find.text('Plano ativo pronto para travar a serie'),
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Plano ativo pronto para travar a serie'),
        findsOneWidget,
      );

      await tester.dragUntilVisible(
        find.text('Reservar agora').first,
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Reservar agora').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fixar plano'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Plano fixado:'), findsOneWidget);
      expect(find.text('Plano ativo pronto para travar a serie'), findsNothing);
      expect(repository.planScheduleCalls, 1);
    },
  );

  testWidgets(
    'opens a focused membership plan directly as fixed-series scheduling',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final now = DateTime.now();
      final membershipStart = _activeMembershipStart(now);
      final membershipExpiry = _activeMembershipExpiry(now);
      final slotStart = _futureSlotStart(now);
      final slotEnd = _futureSlotEnd(now);

      final repository = _FakeBookingRepository(
        membershipPlans: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano brilho',
            serviceId: 'service-1',
            serviceName: 'Escova premium',
            status: 'active',
            sessionsIncluded: 4,
            sessionsUsed: 0,
            startedAt: membershipStart,
            expiresAt: membershipExpiry,
            priceSnapshot: 249.9,
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: slotStart,
            endsAt: slotEnd,
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(
        _buildAgendaHarness(
          repository,
          focusedOffer: const SalonOfferHighlight(
            id: 'membership-plan:membership-1',
            kind: 'membership',
            title: 'Plano brilho',
            description: 'Serie fixa',
            highlightText: 'Serie fixa',
            imageUrl: null,
            bookingServiceId: 'service-1',
            bookingServiceName: 'Escova premium',
            actionKind: 'schedule_membership_plan',
            kindLabel: 'Plano ativo',
            priceLabel: null,
            lifecycleLabel: 'Serie fixa',
          ),
          focusedOfferRevision: 1,
        ),
      );
      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Reservar agora').first,
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Reservar agora').first);
      await tester.pumpAndSettle();

      expect(find.text('Confirmar horario fixo do plano'), findsWidgets);
      expect(find.text('Usar plano mensal'), findsNothing);
      expect(find.text('Pagar avulso'), findsNothing);

      await tester.tap(find.text('Confirmar horario fixo do plano').last);
      await tester.pumpAndSettle();

      expect(repository.planScheduleCalls, 1);
      expect(find.textContaining('Plano fixado:'), findsOneWidget);
    },
  );

  testWidgets(
    'opens membership activation directly as a preferred-slot request before salon approval',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final reference = DateTime.now();
      final slotStart = _futureSlotStart(reference);
      final slotEnd = _futureSlotEnd(reference);
      final repository = _FakeBookingRepository(
        availableSlots: [
          AppointmentSlot(
            startAt: slotStart,
            endsAt: slotEnd,
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );
      final profileRepository = _FakeAgendaProfileRepository();

      await tester.pumpWidget(
        _buildAgendaHarness(
          repository,
          profileRepository: profileRepository,
          focusedOffer: const SalonOfferHighlight(
            id: 'offer-1',
            kind: 'membership',
            title: 'Plano brilho',
            description: 'Ative o plano com horario preferido.',
            highlightText: 'Assine agora',
            imageUrl: null,
            bookingServiceId: 'service-1',
            bookingServiceName: 'Escova premium',
            actionKind: membershipRequestSchedulingActionKind,
            kindLabel: 'Plano',
            priceLabel: 'R\$ 149,90',
            lifecycleLabel: 'Agora',
          ),
          focusedOfferRevision: 1,
        ),
      );
      await tester.pumpAndSettle();

      await tester.dragUntilVisible(
        find.text('Reservar agora').first,
        find.byType(ListView).first,
        const Offset(0, -180),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Reservar agora').first);
      await tester.pumpAndSettle();

      expect(
        find.text('Confirmar pedido com horario preferido'),
        findsOneWidget,
      );
      expect(find.text('Forma prevista de pagamento'), findsNothing);

      await tester.tap(find.text('Pedir plano com esse horario'));
      await tester.pumpAndSettle();

      expect(profileRepository.requestMembershipCalls, 1);
      expect(profileRepository.lastRequestedOfferId, 'offer-1');
      expect(profileRepository.lastPreferredStaffMemberId, 'staff-1');
      expect(profileRepository.lastPreferredStartAt, slotStart);
      expect(repository.planScheduleCalls, 0);
      expect(find.textContaining('Pedido do plano enviado.'), findsOneWidget);
    },
  );

  test(
    'parses created appointments from membership plan scheduling payload',
    () {
      final result = MembershipPlanScheduleResult.fromJson({
        'createdAppointments': [
          {
            'appointmentId': 'appointment-1',
            'membershipExpiresAt': '2026-05-31T23:59:59.000Z',
            'membershipId': 'membership-1',
            'membershipTitle': 'Plano brilho',
            'sessionIndex': 2,
            'sessionsIncluded': 4,
            'staffMemberId': 'staff-9',
            'startsAt': '2026-05-12T16:30:00.000Z',
            'status': 'confirmed',
          },
        ],
        'membershipId': 'membership-1',
        'membershipTitle': 'Plano brilho',
        'membershipExpiresAt': '2026-05-31T23:59:59.000Z',
        'scheduledCount': 1,
        'sessionsIncluded': 4,
        'skippedCount': 0,
      });

      expect(result.createdAppointmentIds, ['appointment-1']);
      expect(result.createdAppointments.single.sessionIndex, 2);
      expect(result.createdAppointments.single.staffMemberId, 'staff-9');
      expect(result.createdAppointments.single.status, 'confirmed');
      expect(result.membershipId, 'membership-1');
    },
  );

  testWidgets('filters slot cards to the focused professional of the service', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final day = DateUtils.dateOnly(DateTime.now());
    final repository = _FakeBookingRepository(
      staffMembers: [
        _fakeStaffAvailability(
          id: 'staff-1',
          name: 'Marina',
          nextAvailableAt: day.add(const Duration(hours: 14)),
        ),
        _fakeStaffAvailability(
          id: 'staff-2',
          name: 'Tania',
          nextAvailableAt: day.add(const Duration(hours: 15)),
        ),
      ],
      availableSlots: [
        AppointmentSlot(
          startAt: day.add(const Duration(hours: 14)),
          endsAt: day.add(const Duration(hours: 15)),
          staffMemberId: 'staff-1',
          staffMemberName: 'Marina',
          staffMemberImageUrl: null,
        ),
        AppointmentSlot(
          startAt: day.add(const Duration(hours: 15)),
          endsAt: day.add(const Duration(hours: 16)),
          staffMemberId: 'staff-2',
          staffMemberName: 'Tania',
          staffMemberImageUrl: null,
        ),
      ],
    );

    await tester.pumpWidget(_buildAgendaHarness(repository));
    await tester.pumpAndSettle();

    expect(find.text('14:00 até 15:00'), findsOneWidget);
    expect(find.text('15:00 até 16:00'), findsNothing);

    await tester.tap(find.text('Tania').first);
    await tester.pumpAndSettle();

    expect(find.text('14:00 até 15:00'), findsNothing);
    expect(find.text('15:00 até 16:00'), findsOneWidget);
  });

  testWidgets('hides slots from professionals outside the selected service', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final day = DateUtils.dateOnly(DateTime.now());
    final repository = _FakeBookingRepository(
      staffMembers: [
        _fakeStaffAvailability(
          id: 'braids-specialist',
          name: 'Marina',
          nextAvailableAt: day.add(const Duration(hours: 14)),
        ),
      ],
      availableSlots: [
        AppointmentSlot(
          startAt: day.add(const Duration(hours: 14)),
          endsAt: day.add(const Duration(hours: 15)),
          staffMemberId: 'braids-specialist',
          staffMemberName: 'Marina',
          staffMemberImageUrl: null,
        ),
        AppointmentSlot(
          startAt: day.add(const Duration(hours: 15)),
          endsAt: day.add(const Duration(hours: 16)),
          staffMemberId: 'makeup-specialist',
          staffMemberName: 'Tania Maquiagem',
          staffMemberImageUrl: null,
        ),
      ],
    );

    await tester.pumpWidget(_buildAgendaHarness(repository));
    await tester.pumpAndSettle();

    expect(find.text('Marina'), findsWidgets);
    expect(find.text('14:00 até 15:00'), findsOneWidget);
    expect(find.text('15:00 até 16:00'), findsNothing);
    expect(find.text('Tania Maquiagem'), findsNothing);
  });

  testWidgets(
    'marks a busy professional as in service and keeps occupied time blocked',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final day = DateUtils.dateOnly(DateTime.now());
      final repository = _FakeBookingRepository(
        staffMembers: [
          _fakeStaffAvailability(
            id: 'staff-1',
            name: 'Marina',
            nextAvailableAt: day.add(const Duration(hours: 15)),
            status: 'serving',
            statusDetail:
                'Em atendimento até 15:00. Próximos encaixes livres continuam abaixo.',
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: day.add(const Duration(hours: 15)),
            endsAt: day.add(const Duration(hours: 16)),
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(_buildAgendaHarness(repository));
      await tester.pumpAndSettle();

      expect(find.text('Em atendimento'), findsOneWidget);
      expect(
        find.text(
          'Em atendimento até 15:00. Próximos encaixes livres continuam abaixo.',
        ),
        findsOneWidget,
      );
      expect(find.text('14:00 até 15:00'), findsNothing);
      expect(find.text('15:00 até 16:00'), findsOneWidget);
    },
  );

  testWidgets('blocks a second active booking on the same day', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final tomorrow = DateUtils.dateOnly(
      DateTime.now().add(const Duration(days: 1)),
    );
    final repository = _FakeBookingRepository(
      appointments: [
        _fakeAppointment(
          id: 'confirmed-tomorrow',
          date: tomorrow.add(const Duration(hours: 15, minutes: 30)),
          status: 'confirmed',
        ),
      ],
      availableSlots: [
        AppointmentSlot(
          startAt: tomorrow.add(const Duration(hours: 17)),
          endsAt: tomorrow.add(const Duration(hours: 17, minutes: 50)),
          staffMemberId: 'staff-1',
          staffMemberName: 'Marina',
          staffMemberImageUrl: null,
        ),
      ],
    );

    await tester.pumpWidget(_buildAgendaHarness(repository));
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Amanh'));
    await tester.pumpAndSettle();

    expect(
      find.text('Voce ja possui um horario ativo neste dia'),
      findsOneWidget,
    );
    expect(find.text('Reservar agora'), findsNothing);
  });

  testWidgets(
    'keeps another day bookable when the active booking is elsewhere',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 3600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final tomorrow = DateUtils.dateOnly(
        DateTime.now().add(const Duration(days: 1)),
      );
      final twoDaysFromNow = DateUtils.dateOnly(
        DateTime.now().add(const Duration(days: 2)),
      );
      final repository = _FakeBookingRepository(
        appointments: [
          _fakeAppointment(
            id: 'confirmed-later',
            date: twoDaysFromNow.add(const Duration(hours: 15, minutes: 30)),
            status: 'confirmed',
          ),
        ],
        availableSlots: [
          AppointmentSlot(
            startAt: tomorrow.add(const Duration(hours: 17)),
            endsAt: tomorrow.add(const Duration(hours: 17, minutes: 50)),
            staffMemberId: 'staff-1',
            staffMemberName: 'Marina',
            staffMemberImageUrl: null,
          ),
        ],
      );

      await tester.pumpWidget(_buildAgendaHarness(repository));
      await tester.pumpAndSettle();

      await tester.tap(find.textContaining('Amanh'));
      await tester.pumpAndSettle();

      expect(
        find.text('Voce ja possui um horario ativo neste dia'),
        findsNothing,
      );
      expect(find.text('Reservar agora'), findsOneWidget);

      await tester.tap(find.text('Reservar agora').first);
      await tester.pumpAndSettle();

      expect(find.text('Confirmar horario'), findsOneWidget);
    },
  );

  testWidgets('reuses cached availability when revisiting a loaded day', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1440, 3600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final today = DateUtils.dateOnly(DateTime.now());
    final tomorrow = today.add(const Duration(days: 1));
    final repository = _FakeBookingRepository(
      availableSlots: [
        AppointmentSlot(
          startAt: tomorrow.add(const Duration(hours: 15)),
          endsAt: tomorrow.add(const Duration(hours: 16)),
          staffMemberId: 'staff-1',
          staffMemberName: 'Marina',
          staffMemberImageUrl: null,
        ),
      ],
    );

    await tester.pumpWidget(_buildAgendaHarness(repository));
    await tester.pumpAndSettle();

    expect(repository.availabilityFetchCalls, 1);

    await tester.tap(_findDayCard(tomorrow));
    await tester.pumpAndSettle();
    expect(repository.availabilityFetchCalls, 2);

    await tester.tap(_findDayCard(today));
    await tester.pumpAndSettle();
    expect(repository.availabilityFetchCalls, 2);
  });
}

Widget _buildAgendaHarness(
  BookingRepository repository, {
  SalonOfferHighlight? focusedOffer,
  int focusedOfferRevision = 0,
  ProfileRepository? profileRepository,
}) {
  const session = AppSession(
    customer: CustomerProfile(
      id: 'customer-1',
      salonId: 'salon-1',
      authUserId: 'auth-1',
      name: 'Ana Souza',
      phone: null,
      referralCode: null,
      consentStatus: 'granted',
    ),
  );

  return MaterialApp(
    theme: AppTheme.build(),
    home: AgendaPage(
      bookingRepository: repository,
      profileRepository: profileRepository,
      focusedOffer: focusedOffer,
      focusedOfferRevision: focusedOfferRevision,
      notificationsController: CustomerNotificationsController(
        client: null,
        sessionController: _TestSessionController(session),
        notificationRepository: NotificationRepository(client: null),
      ),
      session: session,
    ),
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
}

class _FakeBookingRepository extends BookingRepository {
  _FakeBookingRepository({
    List<CustomerAppointment> appointments = const [],
    this.membershipPlans = const [],
    this.staffMembers = const [],
    this.availableSlots = const [],
    this.returnStaleMembershipAppointments = false,
    this.servicesErrorMessage,
    this.availabilityErrorMessage,
    this.archiveNotFoundIds = const <String>{},
  }) : _appointments = appointments,
       super(client: null);

  List<CustomerAppointment> _appointments;
  final List<CustomerMembershipPlan> membershipPlans;
  final List<StaffAvailability> staffMembers;
  final List<AppointmentSlot> availableSlots;
  final bool returnStaleMembershipAppointments;
  final String? servicesErrorMessage;
  final String? availabilityErrorMessage;
  final Set<String> archiveNotFoundIds;
  int clearHistoryCalls = 0;
  int archiveCalls = 0;
  int completeCalls = 0;
  int availabilityFetchCalls = 0;
  int planScheduleCalls = 0;
  int rescheduleCalls = 0;
  String? lastCreatedPaymentPreference;
  String? lastCompletedAppointmentId;
  String? lastRescheduledAppointmentId;
  String? lastRescheduledStaffMemberId;
  bool lastCancelledWasMembershipPlan = false;

  @override
  Future<List<ServiceOption>> fetchServices() async {
    if (servicesErrorMessage != null) {
      throw Exception(servicesErrorMessage);
    }

    return const [
      ServiceOption(
        id: 'service-1',
        name: 'Escova premium',
        description: 'FinalizaÃ§Ã£o com brilho e alinhamento.',
        durationMinutes: 50,
        price: 89.9,
        imageUrl: null,
      ),
    ];
  }

  @override
  Future<List<CustomerAppointment>> fetchAppointments() async {
    return _appointments;
  }

  @override
  Future<List<CustomerMembershipPlan>> fetchMembershipPlans({
    required String customerId,
  }) async {
    return membershipPlans;
  }

  @override
  Future<void> archiveAppointment({required String appointmentId}) async {
    archiveCalls += 1;
    if (archiveNotFoundIds.contains(appointmentId)) {
      throw Exception(
        'PostgrestException(message: appointment_not_found, code: P0001, details: Bad Request, hint: null)',
      );
    }
    _appointments = _appointments
        .where((appointment) => appointment.id != appointmentId)
        .toList();
  }

  @override
  Future<void> cancelAppointment({
    required String appointmentId,
    required String reason,
    bool isMembershipPlanAppointment = false,
  }) async {
    lastCancelledWasMembershipPlan = isMembershipPlanAppointment;
    _appointments = _appointments
        .where((appointment) => appointment.id != appointmentId)
        .toList(growable: false);
  }

  @override
  Future<void> completeAppointment({required String appointmentId}) async {
    completeCalls += 1;
    lastCompletedAppointmentId = appointmentId;
    _appointments = _appointments
        .map((appointment) {
          if (appointment.id != appointmentId) {
            return appointment;
          }

          return CustomerAppointment(
            id: appointment.id,
            date: appointment.date,
            endsAt: appointment.endsAt,
            status: 'completed',
            paymentPreference: appointment.paymentPreference,
            depositAmount: appointment.depositAmount,
            depositStatus: appointment.depositStatus,
            depositReportedPaidAt: appointment.depositReportedPaidAt,
            depositReportedPaidVia: appointment.depositReportedPaidVia,
            bookingPolicySnapshot: appointment.bookingPolicySnapshot,
            serviceId: appointment.serviceId,
            serviceName: appointment.serviceName,
            serviceDuration: appointment.serviceDuration,
            servicePrice: appointment.servicePrice,
            serviceImageUrl: appointment.serviceImageUrl,
            staffMemberId: appointment.staffMemberId,
            staffName: appointment.staffName,
            staffRole: appointment.staffRole,
            staffImageUrl: appointment.staffImageUrl,
            presenceConfirmedAt: appointment.presenceConfirmedAt,
            depositPaymentProvider: appointment.depositPaymentProvider,
            depositPaymentProviderChargeId:
                appointment.depositPaymentProviderChargeId,
            depositPaymentProviderStatus:
                appointment.depositPaymentProviderStatus,
            depositPaymentProviderInvoiceUrl:
                appointment.depositPaymentProviderInvoiceUrl,
            depositPaymentProviderPayload:
                appointment.depositPaymentProviderPayload,
            depositPaymentProviderError:
                appointment.depositPaymentProviderError,
            reviewRating: appointment.reviewRating,
            reviewComment: appointment.reviewComment,
            reviewCreatedAt: appointment.reviewCreatedAt,
            reviewUpdatedAt: appointment.reviewUpdatedAt,
            membershipPlanId: appointment.membershipPlanId,
            membershipPlanTitle: appointment.membershipPlanTitle,
            membershipPlanReservationStatus:
                appointment.membershipPlanReservationStatus,
            membershipSessionIndex: appointment.membershipSessionIndex,
            membershipSessionsIncluded: appointment.membershipSessionsIncluded,
            membershipPlanExpiresAt: appointment.membershipPlanExpiresAt,
          );
        })
        .toList(growable: false);
  }

  @override
  Future<void> rescheduleAppointment({
    required CustomerAppointment appointment,
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    rescheduleCalls += 1;
    lastRescheduledAppointmentId = appointment.id;
    lastRescheduledStaffMemberId = slot.staffMemberId;
    _appointments = _appointments
        .map((currentAppointment) {
          if (currentAppointment.id != appointment.id) {
            return currentAppointment;
          }

          return CustomerAppointment(
            id: currentAppointment.id,
            date: slot.startAt,
            endsAt: slot.endsAt,
            status: currentAppointment.status,
            paymentPreference: currentAppointment.paymentPreference,
            depositAmount: currentAppointment.depositAmount,
            depositStatus: currentAppointment.depositStatus,
            depositReportedPaidAt: currentAppointment.depositReportedPaidAt,
            depositReportedPaidVia: currentAppointment.depositReportedPaidVia,
            bookingPolicySnapshot: currentAppointment.bookingPolicySnapshot,
            serviceId: service.id,
            serviceName: currentAppointment.serviceName,
            serviceDuration: currentAppointment.serviceDuration,
            servicePrice: currentAppointment.servicePrice,
            serviceImageUrl: currentAppointment.serviceImageUrl,
            staffMemberId: slot.staffMemberId,
            staffName: slot.staffMemberName,
            staffRole: currentAppointment.staffRole,
            staffImageUrl: slot.staffMemberImageUrl,
            presenceConfirmedAt: null,
            depositPaymentProvider: currentAppointment.depositPaymentProvider,
            depositPaymentProviderChargeId:
                currentAppointment.depositPaymentProviderChargeId,
            depositPaymentProviderStatus:
                currentAppointment.depositPaymentProviderStatus,
            depositPaymentProviderInvoiceUrl:
                currentAppointment.depositPaymentProviderInvoiceUrl,
            depositPaymentProviderPayload:
                currentAppointment.depositPaymentProviderPayload,
            depositPaymentProviderError:
                currentAppointment.depositPaymentProviderError,
            reviewRating: currentAppointment.reviewRating,
            reviewComment: currentAppointment.reviewComment,
            reviewCreatedAt: currentAppointment.reviewCreatedAt,
            reviewUpdatedAt: currentAppointment.reviewUpdatedAt,
            membershipPlanId: currentAppointment.membershipPlanId,
            membershipPlanTitle: currentAppointment.membershipPlanTitle,
            membershipPlanReservationStatus:
                currentAppointment.membershipPlanReservationStatus,
            membershipSessionIndex: currentAppointment.membershipSessionIndex,
            membershipSessionsIncluded:
                currentAppointment.membershipSessionsIncluded,
            membershipPlanExpiresAt: currentAppointment.membershipPlanExpiresAt,
          );
        })
        .toList(growable: false);
  }

  @override
  Future<void> clearAppointmentHistory({
    required List<String> appointmentIds,
  }) async {
    clearHistoryCalls += 1;
    final clearableIds = appointmentIds.toSet();
    _appointments = _appointments
        .where((appointment) => !clearableIds.contains(appointment.id))
        .toList();
  }

  @override
  Future<DayAvailability?> fetchDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    availabilityFetchCalls += 1;
    if (availabilityErrorMessage != null) {
      throw Exception(availabilityErrorMessage);
    }

    final resolvedStaffMembers = staffMembers.isNotEmpty
        ? staffMembers
        : _fakeStaffAvailabilityFromSlots(
            availableSlots: availableSlots,
            fallbackDay: day,
          );

    return DayAvailability(
      targetDay: day,
      timezone: 'America/Sao_Paulo',
      serviceDuration: 50,
      opensAt: DateTime(day.year, day.month, day.day, 9),
      closesAt: DateTime(day.year, day.month, day.day, 18),
      isOpen: true,
      slotStepMinutes: 30,
      staffMembers: resolvedStaffMembers,
      availableSlots: availableSlots,
    );
  }

  @override
  Future<CustomerAppointment> createAppointment({
    required ServiceOption service,
    required AppointmentSlot slot,
    String? paymentPreference,
  }) async {
    lastCreatedPaymentPreference = paymentPreference;
    final created = CustomerAppointment(
      id: 'created-1',
      date: slot.startAt,
      endsAt: slot.endsAt,
      status: 'confirmed',
      paymentPreference: paymentPreference,
      depositAmount: 0,
      depositStatus: 'not_required',
      depositReportedPaidAt: null,
      depositReportedPaidVia: null,
      bookingPolicySnapshot: null,
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      serviceImageUrl: service.imageUrl,
      staffMemberId: slot.staffMemberId,
      staffName: slot.staffMemberName,
      staffRole: null,
      staffImageUrl: slot.staffMemberImageUrl,
      presenceConfirmedAt: null,
      depositPaymentProvider: null,
      depositPaymentProviderChargeId: null,
      depositPaymentProviderStatus: null,
      depositPaymentProviderInvoiceUrl: null,
      depositPaymentProviderPayload: null,
      depositPaymentProviderError: null,
      reviewRating: null,
      reviewComment: null,
      reviewCreatedAt: null,
      reviewUpdatedAt: null,
      membershipPlanId: null,
      membershipPlanTitle: null,
      membershipPlanReservationStatus: null,
      membershipSessionIndex: null,
      membershipSessionsIncluded: null,
      membershipPlanExpiresAt: null,
    );
    _appointments = [created, ..._appointments];
    return created;
  }

  @override
  Future<MembershipPlanScheduleResult> scheduleMembershipPlan({
    required CustomerMembershipPlan membership,
    required ServiceOption service,
    required AppointmentSlot slot,
  }) async {
    planScheduleCalls += 1;
    final appointment = CustomerAppointment(
      id: 'plan-created-1',
      date: slot.startAt,
      endsAt: slot.endsAt,
      status: 'confirmed',
      paymentPreference: null,
      depositAmount: 0,
      depositStatus: 'not_required',
      depositReportedPaidAt: null,
      depositReportedPaidVia: null,
      bookingPolicySnapshot: null,
      serviceId: service.id,
      serviceName: service.name,
      serviceDuration: service.durationMinutes,
      servicePrice: service.price,
      serviceImageUrl: service.imageUrl,
      staffMemberId: slot.staffMemberId,
      staffName: slot.staffMemberName,
      staffRole: null,
      staffImageUrl: slot.staffMemberImageUrl,
      presenceConfirmedAt: null,
      depositPaymentProvider: null,
      depositPaymentProviderChargeId: null,
      depositPaymentProviderStatus: null,
      depositPaymentProviderInvoiceUrl: null,
      depositPaymentProviderPayload: null,
      depositPaymentProviderError: null,
      reviewRating: null,
      reviewComment: null,
      reviewCreatedAt: null,
      reviewUpdatedAt: null,
      membershipPlanId: returnStaleMembershipAppointments
          ? null
          : membership.id,
      membershipPlanTitle: returnStaleMembershipAppointments
          ? null
          : membership.title,
      membershipPlanReservationStatus: returnStaleMembershipAppointments
          ? null
          : 'scheduled',
      membershipSessionIndex: returnStaleMembershipAppointments ? null : 1,
      membershipSessionsIncluded: returnStaleMembershipAppointments
          ? null
          : membership.sessionsIncluded,
      membershipPlanExpiresAt: returnStaleMembershipAppointments
          ? null
          : membership.expiresAt,
    );
    _appointments = [appointment, ..._appointments];
    return MembershipPlanScheduleResult(
      createdAppointments: const [
        MembershipPlanScheduledAppointment(
          appointmentId: 'plan-created-1',
          membershipExpiresAt: null,
          membershipId: 'membership-1',
          membershipTitle: 'Plano corte',
          sessionIndex: 1,
          sessionsIncluded: 3,
          staffMemberId: 'staff-1',
          startsAt: null,
          status: 'confirmed',
        ),
      ],
      membershipId: membership.id,
      membershipTitle: membership.title,
      membershipExpiresAt: membership.expiresAt,
      scheduledCount: 1,
      sessionsIncluded: membership.sessionsIncluded,
      skippedCount: 0,
    );
  }
}

class _FakeAgendaProfileRepository extends ProfileRepository {
  _FakeAgendaProfileRepository() : super(client: null);

  int requestMembershipCalls = 0;
  String? lastRequestedOfferId;
  DateTime? lastPreferredStartAt;
  String? lastPreferredStaffMemberId;

  @override
  Future<CustomerMembershipRequest> requestMembershipPlan({
    required String offerId,
    String? notes,
    DateTime? preferredStartAt,
    String? preferredStaffMemberId,
    String? preferredStaffMemberName,
  }) async {
    requestMembershipCalls += 1;
    lastRequestedOfferId = offerId;
    lastPreferredStartAt = preferredStartAt;
    lastPreferredStaffMemberId = preferredStaffMemberId;
    return CustomerMembershipRequest(
      id: 'request-1',
      offerId: offerId,
      offerTitle: 'Plano brilho',
      status: 'pending',
      requestedAt: DateTime(2026, 5, 10, 15),
      priceSnapshot: 149.9,
      notes: notes,
      preferredStartAt: preferredStartAt,
      preferredStaffMemberId: preferredStaffMemberId,
      preferredStaffMemberName: 'Marina',
    );
  }
}

Finder _findDayCard(DateTime day) {
  return find.byWidgetPredicate((widget) {
    if (widget.runtimeType.toString() != '_DayPickerCard') {
      return false;
    }

    final dynamic dayCard = widget;
    return DateUtils.isSameDay(dayCard.day as DateTime, day);
  });
}

CustomerAppointment _fakeAppointment({
  required String id,
  required DateTime date,
  String? paymentPreference,
  required String status,
}) {
  return CustomerAppointment(
    id: id,
    date: date,
    endsAt: date.add(const Duration(minutes: 30)),
    status: status,
    paymentPreference: paymentPreference,
    depositAmount: 0,
    depositStatus: 'not_required',
    depositReportedPaidAt: null,
    depositReportedPaidVia: null,
    bookingPolicySnapshot: null,
    serviceId: 'service-1',
    serviceName: 'Corte masculino',
    serviceDuration: 30,
    servicePrice: 45,
    serviceImageUrl: null,
    staffMemberId: 'staff-1',
    staffName: 'Wesley',
    staffRole: null,
    staffImageUrl: null,
    presenceConfirmedAt: null,
    depositPaymentProvider: null,
    depositPaymentProviderChargeId: null,
    depositPaymentProviderStatus: null,
    depositPaymentProviderInvoiceUrl: null,
    depositPaymentProviderPayload: null,
    depositPaymentProviderError: null,
    reviewRating: null,
    reviewComment: null,
    reviewCreatedAt: null,
    reviewUpdatedAt: null,
    membershipPlanId: null,
    membershipPlanTitle: null,
    membershipPlanReservationStatus: null,
    membershipSessionIndex: null,
    membershipSessionsIncluded: null,
    membershipPlanExpiresAt: null,
  );
}

StaffAvailability _fakeStaffAvailability({
  required String id,
  required String name,
  required DateTime nextAvailableAt,
  String status = 'available',
  String statusDetail = 'Atende neste serviÃ§o.',
}) {
  return StaffAvailability(
    id: id,
    name: name,
    role: 'Especialista',
    imageUrl: null,
    isOpen: true,
    opensAt: DateTime(
      nextAvailableAt.year,
      nextAvailableAt.month,
      nextAvailableAt.day,
      9,
    ),
    closesAt: DateTime(
      nextAvailableAt.year,
      nextAvailableAt.month,
      nextAvailableAt.day,
      18,
    ),
    availableSlotsCount: 1,
    nextAvailableAt: nextAvailableAt,
    status: status,
    statusDetail: statusDetail,
  );
}

List<StaffAvailability> _fakeStaffAvailabilityFromSlots({
  required List<AppointmentSlot> availableSlots,
  required DateTime fallbackDay,
}) {
  final groupedSlots = <String, List<AppointmentSlot>>{};

  for (final slot in availableSlots) {
    groupedSlots.putIfAbsent(slot.staffMemberId, () => []).add(slot);
  }

  return groupedSlots.entries.map((entry) {
    final slots = entry.value..sort((a, b) => a.startAt.compareTo(b.startAt));
    final firstSlot = slots.first;
    final nextAvailableAt = firstSlot.startAt;

    return StaffAvailability(
      id: entry.key,
      name: firstSlot.staffMemberName,
      role: 'Especialista',
      imageUrl: firstSlot.staffMemberImageUrl,
      isOpen: true,
      opensAt: DateTime(
        fallbackDay.year,
        fallbackDay.month,
        fallbackDay.day,
        9,
      ),
      closesAt: DateTime(
        fallbackDay.year,
        fallbackDay.month,
        fallbackDay.day,
        18,
      ),
      availableSlotsCount: slots.length,
      nextAvailableAt: nextAvailableAt,
      status: 'available',
      statusDetail: 'Atende neste serviÃ§o.',
    );
  }).toList();
}
