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
  final explicitTabIndex = _resolveExplicitTargetTab(payload);
  final explicitOpenInbox = _resolveExplicitOpenInbox(payload);
  if (explicitTabIndex != null) {
    return NotificationNavigationIntent(
      targetTabIndex: explicitTabIndex,
      openInbox: explicitOpenInbox,
    );
  }

  final ctaTarget = (payload['ctaTarget']?.toString() ?? '')
      .trim()
      .toLowerCase();
  final typeIntent = _resolveNotificationIntentByType(
    notificationType: notificationType,
    payload: payload,
  );
  final payloadIntent = _resolveNotificationIntentByPayload(
    notificationType: notificationType,
    payload: payload,
  );

  switch (ctaTarget) {
    case 'appointments':
    case 'agenda':
      return const NotificationNavigationIntent(targetTabIndex: 1);
    case 'store':
    case 'shop':
    case 'loja':
      return const NotificationNavigationIntent(targetTabIndex: 2);
    case 'feed':
      return const NotificationNavigationIntent(targetTabIndex: 3);
    case 'profile':
    case 'perfil':
    case 'benefits':
    case 'support':
      return const NotificationNavigationIntent(targetTabIndex: 4);
    case 'notifications':
    case 'avisos':
      return const NotificationNavigationIntent(
        targetTabIndex: 0,
        openInbox: true,
      );
    case 'explore':
    case 'explorar':
      return payloadIntent ??
          typeIntent ??
          const NotificationNavigationIntent(targetTabIndex: 0);
    case 'home':
    case 'inicio':
      return NotificationNavigationIntent(
        targetTabIndex: 0,
        openInbox: explicitOpenInbox,
      );
    default:
      break;
  }

  return payloadIntent ??
      typeIntent ??
      const NotificationNavigationIntent(targetTabIndex: 0);
}

NotificationNavigationIntent? _resolveNotificationIntentByType({
  required String notificationType,
  required Map<String, dynamic> payload,
}) {
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
  if (type.contains('service')) {
    return const NotificationNavigationIntent(targetTabIndex: 1);
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

  if (type.contains('notification') || type.contains('inbox')) {
    return const NotificationNavigationIntent(
      targetTabIndex: 0,
      openInbox: true,
    );
  }
  if (type.contains('promotion') ||
      type.contains('campaign') ||
      type.contains('offer') ||
      type.contains('client_app')) {
    return const NotificationNavigationIntent(targetTabIndex: 0);
  }

  return null;
}

NotificationNavigationIntent? _resolveNotificationIntentByPayload({
  required String notificationType,
  required Map<String, dynamic> payload,
}) {
  final type = (payload['type']?.toString() ?? notificationType)
      .trim()
      .toLowerCase();
  final changedAreas = _resolveChangedAreas(payload);

  if (_hasPayloadValue(payload, 'postId')) {
    return const NotificationNavigationIntent(targetTabIndex: 3);
  }

  if (_hasPayloadValue(payload, 'membershipId') ||
      _payloadValue(payload, 'offerKind') == 'membership') {
    return const NotificationNavigationIntent(targetTabIndex: 4);
  }

  if (_hasPayloadValue(payload, 'appointmentId') ||
      _hasPayloadValue(payload, 'serviceId') ||
      _hasPayloadValue(payload, 'staffMemberId') ||
      (type.contains('service') &&
          _hasAnyPayloadValue(payload, const ['serviceName', 'category'])) ||
      (type.contains('staff') && _hasPayloadValue(payload, 'staffMemberName'))) {
    return const NotificationNavigationIntent(targetTabIndex: 1);
  }

  if (_hasPayloadValue(payload, 'productId') ||
      (type.contains('product') &&
          _hasAnyPayloadValue(payload, const ['productName', 'brand']))) {
    return const NotificationNavigationIntent(targetTabIndex: 2);
  }

  if (_hasPayloadValue(payload, 'offerId') &&
      (_payloadValue(payload, 'offerKind') == 'promotion' ||
          type.contains('promotion'))) {
    return const NotificationNavigationIntent(targetTabIndex: 0);
  }

  if (changedAreas.contains('vitrine')) {
    return const NotificationNavigationIntent(targetTabIndex: 2);
  }

  if (changedAreas.isNotEmpty) {
    return const NotificationNavigationIntent(targetTabIndex: 0);
  }

  return null;
}

int? _resolveExplicitTargetTab(Map<String, dynamic> payload) {
  final rawTabIndex =
      payload['targetTabIndex']?.toString() ?? payload['tabIndex']?.toString();
  if (rawTabIndex == null) {
    return null;
  }

  final parsed = int.tryParse(rawTabIndex.trim());
  if (parsed == null || parsed < 0 || parsed > 4) {
    return null;
  }

  return parsed;
}

bool _resolveExplicitOpenInbox(Map<String, dynamic> payload) {
  final rawOpenInbox = payload['openInbox'];
  if (rawOpenInbox is bool) {
    return rawOpenInbox;
  }

  final normalized = rawOpenInbox?.toString().trim().toLowerCase();
  return normalized == 'true' || normalized == '1' || normalized == 'yes';
}

List<String> _resolveChangedAreas(Map<String, dynamic> payload) {
  final rawValue = payload['changedAreas'];
  if (rawValue is Iterable) {
    return rawValue
        .map((item) => item.toString().trim().toLowerCase())
        .where((item) => item.isNotEmpty)
        .toList(growable: false);
  }

  final normalized = rawValue?.toString().trim().toLowerCase() ?? '';
  if (normalized.isEmpty) {
    return const <String>[];
  }

  return normalized
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList(growable: false);
}

String? _payloadValue(Map<String, dynamic> payload, String key) {
  final normalized = payload[key]?.toString().trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  return normalized.toLowerCase();
}

bool _hasPayloadValue(Map<String, dynamic> payload, String key) {
  return _payloadValue(payload, key) != null;
}

bool _hasAnyPayloadValue(Map<String, dynamic> payload, List<String> keys) {
  for (final key in keys) {
    if (_hasPayloadValue(payload, key)) {
      return true;
    }
  }

  return false;
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
