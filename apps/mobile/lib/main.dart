import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'src/bootstrap/app_bootstrap.dart';
import 'src/bootstrap/salon_customer_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('pt_BR');
  final bootstrap = await AppBootstrap.initialize();
  runApp(SalonCustomerApp(bootstrap: bootstrap));
}
