import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/bootstrap/app_bootstrap.dart';
import 'package:mobile/src/bootstrap/salon_customer_app.dart';

void main() {
  testWidgets('renders the customer app login shell', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    await bootstrap.sessionController.restoreSession();

    await tester.pumpWidget(SalonCustomerApp(bootstrap: bootstrap));
    await tester.pumpAndSettle();

    expect(find.text('Entrar com meu cadastro'), findsOneWidget);
    expect(find.text('Entrar'), findsWidgets);
    expect(find.text('Criar conta'), findsOneWidget);
    expect(find.text('Entrada separada do cadastro'), findsOneWidget);
    expect(find.text('Continuar com Google'), findsOneWidget);
    expect(find.text('Continuar com Facebook'), findsOneWidget);
    expect(find.text('Loja virtual do salão'), findsNothing);
  });

  testWidgets('opens the signup page from the login screen', (
    WidgetTester tester,
  ) async {
    final bootstrap = AppBootstrap.testing();
    await bootstrap.sessionController.restoreSession();

    await tester.pumpWidget(SalonCustomerApp(bootstrap: bootstrap));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Criar conta').first);
    await tester.pumpAndSettle();

    expect(
      find.text('Crie sua conta em uma tela só de cadastro.'),
      findsOneWidget,
    );
    expect(find.text('Cadastro separado do login'), findsOneWidget);
  });
}
