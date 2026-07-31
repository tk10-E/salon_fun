import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mobile/src/core/config/app_environment.dart';
import 'package:mobile/src/features/auth/auth_service.dart';
import 'package:mobile/src/features/auth/biometric_lock_service.dart';
import 'package:mobile/src/features/auth/session_controller.dart';
import 'package:mobile/src/features/notifications/customer_notifications_controller.dart';
import 'package:mobile/src/features/notifications/notification_models.dart';
import 'package:mobile/src/features/notifications/notification_repository.dart';
import 'package:mobile/src/features/profile/profile_repository.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/public_salon_repository.dart';

void main() {
  test('keeps inbox data when notification refresh fails temporarily', () async {
    final repository = _FakeNotificationRepository();
    final controller = CustomerNotificationsController(
      client: null,
      sessionController: _TestSessionController(_sampleSession),
      notificationRepository: repository,
    );

    await controller.bindSession(_sampleSession);

    expect(controller.notifications, hasLength(1));
    expect(controller.unreadCount, 1);

    repository.error = Exception(
      'O app perdeu a conexão com o painel. Verifique o sinal e tente novamente.',
    );

    await controller.refreshNotifications();

    expect(controller.notifications, hasLength(1));
    expect(controller.unreadCount, 1);
    expect(controller.isLoadingInbox, isFalse);
  });
}

class _FakeNotificationRepository extends NotificationRepository {
  _FakeNotificationRepository() : super(client: null);

  Exception? error;

  @override
  Future<List<AppNotificationItem>> fetchNotifications({
    required String customerId,
    required String salonId,
    int limit = 30,
  }) async {
    if (error != null) {
      throw error!;
    }

    return <AppNotificationItem>[
      AppNotificationItem(
        id: 'notification-1',
        title: 'Agenda atualizada',
        body: 'O painel acabou de liberar um encaixe.',
        createdAt: DateTime(2026, 4, 14, 10),
        isRead: false,
        isLocal: false,
        sourceLabel: 'Painel',
        targetTabIndex: 1,
        notificationType: 'appointment_update',
        payload: const <String, dynamic>{},
      ),
    ];
  }
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

final AppSession _sampleSession = AppSession(
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
  landingData: null,
);
