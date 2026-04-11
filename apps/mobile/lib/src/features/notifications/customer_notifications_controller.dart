import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/session_controller.dart';
import '../shared/app_models.dart';
import 'notification_models.dart';
import 'notification_repository.dart';

class CustomerNotificationsController extends ChangeNotifier {
  CustomerNotificationsController({
    required this.client,
    required this.sessionController,
    required this.notificationRepository,
  });

  final SupabaseClient? client;
  final SessionController sessionController;
  final NotificationRepository notificationRepository;

  AppSession? _session;
  final List<AppNotificationItem> _localNotifications = <AppNotificationItem>[];
  List<AppNotificationItem> _remoteNotifications = const [];

  RealtimeChannel? _appointmentsChannel;
  RealtimeChannel? _postsChannel;
  RealtimeChannel? _servicesChannel;
  RealtimeChannel? _offersChannel;
  RealtimeChannel? _referralsChannel;
  RealtimeChannel? _loyaltyProgramsChannel;
  RealtimeChannel? _loyaltyTransactionsChannel;
  RealtimeChannel? _membershipsChannel;
  RealtimeChannel? _notificationsChannel;
  RealtimeChannel? _inventoryChannel;
  RealtimeChannel? _ordersChannel;
  RealtimeChannel? _orderItemsChannel;

  Timer? _landingRefreshDebounce;
  bool _refreshingNotifications = false;
  bool _loadingInbox = false;
  bool _isDisposed = false;
  int _homeRevision = 0;
  int _agendaRevision = 0;
  int _feedRevision = 0;
  int _storeRevision = 0;
  int _benefitsRevision = 0;

  int get homeRevision => _homeRevision;
  int get agendaRevision => _agendaRevision;
  int get feedRevision => _feedRevision;
  int get storeRevision => _storeRevision;
  int get benefitsRevision => _benefitsRevision;
  bool get isLoadingInbox => _loadingInbox;

