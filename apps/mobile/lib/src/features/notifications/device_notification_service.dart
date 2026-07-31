import 'dart:async';
import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/app_environment.dart';
import '../shared/app_models.dart';
import 'notification_navigation.dart';

enum DeviceNotificationHealth {
  idle,
  ready,
  permissionDenied,
  waitingActivation,
}

class DeviceNotificationHealthState {
  const DeviceNotificationHealthState({
    required this.health,
    this.systemStatus,
  });

  final DeviceNotificationHealth health;
  final String? systemStatus;

  bool get showsCustomerCard =>
      health == DeviceNotificationHealth.permissionDenied ||
      health == DeviceNotificationHealth.waitingActivation;

  bool get canRetry => showsCustomerCard;

  String get title {
    switch (health) {
      case DeviceNotificationHealth.permissionDenied:
        return 'Ative os lembretes do aparelho';
      case DeviceNotificationHealth.waitingActivation:
        return 'Conectando este aparelho aos avisos';
      case DeviceNotificationHealth.ready:
        return 'Lembretes prontos';
      case DeviceNotificationHealth.idle:
        return 'Avisos do aparelho';
    }
  }

  String get message {
    switch (health) {
      case DeviceNotificationHealth.permissionDenied:
        return 'O sistema do aparelho ainda não liberou notificações. Sem isso, os lembretes de horário podem não tocar aqui.';
      case DeviceNotificationHealth.waitingActivation:
        return 'Os avisos já estão ativos no app, mas este aparelho ainda está terminando a conexão com o push. Você pode tentar atualizar agora.';
      case DeviceNotificationHealth.ready:
        return 'Este aparelho está pronto para receber lembretes do salão.';
      case DeviceNotificationHealth.idle:
        return 'Os avisos do salão aparecem aqui assim que o dispositivo estiver conectado.';
    }
  }
}

class DeviceNotificationService extends ChangeNotifier {
  DeviceNotificationService({
    required this.environment,
    required this.supabaseClient,
    this.disablePush = false,
  }) : _healthState = const DeviceNotificationHealthState(
         health: DeviceNotificationHealth.idle,
       );

  final AppEnvironment environment;
  final SupabaseClient? supabaseClient;
  final bool disablePush;

  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  final StreamController<NotificationNavigationIntent>
  _notificationOpenController =
      StreamController<NotificationNavigationIntent>.broadcast();

  StreamSubscription<RemoteMessage>? _foregroundMessageSubscription;
  StreamSubscription<RemoteMessage>? _messageOpenedAppSubscription;
  StreamSubscription<String>? _tokenRefreshSubscription;
  Timer? _registrationRetryTimer;
  String? _registeredToken;
  String? _boundCustomerId;
  NotificationNavigationIntent? _pendingNavigationIntent;
  bool _initialized = false;
  bool _bindingInProgress = false;
  int _registrationRetryAttempt = 0;
  DeviceNotificationHealthState _healthState;

  bool get isAvailable =>
      !disablePush && environment.hasFirebase && supabaseClient != null;

  Stream<NotificationNavigationIntent> get notificationOpenStream =>
      _notificationOpenController.stream;

  DeviceNotificationHealthState get healthState => _healthState;

  Future<void> retryActivation() async {
    if (!isAvailable || _boundCustomerId == null) {
      return;
    }

    _cancelRegistrationRetry(resetAttempts: true);
    await _syncCurrentBinding();
  }

  @visibleForTesting
  void overrideHealthState(DeviceNotificationHealthState value) {
    _setHealthState(value);
  }

  NotificationNavigationIntent? takePendingNotificationIntent() {
    final intent = _pendingNavigationIntent;
    _pendingNavigationIntent = null;
    return intent;
  }

  Future<void> initialize() async {
    if (!isAvailable || _initialized) {
      return;
    }

    try {
      const initializationSettings = InitializationSettings(
        android: AndroidInitializationSettings('ic_stat_salon_fun'),
        iOS: DarwinInitializationSettings(
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
        onDidReceiveNotificationResponse: _handleLocalNotificationResponse,
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();

      if (androidPlugin != null) {
        await androidPlugin.createNotificationChannel(_updatesChannel);
        await androidPlugin.createNotificationChannel(_vacancyChannel);
      }

      final messaging = FirebaseMessaging.instance;
      await messaging.setAutoInitEnabled(true);
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      _foregroundMessageSubscription = FirebaseMessaging.onMessage.listen(
        _showForegroundNotification,
      );
      _messageOpenedAppSubscription = FirebaseMessaging.onMessageOpenedApp
          .listen(_handleRemoteNotificationOpened);
      _tokenRefreshSubscription = messaging.onTokenRefresh.listen((token) {
        unawaited(_handleTokenRefresh(token));
      });

      _initialized = true;
      _setHealthState(
        const DeviceNotificationHealthState(health: DeviceNotificationHealth.idle),
      );
      await _captureLaunchNotificationIntents(messaging);
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.initialize failed: '
        '${error.toString()}',
      );
    }
  }

  Future<void> bindSession(AppSession? session) async {
    if (!isAvailable) {
      return;
    }

    try {
      await initialize();
      final previousCustomerId = _boundCustomerId;

      if (session == null) {
        _cancelRegistrationRetry(resetAttempts: true);
        _boundCustomerId = null;
        await _deactivateCurrentToken();
        _setHealthState(
          const DeviceNotificationHealthState(health: DeviceNotificationHealth.idle),
        );
        return;
      }

      _boundCustomerId = session.customer.id;
      if (_boundCustomerId != previousCustomerId) {
        _cancelRegistrationRetry(resetAttempts: true);
      } else {
        _cancelRegistrationRetry();
      }
      await _syncCurrentBinding();
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.bindSession failed: ${error.toString()}',
      );
    }
  }

