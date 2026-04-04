import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:salon_client/src/data/salon_repository.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/models/client_app_config.dart';
import 'package:salon_client/src/screens/auth_screen.dart';
import 'package:salon_client/src/screens/booking_screen.dart';
import 'package:salon_client/src/screens/join_salon_screen.dart';
import 'package:salon_client/src/screens/notifications_screen.dart';
import 'package:salon_client/src/screens/password_recovery_screen.dart';
import 'package:salon_client/src/screens/trust_document_screen.dart';
import 'package:salon_client/src/theme/app_theme.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  Future<void> pumpMobileScreen(
    WidgetTester tester,
    Widget screen, {
    CustomerProfile? profile,
  }) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(theme: buildSalonTheme(profile), home: screen),
    );
  }

  testWidgets('auth screen renderiza no mobile sem overflow', (tester) async {
    final repository = _MobileSmokeFakeRepository();

    await pumpMobileScreen(tester, AuthScreen(repository: repository));

    await tester.pumpAndSettle();
    expect(find.text('Faça login com classe'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('join salon screen mostra preview no mobile', (tester) async {
    final repository = _MobileSmokeFakeRepository(
      joinPreview: SalonJoinPreview(
        salonId: 'salon-1',
        name: 'Studio Editorial',
        tagline: 'Agenda, benefícios e conteúdo já publicados pelo salão.',
        businessSegment: 'beleza',
        clientAppConfig: const SalonClientAppConfig(
          welcomeHeadline: 'Entre no salão certo',
        ),
      ),
    );

    await pumpMobileScreen(
      tester,
      JoinSalonScreen(
        repository: repository,
        onJoined: (_) async {},
        onSignOutRequested: () async {},
      ),
    );

    await tester.enterText(find.byType(TextFormField).first, 'ABCD');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(find.text('Studio Editorial'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('password recovery screen renderiza no mobile', (tester) async {
    await pumpMobileScreen(
      tester,
      PasswordRecoveryScreen(
        repository: _MobileSmokeFakeRepository(),
        initialEmail: 'ana@teste.com',
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Receba o link de recuperação'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('notifications screen renderiza avisos no mobile', (
    tester,
  ) async {
    final repository = _MobileSmokeFakeRepository(
      notifications: <CustomerNotificationItem>[
        CustomerNotificationItem(
          id: 'notif-1',
          sourceType: 'salon_notification',
          type: 'appointment_confirmed',
          title: 'Horário confirmado',
          body: 'Seu atendimento foi confirmado pelo salão.',
          createdAt: DateTime(2026, 4, 3, 10),
        ),
      ],
    );

    await pumpMobileScreen(tester, NotificationsScreen(repository: repository));

    await tester.pumpAndSettle();
    expect(find.text('Horário confirmado'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('trust document screen renderiza conteúdo no mobile', (
    tester,
  ) async {
    await pumpMobileScreen(
      tester,
      TrustDocumentScreen(
        title: 'Política de privacidade',
        subtitle: 'Leitura simples para a cliente entender o uso dos dados.',
        eyebrow: 'Confiança',
        sections: const <TrustDocumentSection>[
          TrustDocumentSection(
            title: 'Dados do app',
            body:
                'Cadastro, agenda e relacionamento ficam claros para a cliente.',
          ),
          TrustDocumentSection(
            title: 'Suporte',
            body: 'O app mostra como pedir ajuda quando necessário.',
          ),
        ],
      ),
    );

    await tester.pumpAndSettle();
    expect(find.text('Leitura clara'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('booking screen renderiza disponibilidade no mobile', (
    tester,
  ) async {
    final repository = _MobileSmokeFakeRepository(
      availability: DayAvailability(
        day: DateTime(2026, 4, 3),
        timezone: 'America/Sao_Paulo',
        slotStepMinutes: 30,
        serviceDuration: 60,
        isOpen: true,
        opensAt: '09:00',
        closesAt: '18:00',
        staffNames: const <String>['Wesley'],
        availableSlots: <AvailableSlot>[
          AvailableSlot(
            startAt: DateTime(2026, 4, 3, 9),
            endsAt: DateTime(2026, 4, 3, 10),
            staffMemberId: 'staff-1',
            staffMemberName: 'Wesley',
          ),
        ],
      ),
    );
    final profile = CustomerProfile(
      id: 'customer-1',
      name: 'Ana',
      salonId: 'salon-1',
      salonName: 'Studio Salon Fun',
      salonClientAppConfig: const SalonClientAppConfig(),
      bookingPolicyEnabled: true,
      bookingPolicyTitle: 'Reserva protegida',
      bookingPolicySummary: 'O salão protege horários concorridos.',
      bookingPolicyCancellationWindowHours: 24,
      bookingPolicyConfirmationRequired: true,
      bookingPolicyConfirmationLeadMinutes: 30,
      bookingPolicyAutoCancelUnconfirmed: true,
      bookingPolicyAutoCancelLeadMinutes: 10,
      bookingPolicyDepositReminderLeadHours: 6,
      bookingPolicyRequiresDeposit: true,
      bookingPolicyDepositAmount: 50,
      bookingPolicyPaymentMode: 'pix',
      bookingPolicyPixKey: '11999999999',
      bookingPolicyPixRecipientName: 'Studio Salon Fun',
      bookingPolicyPixRecipientCity: 'Sao Paulo',
      bookingPolicyPaymentInstructions: 'Pague o sinal para segurar o horário.',
      bookingPolicyVersion: 'v1',
    );
    final service = const ServiceItem(
      id: 'service-1',
      name: 'Corte completo',
      price: 90,
      duration: 60,
      category: 'Cabelo',
      description: 'Cuidado com acabamento e leitura premium.',
    );

    await pumpMobileScreen(
      tester,
      BookingScreen(repository: repository, profile: profile, service: service),
      profile: profile,
    );

    await tester.pumpAndSettle();
    expect(find.text('Escolha o dia'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _MobileSmokeFakeRepository implements SalonRepository {
  _MobileSmokeFakeRepository({
    this.joinPreview,
    this.notifications = const <CustomerNotificationItem>[],
    DayAvailability? availability,
  }) : availability =
           availability ??
           DayAvailability(
             day: DateTime(2026, 4, 3),
             timezone: 'America/Sao_Paulo',
             slotStepMinutes: 30,
             serviceDuration: 60,
             isOpen: true,
             staffNames: const <String>['Wesley'],
             availableSlots: const <AvailableSlot>[],
           );

  final SalonJoinPreview? joinPreview;
  final List<CustomerNotificationItem> notifications;
  final DayAvailability availability;

  @override
  User? get currentUser => null;

  @override
  Stream<AuthState> get authChanges => const Stream<AuthState>.empty();

  @override
  Future<SalonJoinPreview?> getSalonJoinPreview(String code) async {
    return joinPreview;
  }

  @override
  Future<List<CustomerNotificationItem>> getCustomerNotifications({
    OperationalIssueReporter? onIssue,
  }) async {
    return notifications;
  }

  @override
  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot({
    OperationalIssueReporter? onIssue,
  }) async {
    return const NotificationReceiptSnapshot(
      readKeys: <String>{},
      archivedKeys: <String>{},
    );
  }

  @override
  Future<void> markNotificationsRead(
    List<CustomerNotificationItem> notifications,
  ) async {}

  @override
  Future<CachedView<DayAvailability>> loadDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    return CachedView<DayAvailability>(data: availability, isFromCache: false);
  }

  @override
  Future<void> warmDayAvailabilityCache({
    required String serviceId,
    required Iterable<DateTime> days,
  }) async {}

  @override
  dynamic noSuchMethod(Invocation invocation) {
    return super.noSuchMethod(invocation);
  }
}
