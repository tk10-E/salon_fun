import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/app_environment.dart';
import '../network/snapshot_read_cache.dart';

class ClientPerformanceReporter {
  ClientPerformanceReporter({
    required this.environment,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  static const _requestTimeout = Duration(milliseconds: 1500);
  static const _cooldownWindow = Duration(minutes: 4);

  final AppEnvironment environment;
  final http.Client _httpClient;
  final Map<String, DateTime> _lastReportedAtByKey = <String, DateTime>{};

  Uri? get _endpoint =>
      environment.publicApiUri('/api/public/observability/performance');

  bool get isEnabled => _endpoint != null;

  Future<T> trace<T>({
    required String operation,
    required String surface,
    required Future<T> Function() action,
    String? cacheStatus,
    String? route,
    int slowThresholdMs = 900,
  }) async {
    final stopwatch = Stopwatch()..start();

    try {
      final result = await action();
      stopwatch.stop();
      reportOperation(
        cacheStatus: cacheStatus,
        durationMs: stopwatch.elapsedMilliseconds,
        operation: operation,
        outcome: 'ok',
        route: route,
        slowThresholdMs: slowThresholdMs,
        surface: surface,
      );
      return result;
    } catch (error) {
      stopwatch.stop();
      reportOperation(
        cacheStatus: cacheStatus,
        durationMs: stopwatch.elapsedMilliseconds,
        operation: operation,
        outcome: 'failed',
        route: route,
        slowThresholdMs: slowThresholdMs,
        surface: surface,
      );
      rethrow;
    }
  }

  void observeSnapshotRead(SnapshotReadObservation observation) {
    final spec = _resolveSnapshotSpec(observation.key);
    if (spec == null) {
      return;
    }

    reportOperation(
      cacheStatus: observation.bypassCache ? 'bypass_network' : 'network_miss',
      durationMs: observation.duration.inMilliseconds,
      operation: spec.operation,
      outcome: observation.outcome == SnapshotReadOutcome.failed
          ? 'failed'
          : 'ok',
      route: spec.route,
      slowThresholdMs: spec.slowThresholdMs,
      surface: spec.surface,
    );
  }

  void reportOperation({
    required int durationMs,
    required String operation,
    required String outcome,
    required String surface,
    String? cacheStatus,
    String? route,
    int slowThresholdMs = 900,
  }) {
    final endpoint = _endpoint;
    if (endpoint == null) {
      return;
    }

    final normalizedOutcome = outcome == 'failed' ? 'failed' : 'ok';
    if (normalizedOutcome == 'ok' && durationMs < slowThresholdMs) {
      return;
    }

    final dedupeKey =
        '$surface|$operation|$normalizedOutcome|${cacheStatus ?? 'na'}';
    final now = DateTime.now();
    final lastReportedAt = _lastReportedAtByKey[dedupeKey];
    final isSevereSlowPath = durationMs >= slowThresholdMs * 2;
    if (lastReportedAt != null &&
        now.difference(lastReportedAt) < _cooldownWindow &&
        normalizedOutcome == 'ok' &&
        !isSevereSlowPath) {
      return;
    }

    _lastReportedAtByKey[dedupeKey] = now;
    unawaited(
      _send(<String, Object?>{
        'cacheStatus': cacheStatus,
        'durationMs': durationMs,
        'joinCode': environment.defaultJoinCode.isEmpty
            ? null
            : environment.defaultJoinCode,
        'operation': operation,
        'outcome': normalizedOutcome,
        'platform': resolveClientPlatformLabel(),
        'route': route,
        'source': 'mobile',
        'surface': surface,
      }),
    );
  }

  Future<void> _send(Map<String, Object?> payload) async {
    try {
      await _httpClient
          .post(
            _endpoint!,
            headers: const <String, String>{
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode(payload),
          )
          .timeout(_requestTimeout);
    } catch (_) {}
  }

  _SnapshotObservationSpec? _resolveSnapshotSpec(String key) {
    for (final spec in _snapshotObservationSpecs) {
      if (key.startsWith(spec.cacheKeyPrefix)) {
        return spec;
      }
    }

    return null;
  }
}

class _SnapshotObservationSpec {
  const _SnapshotObservationSpec({
    required this.cacheKeyPrefix,
    required this.operation,
    required this.route,
    required this.slowThresholdMs,
    required this.surface,
  });

  final String cacheKeyPrefix;
  final String operation;
  final String route;
  final int slowThresholdMs;
  final String surface;
}

const List<_SnapshotObservationSpec> _snapshotObservationSpecs =
    <_SnapshotObservationSpec>[
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'landing:',
        operation: 'public.fetchLanding',
        route: '/login',
        slowThresholdMs: 850,
        surface: 'public_landing',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'agenda:services',
        operation: 'agenda.fetchServices',
        route: '/agenda',
        slowThresholdMs: 850,
        surface: 'agenda',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'agenda:appointments',
        operation: 'agenda.fetchAppointments',
        route: '/agenda',
        slowThresholdMs: 950,
        surface: 'agenda',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'agenda:membershipPlans:',
        operation: 'agenda.fetchMembershipPlans',
        route: '/agenda',
        slowThresholdMs: 850,
        surface: 'agenda',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'feed:posts:',
        operation: 'feed.fetchPosts',
        route: '/feed',
        slowThresholdMs: 800,
        surface: 'feed',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'feed:stories',
        operation: 'feed.fetchStories',
        route: '/feed',
        slowThresholdMs: 800,
        surface: 'feed',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:currentCustomer',
        operation: 'profile.fetchCurrentCustomer',
        route: '/perfil',
        slowThresholdMs: 700,
        surface: 'profile',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:birthdayHome',
        operation: 'profile.fetchBirthdayHomeExperience',
        route: '/inicio',
        slowThresholdMs: 700,
        surface: 'home',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:loyaltySummary',
        operation: 'profile.fetchLoyaltySummary',
        route: '/perfil',
        slowThresholdMs: 750,
        surface: 'profile',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:referralSummary',
        operation: 'profile.fetchReferralSummary',
        route: '/perfil',
        slowThresholdMs: 750,
        surface: 'profile',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:loyaltyTransactions:',
        operation: 'profile.fetchLoyaltyTransactions',
        route: '/perfil',
        slowThresholdMs: 800,
        surface: 'profile',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'profile:membershipOverview:',
        operation: 'profile.fetchMembershipOverview',
        route: '/perfil',
        slowThresholdMs: 800,
        surface: 'profile',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'store:catalog',
        operation: 'store.fetchCatalog',
        route: '/loja',
        slowThresholdMs: 850,
        surface: 'store',
      ),
      _SnapshotObservationSpec(
        cacheKeyPrefix: 'store:orders',
        operation: 'store.fetchOrders',
        route: '/loja',
        slowThresholdMs: 850,
        surface: 'store',
      ),
    ];

String resolveClientPlatformLabel() {
  if (kIsWeb) {
    return 'web';
  }

  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'android';
    case TargetPlatform.iOS:
      return 'ios';
    case TargetPlatform.macOS:
      return 'macos';
    case TargetPlatform.windows:
      return 'windows';
    case TargetPlatform.linux:
      return 'linux';
    case TargetPlatform.fuchsia:
      return 'fuchsia';
  }
}
