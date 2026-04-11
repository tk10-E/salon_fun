import 'dart:async';

import 'package:flutter/material.dart';

import '../../bootstrap/app_bootstrap.dart';
import '../../core/theme/app_theme.dart';
import '../agenda/agenda_page.dart';
import '../auth/session_controller.dart';
import '../feed/feed_page.dart';
import '../notifications/customer_notifications_controller.dart';
import '../notifications/notification_navigation.dart';
import '../notifications/notifications_page.dart';
import '../profile/profile_page.dart';
import '../store/store_page.dart';
import 'home_dashboard_page.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.bootstrap,
    required this.sessionController,
  });

  final AppBootstrap bootstrap;
  final SessionController sessionController;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  static const double _overlayClearance = 84;

  int _currentIndex = 0;
  late final CustomerNotificationsController _notificationsController;
  StreamSubscription<NotificationNavigationIntent>?
  _notificationOpenSubscription;
  bool _isNotificationsRouteOpen = false;

  @override
  void initState() {
    super.initState();
    _notificationsController = CustomerNotificationsController(
      client: widget.bootstrap.supabaseClient,
      sessionController: widget.sessionController,
      notificationRepository: widget.bootstrap.notificationRepository,
    );
    _notificationsController.bindSession(widget.sessionController.session!);
    _bindNotificationOpenStream();
  }

  @override
  void didUpdateWidget(covariant HomeShell oldWidget) {
    super.didUpdateWidget(oldWidget);
    final session = widget.sessionController.session;
    if (session != null) {
      _notificationsController.bindSession(session);
    }

    if (oldWidget.bootstrap.deviceNotificationService !=
        widget.bootstrap.deviceNotificationService) {
      _bindNotificationOpenStream();
    }
  }

  @override
  void dispose() {
    unawaited(_notificationOpenSubscription?.cancel());
    _notificationsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.sessionController.session!;
    final preview = session.landingData?.preview;
    final pages = <Widget>[
      HomeDashboardPage(
        bootstrap: widget.bootstrap,
        sessionController: widget.sessionController,
        notificationsController: _notificationsController,
        onNavigate: _setTab,
      ),
      AgendaPage(
        bookingRepository: widget.bootstrap.bookingRepository,
        notificationsController: _notificationsController,
        session: session,
      ),
      StorePage(
        storeRepository: widget.bootstrap.storeRepository,
        notificationsController: _notificationsController,
        session: session,
      ),
      FeedPage(
        feedRepository: widget.bootstrap.feedRepository,
        notificationsController: _notificationsController,
        session: session,
      ),
      ProfilePage(
        bootstrap: widget.bootstrap,
        notificationsController: _notificationsController,
        session: session,
      ),
    ];

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.only(top: _overlayClearance),
              child: IndexedStack(index: _currentIndex, children: pages),
            ),
          ),
          Positioned(
            top: 12,
            right: 16,
            child: SafeArea(
              child: AnimatedBuilder(
                animation: _notificationsController,
                builder: (context, _) {
                  final unreadCount = _notificationsController.unreadCount;
                  return Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(20),
                      onTap: _openNotifications,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 11,
                        ),
                        decoration: BoxDecoration(
                          color: Theme.of(
                            context,
                          ).colorScheme.surface.withValues(alpha: 0.94),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: AppTheme.spec(context).lineColor,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 20,
                              offset: Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                const Icon(Icons.notifications_none_rounded),
                                if (unreadCount > 0)
                                  Positioned(
                                    top: -6,
                                    right: -8,
                                    child: Container(
                                      constraints: const BoxConstraints(
                                        minWidth: 18,
                                        minHeight: 18,
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppTheme.spec(
                                          context,
                                        ).primaryColor,
                                        shape: BoxShape.circle,
                                      ),
                                      alignment: Alignment.center,
                                      child: Text(
                                        unreadCount > 9 ? '9+' : '$unreadCount',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(width: 10),
                            const Text('Avisos'),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _setTab,
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Início',
            ),
            const NavigationDestination(
              icon: Icon(Icons.calendar_month_outlined),
              selectedIcon: Icon(Icons.calendar_month_rounded),
              label: 'Agenda',
            ),
            NavigationDestination(
              icon: _StoreBrandIcon(
                imageUrl: preview?.logoUrl,
                selected: false,
              ),
              selectedIcon: _StoreBrandIcon(
                imageUrl: preview?.logoUrl,
                selected: true,
              ),
              label: 'Loja',
            ),
            const NavigationDestination(
              icon: Icon(Icons.slideshow_outlined),
              selectedIcon: Icon(Icons.slideshow_rounded),
              label: 'Feed',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded),
              label: 'Perfil',
            ),
          ],
        ),
      ),
    );
  }

  void _setTab(int index) {
    setState(() => _currentIndex = index);
  }

  Future<void> _openNotifications() async {
    if (_isNotificationsRouteOpen) {
      return;
    }

    _isNotificationsRouteOpen = true;
    try {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (context) => NotificationsPage(
            controller: _notificationsController,
            onNavigate: _setTab,
          ),
        ),
      );
    } finally {
      _isNotificationsRouteOpen = false;
    }
  }

  void _bindNotificationOpenStream() {
    unawaited(_notificationOpenSubscription?.cancel());
    _notificationOpenSubscription = widget
        .bootstrap
        .deviceNotificationService
        .notificationOpenStream
        .listen(_handleNotificationOpenIntent);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      final pendingIntent = widget.bootstrap.deviceNotificationService
          .takePendingNotificationIntent();
      if (pendingIntent != null) {
        _handleNotificationOpenIntent(pendingIntent);
      }
    });
  }

  void _handleNotificationOpenIntent(NotificationNavigationIntent intent) {
    if (!mounted) {
      return;
    }

    if (_currentIndex != intent.targetTabIndex) {
      setState(() => _currentIndex = intent.targetTabIndex);
    }

    if (!intent.openInbox) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      unawaited(_openNotifications());
    });
  }
}

class _StoreBrandIcon extends StatelessWidget {
  const _StoreBrandIcon({required this.imageUrl, required this.selected});

  final String? imageUrl;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    if (imageUrl == null || imageUrl!.trim().isEmpty) {
      return Icon(
        selected ? Icons.storefront_rounded : Icons.storefront_outlined,
      );
    }

    return Container(
      width: 28,
      height: 28,
      padding: const EdgeInsets.all(1.5),
      decoration: BoxDecoration(
        color: spec.panelColor,
        borderRadius: BorderRadius.circular(selected ? 10 : 9),
        border: Border.all(
          color: selected
              ? spec.primaryColor.withValues(alpha: 0.7)
              : spec.lineColor,
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(selected ? 8 : 7),
        child: Image.network(
          imageUrl!,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Icon(
              selected ? Icons.storefront_rounded : Icons.storefront_outlined,
              size: 18,
              color: selected ? spec.primaryColor : spec.mutedInkColor,
            );
          },
        ),
      ),
    );
  }
}
