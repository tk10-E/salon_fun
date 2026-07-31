import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'src/bootstrap/app_bootstrap.dart';
import 'src/bootstrap/salon_customer_app.dart';
import 'src/core/config/app_environment.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage _) async {
  WidgetsFlutterBinding.ensureInitialized();
  final environment = AppEnvironment.fromEnvironment();

  if (Firebase.apps.isNotEmpty) {
    return;
  }

  final firebaseOptions = environment.firebaseOptions;
  if (firebaseOptions != null) {
    await Firebase.initializeApp(options: firebaseOptions);
    return;
  }

  if (environment.canBootstrapFirebaseNatively && !kIsWeb) {
    await Firebase.initializeApp();
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  await initializeDateFormatting('pt_BR');
  final bootstrap = await AppBootstrap.initialize();
  if (bootstrap.environment.canShowAdMobBanner) {
    unawaited(MobileAds.instance.initialize());
  }
  runApp(SalonCustomerApp(bootstrap: bootstrap));
}
