import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
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

void main() {
  testWidgets('renders the premium agenda shell and empty states', (
    WidgetTester tester,
  ) async {
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
          bookingRepository: BookingRepository(client: null),
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
      find.text('Reserva rápida, leitura clara e encaixe certeiro.'),
      findsOneWidget,
    );
    expect(find.text('Agenda premium'), findsOneWidget);
    expect(find.text('Próximo horário'), findsOneWidget);
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
}
