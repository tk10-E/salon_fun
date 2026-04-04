import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/notification_destination.dart';
import 'data/salon_repository.dart';
import 'models/app_models.dart';
import 'screens/auth_screen.dart';
import 'screens/client_shell_screen.dart';
import 'screens/join_salon_screen.dart';
import 'services/app_analytics_service.dart';
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
  final AppAnalyticsService _analytics = AppAnalyticsService.instance;
  PushTokenSyncService? _pushTokenSync;
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  final GlobalKey<ClientShellScreenState> _shellKey =
      GlobalKey<ClientShellScreenState>();
  StreamSubscription<AuthState>? _authSubscription;
  StreamSubscription<NotificationTapPayload>? _pushTapSubscription;
  CustomerProfile? _profile;
  NotificationTapPayload? _pendingNotificationTap;
  bool _isResolvingSession = true;
  bool _showLaunchVeil = true;
  Future<void>? _sessionResolutionInFlight;
  bool _sessionResolutionQueued = false;
  String? _lastTrackedSurface;

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
    if (_sessionResolutionInFlight != null) {
      _sessionResolutionQueued = true;
      return _sessionResolutionInFlight!;
    }

    final completer = Completer<void>();
    _sessionResolutionInFlight = completer.future;

    try {
      do {
        _sessionResolutionQueued = false;
        await _resolveSessionOnce();
      } while (_sessionResolutionQueued && mounted);
      completer.complete();
    } catch (error, stackTrace) {
      completer.completeError(error, stackTrace);
      rethrow;
    } finally {
      _sessionResolutionInFlight = null;
    }
  }

  Future<void> _resolveSessionOnce() async {
    if (!mounted) {
      return;
    }

    setState(() => _isResolvingSession = true);

    try {
      await _repository.bootstrapAuthSession();
      final nextProfile = await _repository.getCustomerProfile();
      final fallbackProfile = _repository.currentUser != null ? _profile : null;
      if (!mounted) {
        return;
      }

      setState(() {
        _profile = nextProfile ?? fallbackProfile;
        _isResolvingSession = false;
      });

      unawaited(_syncPushLifecycle());
      unawaited(_syncAnalyticsContext());
      _trackTopLevelSurface();
    } catch (error, stackTrace) {
      debugPrint('Session resolution failed: $error');
      debugPrintStack(stackTrace: stackTrace);

      if (!mounted) {
        return;
      }

      final fallbackProfile = _repository.currentUser != null ? _profile : null;
      setState(() {
        _profile = fallbackProfile;
        _isResolvingSession = false;
      });

      unawaited(_syncAnalyticsContext());
      _trackTopLevelSurface();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_resolveSessionErrorMessage(error))),
      );
    }
  }

  String _resolveSessionErrorMessage(Object error) {
    final message = error.toString().trim();
    if (message.startsWith('Bad state: ')) {
      return message.substring('Bad state: '.length).trim();
    }
    if (message.isEmpty) {
      return 'Nao foi possivel carregar sua sessao agora.';
    }

    return message;
  }

  Future<void> _signOutAndReload() async {
    await _pushTokenSync?.deactivateCurrentToken();
    await _pushTokenSync?.dispose();
    _pushTokenSync = null;
    await _repository.signOut();
    await _resolveSession();
  }

  Future<void> _handleJoinedProfile(CustomerProfile profile) async {
    if (!mounted) {
      return;
    }

    setState(() {
      _profile = profile;
      _isResolvingSession = false;
    });

    unawaited(_syncPushLifecycle());
    unawaited(_analytics.logJoinSalonCompleted(salonId: profile.salonId));
    unawaited(_syncAnalyticsContext());
    _trackTopLevelSurface();
    unawaited(_resolveSession());
  }

  void _handleProfileChanged(CustomerProfile profile) {
    setState(() {
      _profile = profile;
    });

    unawaited(_syncPushLifecycle());
    unawaited(_syncAnalyticsContext());
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

    final destination = resolveNotificationDestination(payload.type);
    await _analytics.logNotificationOpened(
      type: payload.type,
      target: destination.analyticsTarget,
    );

    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      _pendingNotificationTap = payload;
      return;
    }

    navigator.popUntil((route) => route.isFirst);
    await Future<void>.delayed(Duration.zero);

    final shellState = _shellKey.currentState;
    if (shellState == null) {
      _pendingNotificationTap = payload;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _drainPendingNotificationTap();
        }
      });
      return;
    }

    _pendingNotificationTap = null;
    if (destination.opensNotificationsCenter) {
      await shellState.openNotificationsCenter();
      return;
    }

    shellState.navigateToTab(destination.tabIndex!);
    if (!mounted || destination.feedbackMessage == null) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(destination.feedbackMessage!)),
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      _trackTopLevelSurface();
      if (_pendingNotificationTap != null &&
          _repository.currentUser != null &&
          _profile != null) {
        _drainPendingNotificationTap();
      }
    });

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
        onJoined: _handleJoinedProfile,
        onSignOutRequested: _signOutAndReload,
      );
    }

    return ClientShellScreen(
      key: _shellKey,
      repository: _repository,
      profile: _profile!,
      onProfileChanged: _handleProfileChanged,
      onSignOutRequested: _signOutAndReload,
    );
  }

  Future<void> _syncAnalyticsContext() async {
    final user = _repository.currentUser;
    final profile = _profile;

    if (user == null || profile == null) {
      await _analytics.clearUserContext();
      return;
    }

    await _analytics.setUserContext(
      userId: user.id,
      salonId: profile.salonId,
      salonName: profile.salonName,
    );
  }

  void _trackTopLevelSurface() {
    final surface = switch (_routeIdentity()) {
      'loading' => 'client_loading',
      'auth' => 'client_auth',
      'join' => 'client_join_salon',
      _ => 'client_shell',
    };

    if (_lastTrackedSurface == surface) {
      return;
    }

    _lastTrackedSurface = surface;
    unawaited(_analytics.logScreenView(surface));
  }
}
