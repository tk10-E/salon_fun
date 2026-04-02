import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/salon_repository.dart';
import 'models/app_models.dart';
import 'screens/auth_screen.dart';
import 'screens/client_shell_screen.dart';
import 'screens/join_salon_screen.dart';
import 'screens/notifications_screen.dart';
import 'services/push_notification_service.dart';
import 'services/push_token_sync_service.dart';
import 'theme/app_theme.dart';
import 'widgets/premium_ui.dart';

class SalonClientApp extends StatefulWidget {
  const SalonClientApp({super.key});

  @override
  State<SalonClientApp> createState() => _SalonClientAppState();
}

class _SalonClientAppState extends State<SalonClientApp> {
  late final SalonRepository _repository = SalonRepository(
    Supabase.instance.client,
  );
  late final PushNotificationService _pushNotifications;
  PushTokenSyncService? _pushTokenSync;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  StreamSubscription<AuthState>? _authSubscription;
  StreamSubscription<NotificationTapPayload>? _pushTapSubscription;
  CustomerProfile? _profile;
  NotificationTapPayload? _pendingNotificationTap;
  bool _isResolvingSession = true;
  bool _showLaunchVeil = true;

  @override
  void initState() {
    super.initState();
    _pushNotifications = PushNotificationService.instance;
    _authSubscription = _repository.authChanges.listen((_) {
      unawaited(_resolveSession());
    });
    _pushTapSubscription = _pushNotifications.onNotificationTap.listen((
      payload,
    ) {
      unawaited(_handleNotificationTap(payload));
    });
    unawaited(_initializePushExperience());
    unawaited(_resolveSession());
    Future<void>.delayed(const Duration(milliseconds: 1450), () async {
      if (!mounted) {
        return;
      }

      setState(() => _showLaunchVeil = false);
    });
  }

  @override
  void dispose() {
    unawaited(_authSubscription?.cancel());
    unawaited(_pushTapSubscription?.cancel());
    unawaited(_pushTokenSync?.dispose());
    super.dispose();
  }

  Future<void> _initializePushExperience() async {
    await _pushNotifications.initialize();
    final initialTap = _pushNotifications.consumeInitialTap();
    if (initialTap != null) {
      await _handleNotificationTap(initialTap);
    }
  }

  Future<void> _resolveSession() async {
    if (!mounted) {
      return;
    }

    setState(() => _isResolvingSession = true);
    await _repository.bootstrapAuthSession();
    final nextProfile = await _repository.getCustomerProfile();
    if (!mounted) {
      return;
    }

    setState(() {
      _profile = nextProfile;
      _isResolvingSession = false;
    });

    unawaited(_syncPushLifecycle());
  }

  Future<void> _signOutAndReload() async {
    await _pushTokenSync?.deactivateCurrentToken();
    await _pushTokenSync?.dispose();
    _pushTokenSync = null;
    await _repository.signOut();
    await _resolveSession();
  }

  void _handleProfileChanged(CustomerProfile profile) {
    setState(() {
      _profile = profile;
    });

    unawaited(_syncPushLifecycle());
  }

  Future<void> _syncPushLifecycle() async {
    if (_repository.currentUser == null || _profile == null) {
      await _pushTokenSync?.dispose();
      _pushTokenSync = null;
      return;
    }

    _pushTokenSync ??= PushTokenSyncService(
      registerPushToken: _repository.registerPushToken,
      deactivatePushToken: _repository.deactivatePushToken,
      pushService: _pushNotifications,
    );
    await _pushTokenSync!.start();
    _drainPendingNotificationTap();
  }

  Future<void> _handleNotificationTap(NotificationTapPayload payload) async {
    if (_repository.currentUser == null || _profile == null) {
      _pendingNotificationTap = payload;
      return;
    }

    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      _pendingNotificationTap = payload;
      return;
    }

    _pendingNotificationTap = null;
    await navigator.push<void>(
      MaterialPageRoute(
        builder: (_) => NotificationsScreen(repository: _repository),
      ),
    );
  }

  void _drainPendingNotificationTap() {
    final pending = _pendingNotificationTap;
    if (pending == null) {
      return;
    }

    _pendingNotificationTap = null;
    unawaited(_handleNotificationTap(pending));
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: _profile?.salonName ?? 'Salon Fun',
      debugShowCheckedModeBanner: false,
      theme: buildSalonTheme(_profile),
      navigatorKey: _navigatorKey,
      home: Stack(
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 520),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeOutCubic,
            transitionBuilder: (child, animation) {
              final offset =
                  Tween<Offset>(
                    begin: const Offset(0, 0.03),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: animation,
                      curve: Curves.easeOutCubic,
                    ),
                  );

              return FadeTransition(
                opacity: animation,
                child: SlideTransition(position: offset, child: child),
              );
            },
            child: KeyedSubtree(
              key: ValueKey<String>(_routeIdentity()),
              child: _buildHome(),
            ),
          ),
          IgnorePointer(
            ignoring: !_showLaunchVeil,
            child: AnimatedOpacity(
              opacity: _showLaunchVeil ? 1 : 0,
              duration: const Duration(milliseconds: 520),
              curve: Curves.easeOutCubic,
              child: ExperienceVeil(title: _profile?.salonName ?? 'Salon Fun'),
            ),
          ),
        ],
      ),
    );
  }

  String _routeIdentity() {
    if (_isResolvingSession) {
      return 'loading';
    }
    if (_repository.currentUser == null) {
      return 'auth';
    }
    if (_profile == null) {
      return 'join';
    }

    return 'shell:${_profile!.id}';
  }

  Widget _buildHome() {
    if (_isResolvingSession) {
      return const Scaffold(
        backgroundColor: Colors.transparent,
        body: PremiumBackground(
          padding: EdgeInsets.all(24),
          child: LoadingView(),
        ),
      );
    }

    if (_repository.currentUser == null) {
      return AuthScreen(repository: _repository);
    }

    if (_profile == null) {
      return JoinSalonScreen(
        repository: _repository,
        onJoined: _resolveSession,
        onSignOutRequested: _signOutAndReload,
      );
    }

    return ClientShellScreen(
      repository: _repository,
      profile: _profile!,
      onProfileChanged: _handleProfileChanged,
      onSignOutRequested: _signOutAndReload,
    );
  }
}
