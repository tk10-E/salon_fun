import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/salon_branding.dart';
import 'empty_state.dart';
import 'soft_card.dart';

class NotificationCenterSheet extends StatefulWidget {
  const NotificationCenterSheet({
    super.key,
    required this.branding,
    required this.notifications,
    required this.onArchiveNotifications,
  });

  final SalonBranding branding;
  final List<CustomerNotificationItem> notifications;
  final Future<void> Function(List<CustomerNotificationItem> notifications)
  onArchiveNotifications;

  @override
  State<NotificationCenterSheet> createState() =>
      _NotificationCenterSheetState();
}

class _NotificationCenterSheetState extends State<NotificationCenterSheet> {
  _NotificationFilter _selectedFilter = _NotificationFilter.all;
  late List<CustomerNotificationItem> _visibleNotifications;
  bool _isArchivingAll = false;
  final Set<String> _archivingKeys = <String>{};

  @override
  void initState() {
    super.initState();
    _visibleNotifications = List<CustomerNotificationItem>.from(
      widget.notifications,
    );
  }

  List<CustomerNotificationItem> get _filteredNotifications {
    return _visibleNotifications
        .where((item) => _selectedFilter.matches(item))
        .toList();
  }

  int _countFor(_NotificationFilter filter) {
    return _visibleNotifications.where((item) => filter.matches(item)).length;
  }

  Future<void> _archiveOne(CustomerNotificationItem notification) async {
    setState(() => _archivingKeys.add(notification.readKey));

    try {
      await widget.onArchiveNotifications([notification]);
      if (!mounted) {
        return;
      }

      setState(() {
        _visibleNotifications.removeWhere(
          (item) => item.readKey == notification.readKey,
        );
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível apagar este aviso agora.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _archivingKeys.remove(notification.readKey));
      }
    }
  }

