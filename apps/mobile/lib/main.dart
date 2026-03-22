import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'src/app.dart';
import 'src/services/push_notification_service.dart';
import 'src/supabase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    SupabaseConfig.validate();

    await Supabase.initialize(
      url: SupabaseConfig.url,
      anonKey: SupabaseConfig.anonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.implicit,
      ),
    );

  } catch (error) {
    runApp(_BootErrorApp(message: error.toString()));
    return;
  }

  try {
    await PushNotificationService.instance.initialize();
  } catch (error, stackTrace) {
    debugPrint('Push init skipped: $error');
    debugPrintStack(stackTrace: stackTrace);
  }

  runApp(const SalonClientApp());
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
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFE3D5C7)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Não foi possível iniciar o app',
                      style: TextStyle(
                        color: Color(0xFF2F231C),
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'A compilação de release precisa das variáveis do Supabase. Gere o APK usando o arquivo .env.production.',
                      style: TextStyle(
                        color: Color(0xFF765E4E),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 18),
                    const SelectableText(
                      'flutter build apk --release --dart-define-from-file=.env.production',
                      style: TextStyle(
                        color: Color(0xFF8E441F),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 18),
                    SelectableText(
                      message,
                      style: const TextStyle(
                        color: Color(0xFF765E4E),
                        fontSize: 13,
                        height: 1.45,
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
