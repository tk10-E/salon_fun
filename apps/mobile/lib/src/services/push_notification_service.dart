import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../core/firebase_config.dart';

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
    this.data = const <String, dynamic>{},
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
    return <String, dynamic>{
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
          message.data['title']?.toString() ??
          message.notification?.title ??
          'Novidade no salão',
      body:
          message.data['body']?.toString() ??
          message.notification?.body ??
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
  final Map<String, AndroidBitmap<Object>> _largeIconCache =
      <String, AndroidBitmap<Object>>{};
  final Map<String, Future<AndroidBitmap<Object>?>> _largeIconRequests =
      <String, Future<AndroidBitmap<Object>?>>{};
  Future<void>? _initializationFuture;
  bool _isInitialized = false;
  bool _firebaseAvailable = false;
  NotificationTapPayload? _initialTapPayload;

  bool get isSupportedOnCurrentPlatform {
    if (kIsWeb) {
      return false;
    }

    return defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS;
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
        final explicitOptions = FirebaseConfig.optionsForCurrentPlatform();
        if (explicitOptions != null) {
          await Firebase.initializeApp(options: explicitOptions);
        } else {
          await Firebase.initializeApp();
        }
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
    final title = _buildDisplayTitle(notificationPayload);
    final body = _buildDisplayBody(notificationPayload);
    final largeIcon = await _resolveLargeIcon(notificationPayload);
    final channel = notificationType == 'vacancy_alert'
        ? _vacancyChannel
        : _updatesChannel;
    final isAndroid = defaultTargetPlatform == TargetPlatform.android;
    if (isAndroid && channel == null) {
      return;
    }
    final androidDetails = isAndroid
        ? AndroidNotificationDetails(
            channel!.id,
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
            largeIcon: largeIcon,
            styleInformation: BigTextStyleInformation(body),
          )
        : null;

    await _localNotifications.show(
      notificationPayload.dedupeKey.hashCode ^ body.hashCode,
      title,
      body,
      NotificationDetails(
        android: androidDetails,
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          interruptionLevel: InterruptionLevel.active,
          threadIdentifier: notificationType,
        ),
      ),
      payload: notificationPayload.encode(),
    );

    _recentNotificationKeys[notificationPayload.dedupeKey] = DateTime.now();
  }

  Future<void> _configureLocalNotifications() async {
    final initializationSettings = InitializationSettings(
      android: const AndroidInitializationSettings(_androidNotificationIcon),
      iOS: const DarwinInitializationSettings(
        requestAlertPermission: false,
        requestBadgePermission: false,
        requestSoundPermission: false,
        defaultPresentAlert: true,
        defaultPresentBadge: true,
        defaultPresentSound: true,
      ),
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

    if (defaultTargetPlatform == TargetPlatform.android) {
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
    await _localNotifications
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >()
        ?.requestPermissions(alert: true, badge: true, sound: true);
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

  Future<AndroidBitmap<Object>?> _resolveLargeIcon(
    NotificationTapPayload notificationPayload,
  ) async {
    final salonLogoUrl = _readSalonLogoUrl(notificationPayload);
    if (salonLogoUrl == null) {
      return null;
    }

    final cached = _largeIconCache[salonLogoUrl];
    if (cached != null) {
      return cached;
    }

    final inFlight = _largeIconRequests[salonLogoUrl];
    if (inFlight != null) {
      return inFlight;
    }

    final future = _downloadLargeIcon(salonLogoUrl);
    _largeIconRequests[salonLogoUrl] = future;

    try {
      final bitmap = await future;
      if (bitmap != null) {
        _largeIconCache[salonLogoUrl] = bitmap;
        _trimLargeIconCache();
      }
      return bitmap;
    } finally {
      _largeIconRequests.remove(salonLogoUrl);
    }
  }

  String? _readSalonLogoUrl(NotificationTapPayload notificationPayload) {
    final raw = notificationPayload.data['salonLogoUrl']?.toString().trim();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(raw);
    if (uri == null || !(uri.isScheme('https') || uri.isScheme('http'))) {
      return null;
    }

    return raw;
  }

  String? _readSalonName(NotificationTapPayload notificationPayload) {
    final raw = notificationPayload.data['salonName']?.toString().trim();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return raw;
  }

  String _buildDisplayTitle(NotificationTapPayload notificationPayload) {
    return _readSalonName(notificationPayload) ?? notificationPayload.title;
  }

  String _buildDisplayBody(NotificationTapPayload notificationPayload) {
    final salonName = _readSalonName(notificationPayload);
    final semanticTitle = notificationPayload.title.trim();
    final semanticBody = notificationPayload.body.trim();

    if (salonName == null) {
      if (semanticBody.isNotEmpty) {
        return semanticBody;
      }

      return semanticTitle;
    }

    if (semanticTitle.isEmpty) {
      return semanticBody;
    }

    if (semanticBody.isEmpty || semanticBody == semanticTitle) {
      return semanticTitle;
    }

    return '$semanticTitle\n$semanticBody';
  }

  Future<AndroidBitmap<Object>?> _downloadLargeIcon(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return null;
    }

    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);

    try {
      final request = await client.getUrl(uri);
      final response = await request.close();
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }

      final bytes = await consolidateHttpClientResponseBytes(response);
      if (bytes.isEmpty) {
        return null;
      }

      return ByteArrayAndroidBitmap.fromBase64String(base64Encode(bytes))
          as AndroidBitmap<Object>;
    } catch (error, stackTrace) {
      debugPrint('Notification logo load failed: $error');
      debugPrintStack(stackTrace: stackTrace);
      return null;
    } finally {
      client.close(force: true);
    }
  }

  void _trimLargeIconCache() {
    const maxEntries = 18;
    while (_largeIconCache.length > maxEntries) {
      _largeIconCache.remove(_largeIconCache.keys.first);
    }
  }
}
