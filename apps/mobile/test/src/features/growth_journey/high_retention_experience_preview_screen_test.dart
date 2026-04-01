import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/growth_journey/presentation/high_retention_experience_preview_screen.dart';

void main() {
  testWidgets('renders home and booking tabs with real microcopy', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: HighRetentionExperiencePreviewScreen()),
    );
    await tester.pumpAndSettle();

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Booking'), findsOneWidget);
    expect(find.textContaining('esse e o melhor momento'), findsOneWidget);

    await tester.tap(find.text('Booking'));
    await tester.pumpAndSettle();

    expect(find.text('Horarios ranqueados para voce'), findsOneWidget);
    expect(find.text('Servico preselecionado'), findsOneWidget);
  });
}
