import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import '../models/app_models.dart';

abstract class AppAnalytics {
  Future<void> identifyCustomer(CustomerProfile? profile);

  Future<void> trackEvent(
    String event, [
    Map<String, Object?> parameters = const <String, Object?>{},
  ]);
}

class FirebaseAppAnalyticsService implements AppAnalytics {
  FirebaseAppAnalyticsService._();

  static final FirebaseAppAnalyticsService instance =
      FirebaseAppAnalyticsService._();

  Future<FirebaseAnalytics?>? _analyticsFuture;

  @override
  Future<void> identifyCustomer(CustomerProfile? profile) async {
    final analytics = await _resolveAnalytics();
    if (analytics == null) {
      if (kDebugMode) {
        debugPrint('analytics_identify:${profile?.id ?? 'anonymous'}');
      }
      return;
    }

    await analytics.setUserId(id: profile?.id);
    await analytics.setUserProperty(
      name: 'salon_id',
      value: _normalizeUserPropertyValue(profile?.salonId),
    );
    await analytics.setUserProperty(
      name: 'business_segment',
      value: _normalizeUserPropertyValue(profile?.salonBusinessSegment),
    );
  }

  @override
  Future<void> trackEvent(
    String event, [
    Map<String, Object?> parameters = const <String, Object?>{},
  ]) async {
    final normalizedEvent = _normalizeKey(event, fallback: 'app_event');
    final normalizedParameters = _normalizeParameters(parameters);
    final analytics = await _resolveAnalytics();

    if (analytics == null) {
      if (kDebugMode) {
        debugPrint('analytics:$normalizedEvent $normalizedParameters');
      }
      return;
    }

    await analytics.logEvent(
      name: normalizedEvent,
      parameters: normalizedParameters.isEmpty ? null : normalizedParameters,
    );
  }

  Future<FirebaseAnalytics?> _resolveAnalytics() {
    return _analyticsFuture ??= _initializeAnalytics();
  }

  Future<FirebaseAnalytics?> _initializeAnalytics() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      return FirebaseAnalytics.instance;
    } catch (error, stackTrace) {
      debugPrint('Analytics init skipped: $error');
      debugPrintStack(stackTrace: stackTrace);
      return null;
    }
  }
}

Map<String, Object> _normalizeParameters(Map<String, Object?> raw) {
  final normalized = <String, Object>{};
  raw.forEach((key, value) {
    final normalizedValue = _normalizeParameterValue(value);
    if (normalizedValue == null) {
      return;
    }

    normalized[_normalizeKey(key, fallback: 'param')] = normalizedValue;
  });
  return normalized;
}

Object? _normalizeParameterValue(Object? value) {
  if (value == null) {
    return null;
  }
  if (value is String) {
    return value;
  }
  if (value is num) {
    return value;
  }
  if (value is bool) {
    return value ? 1 : 0;
  }
  if (value is DateTime) {
    return value.toIso8601String();
  }
  if (value is Enum) {
    return value.name;
  }
  if (value is Iterable) {
    return value.map((entry) => entry.toString()).join(', ');
  }
  return value.toString();
}

String? _normalizeUserPropertyValue(String? value) {
  final normalized = value?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }

  if (normalized.length <= 36) {
    return normalized;
  }

  return normalized.substring(0, 36);
}

String _normalizeKey(String raw, {required String fallback}) {
  final replaced = raw
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9_]+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');

  final safeBase = replaced.isEmpty ? fallback : replaced;
  final prefixed = RegExp(r'^[a-z]').hasMatch(safeBase)
      ? safeBase
      : 'e_$safeBase';

  if (prefixed.length <= 40) {
    return prefixed;
  }

  return prefixed.substring(0, 40);
}
