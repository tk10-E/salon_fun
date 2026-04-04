import 'package:firebase_analytics/firebase_analytics.dart';

class AppAnalyticsService {
  AppAnalyticsService._();

  static final AppAnalyticsService instance = AppAnalyticsService._();

  FirebaseAnalytics? _analytics;

  Future<void> logScreenView(String screenName) {
    return _withAnalytics((analytics) async {
      await analytics.logScreenView(
        screenName: _sanitizeValue(screenName),
        screenClass: 'salon_client',
      );
    });
  }

  Future<void> setUserContext({
    required String userId,
    required String salonId,
    String? salonName,
  }) {
    return _withAnalytics((analytics) async {
      await analytics.setUserId(id: userId);
      await analytics.setUserProperty(
        name: 'salon_id',
        value: _sanitizeValue(salonId),
      );
      await analytics.setUserProperty(
        name: 'salon_name',
        value: _sanitizeValue(salonName),
      );
    });
  }

  Future<void> clearUserContext() {
    return _withAnalytics((analytics) async {
      await analytics.setUserId(id: null);
      await analytics.setUserProperty(name: 'salon_id', value: null);
      await analytics.setUserProperty(name: 'salon_name', value: null);
    });
  }

  Future<void> logNotificationOpened({
    required String type,
    required String target,
  }) {
    return _logEvent(
      'notification_opened',
      <String, Object?>{
        'notification_type': _sanitizeValue(type),
        'target': _sanitizeValue(target),
      },
    );
  }

  Future<void> logNotificationCenterOpened() {
    return _logEvent('notification_center_opened');
  }

  Future<void> logNotificationCenterAction({
    required String type,
    required String target,
  }) {
    return _logEvent(
      'notification_center_action',
      <String, Object?>{
        'notification_type': _sanitizeValue(type),
        'target': _sanitizeValue(target),
      },
    );
  }

  Future<void> logJoinSalonCompleted({required String salonId}) {
    return _logEvent(
      'join_salon_completed',
      <String, Object?>{'salon_id': _sanitizeValue(salonId)},
    );
  }

  Future<void> logTrustDocumentOpened({required String documentName}) {
    return _logEvent(
      'trust_document_opened',
      <String, Object?>{
        'document_name': _sanitizeValue(documentName),
      },
    );
  }

  Future<void> logFeedMediaInteraction({
    required String postType,
    required String action,
  }) {
    return _logEvent(
      'feed_media_interaction',
      <String, Object?>{
        'post_type': _sanitizeValue(postType),
        'action': _sanitizeValue(action),
      },
    );
  }

  Future<void> logEmptyStateViewed({
    required String screenName,
    required String stateName,
  }) {
    return _logEvent(
      'empty_state_viewed',
      <String, Object?>{
        'screen_name': _sanitizeValue(screenName),
        'state_name': _sanitizeValue(stateName),
      },
    );
  }

  Future<void> _logEvent(
    String name, [
    Map<String, Object?> parameters = const <String, Object?>{},
  ]) {
    final filteredParameters = <String, Object>{};
    for (final entry in parameters.entries) {
      final value = entry.value;
      if (value != null) {
        filteredParameters[entry.key] = value;
      }
    }

    return _withAnalytics((analytics) {
      return analytics.logEvent(
        name: name,
        parameters: filteredParameters,
      );
    });
  }

  Future<void> _withAnalytics(
    Future<void> Function(FirebaseAnalytics analytics) action,
  ) async {
    try {
      final analytics = _analytics ??= FirebaseAnalytics.instance;
      await action(analytics);
    } catch (_) {}
  }

  String? _sanitizeValue(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    final sanitized = value
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9_]+'), '_')
        .replaceAll(RegExp(r'_+'), '_')
        .replaceAll(RegExp(r'^_|_$'), '');
    if (sanitized.isEmpty) {
      return null;
    }

    return sanitized.substring(0, sanitized.length > 36 ? 36 : sanitized.length);
  }
}