  Future<void> _archiveAll() async {
    if (_visibleNotifications.isEmpty || _isArchivingAll) {
      return;
    }

    final notificationsToArchive = List<CustomerNotificationItem>.from(
      _visibleNotifications,
    );

    setState(() => _isArchivingAll = true);

    try {
      await widget.onArchiveNotifications(notificationsToArchive);
      if (!mounted) {
        return;
      }

      setState(() {
        _visibleNotifications = <CustomerNotificationItem>[];
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível apagar os avisos agora.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isArchivingAll = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unreadCount = _visibleNotifications
        .where((item) => !item.isRead)
        .length;
    final filteredNotifications = _filteredNotifications;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Notificações do salão',
              style: theme.textTheme.headlineSmall?.copyWith(
                color: widget.branding.deep,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _visibleNotifications.isEmpty
                  ? 'Os avisos importantes do salão vão aparecer aqui.'
                  : unreadCount == 0
                  ? '${_visibleNotifications.length} notificações no histórico.'
                  : '${_visibleNotifications.length} notificações • $unreadCount novas',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: widget.branding.mutedText,
                height: 1.5,
              ),
            ),
            if (_visibleNotifications.isNotEmpty) ...[
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _isArchivingAll ? null : _archiveAll,
                  icon: _isArchivingAll
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.delete_sweep_rounded, size: 18),
                  label: const Text('Apagar avisos'),
                ),
              ),
            ],
            const SizedBox(height: 18),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _NotificationFilter.values.map((filter) {
                  final isSelected = filter == _selectedFilter;
                  final count = _countFor(filter);

                  return Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: ChoiceChip(
                      selected: isSelected,
                      label: Text(
                        count > 0 ? '${filter.label} ($count)' : filter.label,
                      ),
                      avatar: Icon(
                        filter.icon,
                        size: 18,
                        color: isSelected
                            ? widget.branding.onPrimary
                            : widget.branding.deep,
                      ),
                      selectedColor: widget.branding.primary,
                      backgroundColor: widget.branding.surface,
                      side: BorderSide(
                        color: isSelected
                            ? widget.branding.primary
                            : widget.branding.outline,
                      ),
                      labelStyle: theme.textTheme.labelLarge?.copyWith(
                        color: isSelected
                            ? widget.branding.onPrimary
                            : widget.branding.deep,
                        fontWeight: FontWeight.w800,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(999),
                      ),
                      onSelected: (_) {
                        setState(() => _selectedFilter = filter);
                      },
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 18),
            Expanded(
              child: filteredNotifications.isEmpty
                  ? _EmptyFilterState(
                      branding: widget.branding,
                      filter: _selectedFilter,
                    )
                  : ListView.separated(
                      physics: const BouncingScrollPhysics(),
                      itemCount: filteredNotifications.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        return _NotificationCard(
                          notification: filteredNotifications[index],
                          branding: widget.branding,
                          isBusy: _archivingKeys.contains(
                            filteredNotifications[index].readKey,
                          ),
                          onDelete: () =>
                              _archiveOne(filteredNotifications[index]),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _NotificationFilter {
  all(label: 'Todas', icon: Icons.apps_rounded),
  unread(label: 'Novas', icon: Icons.markunread_rounded),
  promotions(label: 'Promoções', icon: Icons.local_offer_rounded),
  appointments(label: 'Agendamentos', icon: Icons.calendar_month_rounded),
  referrals(label: 'Indicações', icon: Icons.people_alt_rounded);

  const _NotificationFilter({required this.label, required this.icon});

  final String label;
  final IconData icon;

  bool matches(CustomerNotificationItem item) {
    switch (this) {
      case _NotificationFilter.all:
        return true;
      case _NotificationFilter.unread:
        return !item.isRead;
      case _NotificationFilter.promotions:
        return item.type.startsWith('promotion_') ||
            item.type.startsWith('membership_') ||
            item.type.startsWith('loyalty_') ||
            item.type == 'winback_offer' ||
            item.type == 'smart_rebook_prompt' ||
            item.type.startsWith('service_') ||
            item.type == 'feed_post_published';
      case _NotificationFilter.appointments:
        return item.type == 'vacancy_alert' ||
            item.type.startsWith('appointment_');
      case _NotificationFilter.referrals:
        return item.type.startsWith('referral_');
    }
  }
}

class _EmptyFilterState extends StatelessWidget {
  const _EmptyFilterState({required this.branding, required this.filter});

  final SalonBranding branding;
  final _NotificationFilter filter;

  @override
  Widget build(BuildContext context) {
    final content = switch (filter) {
      _NotificationFilter.all => (
        title: 'Nenhum aviso por enquanto',
        message:
            'Quando o salão confirmar horários, liberar promoções ou validar indicações, tudo vai aparecer aqui.',
        icon: Icons.notifications_none_rounded,
      ),
      _NotificationFilter.unread => (
        title: 'Nada novo no momento',
        message:
            'Você já viu todos os avisos recentes. As próximas novidades vão aparecer aqui.',
        icon: Icons.mark_email_read_rounded,
      ),
      _NotificationFilter.promotions => (
        title: 'Sem promoções ativas agora',
        message:
            'Assim que o salão publicar promoções, planos ou novidades, você vai receber por aqui.',
        icon: Icons.local_offer_outlined,
      ),
      _NotificationFilter.appointments => (
        title: 'Nenhum aviso de agendamento',
        message:
            'Confirmações, cancelamentos e horários liberados do salão aparecem nesta área.',
        icon: Icons.event_note_rounded,
      ),
      _NotificationFilter.referrals => (
        title: 'Nenhuma indicação por enquanto',
        message:
            'Acompanhe aqui quando sua indicação entrar no app, agendar e concluir a visita.',
        icon: Icons.group_outlined,
      ),
    };

    return Center(
      child: EmptyState(
        title: content.title,
        message: content.message,
        icon: content.icon,
        centered: true,
        accentColor: branding.primary,
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.notification,
    required this.branding,
    required this.onDelete,
    this.isBusy = false,
  });

  final CustomerNotificationItem notification;
  final SalonBranding branding;
  final VoidCallback onDelete;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final metadata = _metadataForType(notification.type);
    final isUnread = !notification.isRead;

    return SoftCard(
      borderColor: isUnread
          ? branding.primary.withValues(alpha: 0.48)
          : branding.outline.withValues(alpha: 0.82),
      backgroundColor: isUnread
          ? branding.highlightBackground.withValues(alpha: 0.56)
          : Colors.white,
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: metadata.backgroundColor,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(metadata.icon, color: metadata.foregroundColor),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _InfoPill(
                      label: metadata.label,
                      backgroundColor: metadata.backgroundColor,
                      foregroundColor: metadata.foregroundColor,
                    ),
                    _InfoPill(
                      label: isUnread ? 'Nova' : 'Vista',
                      backgroundColor: isUnread
                          ? branding.primary.withValues(alpha: 0.16)
                          : const Color(0xFFF1ECE5),
                      foregroundColor: isUnread
                          ? branding.deep
                          : const Color(0xFF7C685A),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _formatTimestamp(notification.createdAt),
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF836B5B),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  IconButton(
                    onPressed: isBusy ? null : onDelete,
                    tooltip: 'Apagar aviso',
                    visualDensity: VisualDensity.compact,
                    icon: isBusy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.delete_outline_rounded, size: 20),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            notification.title,
            style: theme.textTheme.titleMedium?.copyWith(
              color: branding.deep,
              fontWeight: FontWeight.w800,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            notification.body,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: const Color(0xFF765E4E),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: foregroundColor,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _NotificationTypeMetadata {
  const _NotificationTypeMetadata({
    required this.label,
    required this.icon,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final String label;
  final IconData icon;
  final Color backgroundColor;
  final Color foregroundColor;
}

_NotificationTypeMetadata _metadataForType(String type) {
  switch (type) {
    case 'vacancy_alert':
      return const _NotificationTypeMetadata(
        label: 'Horário liberado',
        icon: Icons.schedule_send_rounded,
        backgroundColor: Color(0xFFEAF6EE),
        foregroundColor: Color(0xFF2E6B4B),
      );
    case 'winback_offer':
      return const _NotificationTypeMetadata(
        label: 'Volte para o salão',
        icon: Icons.local_offer_rounded,
        backgroundColor: Color(0xFFFFF1E7),
        foregroundColor: Color(0xFF9A4A1F),
      );
    case 'smart_rebook_prompt':
      return const _NotificationTypeMetadata(
        label: 'Reagendamento inteligente',
        icon: Icons.auto_awesome_rounded,
        backgroundColor: Color(0xFFEEF6FF),
        foregroundColor: Color(0xFF2C5C97),
      );
    case 'promotion_published':
    case 'promotion_updated':
      return const _NotificationTypeMetadata(
        label: 'Promoção',
        icon: Icons.local_offer_rounded,
        backgroundColor: Color(0xFFFFF1E7),
        foregroundColor: Color(0xFF9A4A1F),
      );
    case 'membership_published':
    case 'membership_updated':
      return const _NotificationTypeMetadata(
        label: 'Plano mensal',
        icon: Icons.workspace_premium_rounded,
        backgroundColor: Color(0xFFF4ECFF),
        foregroundColor: Color(0xFF6845A2),
      );
    case 'loyalty_program_updated':
      return const _NotificationTypeMetadata(
        label: 'Fidelidade',
        icon: Icons.workspace_premium_rounded,
        backgroundColor: Color(0xFFFFF4E7),
        foregroundColor: Color(0xFF9C5A1E),
      );
    case 'loyalty_tier_unlocked':
    case 'loyalty_vip_unlocked':
      return const _NotificationTypeMetadata(
        label: 'Nível desbloqueado',
        icon: Icons.star_rounded,
        backgroundColor: Color(0xFFEAF6EE),
        foregroundColor: Color(0xFF2E6B4B),
      );
    case 'referral_program_updated':
      return const _NotificationTypeMetadata(
        label: 'Indicação',
        icon: Icons.people_alt_rounded,
        backgroundColor: Color(0xFFEAF0FF),
        foregroundColor: Color(0xFF3156A8),
      );
    case 'service_published':
    case 'service_updated':
      return const _NotificationTypeMetadata(
        label: 'Serviço',
        icon: Icons.auto_awesome_rounded,
        backgroundColor: Color(0xFFFFF2EC),
        foregroundColor: Color(0xFF904126),
      );
    case 'feed_post_published':
      return const _NotificationTypeMetadata(
        label: 'Foto no feed',
        icon: Icons.photo_library_rounded,
        backgroundColor: Color(0xFFEDF5FF),
        foregroundColor: Color(0xFF3568B8),
      );
    case 'referral_qualified':
    case 'referral_reward_unlocked':
      return const _NotificationTypeMetadata(
        label: 'Benefício liberado',
        icon: Icons.card_giftcard_rounded,
        backgroundColor: Color(0xFFEAF6EE),
        foregroundColor: Color(0xFF2E6B4B),
      );
    case 'appointment_confirmed':
      return const _NotificationTypeMetadata(
        label: 'Agendamento confirmado',
        icon: Icons.event_available_rounded,
        backgroundColor: Color(0xFFEAF6EE),
        foregroundColor: Color(0xFF2E6B4B),
      );
    case 'appointment_reminder_1h':
      return const _NotificationTypeMetadata(
        label: 'Lembrete de 1 hora',
        icon: Icons.alarm_rounded,
        backgroundColor: Color(0xFFEAF0FF),
        foregroundColor: Color(0xFF3156A8),
      );
    case 'appointment_confirmation_required':
      return const _NotificationTypeMetadata(
        label: 'Confirmação de presença',
        icon: Icons.verified_user_rounded,
        backgroundColor: Color(0xFFF8F1E8),
        foregroundColor: Color(0xFF8D5B28),
      );
    case 'appointment_staff_reassigned':
      return const _NotificationTypeMetadata(
        label: 'Mudança de profissional',
        icon: Icons.swap_horiz_rounded,
        backgroundColor: Color(0xFFEAF0FF),
        foregroundColor: Color(0xFF3156A8),
      );
    case 'appointment_auto_cancelled_unconfirmed':
      return const _NotificationTypeMetadata(
        label: 'Horário liberado por falta de confirmação',
        icon: Icons.event_busy_rounded,
        backgroundColor: Color(0xFFFFEFEE),
        foregroundColor: Color(0xFFB04839),
      );
    case 'appointment_cancelled':
      return const _NotificationTypeMetadata(
        label: 'Agendamento cancelado',
        icon: Icons.event_busy_rounded,
        backgroundColor: Color(0xFFFFEFEE),
        foregroundColor: Color(0xFFB04839),
      );
    case 'appointment_completed':
      return const _NotificationTypeMetadata(
        label: 'Atendimento concluído',
        icon: Icons.verified_rounded,
        backgroundColor: Color(0xFFF7F1E8),
        foregroundColor: Color(0xFF8D5B28),
      );
    default:
      return const _NotificationTypeMetadata(
        label: 'Atualização',
        icon: Icons.notifications_active_rounded,
        backgroundColor: Color(0xFFF3EEE8),
        foregroundColor: Color(0xFF6F5648),
      );
  }
}

String _formatTimestamp(DateTime value) {
  final now = DateTime.now();
  final isSameDay =
      value.year == now.year &&
      value.month == now.month &&
      value.day == now.day;

  if (isSameDay) {
    return DateFormat('HH:mm').format(value);
  }

  return DateFormat('dd/MM • HH:mm').format(value);
}
