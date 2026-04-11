import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/features/notifications/notification_navigation.dart';

void main() {
  test('resolves CTA targets to client app tabs', () {
    expect(
      resolveNotificationTargetTab(
        notificationType: 'panel_update',
        payload: const <String, dynamic>{'ctaTarget': 'appointments'},
      ),
      1,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'panel_update',
        payload: const <String, dynamic>{'ctaTarget': 'feed'},
      ),
      3,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'panel_update',
        payload: const <String, dynamic>{'ctaTarget': 'support'},
      ),
      4,
    );
  });

  test('marks notification CTA as an inbox intent', () {
    final intent = resolveNotificationNavigationIntent(
      notificationType: 'client_app_updated',
      payload: const <String, dynamic>{'ctaTarget': 'notifications'},
    );

    expect(intent.targetTabIndex, 0);
    expect(intent.openInbox, isTrue);
  });

  test('resolves operational notification types', () {
    expect(
      resolveNotificationTargetTab(
        notificationType: 'vacancy_alert',
        payload: const <String, dynamic>{},
      ),
      1,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'store_product_published',
        payload: const <String, dynamic>{},
      ),
      2,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'haircut_rebook_reminder',
        payload: const <String, dynamic>{},
      ),
      1,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'feed_post_published',
        payload: const <String, dynamic>{},
      ),
      3,
    );
    expect(
      resolveNotificationTargetTab(
        notificationType: 'loyalty_balance_reminder',
        payload: const <String, dynamic>{},
      ),
      4,
    );
  });

  test('roundtrips foreground notification payloads', () {
    final encoded = encodeNotificationPayload(const <String, dynamic>{
      'type': 'appointment_confirmed',
      'notificationId': 'notification-1',
      'ctaTarget': 'appointments',
    });

    final decoded = decodeNotificationPayload(encoded);

    expect(decoded['type'], 'appointment_confirmed');
    expect(decoded['notificationId'], 'notification-1');
    expect(decoded['ctaTarget'], 'appointments');
  });

  test('keeps benefit reminder labels in the benefit area', () {
    expect(
      resolveNotificationSourceLabel(
        notificationType: 'loyalty_balance_reminder',
        audience: 'salon_customers',
      ),
      'Benefícios',
    );
  });
}
