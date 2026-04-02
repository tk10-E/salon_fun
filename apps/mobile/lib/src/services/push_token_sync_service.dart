import 'dart:async';

import 'package:flutter/foundation.dart';

import 'push_notification_service.dart';

typedef RegisterPushTokenCallback =
    Future<void> Function({
      required String token,
      required String platform,
      String? deviceLabel,
    });

typedef DeactivatePushTokenCallback =
    Future<void> Function({required String token});

class PushTokenSyncService {
  PushTokenSyncService({
    required RegisterPushTokenCallback registerPushToken,
    required DeactivatePushTokenCallback deactivatePushToken,
    PushNotificationService? pushService,
  }) : _registerPushToken = registerPushToken,
       _deactivatePushToken = deactivatePushToken,
       _pushService = pushService ?? PushNotificationService.instance;

  final RegisterPushTokenCallback _registerPushToken;
  final DeactivatePushTokenCallback _deactivatePushToken;
  final PushNotificationService _pushService;

  StreamSubscription<String>? _tokenRefreshSubscription;
  Future<void>? _startFuture;
  Timer? _retryTimer;
  String? _retryToken;
  int _retryAttemptCount = 0;
  bool _hasStarted = false;
  bool _isDisposed = false;

  Future<void> start() async {
    if (_hasStarted ||
        _isDisposed ||
        !_pushService.isSupportedOnCurrentPlatform) {
      return;
    }

    final inFlight = _startFuture;
    if (inFlight != null) {
      await inFlight;
      return;
    }

    final future = _startInternal();
    _startFuture = future;

    try {
      await future;
      _hasStarted = true;
    } finally {
      _startFuture = null;
    }
  }

  Future<void> deactivateCurrentToken() async {
    if (_isDisposed || !_pushService.isSupportedOnCurrentPlatform) {
      return;
    }

    try {
      final token = await _pushService.getDeviceToken();
      final normalizedToken = token?.trim() ?? '';
      if (normalizedToken.isEmpty) {
        return;
      }

      await _deactivatePushToken(token: normalizedToken);
    } catch (error, stackTrace) {
      debugPrint('Não foi possível desativar o token push atual: $error');
      debugPrintStack(stackTrace: stackTrace);
    }
  }

  Future<void> dispose() async {
    _isDisposed = true;
    _hasStarted = false;
    _clearRetryState();
    await _tokenRefreshSubscription?.cancel();
    _tokenRefreshSubscription = null;
  }

  Future<void> _startInternal() async {
    _tokenRefreshSubscription ??= _pushService.onTokenRefresh.listen((token) {
      unawaited(_registerToken(token));
    });

    final token = await _pushService.getDeviceToken();
    await _registerToken(token);
  }

  Future<void> _registerToken(String? token) async {
    if (_isDisposed) {
      return;
    }

    final normalizedToken = token?.trim() ?? '';
    if (normalizedToken.isEmpty) {
      return;
    }

    final deviceInfo = _deviceInfoForCurrentPlatform();

    try {
      await _registerPushToken(
        token: normalizedToken,
        platform: deviceInfo.platform,
        deviceLabel: deviceInfo.label,
      );
      _clearRetryState();
    } catch (error, stackTrace) {
      debugPrint('Não foi possível registrar o token push: $error');
      debugPrintStack(stackTrace: stackTrace);
      _scheduleRetry(normalizedToken);
    }
  }

  void _scheduleRetry(String token) {
    if (_isDisposed) {
      return;
    }

    if (_retryToken != token) {
      _retryAttemptCount = 0;
    }

    _retryToken = token;
    _retryAttemptCount += 1;

    _retryTimer?.cancel();
    final seconds = _retryDelayInSeconds(_retryAttemptCount);
    _retryTimer = Timer(Duration(seconds: seconds), () {
      final pendingToken = _retryToken;
      if (_isDisposed || pendingToken == null) {
        return;
      }

      unawaited(_registerToken(pendingToken));
    });
  }

  void _clearRetryState() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _retryToken = null;
    _retryAttemptCount = 0;
  }

  int _retryDelayInSeconds(int attempt) {
    if (attempt <= 1) {
      return 2;
    }

    if (attempt == 2) {
      return 5;
    }

    final seconds = 10 * (1 << (attempt - 3));
    return seconds.clamp(10, 60);
  }

  _PushDeviceInfo _deviceInfoForCurrentPlatform() {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return const _PushDeviceInfo(platform: 'ios', label: 'Salon Fun iOS');
      case TargetPlatform.android:
        return const _PushDeviceInfo(
          platform: 'android',
          label: 'Salon Fun Android',
        );
      case TargetPlatform.macOS:
        return const _PushDeviceInfo(
          platform: 'macos',
          label: 'Salon Fun macOS',
        );
      case TargetPlatform.windows:
        return const _PushDeviceInfo(
          platform: 'windows',
          label: 'Salon Fun Windows',
        );
      case TargetPlatform.linux:
        return const _PushDeviceInfo(
          platform: 'linux',
          label: 'Salon Fun Linux',
        );
      case TargetPlatform.fuchsia:
        return const _PushDeviceInfo(
          platform: 'fuchsia',
          label: 'Salon Fun Fuchsia',
        );
    }
  }
}

class _PushDeviceInfo {
  const _PushDeviceInfo({required this.platform, required this.label});

  final String platform;
  final String label;
}
