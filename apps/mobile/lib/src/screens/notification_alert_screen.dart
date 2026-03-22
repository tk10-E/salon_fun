import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/salon_repository.dart';
import '../services/push_notification_service.dart';
import '../theme/service_category_visual.dart';
import '../widgets/cancel_appointment_sheet.dart';

class NotificationAlertScreen extends StatefulWidget {
  const NotificationAlertScreen({super.key, required this.notification});

  final NotificationTapPayload notification;

  @override
  State<NotificationAlertScreen> createState() =>
      _NotificationAlertScreenState();
}

class _NotificationAlertScreenState extends State<NotificationAlertScreen> {
  late final SalonRepository _repository;
  bool _isConfirmingPresence = false;
  bool _isCancellingAppointment = false;
  _AppointmentAlertResolution? _resolution;

  NotificationTapPayload get notification => widget.notification;

  String? get _appointmentId => notification.data['appointmentId']?.toString();
  String get _serviceName {
    final raw = notification.data['serviceName']?.toString().trim();
    return raw == null || raw.isEmpty ? 'esse atendimento' : raw;
  }

  String? get _staffMemberName {
    final raw = notification.data['staffMemberName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  bool get _isFeedPostNotification => notification.type == 'feed_post_published';

  String? get _postTitle {
    final raw = notification.data['postTitle']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postCaption {
    final raw = notification.data['postCaption']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postImageUrl {
    final raw = notification.data['postImageUrl']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  String? get _postServiceName {
    final raw = notification.data['serviceName']?.toString().trim();
    return raw == null || raw.isEmpty ? null : raw;
  }

  DateTime? get _postPublishedAt {
    final raw = notification.data['postPublishedAt']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  DateTime? get _appointmentAt {
    final raw = notification.data['appointmentAt']?.toString();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    return DateTime.tryParse(raw)?.toLocal();
  }

  bool get _requiresAttendanceConfirmation =>
      notification.type == 'appointment_confirmation_required' &&
      _appointmentId != null &&
      _resolution == null;

  @override
  void initState() {
    super.initState();
    _repository = SalonRepository(Supabase.instance.client);
  }

  Future<void> _confirmPresence() async {
    final appointmentId = _appointmentId;
    if (appointmentId == null ||
        _isConfirmingPresence ||
        _isCancellingAppointment) {
      return;
    }

    setState(() => _isConfirmingPresence = true);

    try {
      await _repository.confirmUpcomingAppointmentPresence(
        appointmentId: appointmentId,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.success,
          title: 'Presença confirmada',
          message:
              'Perfeito. O salão já recebeu sua confirmação e esse horário continua reservado para você.',
        );
      });
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível confirmar agora',
          message: _mapPresenceConfirmationError(error.message),
        );
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível confirmar agora',
          message:
              'Tente novamente em alguns instantes. Se preferir, confirme direto no histórico do app.',
        );
      });
    } finally {
      if (mounted) {
        setState(() => _isConfirmingPresence = false);
      }
    }
  }

  Future<void> _cancelAppointment() async {
    final appointmentId = _appointmentId;
    if (appointmentId == null ||
        _isCancellingAppointment ||
        _isConfirmingPresence) {
      return;
    }

    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CancelAppointmentSheet(serviceName: _serviceName),
    );

    if (reason == null || reason.trim().isEmpty || !mounted) {
      return;
    }

    setState(() => _isCancellingAppointment = true);

