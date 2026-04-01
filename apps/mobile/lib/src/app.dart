import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/app_models.dart';
import 'navigation/salon_page_route.dart';
import 'repositories/salon_repository.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/join_salon_screen.dart';
import 'screens/notification_alert_screen.dart';
import 'screens/password_recovery_screen.dart';
import 'services/app_link_service.dart';
import 'services/app_analytics_service.dart';
import 'services/push_notification_service.dart';
import 'features/retention_v1/domain/retention_v1_models.dart';
import 'theme/salon_brand_config.dart';
import 'theme/salon_branding.dart';
import 'theme/salon_experience_preset.dart';
import 'theme/tenant_theme.dart';
import 'widgets/branded_loading_view.dart';
import 'widgets/launch_experience_overlay.dart';

class SalonClientApp extends StatefulWidget {
  const SalonClientApp({super.key});

  @override
  State<SalonClientApp> createState() => _SalonClientAppState();
}

class _SalonClientAppState extends State<SalonClientApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  StreamSubscription<SalonAppLink>? _appLinkSubscription;
  StreamSubscription<NotificationTapPayload>? _notificationTapSubscription;
  String? _lastOpenedNotificationKey;
  CustomerProfile? _activeProfile;
  String? _pendingJoinCode;
  SalonAppAuthAction? _pendingAuthAction;

  @override
  void initState() {
    super.initState();
    _appLinkSubscription = AppLinkService.instance.linkStream.listen(
      _handleIncomingAppLink,
    );
    _notificationTapSubscription = PushNotificationService
        .instance
        .onNotificationTap
        .listen(_openNotificationAlert);

    unawaited(_consumeInitialAppLink());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final initialTap = PushNotificationService.instance.consumeInitialTap();
      if (initialTap != null) {
        _openNotificationAlert(initialTap);
      }
    });
  }

  @override
  void dispose() {
    unawaited(_appLinkSubscription?.cancel());
    unawaited(_notificationTapSubscription?.cancel());
    super.dispose();
  }

  Future<void> _consumeInitialAppLink() async {
    final initialLink = await AppLinkService.instance.getInitialLink();
    if (initialLink == null || !mounted) {
      return;
    }

    _handleIncomingAppLink(initialLink);
  }

  void _handleIncomingAppLink(SalonAppLink link) {
    final authAction = link.authAction;
    if (authAction != null) {
      if (_pendingAuthAction == authAction) {
        return;
      }

      setState(() => _pendingAuthAction = authAction);
      return;
    }

    final joinCode = link.joinCode;
    if (joinCode == null ||
        _activeProfile != null ||
        _pendingJoinCode == joinCode) {
      return;
    }

    setState(() => _pendingJoinCode = joinCode);
  }

  void _handleJoinCodeConsumed(String joinCode) {
    if (_pendingJoinCode != joinCode) {
      return;
    }

    setState(() => _pendingJoinCode = null);
  }

  void _handleAuthActionConsumed(SalonAppAuthAction action) {
    if (_pendingAuthAction != action) {
      return;
    }

    setState(() => _pendingAuthAction = null);
  }

  void _openNotificationAlert(NotificationTapPayload payload) {
    if (_lastOpenedNotificationKey == payload.dedupeKey) {
      return;
    }

    final retentionPushType = RetentionV1PushType.fromNotificationType(
      payload.type,
    );
    if (retentionPushType != null) {
      unawaited(
        FirebaseAppAnalyticsService.instance.trackEvent('push_opened', {
          'source': 'retention_v1',
          'push_type': retentionPushType.name,
          'notification_type': payload.type,
        }),
      );
    }

    _lastOpenedNotificationKey = payload.dedupeKey;
    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      return;
    }

    navigator.push(
      SalonPageRoute<void>(
        builder: (_) => NotificationAlertScreen(notification: payload),
      ),
    );
  }

  void _handleActiveProfileChanged(CustomerProfile? profile) {
    if (_sameBrandingProfile(_activeProfile, profile)) {
      return;
    }

    unawaited(FirebaseAppAnalyticsService.instance.identifyCustomer(profile));
    setState(() => _activeProfile = profile);
  }

  ThemeData _buildTheme(SalonBranding branding, SalonBrandConfig brandConfig) {
    return PremiumTenantTheme.buildTheme(
      branding: branding,
      brand: brandConfig,
    ).copyWith(
      splashFactory: InkSparkle.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: _SalonPageTransitionsBuilder(),
          TargetPlatform.iOS: _SalonPageTransitionsBuilder(),
          TargetPlatform.macOS: _SalonPageTransitionsBuilder(),
          TargetPlatform.windows: _SalonPageTransitionsBuilder(),
          TargetPlatform.linux: _SalonPageTransitionsBuilder(),
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeBranding = _activeProfile == null
        ? SalonBranding.fromName('Salon Fun', overrideHexColor: '#C56B43')
        : SalonBranding.fromName(
            _activeProfile!.salonName,
            overrideHexColor: _activeProfile!.salonBrandColor,
            businessSegment: _activeProfile!.salonBusinessSegment,
            clientAppConfig: _activeProfile!.salonClientAppConfig,
          );
    final activeBrandConfig = _activeProfile == null
        ? SalonBrandConfig.fromProfile(
            const CustomerProfile(
              id: 'preview',
              name: 'Cliente',
              salonId: 'preview-salon',
              salonName: 'Salon Fun',
              salonTagline: 'Experiencia premium para saloes autorais.',
              salonBrandColor: '#C56B43',
            ),
          )
        : SalonBrandConfig.fromProfile(_activeProfile!);

    return MaterialApp(
      title: _activeProfile?.salonName ?? 'Salon Fun',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      theme: _buildTheme(activeBranding, activeBrandConfig),
      themeAnimationCurve: Curves.easeOutCubic,
      themeAnimationDuration: const Duration(milliseconds: 220),
      builder: (context, child) {
        final isDarkShell = activeBrandConfig.isDarkShell;
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value:
              (isDarkShell
                      ? SystemUiOverlayStyle.light
                      : SystemUiOverlayStyle.dark)
                  .copyWith(
                    statusBarColor: Colors.transparent,
                    systemNavigationBarColor: isDarkShell
                        ? const Color(0xFF18110E)
                        : const Color(0xFFFDF7F1),
                    systemNavigationBarIconBrightness: isDarkShell
                        ? Brightness.light
                        : Brightness.dark,
                  ),
          child: child ?? const SizedBox.shrink(),
        );
      },
      home: LaunchExperienceOverlay(
        branding: activeBranding,
        logoUrl: _activeProfile?.salonLogoUrl,
        salonName: _activeProfile?.salonName ?? 'Salon Fun',
        child: _SessionGate(
          onActiveProfileChanged: _handleActiveProfileChanged,
          pendingJoinCode: _pendingJoinCode,
          onJoinCodeConsumed: _handleJoinCodeConsumed,
          pendingAuthAction: _pendingAuthAction,
          onAuthActionConsumed: _handleAuthActionConsumed,
        ),
      ),
    );
  }
}

