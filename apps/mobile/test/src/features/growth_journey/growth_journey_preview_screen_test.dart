import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/growth_journey/presentation/growth_journey_preview_screen.dart';

void main() {
  testWidgets('renders the four growth tabs and screen blocks', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: GrowthJourneyPreviewScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Booking'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Loyalty'), findsOneWidget);
    expect(find.text('Hero de rebook inteligente'), findsOneWidget);

    await tester.tap(find.text('Booking'));
    await tester.pumpAndSettle();

    expect(find.text('Rail de servicos prioritarios'), findsOneWidget);
    expect(find.text('Booking com menos atrito'), findsOneWidget);
  });
}
