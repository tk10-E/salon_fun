import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'models/app_models.dart';
import 'repositories/salon_repository.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'screens/join_salon_screen.dart';
import 'screens/notification_alert_screen.dart';
import 'services/push_notification_service.dart';
import 'theme/salon_branding.dart';
import 'theme/salon_experience_preset.dart';
import 'widgets/branded_loading_view.dart';

class SalonClientApp extends StatefulWidget {
  const SalonClientApp({super.key});

  @override
  State<SalonClientApp> createState() => _SalonClientAppState();
}

class _SalonClientAppState extends State<SalonClientApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  StreamSubscription<NotificationTapPayload>? _notificationTapSubscription;
  String? _lastOpenedNotificationKey;
  CustomerProfile? _activeProfile;

  @override
  void initState() {
    super.initState();
    _notificationTapSubscription = PushNotificationService
        .instance
        .onNotificationTap
        .listen(_openNotificationAlert);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final initialTap = PushNotificationService.instance.consumeInitialTap();
      if (initialTap != null) {
        _openNotificationAlert(initialTap);
      }
    });
  }

  @override
  void dispose() {
    unawaited(_notificationTapSubscription?.cancel());
    super.dispose();
  }

  void _openNotificationAlert(NotificationTapPayload payload) {
    if (_lastOpenedNotificationKey == payload.dedupeKey) {
      return;
    }

    _lastOpenedNotificationKey = payload.dedupeKey;
    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      return;
    }

    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => NotificationAlertScreen(notification: payload),
      ),
    );
  }

  void _handleActiveProfileChanged(CustomerProfile? profile) {
    if (_sameBrandingProfile(_activeProfile, profile)) {
      return;
    }

    setState(() => _activeProfile = profile);
  }

  ThemeData _buildTheme(SalonBranding branding) {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: branding.primary,
          brightness: Brightness.light,
        ).copyWith(
          primary: branding.primary,
          secondary: branding.primary,
          surface: Colors.white,
          onSurface: branding.deep,
        );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: Color.lerp(branding.surface, Colors.white, 0.35),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: branding.deep,
        contentTextStyle: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Color.lerp(branding.surface, Colors.white, 0.34),
        foregroundColor: branding.deep,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleTextStyle: TextStyle(
          color: branding.deep,
          fontSize: 24,
          fontWeight: FontWeight.w800,
        ),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: branding.outline.withValues(alpha: 0.72)),
        ),
      ),
      tabBarTheme: TabBarThemeData(
        dividerColor: Colors.transparent,
        indicatorColor: branding.primary,
        labelColor: branding.deep,
        unselectedLabelColor: branding.mutedText,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: branding.primary,
          foregroundColor: branding.onPrimary,
          disabledBackgroundColor: branding.outline.withValues(alpha: 0.88),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
          minimumSize: const Size.fromHeight(54),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: branding.deep,
          side: BorderSide(color: branding.outline.withValues(alpha: 0.9)),
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      chipTheme: ThemeData.light(useMaterial3: true).chipTheme.copyWith(
        backgroundColor: Colors.white,
        selectedColor: branding.chipBackground,
        side: BorderSide(color: branding.outline.withValues(alpha: 0.84)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        labelStyle: TextStyle(
          color: branding.deep,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white.withValues(alpha: 0.92),
        labelStyle: TextStyle(color: branding.mutedText),
        floatingLabelStyle: TextStyle(
          color: branding.primary,
          fontWeight: FontWeight.w700,
        ),
        hintStyle: TextStyle(color: branding.mutedText.withValues(alpha: 0.62)),
        prefixIconColor: branding.mutedText.withValues(alpha: 0.82),
        suffixIconColor: branding.mutedText.withValues(alpha: 0.82),
        errorStyle: const TextStyle(fontWeight: FontWeight.w600, height: 1.3),
        errorMaxLines: 2,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(
            color: branding.outline.withValues(alpha: 0.8),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(
            color: branding.outline.withValues(alpha: 0.8),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: branding.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFD5655A), width: 1.2),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Color(0xFFC94D43), width: 1.6),
        ),
      ),
      textTheme: ThemeData.light(useMaterial3: true).textTheme.copyWith(
        headlineMedium: TextStyle(
          color: branding.deep,
          fontSize: 34,
          height: 1.02,
          fontWeight: FontWeight.w800,
        ),
        headlineSmall: TextStyle(
          color: branding.deep,
          fontSize: 28,
          height: 1.05,
          fontWeight: FontWeight.w800,
        ),
        titleLarge: TextStyle(
          color: branding.deep,
          fontSize: 22,
          fontWeight: FontWeight.w800,
        ),
        titleMedium: TextStyle(
          color: branding.deep,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        bodyLarge: TextStyle(
          color: branding.mutedText,
          fontSize: 16,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          color: branding.mutedText,
          fontSize: 14,
          height: 1.45,
        ),
        labelLarge: TextStyle(
          color: branding.deep,
          fontSize: 13,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.4,
        ),
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
          );

    return MaterialApp(
      title: _activeProfile?.salonName ?? 'Salon Fun',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      theme: _buildTheme(activeBranding),
      home: _SessionGate(onActiveProfileChanged: _handleActiveProfileChanged),
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
      left.salonTagline == right.salonTagline;
}

class _SessionGate extends StatefulWidget {
  const _SessionGate({required this.onActiveProfileChanged});

  final ValueChanged<CustomerProfile?> onActiveProfileChanged;

  @override
  State<_SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<_SessionGate> {
  late final SalonRepository _repository = SalonRepository(
    Supabase.instance.client,
  );
  CustomerProfile? _reportedProfile;

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

        return _CustomerGate(
          repository: _repository,
          onActiveProfileChanged: _reportActiveProfile,
        );
      },
    );
  }
}

class _CustomerGate extends StatefulWidget {
  const _CustomerGate({
    required this.repository,
    required this.onActiveProfileChanged,
  });

  final SalonRepository repository;
  final ValueChanged<CustomerProfile?> onActiveProfileChanged;

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
