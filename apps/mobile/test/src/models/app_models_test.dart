import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  test(
    'fromVacancyAlert preserves booking context in notification payload',
    () {
      final notification = CustomerNotificationItem.fromVacancyAlert(
        VacancyAlert(
          id: 'alert-1',
          headline: 'Horário liberado',
          body: 'Um encaixe acabou de abrir.',
          startsAt: DateTime(2026, 3, 31, 14),
          endsAt: DateTime(2026, 3, 31, 15),
          createdAt: DateTime(2026, 3, 31, 13, 55),
          createdBy: 'salon',
          serviceId: 'service-42',
          staffMemberId: 'staff-7',
        ),
      );

      expect(notification.type, 'vacancy_alert');
      expect(notification.payload['serviceId'], 'service-42');
      expect(notification.payload['staffMemberId'], 'staff-7');
      expect(notification.payload['startsAt'], isA<String>());
      expect(notification.payload['endsAt'], isA<String>());
    },
  );
}
