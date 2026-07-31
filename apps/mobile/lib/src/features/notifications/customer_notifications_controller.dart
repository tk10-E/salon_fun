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
  RealtimeChannel? _customerProfileChannel;
  RealtimeChannel? _salonProfileChannel;
  RealtimeChannel? _postsChannel;
  RealtimeChannel? _birthdayCampaignChannel;  RealtimeChannel? _servicesChannel;
  RealtimeChannel? _staffMembersChannel;
  RealtimeChannel? _staffBlocksChannel;
  RealtimeChannel? _offersChannel;
  RealtimeChannel? _referralsChannel;
  RealtimeChannel? _referralEventsChannel;
  RealtimeChannel? _referralRewardUnlocksChannel;
  RealtimeChannel? _loyaltyProgramsChannel;
  RealtimeChannel? _loyaltyTransactionsChannel;
  RealtimeChannel? _membershipsChannel;
  RealtimeChannel? _membershipRequestsChannel;
  RealtimeChannel? _membershipRedemptionsChannel;
  RealtimeChannel? _notificationsChannel;
  RealtimeChannel? _inventoryChannel;
  RealtimeChannel? _ordersChannel;
  RealtimeChannel? _orderItemsChannel;

  Timer? _landingRefreshDebounce;
  Timer? _sessionRefreshDebounce;
  bool _refreshingNotifications = false;
  bool _loadingInbox = false;
  bool _isDisposed = false;
  Future<void>? _rebindInFlight;
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

  void touchHomeRevision() {
    _homeRevision += 1;
    _safeNotify();
  }

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
      await refreshSyncBindings(reloadInbox: true);
      return;
    }

    await _unsubscribeAll();
    await refreshNotifications();
    _subscribeRealtime();
  }

  Future<void> refreshSyncBindings({bool reloadInbox = true}) async {
    final inFlight = _rebindInFlight;
    if (inFlight != null) {
      return inFlight;
    }

    final future = _refreshSyncBindingsNow(reloadInbox: reloadInbox);
    _rebindInFlight = future;
    try {
      await future;
    } finally {
      if (identical(_rebindInFlight, future)) {
        _rebindInFlight = null;
      }
    }
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
    } catch (error) {
      _debugLog(
        'CustomerNotificationsController.refresh failed: ${error.toString()}',
      );
    } finally {
      _refreshingNotifications = false;
      _loadingInbox = false;
      _safeNotify();
    }
  }

  Future<void> markAllRead() async {
    try {
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
    } catch (error) {
      _debugLog(
        'CustomerNotificationsController.markAllRead failed: ${error.toString()}',
      );
    }
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
      try {
        await notificationRepository.markAsRead([item.id]);
        await refreshNotifications();
      } catch (error) {
        _debugLog(
          'CustomerNotificationsController.markNotificationRead failed: ${error.toString()}',
        );
      }
    }
  }

  Future<void> _refreshSyncBindingsNow({required bool reloadInbox}) async {
    final session = _session;
    if (session == null) {
      return;
    }

    if (client != null) {
      await _unsubscribeAll();
      if (_session == session) {
        _subscribeRealtime();
      }
    }

    if (reloadInbox) {
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

    _customerProfileChannel = safeClient
        .channel('customer-profile-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customers',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: customerId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _queueSessionRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _salonProfileChannel = safeClient
        .channel('customer-salon-profile-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salons',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'id',
            value: salonId,
          ),
          callback: (_) {
            _homeRevision += 1;
            _queueLandingRefresh();
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
          callback: (_) {
            _feedRevision += 1;
            _homeRevision += 1;
            _queueLandingRefresh();
            _safeNotify();
          },
        )
        .subscribe();

    _birthdayCampaignChannel = safeClient
        .channel('customer-birthday-campaign-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_birthday_campaigns',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _homeRevision += 1;
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

    _staffMembersChannel = safeClient
        .channel('customer-staff-members-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'staff_members',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _agendaRevision += 1;
            _homeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _staffBlocksChannel = safeClient
        .channel('customer-staff-blocks-$salonId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'staff_blocks',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'salon_id',
            value: salonId,
          ),
          callback: (_) {
            _agendaRevision += 1;
            _homeRevision += 1;
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

    _referralEventsChannel = safeClient
        .channel('customer-referral-events-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_referral_events',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'referrer_customer_id',
            value: customerId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
            _safeNotify();
          },
        )
        .subscribe();

    _referralRewardUnlocksChannel = safeClient
        .channel('customer-referral-rewards-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'salon_referral_reward_unlocks',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'referrer_customer_id',
            value: customerId,
          ),
          callback: (_) {
            _benefitsRevision += 1;
            _homeRevision += 1;
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

    _membershipRequestsChannel = safeClient
        .channel('customer-membership-requests-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_membership_requests',
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

    _membershipRedemptionsChannel = safeClient
        .channel('customer-membership-redemptions-$customerId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'customer_membership_redemptions',
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

  void _queueSessionRefresh() {
    _sessionRefreshDebounce?.cancel();
    _sessionRefreshDebounce = Timer(const Duration(milliseconds: 420), () {
      unawaited(sessionController.refreshAuthenticatedSession());
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

    if (type.contains('service') ||
        type.contains('offer') ||
        type.contains('promotion') ||
        type.contains('campaign') ||
        type.contains('client_app') ||
        type.contains('branding') ||        type.contains('feed') ||
        type.contains('post') ||
        type.contains('store') ||
        type.contains('product') ||
        type.contains('vitrine')) {
      if (type.contains('service')) {
        _agendaRevision += 1;
      }
      if (type.contains('feed') ||
          type.contains('post')) {
        _feedRevision += 1;
      }
      if (type.contains('store') ||
          type.contains('product') ||
          type.contains('vitrine')) {
        _storeRevision += 1;
      }
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
    _sessionRefreshDebounce?.cancel();
    final safeClient = client;
    if (safeClient == null) {
      return;
    }

    final channels = <RealtimeChannel?>[
      _appointmentsChannel,
      _customerProfileChannel,
      _salonProfileChannel,
      _postsChannel,
      _birthdayCampaignChannel,      _servicesChannel,
      _staffMembersChannel,
      _staffBlocksChannel,
      _offersChannel,
      _referralsChannel,
      _referralEventsChannel,
      _referralRewardUnlocksChannel,
      _loyaltyProgramsChannel,
      _loyaltyTransactionsChannel,
      _membershipsChannel,
      _membershipRequestsChannel,
      _membershipRedemptionsChannel,
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
    _customerProfileChannel = null;
    _salonProfileChannel = null;
    _postsChannel = null;
    _birthdayCampaignChannel = null;    _servicesChannel = null;
    _staffMembersChannel = null;
    _staffBlocksChannel = null;
    _offersChannel = null;
    _referralsChannel = null;
    _referralEventsChannel = null;
    _referralRewardUnlocksChannel = null;
    _loyaltyProgramsChannel = null;
    _loyaltyTransactionsChannel = null;
    _membershipsChannel = null;
    _membershipRequestsChannel = null;
    _membershipRedemptionsChannel = null;
    _notificationsChannel = null;
    _inventoryChannel = null;
    _ordersChannel = null;
    _orderItemsChannel = null;
  }

  @override
  void dispose() {
    _isDisposed = true;
    _landingRefreshDebounce?.cancel();
    _sessionRefreshDebounce?.cancel();
    unawaited(_unsubscribeAll());
    super.dispose();
  }

  void _safeNotify() {
    if (_isDisposed) {
      return;
    }
    notifyListeners();
  }

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint(message);
    }
  }
}
