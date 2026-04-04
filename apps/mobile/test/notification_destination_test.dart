import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/notification_destination.dart';

void main() {
  group('resolveNotificationDestination', () {
    test('manda alertas de agenda para a aba de appointments', () {
      final destination = resolveNotificationDestination(
        'appointment_confirmed',
      );

      expect(destination.tabIndex, ClientShellTabIndex.appointments);
      expect(destination.opensNotificationsCenter, isFalse);
    });

    test('manda posts publicados para o feed', () {
      final destination = resolveNotificationDestination('feed_post_published');

      expect(destination.tabIndex, ClientShellTabIndex.feed);
      expect(destination.actionLabel, 'Abrir feed');
    });

    test('manda campanhas para a vitrine', () {
      final destination = resolveNotificationDestination('promotion_updated');

      expect(destination.tabIndex, ClientShellTabIndex.explore);
      expect(destination.feedbackMessage, isNotNull);
    });

    test('manda serviços publicados para o catálogo', () {
      final destination = resolveNotificationDestination('service_published');

      expect(destination.tabIndex, ClientShellTabIndex.explore);
      expect(destination.actionLabel, 'Ver catálogo');
    });

    test('manda winback para a vitrine comercial', () {
      final destination = resolveNotificationDestination('winback_offer');

      expect(destination.tabIndex, ClientShellTabIndex.explore);
      expect(destination.actionLabel, 'Ver oferta');
    });

    test('manda rebook inteligente para o fluxo de agendamento', () {
      final destination = resolveNotificationDestination('smart_rebook_prompt');

      expect(destination.tabIndex, ClientShellTabIndex.explore);
      expect(destination.actionLabel, 'Agendar retorno');
    });

    test('cobre todos os tipos client-facing emitidos pelo painel hoje', () {
      const panelTypes = <String, int>{
        'promotion_published': ClientShellTabIndex.explore,
        'promotion_updated': ClientShellTabIndex.explore,
        'membership_published': ClientShellTabIndex.explore,
        'membership_updated': ClientShellTabIndex.explore,
        'loyalty_program_updated': ClientShellTabIndex.profile,
        'loyalty_tier_unlocked': ClientShellTabIndex.profile,
        'loyalty_vip_unlocked': ClientShellTabIndex.profile,
        'winback_offer': ClientShellTabIndex.explore,
        'smart_rebook_prompt': ClientShellTabIndex.explore,
        'appointment_confirmed': ClientShellTabIndex.appointments,
        'appointment_deposit_required': ClientShellTabIndex.appointments,
        'appointment_reminder_1h': ClientShellTabIndex.appointments,
        'appointment_confirmation_required': ClientShellTabIndex.appointments,
        'appointment_auto_cancelled_deposit_pending':
            ClientShellTabIndex.appointments,
        'appointment_auto_cancelled_unconfirmed':
            ClientShellTabIndex.appointments,
        'appointment_cancelled': ClientShellTabIndex.appointments,
        'appointment_completed': ClientShellTabIndex.appointments,
        'appointment_staff_reassigned': ClientShellTabIndex.appointments,
        'vacancy_alert': ClientShellTabIndex.appointments,
        'referral_program_updated': ClientShellTabIndex.profile,
        'referral_qualified': ClientShellTabIndex.profile,
        'referral_reward_unlocked': ClientShellTabIndex.profile,
        'service_published': ClientShellTabIndex.explore,
        'service_updated': ClientShellTabIndex.explore,
        'feed_post_published': ClientShellTabIndex.feed,
      };

      for (final entry in panelTypes.entries) {
        final destination = resolveNotificationDestination(entry.key);
        expect(
          destination.opensNotificationsCenter,
          isFalse,
          reason: 'O tipo ${entry.key} não deveria cair no fallback.',
        );
        expect(
          destination.tabIndex,
          entry.value,
          reason: 'O tipo ${entry.key} precisa abrir a aba correta.',
        );
      }
    });

    test('usa a central como fallback para tipos desconhecidos', () {
      final destination = resolveNotificationDestination('salon_update');

      expect(destination.opensNotificationsCenter, isTrue);
      expect(destination.tabIndex, isNull);
    });
  });
}