  @override
  Future<void> dispose() async {
    _cancelRegistrationRetry();
    await _foregroundMessageSubscription?.cancel();
    await _messageOpenedAppSubscription?.cancel();
    await _tokenRefreshSubscription?.cancel();
    await _notificationOpenController.close();
    super.dispose();
  }

  void _handleRemoteNotificationOpened(RemoteMessage message) {
    _handlePayloadNotificationOpened(message.data);
  }

  void _handleLocalNotificationResponse(NotificationResponse response) {
    _handlePayloadNotificationOpened(
      decodeNotificationPayload(response.payload),
    );
  }

  void _handlePayloadNotificationOpened(Map<String, dynamic> payload) {
    if (payload.isEmpty || _notificationOpenController.isClosed) {
      return;
    }

    final notificationType =
        payload['type']?.toString() ??
        payload['notification_type']?.toString() ??
        payload['notificationType']?.toString() ??
        'panel_update';
    final intent = resolveNotificationNavigationIntent(
      notificationType: notificationType,
      payload: payload,
    );

    if (_notificationOpenController.hasListener) {
      _notificationOpenController.add(intent);
      return;
    }

    _pendingNavigationIntent = intent;
  }

  Future<void> _captureLaunchNotificationIntents(
    FirebaseMessaging messaging,
  ) async {
    try {
      final launchDetails = await _localNotifications
          .getNotificationAppLaunchDetails();
      final launchPayload =
          launchDetails?.notificationResponse?.payload?.trim() ?? '';
      if (launchDetails?.didNotificationLaunchApp == true &&
          launchPayload.isNotEmpty) {
        _handlePayloadNotificationOpened(
          decodeNotificationPayload(launchPayload),
        );
      }

      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        _handleRemoteNotificationOpened(initialMessage);
      }
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.launchIntent failed: ${error.toString()}',
      );
    }
  }

  Future<void> _handleTokenRefresh(String token) async {
    final normalizedToken = token.trim();
    if (normalizedToken.isEmpty) {
      return;
    }

    final didRegister = await _registerPushToken(normalizedToken);
    if (didRegister) {
      _cancelRegistrationRetry(resetAttempts: true);
      return;
    }

    _scheduleRegistrationRetry();
  }

  Future<void> _syncCurrentBinding() async {
    if (!isAvailable || _boundCustomerId == null || _bindingInProgress) {
      return;
    }

    _bindingInProgress = true;
    try {
      final permission = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      if (!_isNotificationPermissionGranted(permission)) {
        _setHealthState(
          DeviceNotificationHealthState(
            health: DeviceNotificationHealth.permissionDenied,
            systemStatus: permission.authorizationStatus.name,
          ),
        );
        return;
      }

      await _requestLocalNotificationPermissions();

      final token = await _resolveMessagingToken();
      if (token == null) {
        _setHealthState(
          const DeviceNotificationHealthState(
            health: DeviceNotificationHealth.waitingActivation,
          ),
        );
        _scheduleRegistrationRetry();
        return;
      }

      final didRegister = await _registerPushToken(token);
      if (didRegister) {
        _cancelRegistrationRetry(resetAttempts: true);
        _setHealthState(
          const DeviceNotificationHealthState(health: DeviceNotificationHealth.ready),
        );
        return;
      }

      _setHealthState(
        const DeviceNotificationHealthState(
          health: DeviceNotificationHealth.waitingActivation,
        ),
      );
      _scheduleRegistrationRetry();
    } finally {
      _bindingInProgress = false;
    }
  }

  bool _isNotificationPermissionGranted(NotificationSettings permission) {
    return permission.authorizationStatus == AuthorizationStatus.authorized ||
        permission.authorizationStatus == AuthorizationStatus.provisional;
  }

  Future<void> _requestLocalNotificationPermissions() async {
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

  Future<String?> _resolveMessagingToken() async {
    try {
      if (!kIsWeb && Platform.isIOS) {
        final apnsToken = await _waitForApnsToken();
        if (apnsToken == null) {
          return null;
        }
      }

      final token = await FirebaseMessaging.instance.getToken();
      final normalizedToken = token?.trim() ?? '';
      return normalizedToken.isEmpty ? null : normalizedToken;
    } catch (error) {
      _debugLog('DeviceNotificationService.token failed: ${error.toString()}');
      return null;
    }
  }

  Future<String?> _waitForApnsToken() async {
    for (var attempt = 0; attempt < 6; attempt += 1) {
      final token = await FirebaseMessaging.instance.getAPNSToken();
      final normalizedToken = token?.trim() ?? '';
      if (normalizedToken.isNotEmpty) {
        return normalizedToken;
      }

      await Future<void>.delayed(const Duration(seconds: 1));
    }

    return null;
  }

  Future<bool> _registerPushToken(String token) async {
    if (!isAvailable || _boundCustomerId == null) {
      return false;
    }

    try {
      await supabaseClient!.rpc(
        'register_customer_push_token',
        params: <String, dynamic>{
          'input_token': token,
          'device_platform_input': _devicePlatform,
          'device_label_input': _deviceLabel,
        },
      );
      _registeredToken = token;
      return true;
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.register failed: ${error.toString()}',
      );
      return false;
    }
  }

  Future<void> _deactivateCurrentToken() async {
    if (!isAvailable || _registeredToken == null) {
      return;
    }

    try {
      await supabaseClient!.rpc(
        'deactivate_customer_push_token',
        params: <String, dynamic>{'input_token': _registeredToken},
      );
      _registeredToken = null;
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.deactivate failed: ${error.toString()}',
      );
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    if (kIsWeb || !Platform.isAndroid) {
      return;
    }

    final title =
        message.notification?.title ??
        message.data['title']?.toString() ??
        'Atualização do salão';
    final body =
        message.notification?.body ?? message.data['body']?.toString() ?? '';

    if (title.trim().isEmpty && body.trim().isEmpty) {
      return;
    }

    final channelId = message.data['type']?.toString() == 'vacancy_alert'
        ? _vacancyChannel.id
        : _updatesChannel.id;
    final channelName = message.data['type']?.toString() == 'vacancy_alert'
        ? _vacancyChannel.name
        : _updatesChannel.name;
    final channelDescription =
        message.data['type']?.toString() == 'vacancy_alert'
        ? _vacancyChannel.description
        : _updatesChannel.description;

    try {
      await _localNotifications.show(
        message.hashCode,
        title,
        body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            channelId,
            channelName,
            channelDescription: channelDescription,
            importance: Importance.max,
            priority: Priority.max,
            playSound: true,
            enableVibration: true,
            icon: 'ic_stat_salon_fun',
            styleInformation: BigTextStyleInformation(body),
          ),
        ),
        payload: encodeNotificationPayload(message.data),
      );
    } catch (error) {
      _debugLog(
        'DeviceNotificationService.showForeground failed: '
        '${error.toString()}',
      );
    }
  }

  void _scheduleRegistrationRetry() {
    if (!isAvailable || _boundCustomerId == null) {
      return;
    }

    _registrationRetryAttempt += 1;
    final delaySeconds = _retryDelayInSeconds(_registrationRetryAttempt);
    _registrationRetryTimer?.cancel();
    _registrationRetryTimer = Timer(Duration(seconds: delaySeconds), () {
      _registrationRetryTimer = null;
      if (!isAvailable || _boundCustomerId == null) {
        return;
      }

      unawaited(_syncCurrentBinding());
    });
  }

  void _cancelRegistrationRetry({bool resetAttempts = false}) {
    _registrationRetryTimer?.cancel();
    _registrationRetryTimer = null;
    if (resetAttempts) {
      _registrationRetryAttempt = 0;
    }
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

  String get _devicePlatform {
    if (kIsWeb) {
      return 'web';
    }
    if (Platform.isIOS) {
      return 'ios';
    }
    return 'android';
  }

  String get _deviceLabel {
    if (kIsWeb) {
      return 'Salon Fun Web';
    }
    if (Platform.isIOS) {
      return 'Salon Fun iPhone';
    }
    return 'Salon Fun Android';
  }

  void _setHealthState(DeviceNotificationHealthState nextState) {
    if (_healthState.health == nextState.health &&
        _healthState.systemStatus == nextState.systemStatus) {
      return;
    }

    _healthState = nextState;
    notifyListeners();
  }

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint(message);
    }
  }

  static const AndroidNotificationChannel _updatesChannel =
      AndroidNotificationChannel(
        'salon_updates_v2',
        'Atualizações do salão',
        description: 'Avisos enviados pelo painel do salão.',
        importance: Importance.max,
      );

  static const AndroidNotificationChannel _vacancyChannel =
      AndroidNotificationChannel(
        'salon_vacancy_alerts',
        'Vagas do salão',
        description: 'Alertas de encaixe e vagas abertas no salão.',
        importance: Importance.max,
      );
}