class _SalonPageTransitionsBuilder extends PageTransitionsBuilder {
  const _SalonPageTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (route.fullscreenDialog) {
      return child;
    }

    final curve = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutQuart,
      reverseCurve: Curves.easeInCubic,
    );

    return FadeTransition(
      opacity: Tween<double>(begin: 0.82, end: 1).animate(curve),
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0.04, 0.028),
          end: Offset.zero,
        ).animate(curve),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.985, end: 1).animate(curve),
          child: child,
        ),
      ),
    );
  }
}

bool _sameBrandingProfile(CustomerProfile? left, CustomerProfile? right) {
  if (identical(left, right)) {
    return true;
  }

  if (left == null || right == null) {
    return left == right;
  }

  return left.salonId == right.salonId &&
      left.salonName == right.salonName &&
      left.salonBrandColor == right.salonBrandColor &&
      normalizeSalonBusinessSegment(left.salonBusinessSegment) ==
          normalizeSalonBusinessSegment(right.salonBusinessSegment) &&
      left.salonLogoUrl == right.salonLogoUrl &&
      left.salonTagline == right.salonTagline &&
      left.salonClientAppConfig?.rawConfig.toString() ==
          right.salonClientAppConfig?.rawConfig.toString();
}

class _SessionGate extends StatefulWidget {
  const _SessionGate({
    required this.onActiveProfileChanged,
    required this.pendingJoinCode,
    required this.onJoinCodeConsumed,
    required this.pendingAuthAction,
    required this.onAuthActionConsumed,
  });

  final ValueChanged<CustomerProfile?> onActiveProfileChanged;
  final String? pendingJoinCode;
  final ValueChanged<String> onJoinCodeConsumed;
  final SalonAppAuthAction? pendingAuthAction;
  final ValueChanged<SalonAppAuthAction> onAuthActionConsumed;

