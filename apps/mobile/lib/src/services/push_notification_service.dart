import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

const _vacancyNotificationChannelId = 'salon_vacancy_alerts';
const _vacancyNotificationChannelName = 'Vagas do salão';
const _vacancyNotificationChannelDescription =
    'Alertas de horários liberados para novos agendamentos.';
const _updatesNotificationChannelId = 'salon_updates_v2';
const _updatesNotificationChannelName = 'Atualizações do salão';
const _updatesNotificationChannelDescription =
    'Promoções, planos, confirmações e novidades enviadas pelo salão.';
const _androidNotificationIcon = 'ic_stat_salon_fun';

class NotificationTapPayload {
  const NotificationTapPayload({
    required this.type,
    required this.title,
    required this.body,
    required this.receivedAt,
    this.data = const {},
  });

  final String type;
  final String title;
  final String body;
  final DateTime receivedAt;
  final Map<String, dynamic> data;

  String get dedupeKey {
    final sourceId =
        data['notificationId']?.toString() ??
        data['alertId']?.toString() ??
        '$type|$title|$body';
    return '$type:$sourceId';
  }

  Map<String, dynamic> toMap() {
    return {
      'type': type,
      'title': title,
      'body': body,
      'receivedAt': receivedAt.toIso8601String(),
      'data': data,
    };
  }

  String encode() => jsonEncode(toMap());

  factory NotificationTapPayload.fromRemoteMessage(RemoteMessage message) {
    return NotificationTapPayload(
      type: message.data['type']?.toString() ?? 'update',
      title:
          message.notification?.title ??
          message.data['title']?.toString() ??
          'Novidade no salão',
      body:
          message.notification?.body ??
          message.data['body']?.toString() ??
          'Confira a atualização mais recente no app.',
      receivedAt: DateTime.now(),
      data: Map<String, dynamic>.from(message.data),
    );
  }

  static NotificationTapPayload? tryDecode(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        return null;
      }

      final map = Map<String, dynamic>.from(decoded);
      return NotificationTapPayload(
        type: map['type']?.toString() ?? 'update',
        title: map['title']?.toString() ?? 'Novidade no salão',
        body:
            map['body']?.toString() ??
            'Confira a atualização mais recente no app.',
        receivedAt:
            DateTime.tryParse(map['receivedAt']?.toString() ?? '') ??
            DateTime.now(),
        data: map['data'] is Map
            ? Map<String, dynamic>.from(map['data'] as Map)
            : <String, dynamic>{},
      );
    } catch (_) {
      return null;
    }
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await PushNotificationService.instance.initialize();
  await PushNotificationService.instance.showRemoteMessageAsLocalNotification(
    message,
  );
}

