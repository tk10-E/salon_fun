import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/bootstrap/app_bootstrap.dart';
import 'package:mobile/src/features/auth/login_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('renders the customer app login shell', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();

    await tester.pumpWidget(MaterialApp(home: LoginPage(bootstrap: bootstrap)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Entrar com meu cadastro'), findsOneWidget);
    expect(find.text('Entrar'), findsWidgets);
    expect(find.text('Criar conta'), findsOneWidget);
    expect(find.text('Entrada separada do cadastro'), findsOneWidget);
    expect(find.text('Continuar com Google'), findsNothing);
    expect(find.text('Continuar com Facebook'), findsNothing);
    expect(find.text('Loja virtual do salão'), findsNothing);
  });

  testWidgets('opens the signup page from the login screen', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();

    await tester.pumpWidget(MaterialApp(home: LoginPage(bootstrap: bootstrap)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    await tester.tap(find.text('Criar conta').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(
      find.text('Crie sua conta em uma tela só de cadastro.'),
      findsOneWidget,
    );
    expect(find.text('Cadastro separado do login'), findsOneWidget);
  });
}