  List<AppNotificationItem> get notifications {
    final merged = <AppNotificationItem>[
      ..._localNotifications,
      ..._remoteNotifications,
    ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));
    return merged;
  }

  int get unreadCount => notifications.where((item) => !item.isRead).length;

  Future<void> bindSession(AppSession session) async {
    final hasSameSession =
        _session?.customer.id == session.customer.id &&
        _session?.customer.salonId == session.customer.salonId;
    _session = session;

    if (hasSameSession) {
      await refreshNotifications();
      return;
    }

    await _unsubscribeAll();
    await refreshNotifications();
    _subscribeRealtime();
  }

  Future<void> refreshNotifications() async {
    final session = _session;
    if (session == null || _refreshingNotifications) {
      return;
    }

    _refreshingNotifications = true;
    _loadingInbox = true;
    _safeNotify();
    try {
      _remoteNotifications = await notificationRepository.fetchNotifications(
        customerId: session.customer.id,
        salonId: session.customer.salonId,
      );
    } finally {
      _refreshingNotifications = false;
      _loadingInbox = false;
      _safeNotify();
    }
  }

  Future<void> markAllRead() async {
    final unreadRemoteIds = _remoteNotifications
        .where((item) => !item.isRead)
        .map((item) => item.id)
        .toList();

    if (unreadRemoteIds.isNotEmpty) {
      await notificationRepository.markAsRead(unreadRemoteIds);
    }

    for (var index = 0; index < _localNotifications.length; index += 1) {
      _localNotifications[index] = _localNotifications[index].copyWith(
        isRead: true,
      );
    }

    await refreshNotifications();
    _safeNotify();
  }

  Future<void> markNotificationRead(AppNotificationItem item) async {
    if (item.isLocal) {
      final index = _localNotifications.indexWhere(
        (entry) => entry.id == item.id,
      );
      if (index != -1) {
        _localNotifications[index] = _localNotifications[index].copyWith(
          isRead: true,
        );
        _safeNotify();
      }
      return;
    }

    if (!item.isRead) {
      await notificationRepository.markAsRead([item.id]);
      await refreshNotifications();
    }
  }

  void _subscribeRealtime() {
    final safeClient = client;
    final session = _session;
    if (safeClient == null || session == null) {
      return;
    }

    final salonId = session.customer.salonId;
    final customerId = session.customer.id;

    _appointmentsChannel = safeClient
        .channel('customer-appointments-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'appointments',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'customer_id',
            value: customerId,
          ),
          callback: (_) {
            _agendaRevision += 1;
            _homeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _postsChannel = safeClient
        .channel('customer-posts-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_posts',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _feedRevision += 1;
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _servicesChannel = safeClient
        .channel('customer-services-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'services',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _agendaRevision += 1;
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _offersChannel = safeClient
        .channel('customer-offers-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_offers',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _referralsChannel = safeClient
        .channel('customer-referrals-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_referral_programs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _loyaltyProgramsChannel = safeClient
        .channel('customer-loyalty-program-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_loyalty_programs',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _loyaltyTransactionsChannel = safeClient
        .channel('customer-loyalty-transactions-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_loyalty_transactions',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'customer_id',
            value: customerId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _membershipsChannel = safeClient
        .channel('customer-memberships-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_memberships',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'customer_id',
            value: customerId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _notificationsChannel = safeClient
        .channel('customer-notifications-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_customer_notifications',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (payload) {
            final type =
                (payload.newRecord['notification_type']?.toString() ?? '')
                    .trim()
                    .toLowerCase();
            _handleSalonNotificationType(type);
            unawaited(refreshNotifications());
          },
        )
        .subscribe();

    _inventoryChannel = safeClient
        .channel('customer-inventory-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'inventory_products',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _storeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _ordersChannel = safeClient
        .channel('customer-orders-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_product_orders',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'customer_id',
            value: customerId,
          ),
          callback: (payload) {
            _storeRevision += 1;
            _homeRevision += 1;
            if (payload.eventType != PostgresChangeEvent.insert) {
              _addOrRefreshLocalNotification(
                key: 'order-sync',
                title: 'Seu pedido mudou',
                body: _buildOrderStatusMessage(payload.newRecord['status']),
                targetTabIndex: 2,
                notificationType: 'order_status_sync',
              );
            } else {
              _safeNotify();
            }
          },
        )
        .subscribe();

    _orderItemsChannel = safeClient
        .channel('customer-order-items-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_product_order_items',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'customer_id',
            value: customerId,
          ),
          callback: (_) {
            _storeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();
  }

  void _queueLandingRefresh() {
    _landingRefreshDebounce?.cancel();
    _landingRefreshDebounce = Timer(const Duration(milliseconds: 350), () {
      unawaited(sessionController.refreshLandingData());
    });
  }

  String _buildOrderStatusMessage(dynamic rawStatus) {
    final status = (rawStatus?.toString() ?? '').trim().toLowerCase();
    switch (status) {
      case 'confirmed':
        return 'Seu pedido foi confirmado pelo salão.';
      case 'ready':
        return 'Seu pedido já está pronto para retirada.';
      case 'completed':
        return 'Seu pedido foi finalizado.';
      case 'cancelled':
        return 'O salão marcou seu pedido como cancelado.';
      default:
        return 'O status do seu pedido mudou no painel do salão.';
    }
  }

  void _handleSalonNotificationType(String type) {
    if (type.contains('loyalty') ||
        type.contains('referral') ||
        type.contains('benefit') ||
        type.contains('membership')) {
      _benefitsRevision += 1;
      _homeRevision += 1;
      _queueLandingRefresh();
      _safeNotify();
      return;
    }

    if (type.contains('staff') || type.contains('team')) {
      _agendaRevision += 1;
      _homeRevision += 1;
      _safeNotify();
      return;
    }

    if (type.contains('appointment') ||
        type.contains('agenda') ||
        type.contains('booking') ||
        type.contains('rebook') ||
        type.contains('reminder')) {
      _agendaRevision += 1;
      _homeRevision += 1;
      _safeNotify();
      return;
    }

    if (type == 'client_app_updated') {
      _homeRevision += 1;
      _queueLandingRefresh();
      _safeNotify();
    }
  }

  void _addOrRefreshLocalNotification({
    required String key,
    required String title,
    required String body,
    required int targetTabIndex,
    required String notificationType,
  }) {
    final index = _localNotifications.indexWhere((item) => item.id == key);
    final item = AppNotificationItem(
      id: key,
      title: title,
      body: body,
      createdAt: DateTime.now(),
      isRead: false,
      isLocal: true,
      sourceLabel: 'Ao vivo',
      targetTabIndex: targetTabIndex,
      notificationType: notificationType,
      payload: <String, dynamic>{'type': notificationType},
    );

    if (index == -1) {
      _localNotifications.add(item);
    } else {
      _localNotifications[index] = item;
    }

    _safeNotify();
  }

  Future<void> _unsubscribeAll() async {
    _landingRefreshDebounce?.cancel();
    final safeClient = client;
    if (safeClient == null) {
      return;
    }

    final channels = <RealtimeChannel?>[
      _appointmentsChannel,
      _postsChannel,
      _servicesChannel,
      _offersChannel,
      _referralsChannel,
      _loyaltyProgramsChannel,
      _loyaltyTransactionsChannel,
      _membershipsChannel,
      _notificationsChannel,
      _inventoryChannel,
      _ordersChannel,
      _orderItemsChannel,
    ];

    for (final channel in channels) {
      if (channel != null) {
        await safeClient.removeChannel(channel);
      }
    }

    _appointmentsChannel = null;
    _postsChannel = null;
    _servicesChannel = null;
    _offersChannel = null;
    _referralsChannel = null;
    _loyaltyProgramsChannel = null;
    _loyaltyTransactionsChannel = null;
    _membershipsChannel = null;
    _notificationsChannel = null;
    _inventoryChannel = null;
    _ordersChannel = null;
    _orderItemsChannel = null;
  }

  @override
  void dispose() {
    _isDisposed = true;
    _landingRefreshDebounce?.cancel();
    unawaited(_unsubscribeAll());
    super.dispose();
  }

  void _safeNotify() {
    if (_isDisposed) {
      return;
    }
    notifyListeners();
  }
}
