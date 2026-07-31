import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/network/network_guard.dart';
import 'notification_models.dart';
import 'notification_navigation.dart';

class NotificationRepository {
  NotificationRepository({required this.client});

  final SupabaseClient? client;

  Future<List<AppNotificationItem>> fetchNotifications({
    required String customerId,
    required String salonId,
    int limit = 30,
  }) async {
    final safeClient = client;
    if (safeClient == null) {
      return const [];
    }

    final rows = await runGuardedRead<dynamic>(
      () => safeClient
          .from('salon_customer_notifications')
          .select(
            'id, salon_id, customer_id, audience, notification_type, title, body, payload, created_at',
          )
          .eq('salon_id', salonId)
          .or('audience.eq.salon_customers,customer_id.eq.$customerId')
          .order('created_at', ascending: false)
          .limit(limit),
    );

    final rawNotifications = (rows as List<dynamic>)
        .map((entry) => Map<String, dynamic>.from(entry as Map))
        .toList();

    if (rawNotifications.isEmpty) {
      return const [];
    }

    final ids = rawNotifications
        .map((item) => item['id']?.toString() ?? '')
        .where((id) => id.isNotEmpty)
        .toList();

    final receipts = await runGuardedRead<dynamic>(
      () => safeClient
          .from('customer_notification_receipts')
          .select('source_id, read_at, archived_at')
          .eq('customer_id', customerId)
          .eq('source_type', 'salon_notification')
          .inFilter('source_id', ids),
    );

    final receiptById = <String, Map<String, dynamic>>{
      for (final entry in (receipts as List<dynamic>))
        (entry as Map)['source_id'].toString(): Map<String, dynamic>.from(
          entry,
        ),
    };

    return rawNotifications
        .where((item) {
          final receipt = receiptById[item['id']?.toString() ?? ''];
          return receipt?['archived_at'] == null;
        })
        .map((item) {
          final id = item['id']?.toString() ?? '';
          final receipt = receiptById[id];
          final payload = item['payload'] is Map
              ? Map<String, dynamic>.from(item['payload'] as Map)
              : const <String, dynamic>{};
          final notificationType =
              item['notification_type']?.toString() ?? 'panel_update';
          final audience = item['audience']?.toString() ?? 'salon_customers';

          return AppNotificationItem(
            id: id,
            title: item['title']?.toString() ?? 'Aviso do salão',
            body: item['body']?.toString() ?? '',
            createdAt:
                DateTime.tryParse(item['created_at']?.toString() ?? '') ??
                DateTime.now(),
            isRead: receipt?['read_at'] != null,
            isLocal: false,
            sourceLabel: resolveNotificationSourceLabel(
              notificationType: notificationType,
              audience: audience,
            ),
            targetTabIndex: resolveNotificationTargetTab(
              notificationType: notificationType,
              payload: payload,
            ),
            notificationType: notificationType,
            payload: payload,
          );
        })
        .toList();
  }

  Future<void> markAsRead(List<String> notificationIds) async {
    final safeClient = client;
    if (safeClient == null || notificationIds.isEmpty) {
      return;
    }

    await runGuardedWrite<void>(
      () => safeClient.rpc(
        'mark_customer_notifications_read',
        params: <String, dynamic>{
          'salon_notification_ids': notificationIds,
          'vacancy_alert_ids': const <String>[],
        },
      ),
    );
  }
}
