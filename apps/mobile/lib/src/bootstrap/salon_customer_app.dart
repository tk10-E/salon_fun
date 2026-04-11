import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/theme/app_theme.dart';
import '../core/utils/formatters.dart';
import '../core/widgets/salon_brand_hero.dart';
import '../core/widgets/salon_ui.dart';
import '../features/auth/login_page.dart';
import '../features/auth/session_controller.dart';
import '../features/home/home_shell.dart';
import '../features/shared/app_models.dart';
import 'app_bootstrap.dart';

class SalonCustomerApp extends StatefulWidget {
  const SalonCustomerApp({super.key, required this.bootstrap});

  final AppBootstrap bootstrap;

  @override
  State<SalonCustomerApp> createState() => _SalonCustomerAppState();
}

class _SalonCustomerAppState extends State<SalonCustomerApp>
    with WidgetsBindingObserver {
  static const _biometricGracePeriod = Duration(seconds: 75);

  String? _lastNotificationBindingKey;
  DateTime? _backgroundedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(widget.bootstrap.deviceNotificationService.dispose());
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.hidden ||
        state == AppLifecycleState.paused) {
      _backgroundedAt = DateTime.now();
      return;
    }

    if (state == AppLifecycleState.resumed) {
      final backgroundedAt = _backgroundedAt;
      _backgroundedAt = null;
      if (backgroundedAt == null) {
        _refreshSalonRuntimeData();
        return;
      }

      final timeAway = DateTime.now().difference(backgroundedAt);
      if (timeAway >= _biometricGracePeriod) {
        widget.bootstrap.sessionController.lockForBiometrics();
      }

      _refreshSalonRuntimeData();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.bootstrap.sessionController,
      builder: (context, _) {
        final sessionController = widget.bootstrap.sessionController;
        _syncDeviceNotifications(sessionController);
        final activePreview =
            sessionController.session?.landingData?.preview ??
            sessionController.joinPreview?.preview;
        final appTitle =
            activePreview?.appDisplayName?.trim().isNotEmpty == true
            ? activePreview!.appDisplayName!.trim()
            : activePreview?.name.trim().isNotEmpty == true
            ? activePreview!.name.trim()
            : 'Salon Fun Cliente';
        final home = switch (sessionController.stage) {
          SessionStage.loading => _LaunchPage(preview: activePreview),
          SessionStage.signedOut => LoginPage(bootstrap: widget.bootstrap),
          SessionStage.authenticated
              when sessionController.requiresBiometricUnlock =>
            _BiometricLockPage(sessionController: sessionController),
          SessionStage.authenticated => HomeShell(
            bootstrap: widget.bootstrap,
            sessionController: sessionController,
          ),
        };

        return MaterialApp(
          title: appTitle,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.build(preview: activePreview),
          locale: const Locale('pt', 'BR'),
          supportedLocales: const [Locale('pt', 'BR')],
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: home,
        );
      },
    );
  }

  void _syncDeviceNotifications(SessionController sessionController) {
    final session = sessionController.session;
    final bindingKey = switch (sessionController.stage) {
      SessionStage.authenticated => session?.customer.id ?? 'authenticated',
      SessionStage.loading => 'loading',
      SessionStage.signedOut => 'signed_out',
    };

    if (_lastNotificationBindingKey == bindingKey) {
      return;
    }

    _lastNotificationBindingKey = bindingKey;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      if (sessionController.stage == SessionStage.authenticated) {
        unawaited(
          widget.bootstrap.deviceNotificationService.bindSession(session),
        );
        return;
      }

      unawaited(widget.bootstrap.deviceNotificationService.bindSession(null));
    });
  }

  void _refreshPushBinding() {
    final sessionController = widget.bootstrap.sessionController;
    if (sessionController.stage != SessionStage.authenticated) {
      return;
    }

    unawaited(
      widget.bootstrap.deviceNotificationService.bindSession(
        sessionController.session,
      ),
    );
  }

  void _refreshSalonRuntimeData() {
    final sessionController = widget.bootstrap.sessionController;
    if (sessionController.stage != SessionStage.authenticated) {
      return;
    }

    _refreshPushBinding();
    unawaited(sessionController.refreshLandingData());
  }
}

class _BiometricLockPage extends StatefulWidget {
  const _BiometricLockPage({required this.sessionController});

  final SessionController sessionController;

  @override
  State<_BiometricLockPage> createState() => _BiometricLockPageState();
}

class _BiometricLockPageState extends State<_BiometricLockPage> {
  bool _requested = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_requested) {
      return;
    }

    _requested = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _unlock();
    });
  }

  Future<void> _unlock() async {
    final success = await widget.sessionController.unlockWithBiometrics();
    if (!mounted || success) {
      return;
    }

    final message = widget.sessionController.message;
    if (message == null || message.isEmpty) {
      return;
    }

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.sessionController.session;
    final preview = session?.landingData?.preview;
    final accent = parseHexColor(preview?.brandColor);
    final salonName = preview?.appDisplayName?.trim().isNotEmpty == true
        ? preview!.appDisplayName!.trim()
        : preview?.name.trim().isNotEmpty == true
        ? preview!.name.trim()
        : 'seu salão';

    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl: preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              SalonBrandHero(
                preview: preview,
                accent: accent,
                greeting: 'Olá de novo',
                title: preview?.heroHeadline ?? preview?.welcomeHeadline,
                description:
                    'Seu acesso ao $salonName já está salvo neste aparelho. Confirme sua biometria para continuar.',
                showImage: true,
                bottom: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    FilledButton.icon(
                      onPressed: _unlock,
                      icon: const Icon(Icons.fingerprint_rounded),
                      label: const Text('Entrar com impressão digital'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton(
                      onPressed: widget.sessionController.signOut,
                      child: const Text('Sair da conta'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LaunchPage extends StatelessWidget {
  const _LaunchPage({this.preview});

  final SalonPreview? preview;

  @override
  Widget build(BuildContext context) {
    final accent = parseHexColor(preview?.brandColor);
    return Scaffold(
      body: AppGradientBackground(
        accentColor: accent,
        backgroundImageUrl: preview?.heroImageUrl,
        bannerStyle: preview?.bannerStyle,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SalonBrandHero(
              preview: preview,
              accent: accent,
              greeting: 'Abrindo o app',
              title: preview?.appDisplayName ?? preview?.name,
              description:
                  'Carregando a identidade, a agenda e a vitrine do salão para você entrar no mesmo clima em toda a experiência.',
              bottom: const Row(
                children: [
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.6),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text('Preparando sua experiência personalizada.'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