  @override
  State<_SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<_SessionGate> {
  late final SalonRepository _repository = SalonRepository(
    Supabase.instance.client,
  );
  CustomerProfile? _reportedProfile;
  StreamSubscription<AuthState>? _authSubscription;
  bool _passwordRecoveryActive = false;

  @override
  void initState() {
    super.initState();
    _passwordRecoveryActive =
        widget.pendingAuthAction == SalonAppAuthAction.passwordRecovery;
    _authSubscription = _repository.authChanges.listen((state) {
      if (!mounted) {
        return;
      }

      switch (state.event) {
        case AuthChangeEvent.passwordRecovery:
          setState(() => _passwordRecoveryActive = true);
          widget.onAuthActionConsumed(SalonAppAuthAction.passwordRecovery);
          return;
        case AuthChangeEvent.signedOut:
          if (_passwordRecoveryActive) {
            setState(() => _passwordRecoveryActive = false);
          }
          return;
        default:
          return;
      }
    });
  }

  @override
  void didUpdateWidget(covariant _SessionGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.pendingAuthAction == SalonAppAuthAction.passwordRecovery &&
        oldWidget.pendingAuthAction != widget.pendingAuthAction &&
        !_passwordRecoveryActive) {
      setState(() => _passwordRecoveryActive = true);
    }
  }

  @override
  void dispose() {
    unawaited(_authSubscription?.cancel());
    super.dispose();
  }

  void _reportActiveProfile(CustomerProfile? profile) {
    if (_sameBrandingProfile(_reportedProfile, profile)) {
      return;
    }

    _reportedProfile = profile;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      widget.onActiveProfileChanged(profile);
    });
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: _repository.authChanges,
      initialData: AuthState(
        AuthChangeEvent.initialSession,
        Supabase.instance.client.auth.currentSession,
      ),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const BrandedLoadingView(
            title: 'Conectando sua conta',
            message: 'Aguarde um instante enquanto verificamos seu acesso.',
          );
        }

        if (_repository.currentUser == null) {
          _reportActiveProfile(null);
          return AuthScreen(repository: _repository);
        }

        if (_passwordRecoveryActive) {
          _reportActiveProfile(null);
          return PasswordRecoveryScreen(
            repository: _repository,
            onCompleted: () async {
              if (!mounted) {
                return;
              }

              setState(() => _passwordRecoveryActive = false);
              widget.onAuthActionConsumed(SalonAppAuthAction.passwordRecovery);
            },
            onCancel: () async {
              await _repository.signOut();
              if (!mounted) {
                return;
              }

              setState(() => _passwordRecoveryActive = false);
              widget.onAuthActionConsumed(SalonAppAuthAction.passwordRecovery);
            },
          );
        }

        return _CustomerGate(
          repository: _repository,
          onActiveProfileChanged: _reportActiveProfile,
          pendingJoinCode: widget.pendingJoinCode,
          onJoinCodeConsumed: widget.onJoinCodeConsumed,
        );
      },
    );
  }
}

class _CustomerGate extends StatefulWidget {
  const _CustomerGate({
    required this.repository,
    required this.onActiveProfileChanged,
    required this.pendingJoinCode,
    required this.onJoinCodeConsumed,
  });

  final SalonRepository repository;
  final ValueChanged<CustomerProfile?> onActiveProfileChanged;
  final String? pendingJoinCode;
  final ValueChanged<String> onJoinCodeConsumed;

  @override
  State<_CustomerGate> createState() => _CustomerGateState();
}

class _CustomerGateState extends State<_CustomerGate> {
  late Future<CustomerProfile?> _profileFuture;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  void _loadProfile() {
    _profileFuture = widget.repository.getCustomerProfile();
  }

  Future<void> _refreshProfile() async {
    setState(_loadProfile);
    await _profileFuture;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<CustomerProfile?>(
      future: _profileFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const BrandedLoadingView(
            title: 'Buscando seus dados',
            message: 'Estamos localizando seu salão e seu histórico.',
          );
        }

        final profile = snapshot.data;

        if (profile == null) {
          widget.onActiveProfileChanged(null);
          return JoinSalonScreen(
            repository: widget.repository,
            onJoined: _refreshProfile,
            initialJoinCode: widget.pendingJoinCode,
            onInitialJoinCodeConsumed: widget.onJoinCodeConsumed,
          );
        }

        widget.onActiveProfileChanged(profile);
        return HomeScreen(
          repository: widget.repository,
          profile: profile,
          onActiveProfileChanged: widget.onActiveProfileChanged,
        );
      },
    );
  }
}