class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final StreamController<NotificationTapPayload> _notificationTapController =
      StreamController<NotificationTapPayload>.broadcast();

  AndroidNotificationChannel? _vacancyChannel;
  AndroidNotificationChannel? _updatesChannel;
  StreamSubscription<RemoteMessage>? _foregroundMessagesSubscription;
  StreamSubscription<RemoteMessage>? _openedAppMessagesSubscription;
  final Map<String, DateTime> _recentNotificationKeys = <String, DateTime>{};
  Future<void>? _initializationFuture;
  bool _isInitialized = false;
  bool _firebaseAvailable = false;
  NotificationTapPayload? _initialTapPayload;

  bool get isSupportedOnCurrentPlatform {
    if (kIsWeb) {
      return false;
    }

    return defaultTargetPlatform == TargetPlatform.android;
  }

  bool get isReady => _isInitialized && _firebaseAvailable;

  Stream<NotificationTapPayload> get onNotificationTap =>
      _notificationTapController.stream;

  NotificationTapPayload? consumeInitialTap() {
    final payload = _initialTapPayload;
    _initialTapPayload = null;
    return payload;
  }

  Future<void> initialize() async {
    if (!isSupportedOnCurrentPlatform) {
      return;
    }

    if (_isInitialized) {
      return;
    }

    final inFlight = _initializationFuture;
    if (inFlight != null) {
      await inFlight;
      return;
    }

    final future = _initializeInternal();
    _initializationFuture = future;

    try {
      await future;
    } finally {
      _initializationFuture = null;
    }
  }

  Future<void> _initializeInternal() async {
    if (_isInitialized) {
      return;
    }

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      await FirebaseMessaging.instance.setAutoInitEnabled(true);
      _firebaseAvailable = true;
    } catch (error, stackTrace) {
      debugPrint('Push init skipped: $error');
      debugPrintStack(stackTrace: stackTrace);
      return;
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    await _configureLocalNotifications();
    await _requestPermissions();

    _foregroundMessagesSubscription ??= FirebaseMessaging.onMessage.listen((
      message,
    ) async {
      await showRemoteMessageAsLocalNotification(message);
    });
    _openedAppMessagesSubscription ??= FirebaseMessaging.onMessageOpenedApp
        .listen(_emitTapFromRemoteMessage);

    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _initialTapPayload = NotificationTapPayload.fromRemoteMessage(
        initialMessage,
      );
    }

    _isInitialized = true;
  }

  Future<String?> getDeviceToken() async {
    await initialize();
    if (!isReady) {
      return null;
    }

    return FirebaseMessaging.instance.getToken();
  }

  Stream<String> get onTokenRefresh {
    if (!isSupportedOnCurrentPlatform) {
      return const Stream<String>.empty();
    }

    return FirebaseMessaging.instance.onTokenRefresh;
  }

  Future<void> showRemoteMessageAsLocalNotification(
    RemoteMessage message,
  ) async {
    final notificationPayload = NotificationTapPayload.fromRemoteMessage(
      message,
    );

    await showLocalNotificationPayload(notificationPayload);
  }

  Future<void> showLocalNotificationPayload(
    NotificationTapPayload notificationPayload,
  ) async {
    await initialize();
    if (!isReady) {
      return;
    }

    _pruneRecentNotificationKeys();
    if (_recentNotificationKeys.containsKey(notificationPayload.dedupeKey)) {
      return;
    }

    final notificationType = notificationPayload.type;
    final title = notificationPayload.title;
    final body = notificationPayload.body;
    final channel = notificationType == 'vacancy_alert'
        ? _vacancyChannel
        : _updatesChannel;
    if (channel == null) {
      return;
    }

    await _localNotifications.show(
      notificationPayload.dedupeKey.hashCode ^ body.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          channel.id,
          channel.name,
          channelDescription: channel.description,
          importance: Importance.max,
          priority: Priority.high,
          visibility: NotificationVisibility.public,
          playSound: true,
          enableVibration: true,
          channelShowBadge: true,
          autoCancel: true,
          ticker: title,
          icon: _androidNotificationIcon,
          styleInformation: BigTextStyleInformation(body),
        ),
      ),
      payload: notificationPayload.encode(),
    );

    _recentNotificationKeys[notificationPayload.dedupeKey] = DateTime.now();
  }

  Future<void> _configureLocalNotifications() async {
    final initializationSettings = InitializationSettings(
      android: const AndroidInitializationSettings(_androidNotificationIcon),
    );

    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: _handleNotificationResponse,
    );

    final launchDetails = await _localNotifications
        .getNotificationAppLaunchDetails();
    final response = launchDetails?.notificationResponse;
    if (launchDetails?.didNotificationLaunchApp == true) {
      _initialTapPayload = NotificationTapPayload.tryDecode(response?.payload);
    }

    const vacancyChannel = AndroidNotificationChannel(
      _vacancyNotificationChannelId,
      _vacancyNotificationChannelName,
      description: _vacancyNotificationChannelDescription,
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      showBadge: true,
    );
    const updatesChannel = AndroidNotificationChannel(
      _updatesNotificationChannelId,
      _updatesNotificationChannelName,
      description: _updatesNotificationChannelDescription,
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      showBadge: true,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(vacancyChannel);
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(updatesChannel);

    _vacancyChannel = vacancyChannel;
    _updatesChannel = updatesChannel;
  }

  Future<void> _requestPermissions() async {
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );

    await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
  }

  void _handleNotificationResponse(NotificationResponse response) {
    final payload = NotificationTapPayload.tryDecode(response.payload);
    if (payload == null) {
      return;
    }

    _notificationTapController.add(payload);
  }

  void _emitTapFromRemoteMessage(RemoteMessage message) {
    _notificationTapController.add(
      NotificationTapPayload.fromRemoteMessage(message),
    );
  }

  void _pruneRecentNotificationKeys() {
    final threshold = DateTime.now().subtract(const Duration(minutes: 2));
    _recentNotificationKeys.removeWhere(
      (_, shownAt) => shownAt.isBefore(threshold),
    );
  }
}
