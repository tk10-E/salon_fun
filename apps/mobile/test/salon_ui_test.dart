import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/core/theme/app_theme.dart';
import 'package:mobile/src/core/widgets/salon_ui.dart';
import 'package:mobile/src/features/shared/app_models.dart';

void main() {
  testWidgets('bottom action inset respects device navigation bar', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          viewInsets: EdgeInsets.zero,
          viewPadding: EdgeInsets.only(bottom: 24),
        ),
        child: Builder(
          builder: (context) {
            return Directionality(
              textDirection: TextDirection.ltr,
              child: Text('${salonBottomActionInset(context)}'),
            );
          },
        ),
      ),
    );

    expect(find.text('44.0'), findsOneWidget);
  });

  testWidgets('bottom action inset prioritizes keyboard when it is higher', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          viewInsets: EdgeInsets.only(bottom: 280),
          viewPadding: EdgeInsets.only(bottom: 24),
        ),
        child: Builder(
          builder: (context) {
            return Directionality(
              textDirection: TextDirection.ltr,
              child: Text('${salonBottomActionInset(context)}'),
            );
          },
        ),
      ),
    );

    expect(find.text('300.0'), findsOneWidget);
  });

  testWidgets('glass panels keep strong contrast over branded backgrounds', (
    WidgetTester tester,
  ) async {
    final preview = SalonPreview(
      salonId: 'salon-1',
      joinCode: 'SALAO7',
      name: 'Studio Premium',
      appDisplayName: 'Studio Premium',
      tagline: 'Beleza com ritmo real',
      brandColor: '#C15F43',
      logoUrl: null,
      heroImageUrl: 'https://example.com/hero.jpg',
      heroHeadline: 'Seu melhor visual começa aqui',
      welcomeHeadline: 'Seu salão em ritmo premium',
      welcomeMessage:
          'Agenda, feed e loja alinhados em uma experiência bonita.',
      primaryCtaLabel: 'Agendar',
      promotionHeadline: 'Tudo organizado para resolver em poucos toques.',
      segmentLabel: 'Salão',
      segmentDescription: 'Cuidado e experiência',
      moduleLabels: const ['Agenda', 'Loja', 'Feed'],
      mapUrl: null,
      supportUrl: null,
      supportEmail: 'oi@studio.com',
      ratingValue: 4.9,
      ratingCount: 120,
      visualStyle: 'glow_signature',
      cardStyle: 'glass',
      bannerStyle: 'spotlight',
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(preview: preview),
        home: const Scaffold(
          body: SalonPanel(child: Text('Painel com contraste')),
        ),
      ),
    );

    await tester.pump();

    final panelContainer = tester
        .widgetList<Container>(
          find.descendant(
            of: find.byType(SalonPanel),
            matching: find.byType(Container),
          ),
        )
        .firstWhere((container) {
          final decoration = container.decoration;
          return decoration is BoxDecoration && decoration.color != null;
        });

    final decoration = panelContainer.decoration! as BoxDecoration;
    expect(decoration.color!.a, greaterThanOrEqualTo(0.94));
  });

  testWidgets(
    'network images stay stable when the parent leaves one axis unconstrained',
    (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.build(),
          home: const Scaffold(
            body: Center(
              child: UnconstrainedBox(
                child: SizedBox(
                  width: 48,
                  child: SalonNetworkImage(
                    imageUrl: null,
                    placeholder: SizedBox(width: 24, height: 24),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.byType(SalonNetworkImage), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