    try {
      await _repository.cancelAppointment(
        appointmentId: appointmentId,
        reason: reason,
      );
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.info,
          title: 'Horário cancelado',
          message:
              'Seu cancelamento foi enviado ao salão e o horário foi liberado para a agenda.',
        );
      });
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível cancelar agora',
          message: _mapCancellationError(error.message),
        );
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _resolution = const _AppointmentAlertResolution(
          tone: _AppointmentAlertResolutionTone.error,
          title: 'Não foi possível cancelar agora',
          message:
              'Tente novamente em alguns instantes. Se preferir, cancele pelo histórico do app.',
        );
      });
    } finally {
      if (mounted) {
        setState(() => _isCancellingAppointment = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tone = _toneFor(notification.type);
    final theme = Theme.of(context);
    final appointmentAt = _appointmentAt;
    final postPublishedAt = _postPublishedAt;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F0E8),
      appBar: AppBar(title: const Text('Aviso do salão')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    tone.deep,
                    tone.primary,
                    Color.lerp(tone.primary, Colors.white, 0.08)!,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(32),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x1A27170F),
                    blurRadius: 26,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(tone.icon, color: Colors.white, size: 30),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    tone.label,
                    style: theme.textTheme.labelLarge?.copyWith(
                      color: Colors.white.withValues(alpha: 0.92),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    notification.title,
                    style: theme.textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    notification.body,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: Colors.white.withValues(alpha: 0.94),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          'Recebida em ${DateFormat('dd/MM • HH:mm').format(notification.receivedAt)}',
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      if (appointmentAt != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Horário: ${DateFormat('dd/MM • HH:mm').format(appointmentAt)}',
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: const Color(0xFFE3D5C7)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Resumo do aviso',
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: const Color(0xFF2F231C),
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _descriptionFor(notification.type),
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF765E4E),
                      height: 1.55,
                    ),
                  ),
                  if (_isFeedPostNotification) ...[
                    const SizedBox(height: 18),
                    _FeedPostPreviewCard(
                      title: _postTitle ?? notification.title,
                      caption: _postCaption ?? notification.body,
                      imageUrl: _postImageUrl,
                      serviceName: _postServiceName,
                      publishedAt: postPublishedAt,
                    ),
                  ],
                  if (_staffMemberName != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Profissional: $_staffMemberName',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF5F4B3E),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (_requiresAttendanceConfirmation) ...[
                    const SizedBox(height: 20),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F1E8),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: const Color(0xFFE7D6C4)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Confirme agora para manter seu horário',
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: const Color(0xFF2F231C),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Se você não puder comparecer, cancele por aqui para liberar a agenda do salão a tempo.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF765E4E),
                            ),
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed:
                                  _isConfirmingPresence ||
                                      _isCancellingAppointment
                                  ? null
                                  : _confirmPresence,
                              icon: const Icon(Icons.verified_user_rounded),
                              label: Text(
                                _isConfirmingPresence
                                    ? 'Confirmando presença...'
                                    : 'Confirmar presença',
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed:
                                  _isConfirmingPresence ||
                                      _isCancellingAppointment
                                  ? null
                                  : _cancelAppointment,
                              icon: const Icon(Icons.event_busy_rounded),
                              label: Text(
                                _isCancellingAppointment
                                    ? 'Cancelando horário...'
                                    : 'Cancelar horário',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (_resolution != null) ...[
                    const SizedBox(height: 20),
                    _ResolutionCard(resolution: _resolution!),
                  ],
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    label: const Text('Entendi'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResolutionCard extends StatelessWidget {
  const _ResolutionCard({required this.resolution});

  final _AppointmentAlertResolution resolution;

  @override
  Widget build(BuildContext context) {
    final colors = switch (resolution.tone) {
      _AppointmentAlertResolutionTone.success => (
        background: const Color(0xFFEAF6EE),
        border: const Color(0xFFCFE2D7),
        foreground: const Color(0xFF2E6B4B),
        icon: Icons.verified_rounded,
      ),
      _AppointmentAlertResolutionTone.info => (
        background: const Color(0xFFF4F0FF),
        border: const Color(0xFFDCD3F4),
        foreground: const Color(0xFF5D4AA0),
        icon: Icons.info_outline_rounded,
      ),
      _AppointmentAlertResolutionTone.error => (
        background: const Color(0xFFFFEFEE),
        border: const Color(0xFFF0D0CC),
        foreground: const Color(0xFFA63B30),
        icon: Icons.error_outline_rounded,
      ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(colors.icon, color: colors.foreground),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  resolution.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: colors.foreground,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  resolution.message,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(color: colors.foreground),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AppointmentAlertResolution {
  const _AppointmentAlertResolution({
    required this.tone,
    required this.title,
    required this.message,
  });

  final _AppointmentAlertResolutionTone tone;
  final String title;
  final String message;
}

enum _AppointmentAlertResolutionTone { success, info, error }

class _NotificationTone {
  const _NotificationTone({
    required this.label,
    required this.icon,
    required this.primary,
    required this.deep,
  });

  final String label;
  final IconData icon;
  final Color primary;
  final Color deep;
}

_NotificationTone _toneFor(String type) {
  if (type.startsWith('promotion_') ||
      type.startsWith('membership_') ||
      type.startsWith('loyalty_') ||
      type == 'winback_offer' ||
      type == 'smart_rebook_prompt' ||
      type.startsWith('service_') ||
      type == 'feed_post_published') {
    return const _NotificationTone(
      label: 'Novidade do salão',
      icon: Icons.local_offer_rounded,
      primary: Color(0xFFC56B43),
      deep: Color(0xFF7B3F26),
    );
  }

  if (type.startsWith('appointment_') || type == 'vacancy_alert') {
    return const _NotificationTone(
      label: 'Atualização da agenda',
      icon: Icons.calendar_month_rounded,
      primary: Color(0xFF4E8E94),
      deep: Color(0xFF27525A),
    );
  }

  if (type.startsWith('referral_')) {
    return const _NotificationTone(
      label: 'Indicação',
      icon: Icons.card_giftcard_rounded,
      primary: Color(0xFF6D8B74),
      deep: Color(0xFF385042),
    );
  }

  return const _NotificationTone(
    label: 'Aviso do salão',
    icon: Icons.notifications_active_rounded,
    primary: Color(0xFF8D6CCF),
    deep: Color(0xFF4D3E7E),
  );
}

String _descriptionFor(String type) {
  switch (type) {
    case 'promotion_published':
    case 'promotion_updated':
      return 'O salão publicou ou atualizou uma promoção. Você pode abrir o app e conferir os detalhes com calma antes de agendar.';
    case 'winback_offer':
      return 'O salão ativou uma oferta de retorno porque você está há um tempo sem visitar. Se fizer sentido para você, dá para aproveitar esse incentivo direto no app.';
    case 'smart_rebook_prompt':
      return 'O app identificou seu padrão de retorno e o salão usou isso para sugerir um novo horário antes da sua rotina esfriar. É um lembrete comportamental, não um disparo genérico.';
    case 'membership_published':
    case 'membership_updated':
      return 'Um plano mensal foi publicado ou atualizado no salão. Abra o app para ver valores, benefícios e vigência.';
    case 'loyalty_program_updated':
      return 'O salão atualizou o clube de fidelidade com pontos, cashback ou novos níveis de desconto progressivo.';
    case 'loyalty_tier_unlocked':
    case 'loyalty_vip_unlocked':
      return 'Seu histórico no salão liberou um novo nível de fidelidade. Abra o app para ver o desconto atual, o ranking e o cashback acumulado.';
    case 'referral_program_updated':
      return 'O salão atualizou o programa de indicação. Confira as regras e os benefícios ativos no app.';
    case 'service_published':
    case 'service_updated':
      return 'O catálogo do salão mudou. Novos serviços e ajustes de preço ou duração podem aparecer na sua agenda.';
    case 'feed_post_published':
      return 'O salão publicou uma foto nova no feed. O preview abaixo usa os dados reais da publicação para você conferir antes de abrir o restante do app.';
    case 'appointment_confirmed':
      return 'Seu horário foi confirmado pelo salão. Agora você já pode se programar para comparecer no atendimento.';
    case 'appointment_reminder_1h':
      return 'Este é um lembrete automático enviado uma hora antes do seu atendimento para você se organizar com antecedência.';
    case 'appointment_confirmation_required':
      return 'O salão pediu sua confirmação de presença nos 30 minutos finais antes do atendimento. Você pode confirmar ou cancelar agora mesmo.';
    case 'appointment_auto_cancelled_unconfirmed':
      return 'Como a presença não foi confirmada a tempo, o sistema liberou o horário para evitar perda na agenda do salão.';
    case 'appointment_staff_reassigned':
      return 'O salão precisou trocar o profissional responsável pelo seu horário. O atendimento continua reservado e este aviso confirma quem assume a agenda a partir de agora.';
    case 'appointment_cancelled':
      return 'O salão cancelou o horário. Abra o app para verificar os detalhes e escolher um novo atendimento se necessário.';
    case 'appointment_completed':
      return 'Seu atendimento foi marcado como concluído pelo salão.';
    case 'vacancy_alert':
      return 'Um horário foi liberado no salão. Se ainda estiver disponível, você pode aproveitar essa vaga no app.';
    case 'referral_qualified':
    case 'referral_reward_unlocked':
      return 'Sua indicação atingiu a etapa necessária e o benefício foi atualizado no sistema do salão.';
    default:
      return 'O salão enviou uma atualização importante. Abra o app sempre que quiser revisar esse aviso.';
  }
}

class _FeedPostPreviewCard extends StatelessWidget {
  const _FeedPostPreviewCard({
    required this.title,
    required this.caption,
    this.imageUrl,
    this.serviceName,
    this.publishedAt,
  });

  final String title;
  final String caption;
  final String? imageUrl;
  final String? serviceName;
  final DateTime? publishedAt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final serviceVisual = resolveServiceCategoryVisual(
      category: serviceName,
      name: title,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F1E8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE7D6C4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (imageUrl != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: Image.network(
                  imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      color: const Color(0xFFF1E4D7),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.photo_camera_back_rounded,
                        size: 34,
                        color: Color(0xFF9A7B67),
                      ),
                    );
                  },
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (serviceName != null)
                _FeedMetaChip(
                  icon: serviceVisual.icon,
                  label: serviceName!,
                ),
              if (publishedAt != null)
                _FeedMetaChip(
                  icon: Icons.schedule_rounded,
                  label: DateFormat('dd/MM • HH:mm').format(publishedAt!),
                ),
            ],
          ),
          if (serviceName != null || publishedAt != null)
            const SizedBox(height: 12),
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              color: const Color(0xFF2F231C),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            caption,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF765E4E),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Abra a aba Feed do salão para ver a publicação completa, curtir ou comentar.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: const Color(0xFF8D6B59),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedMetaChip extends StatelessWidget {
  const _FeedMetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE5D2BF)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF8E441F)),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: const Color(0xFF5F4B3E),
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

String _mapPresenceConfirmationError(String raw) {
  final message = raw.toLowerCase();

  if (message.contains('appointment_not_found')) {
    return 'Esse horário não foi encontrado no sistema do salão.';
  }

  if (message.contains('appointment_not_confirmed')) {
    return 'Esse horário ainda não foi confirmado pelo salão ou já mudou de status.';
  }

  if (message.contains('appointment_already_started')) {
    return 'O horário já começou. Se você precisar, fale com o salão pelo app.';
  }

  if (message.contains('confirmation_not_requested')) {
    return 'Esse horário ainda não está na janela de confirmação pelo cliente.';
  }

  if (message.contains('unauthorized') ||
      message.contains('customer_not_linked')) {
    return 'Sua conta não tem permissão para confirmar esse horário.';
  }

  return 'Tente novamente em alguns instantes. Se o problema continuar, fale com o salão.';
}

String _mapCancellationError(String raw) {
  final message = raw.toLowerCase();

  if (message.contains('appointment_not_found')) {
    return 'Esse horário não foi encontrado no sistema do salão.';
  }

  if (message.contains('past_appointment_cannot_be_cancelled')) {
    return 'Esse atendimento já passou e não pode mais ser cancelado.';
  }

  if (message.contains('appointment_already_completed')) {
    return 'Esse atendimento já foi concluído pelo salão.';
  }

  if (message.contains('appointment_already_cancelled')) {
    return 'Esse atendimento já foi cancelado.';
  }

  return 'Tente novamente em alguns instantes. Se o problema continuar, fale com o salão.';
}
