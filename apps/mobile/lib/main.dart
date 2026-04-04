import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/app.dart';
import 'src/core/firebase_config.dart';
import 'src/core/supabase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    if (Firebase.apps.isEmpty) {
      final firebaseOptions = FirebaseConfig.optionsForCurrentPlatform();
      if (firebaseOptions != null) {
        await Firebase.initializeApp(options: firebaseOptions);
      } else {
        await Firebase.initializeApp();
      }
    }

    await initializeDateFormatting('pt_BR');
    Intl.defaultLocale = 'pt_BR';

    SupabaseConfig.validate();

    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.implicit,
      ),
    );

    await _configureCrashReporting();
  } catch (error) {
    runApp(_BootErrorApp(message: error.toString()));
    return;
  }

  await runZonedGuarded<Future<void>>(
    () async {
      runApp(const SalonClientApp());
    },
    (error, stackTrace) async {
      await FirebaseCrashlytics.instance.recordError(
        error,
        stackTrace,
        fatal: true,
      );
    },
  );
}

Future<void> _configureCrashReporting() async {
  final crashlytics = FirebaseCrashlytics.instance;
  await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);

  final previousOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    previousOnError?.call(details);
    if (kDebugMode) {
      FlutterError.presentError(details);
      return;
    }

    crashlytics.recordFlutterFatalError(details);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    crashlytics.recordError(error, stack, fatal: true);
    return true;
  };
}

class _BootErrorApp extends StatelessWidget {
  const _BootErrorApp({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFFF6F0E8),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0xFFE4D5CA)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x1A5B3422),
                      blurRadius: 42,
                      offset: Offset(0, 24),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Não foi possível iniciar o app do cliente',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2F211B),
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'O app precisa das configurações do Supabase e do Firebase para autenticar o cliente com segurança.',
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.5,
                        color: Color(0xFF6F5A50),
                      ),
                    ),
                    const SizedBox(height: 20),
                    const SelectableText(
                      'flutter run --dart-define-from-file=.env.local',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFA24C2E),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SelectableText(
                      message,
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.5,
                        color: Color(0xFF806B60),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
