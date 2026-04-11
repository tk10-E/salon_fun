import 'dart:convert';

class NotificationNavigationIntent {
  const NotificationNavigationIntent({
    required this.targetTabIndex,
    this.openInbox = false,
  });

  final int targetTabIndex;
  final bool openInbox;
}

NotificationNavigationIntent resolveNotificationNavigationIntent({
  required String notificationType,
  required Map<String, dynamic> payload,
}) {
  final ctaTarget = (payload['ctaTarget']?.toString() ?? '')
      .trim()
      .toLowerCase();
  switch (ctaTarget) {
    case 'appointments':
      return const NotificationNavigationIntent(targetTabIndex: 1);
    case 'feed':
      return const NotificationNavigationIntent(targetTabIndex: 3);
    case 'profile':
    case 'support':
      return const NotificationNavigationIntent(targetTabIndex: 4);
    case 'notifications':
      return const NotificationNavigationIntent(
        targetTabIndex: 0,
        openInbox: true,
      );
    case 'explore':
      return const NotificationNavigationIntent(targetTabIndex: 0);
    default:
      break;
  }

  final type = (payload['type']?.toString() ?? notificationType)
      .trim()
      .toLowerCase();

  if (type.contains('loyalty') ||
      type.contains('referral') ||
      type.contains('benefit') ||
      type.contains('membership')) {
    return const NotificationNavigationIntent(targetTabIndex: 4);
  }
  if (type.contains('feed') || type.contains('post')) {
    return const NotificationNavigationIntent(targetTabIndex: 3);
  }
  if (type.contains('product') ||
      type.contains('store') ||
      type.contains('order') ||
      type.contains('catalog')) {
    return const NotificationNavigationIntent(targetTabIndex: 2);
  }
  if (type.contains('staff') ||
      type.contains('team') ||
      type.contains('appointment') ||
      type.contains('agenda') ||
      type.contains('booking') ||
      type.contains('rebook') ||
      type.contains('reminder') ||
      type.contains('vacancy')) {
    return const NotificationNavigationIntent(targetTabIndex: 1);
  }
  return const NotificationNavigationIntent(targetTabIndex: 0);
}

int resolveNotificationTargetTab({
  required String notificationType,
  required Map<String, dynamic> payload,
}) {
  return resolveNotificationNavigationIntent(
    notificationType: notificationType,
    payload: payload,
  ).targetTabIndex;
}

String resolveNotificationSourceLabel({
  required String notificationType,
  required String audience,
}) {
  if (audience == 'single_customer') {
    return 'Aviso direto';
  }

  final normalized = notificationType.trim().toLowerCase();
  if (normalized.contains('feed') || normalized.contains('post')) {
    return 'Feed';
  }
  if (normalized.contains('staff') || normalized.contains('team')) {
    return 'Equipe';
  }
  if (normalized.contains('product') ||
      normalized.contains('store') ||
      normalized.contains('order') ||
      normalized.contains('catalog')) {
    return 'Loja';
  }
  if (normalized.contains('loyalty') ||
      normalized.contains('referral') ||
      normalized.contains('benefit') ||
      normalized.contains('membership')) {
    return 'Benefícios';
  }
  if (normalized.contains('appointment') ||
      normalized.contains('agenda') ||
      normalized.contains('booking') ||
      normalized.contains('rebook') ||
      normalized.contains('reminder') ||
      normalized.contains('vacancy')) {
    return 'Agenda';
  }
  return 'Painel';
}

String? encodeNotificationPayload(Map<String, dynamic> payload) {
  if (payload.isEmpty) {
    return null;
  }

  return jsonEncode(payload);
}

Map<String, dynamic> decodeNotificationPayload(String? rawPayload) {
  final normalized = rawPayload?.trim() ?? '';
  if (normalized.isEmpty) {
    return const <String, dynamic>{};
  }

  try {
    final decoded = jsonDecode(normalized);
    if (decoded is Map) {
      return decoded.map<String, dynamic>(
        (key, value) => MapEntry(key.toString(), value),
      );
    }
  } catch (_) {
    return const <String, dynamic>{};
  }

  return const <String, dynamic>{};
}
