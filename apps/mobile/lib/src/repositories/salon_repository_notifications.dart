part of 'salon_repository.dart';

mixin _SalonRepositoryNotificationsMixin on _SalonRepositoryBase {
  Future<List<CustomerNotificationItem>> getCustomerNotifications() async {
    try {
      final data = await client
          .from('salon_customer_notifications')
          .select('id, notification_type, title, body, created_at, payload')
          .order('created_at', ascending: false)
          .limit(30);

      return (data as List)
          .map(
            (item) => CustomerNotificationItem.fromMap(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList();
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'salon_customer_notifications',
      )) {
        return const [];
      }
      rethrow;
    }
  }

  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() async {
    try {
      final data = await client
          .from('customer_notification_receipts')
          .select('source_type, source_id, archived_at');

      final readKeys = <String>{};
      final archivedKeys = <String>{};

      for (final item in data as List) {
        final map = Map<String, dynamic>.from(item as Map);
        final key =
            '${map['source_type']?.toString() ?? 'salon_notification'}:${map['source_id']}';
        readKeys.add(key);
        if (map['archived_at'] != null) {
          archivedKeys.add(key);
        }
      }

      return NotificationReceiptSnapshot(
        readKeys: readKeys,
        archivedKeys: archivedKeys,
      );
    } on PostgrestException catch (error) {
      if (error.message.toLowerCase().contains(
        'customer_notification_receipts',
      )) {
        return const NotificationReceiptSnapshot(
          readKeys: <String>{},
          archivedKeys: <String>{},
        );
      }
      rethrow;
    }
  }

  Future<void> markNotificationsRead(
    List<CustomerNotificationItem> notifications,
  ) async {
    if (notifications.isEmpty) {
      return;
    }

    final salonNotificationIds = notifications
        .where((item) => item.sourceType == 'salon_notification')
        .map((item) => item.id)
        .toList();
    final vacancyAlertIds = notifications
        .where((item) => item.sourceType == 'vacancy_alert')
        .map((item) => item.id)
        .toList();

    try {
      await client.rpc(
        'mark_customer_notifications_read',
        params: {
          'salon_notification_ids': salonNotificationIds,
          'vacancy_alert_ids': vacancyAlertIds,
        },
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('mark_customer_notifications_read') ||
          message.contains('customer_notification_receipts')) {
        return;
      }
      rethrow;
    }
  }

  Future<void> archiveNotifications(
    List<CustomerNotificationItem> notifications,
  ) async {
    if (notifications.isEmpty) {
      return;
    }

    final salonNotificationIds = notifications
        .where((item) => item.sourceType == 'salon_notification')
        .map((item) => item.id)
        .toList();
    final vacancyAlertIds = notifications
        .where((item) => item.sourceType == 'vacancy_alert')
        .map((item) => item.id)
        .toList();

    try {
      await client.rpc(
        'archive_customer_notifications',
        params: {
          'salon_notification_ids': salonNotificationIds,
          'vacancy_alert_ids': vacancyAlertIds,
        },
      );
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (message.contains('archive_customer_notifications') ||
          message.contains('customer_notification_receipts')) {
        return;
      }
      rethrow;
    }
  }
}
