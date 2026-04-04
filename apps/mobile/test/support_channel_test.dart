import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/core/support_channel.dart';
import 'package:salon_client/src/models/client_app_config.dart';

void main() {
  group('resolveSalonSupportChannel', () {
    test('prioriza supportUrl do salão', () {
      final channel = resolveSalonSupportChannel(
        config: const SalonClientAppConfig(
          supportUrl: 'https://suporte.salao.com.br/cliente',
          supportEmail: 'ajuda@salao.com.br',
        ),
        salonWhatsappPhone: '11998887766',
      );

      expect(channel, isNotNull);
      expect(channel!.kind, SalonSupportChannelKind.managedUrl);
      expect(channel.url, 'https://suporte.salao.com.br/cliente');
      expect(channel.actionLabel, 'Abrir canal do salão');
      expect(channel.summaryLabel, 'suporte.salao.com.br');
    });

    test('usa e-mail quando o salão não publicou URL própria', () {
      final channel = resolveSalonSupportChannel(
        config: const SalonClientAppConfig(
          supportEmail: 'ajuda@salao.com.br',
        ),
        salonWhatsappPhone: '11998887766',
      );

      expect(channel, isNotNull);
      expect(channel!.kind, SalonSupportChannelKind.email);
      expect(channel.actionLabel, 'Enviar e-mail');
      expect(channel.summaryLabel, 'ajuda@salao.com.br');
      expect(channel.url, 'mailto:ajuda@salao.com.br');
    });

    test('cai para WhatsApp quando é o único canal disponível', () {
      final channel = resolveSalonSupportChannel(
        config: const SalonClientAppConfig(),
        salonWhatsappPhone: '(11) 99888-7766',
      );

      expect(channel, isNotNull);
      expect(channel!.kind, SalonSupportChannelKind.whatsapp);
      expect(channel.actionLabel, 'Falar com o salão');
      expect(channel.summaryLabel, 'WhatsApp oficial do salão');
      expect(channel.url, 'https://wa.me/11998887766');
    });
  });
}
