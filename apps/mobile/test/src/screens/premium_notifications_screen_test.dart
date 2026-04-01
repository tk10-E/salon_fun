import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/screens/premium_notifications_screen.dart';
import 'package:salon_client/src/theme/salon_branding.dart';

void main() {
  testWidgets(
    'filters notifications, opens the contextual detail and keeps the hub shortcut',
    (tester) async {
      var promotionsOpened = 0;

      await tester.binding.setSurfaceSize(const Size(1200, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: PremiumNotificationsScreen(
            branding: SalonBranding.fromName('Studio Carcao'),
            notifications: [
              CustomerNotificationItem(
                id: 'notification-1',
                sourceType: 'salon_notification',
                type: 'promotion_published',
                title: 'Oferta de retorno',
                body: 'A campanha voltou para o app.',
                createdAt: DateTime(2026, 3, 31, 10),
              ),
              CustomerNotificationItem(
                id: 'notification-2',
                sourceType: 'salon_notification',
                type: 'appointment_confirmed',
                title: 'Horário confirmado',
                body: 'Seu atendimento foi confirmado.',
                createdAt: DateTime(2026, 3, 31, 11),
              ),
            ],
            onArchiveNotifications: (_) async {},
            onOpenPromotions: () {
              promotionsOpened += 1;
            },
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Oferta de retorno'), findsOneWidget);
      expect(find.text('Horário confirmado'), findsOneWidget);

      await tester.tap(find.widgetWithText(ChoiceChip, 'Campanhas'));
      await tester.pumpAndSettle();

      expect(find.text('Oferta de retorno'), findsOneWidget);
      expect(find.text('Horário confirmado'), findsNothing);

      expect(find.text('Ver campanha'), findsOneWidget);
      expect(find.text('Abrir central'), findsOneWidget);

      await tester.tap(find.text('Ver campanha'));
      await tester.pumpAndSettle();

      expect(find.text('Aviso do salão'), findsOneWidget);
      expect(find.text('Resumo do aviso'), findsOneWidget);
      expect(find.text('Oferta de retorno'), findsAtLeastNWidgets(1));

      await tester.pageBack();
      await tester.pumpAndSettle();

      await tester.tap(find.text('Abrir central'));
      await tester.pumpAndSettle();

      expect(promotionsOpened, 1);
    },
  );
}
