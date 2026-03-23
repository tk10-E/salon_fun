import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';
import 'package:salon_client/src/theme/salon_branding.dart';
import 'package:salon_client/src/widgets/notification_center_sheet.dart';

void main() {
  group('NotificationCenterSheet', () {
    testWidgets(
      'shows an agenda-focused insight and action suggestion for appointment notices',
      (tester) async {
        await _pumpNotificationCenterSheet(
          tester,
          notifications: [
            CustomerNotificationItem(
              id: 'notif-1',
              sourceType: 'salon_notification',
              type: 'appointment_confirmation_required',
              title: 'Confirme sua presença',
              body: 'Seu horário está chegando. Confirme se vai comparecer.',
              createdAt: DateTime(2099, 4, 10, 9),
            ),
          ],
        );

        expect(find.text('Sua agenda pede atenção agora'), findsOneWidget);
        expect(
          find.textContaining('pode mexer no seu próximo horário'),
          findsOneWidget,
        );
        expect(find.text('Confirme sua presença'), findsOneWidget);
        expect(
          find.textContaining(
            'Ação sugerida: Confirme agora para não correr o risco de perder esse horário.',
          ),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'shows a retention-focused insight and action suggestions for winback and loyalty notices',
      (tester) async {
        await _pumpNotificationCenterSheet(
          tester,
          notifications: [
            CustomerNotificationItem(
              id: 'notif-1',
              sourceType: 'salon_notification',
              type: 'winback_offer',
              title: 'Volte com incentivo',
              body: 'Você recebeu um incentivo para voltar ao salão.',
              createdAt: DateTime(2099, 4, 10, 9),
            ),
            CustomerNotificationItem(
              id: 'notif-2',
              sourceType: 'salon_notification',
              type: 'loyalty_vip_unlocked',
              title: 'Seu nível VIP foi liberado',
              body: 'Você alcançou um novo nível de fidelidade.',
              createdAt: DateTime(2099, 4, 9, 18),
            ),
          ],
        );

        expect(
          find.text('Tem retorno com boa chance de virar reserva'),
          findsOneWidget,
        );
        expect(
          find.textContaining('oferta ou rebook inteligente'),
          findsOneWidget,
        );
        expect(
          find.textContaining(
            'Ação sugerida: Use esse incentivo para voltar ao salão antes que sua rotina esfrie mais.',
          ),
          findsOneWidget,
        );
        expect(
          find.textContaining(
            'Ação sugerida: Veja seu novo nível e use essa vantagem na próxima visita.',
          ),
          findsOneWidget,
        );
      },
    );
  });
}

Future<void> _pumpNotificationCenterSheet(
  WidgetTester tester, {
  required List<CustomerNotificationItem> notifications,
}) async {
  await tester.binding.setSurfaceSize(const Size(1200, 1800));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: NotificationCenterSheet(
          branding: SalonBranding.fromName(
            'Salon Fun',
            overrideHexColor: '#C56B43',
          ),
          notifications: notifications,
          onArchiveNotifications: (_) async {},
        ),
      ),
    ),
  );
  await tester.pump();
}
