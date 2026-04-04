import '../models/client_app_config.dart';
import 'formatters.dart';

enum SalonSupportChannelKind { managedUrl, email, whatsapp }

class SalonSupportChannel {
  const SalonSupportChannel({
    required this.kind,
    required this.url,
    required this.actionLabel,
    required this.summaryLabel,
  });

  final SalonSupportChannelKind kind;
  final String url;
  final String actionLabel;
  final String summaryLabel;
}

SalonSupportChannel? resolveSalonSupportChannel({
  required SalonClientAppConfig config,
  required String? salonWhatsappPhone,
}) {
  final supportUrl = (config.supportUrl ?? '').trim();
  if (supportUrl.isNotEmpty) {
    return SalonSupportChannel(
      kind: _resolveUrlKind(supportUrl),
      url: supportUrl,
      actionLabel: _resolveUrlActionLabel(supportUrl),
      summaryLabel: _resolveUrlSummaryLabel(supportUrl),
    );
  }

  final supportEmail = (config.supportEmail ?? '').trim();
  if (supportEmail.isNotEmpty) {
    return SalonSupportChannel(
      kind: SalonSupportChannelKind.email,
      url: Uri(
        scheme: 'mailto',
        path: supportEmail,
      ).toString(),
      actionLabel: 'Enviar e-mail',
      summaryLabel: supportEmail,
    );
  }

  final whatsappUrl = buildWhatsAppUrl(salonWhatsappPhone);
  if (whatsappUrl == null) {
    return null;
  }

  return const SalonSupportChannel(
    kind: SalonSupportChannelKind.whatsapp,
    url: '',
    actionLabel: 'Falar com o salão',
    summaryLabel: 'WhatsApp oficial do salão',
  ).copyWith(url: whatsappUrl);
}

String buildSupportMessageUrl({
  required SalonSupportChannel channel,
  required String subject,
  required String message,
}) {
  final uri = Uri.parse(channel.url);

  switch (channel.kind) {
    case SalonSupportChannelKind.whatsapp:
      return uri
          .replace(
            queryParameters: <String, String>{
              ...uri.queryParameters,
              'text': message,
            },
          )
          .toString();
    case SalonSupportChannelKind.email:
      return uri
          .replace(
            queryParameters: <String, String>{
              ...uri.queryParameters,
              'subject': subject,
              'body': message,
            },
          )
          .toString();
    case SalonSupportChannelKind.managedUrl:
      return channel.url;
  }
}

SalonSupportChannelKind _resolveUrlKind(String url) {
  final uri = Uri.tryParse(url);
  final host = (uri?.host ?? '').toLowerCase();

  if (host.contains('wa.me') || host.contains('whatsapp')) {
    return SalonSupportChannelKind.whatsapp;
  }

  if (uri?.scheme == 'mailto') {
    return SalonSupportChannelKind.email;
  }

  return SalonSupportChannelKind.managedUrl;
}

String _resolveUrlActionLabel(String url) {
  switch (_resolveUrlKind(url)) {
    case SalonSupportChannelKind.whatsapp:
      return 'Falar com o salão';
    case SalonSupportChannelKind.email:
      return 'Enviar e-mail';
    case SalonSupportChannelKind.managedUrl:
      return 'Abrir canal do salão';
  }
}

String _resolveUrlSummaryLabel(String url) {
  final uri = Uri.tryParse(url);
  switch (_resolveUrlKind(url)) {
    case SalonSupportChannelKind.whatsapp:
      return 'WhatsApp oficial do salão';
    case SalonSupportChannelKind.email:
      return uri?.path ?? 'E-mail do salão';
    case SalonSupportChannelKind.managedUrl:
      final host = (uri?.host ?? '').trim();
      return host.isEmpty ? 'Canal oficial do salão' : host;
  }
}

extension on SalonSupportChannel {
  SalonSupportChannel copyWith({
    SalonSupportChannelKind? kind,
    String? url,
    String? actionLabel,
    String? summaryLabel,
  }) {
    return SalonSupportChannel(
      kind: kind ?? this.kind,
      url: url ?? this.url,
      actionLabel: actionLabel ?? this.actionLabel,
      summaryLabel: summaryLabel ?? this.summaryLabel,
    );
  }
}
