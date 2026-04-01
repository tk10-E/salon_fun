import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/screens/premium_professionals_screen.dart';
import 'package:salon_client/src/theme/salon_brand_config.dart';
import 'package:salon_client/src/theme/salon_branding.dart';

void main() {
  testWidgets('toggles favorite professionals with real callback state', (
    tester,
  ) async {
    final requests = <(String professionalId, bool isFavorite)>[];

    await tester.binding.setSurfaceSize(const Size(1200, 1800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        home: PremiumProfessionalsScreen(
          salonName: 'Studio Carcao',
          branding: SalonBranding.fromName('Studio Carcao'),
          professionals: const [
            ProfessionalHighlight(
              id: 'pro-1',
              name: 'Ana',
              specialty: 'Coloracao signature',
              availabilityLabel: 'Atende hoje de 09:00 as 18:00',
              ratingLabel: '5 servicos no app',
            ),
          ],
          onToggleFavorite: (professional, isFavorite) async {
            requests.add((professional.id, isFavorite));
          },
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Salvar'), findsOneWidget);
    expect(find.text('Favorito'), findsNothing);

    await tester.tap(find.text('Salvar'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(requests, [('pro-1', true)]);
    expect(find.text('Favorito'), findsOneWidget);

    await tester.tap(find.text('Favorito'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(requests, [('pro-1', true), ('pro-1', false)]);
    expect(find.text('Salvar'), findsOneWidget);
  });
}
