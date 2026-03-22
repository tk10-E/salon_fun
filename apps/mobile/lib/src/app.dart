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

  @override
  void initState() {
    super.initState();
    _notificationTapSubscription = PushNotificationService.instance
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

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFFC56B43),
      brightness: Brightness.light,
    );

    return MaterialApp(
      title: 'Salon Fun',
      debugShowCheckedModeBanner: false,
      navigatorKey: _navigatorKey,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: colorScheme,
        scaffoldBackgroundColor: const Color(0xFFF6F0E8),
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          backgroundColor: const Color(0xFF2F231C),
          contentTextStyle: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF6F0E8),
          foregroundColor: Color(0xFF3D271B),
          elevation: 0,
          scrolledUnderElevation: 0,
          titleTextStyle: TextStyle(
            color: Color(0xFF3D271B),
            fontSize: 24,
            fontWeight: FontWeight.w800,
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFFE3D5C7)),
          ),
        ),
        tabBarTheme: const TabBarThemeData(
          dividerColor: Colors.transparent,
          indicatorColor: Color(0xFFC56B43),
          labelColor: Color(0xFF3D271B),
          unselectedLabelColor: Color(0xFF876F5F),
          labelStyle: TextStyle(fontWeight: FontWeight.w700),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFC56B43),
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFFD8C1AF),
            textStyle: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
            minimumSize: const Size.fromHeight(54),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF8E441F),
            side: const BorderSide(color: Color(0xFFDCC8B7)),
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        chipTheme: ThemeData.light(useMaterial3: true).chipTheme.copyWith(
          backgroundColor: Colors.white,
          selectedColor: const Color(0x1FC56B43),
          side: const BorderSide(color: Color(0xFFE3D5C7)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          labelStyle: const TextStyle(
            color: Color(0xFF4C3427),
            fontWeight: FontWeight.w700,
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white.withValues(alpha: 0.9),
          labelStyle: const TextStyle(color: Color(0xFF765E4E)),
          hintStyle: const TextStyle(color: Color(0xFFB29986)),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 16,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFE1D5C8)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFE1D5C8)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFC56B43), width: 1.5),
          ),
        ),
        textTheme: ThemeData.light(useMaterial3: true).textTheme.copyWith(
          headlineMedium: const TextStyle(
            color: Color(0xFF2F231C),
            fontSize: 34,
            height: 1.02,
            fontWeight: FontWeight.w800,
          ),
          headlineSmall: const TextStyle(
            color: Color(0xFF2F231C),
            fontSize: 28,
            height: 1.05,
            fontWeight: FontWeight.w800,
          ),
          titleLarge: const TextStyle(
            color: Color(0xFF2F231C),
            fontSize: 22,
            fontWeight: FontWeight.w800,
          ),
          titleMedium: const TextStyle(
            color: Color(0xFF2F231C),
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
          bodyLarge: const TextStyle(
            color: Color(0xFF765E4E),
            fontSize: 16,
            height: 1.5,
          ),
          bodyMedium: const TextStyle(
            color: Color(0xFF765E4E),
            fontSize: 14,
            height: 1.45,
          ),
          labelLarge: const TextStyle(
            color: Color(0xFF8E441F),
            fontSize: 13,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.4,
          ),
        ),
      ),
      home: const _SessionGate(),
    );
  }
}

class _SessionGate extends StatelessWidget {
  const _SessionGate();

  @override
  Widget build(BuildContext context) {
    final repository = SalonRepository(Supabase.instance.client);

    return StreamBuilder<AuthState>(
      stream: repository.authChanges,
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

        if (repository.currentUser == null) {
          return AuthScreen(repository: repository);
        }

        return _CustomerGate(repository: repository);
      },
    );
  }
}

class _CustomerGate extends StatefulWidget {
  const _CustomerGate({required this.repository});

  final SalonRepository repository;

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
          return JoinSalonScreen(
            repository: widget.repository,
            onJoined: _refreshProfile,
          );
        }

        return HomeScreen(repository: widget.repository, profile: profile);
      },
    );
  }
}
