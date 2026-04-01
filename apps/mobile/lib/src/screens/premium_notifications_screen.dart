import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../navigation/salon_page_route.dart';
import '../services/push_notification_service.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_branding.dart';
import '../theme/tenant_theme.dart';
import 'notification_alert_screen.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_surface_card.dart';

class PremiumNotificationsScreen extends StatefulWidget {
  const PremiumNotificationsScreen({
    super.key,
    required this.branding,
    required this.notifications,
    required this.onArchiveNotifications,
    this.onOpenAgenda,
    this.onOpenWallet,
    this.onOpenGallery,
    this.onOpenPromotions,
  });

  final SalonBranding branding;
  final List<CustomerNotificationItem> notifications;
  final Future<void> Function(List<CustomerNotificationItem> notifications)
  onArchiveNotifications;
  final VoidCallback? onOpenAgenda;
  final VoidCallback? onOpenWallet;
  final VoidCallback? onOpenGallery;
  final VoidCallback? onOpenPromotions;

  @override
  State<PremiumNotificationsScreen> createState() =>
      _PremiumNotificationsScreenState();
}

enum _NotificationFilter { all, agenda, campaigns, loyalty, gallery }

enum _NotificationCategory { agenda, campaigns, loyalty, gallery, general }

class _PremiumNotificationsScreenState
    extends State<PremiumNotificationsScreen> {
  late List<CustomerNotificationItem> _notifications = [
    ...widget.notifications,
  ];
  bool _archiving = false;
  _NotificationFilter _selectedFilter = _NotificationFilter.all;

  @override
  Widget build(BuildContext context) {
    final filteredNotifications = _filteredNotifications();
    final unreadCount = _notifications.where((item) => !item.isRead).length;
    final agendaCount = _notifications
        .where((item) => _categoryFor(item) == _NotificationCategory.agenda)
        .length;
    final campaignCount = _notifications
        .where((item) => _categoryFor(item) == _NotificationCategory.campaigns)
        .length;
    final loyaltyCount = _notifications
        .where((item) => _categoryFor(item) == _NotificationCategory.loyalty)
        .length;

    return Scaffold(
      appBar: AppBar(title: const Text('Notificações')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          PremiumSectionHeader(
            title: 'Central inteligente do salão',
            subtitle:
                'Agenda, campanhas, fidelidade e vitrine organizadas por prioridade e com próximo passo real.',
            actionLabel: filteredNotifications.isEmpty || _archiving
                ? null
                : 'Arquivar visíveis',
            onAction: filteredNotifications.isEmpty || _archiving
                ? null
                : () => _archiveItems(filteredNotifications),
          ),
          const SizedBox(height: PremiumSpacing.lg),
          Wrap(
            spacing: PremiumSpacing.sm,
            runSpacing: PremiumSpacing.sm,
            children: [
              _SummaryMetricCard(
                label: 'Não lidas',
                value: '$unreadCount',
                icon: Icons.notifications_active_rounded,
              ),
              _SummaryMetricCard(
                label: 'Agenda',
                value: '$agendaCount',
                icon: Icons.calendar_month_rounded,
              ),
              _SummaryMetricCard(
                label: 'Campanhas',
                value: '$campaignCount',
                icon: Icons.local_offer_rounded,
              ),
              _SummaryMetricCard(
                label: 'Fidelidade',
                value: '$loyaltyCount',
                icon: Icons.workspace_premium_rounded,
              ),
            ],
          ),
          const SizedBox(height: PremiumSpacing.lg),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _NotificationFilter.values.map((filter) {
                final isSelected = _selectedFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: PremiumSpacing.sm),
                  child: ChoiceChip(
                    label: Text(_filterLabel(filter)),
                    selected: isSelected,
                    onSelected: (_) {
                      setState(() => _selectedFilter = filter);
                    },
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: PremiumSpacing.lg),
          if (filteredNotifications.isEmpty)
            PremiumEmptyState(
              eyebrow: _selectedFilter == _NotificationFilter.all
                  ? 'Tudo em dia'
                  : 'Filtro sem itens',
              title: _selectedFilter == _NotificationFilter.all
                  ? 'Nenhum aviso por enquanto'
                  : 'Nenhum aviso nesse recorte',
              message: _selectedFilter == _NotificationFilter.all
                  ? 'Quando houver atualizações do salão, elas aparecerão aqui com leitura premium e próxima ação clara.'
                  : 'Troque o filtro para revisar agenda, vitrine, campanhas e fidelidade do salão.',
              icon: Icons.notifications_none_rounded,
            )
          else
            ...filteredNotifications.map(
              (notification) => Padding(
                padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                child: _NotificationCard(
                  notification: notification,
                  primaryActionLabel: _primaryActionLabelFor(notification),
                  secondaryActionLabel: _secondaryActionLabelFor(notification),
                  icon: _iconFor(notification),
                  label: _labelFor(notification),
                  onArchive: _archiving ? null : () => _archive(notification),
                  onPrimaryAction: () => _openNotificationDetail(notification),
                  onSecondaryAction: _resolveSecondaryAction(notification),
                ),
              ),
            ),
        ],
      ),
    );
  }

  List<CustomerNotificationItem> _filteredNotifications() {
    return _notifications.where((notification) {
      final category = _categoryFor(notification);
      return switch (_selectedFilter) {
        _NotificationFilter.all => true,
        _NotificationFilter.agenda => category == _NotificationCategory.agenda,
        _NotificationFilter.campaigns =>
          category == _NotificationCategory.campaigns,
        _NotificationFilter.loyalty =>
          category == _NotificationCategory.loyalty,
        _NotificationFilter.gallery =>
          category == _NotificationCategory.gallery,
      };
    }).toList();
  }

  Future<void> _archive(CustomerNotificationItem notification) async {
    await _archiveItems([notification]);
  }

  Future<void> _archiveItems(List<CustomerNotificationItem> items) async {
    if (items.isEmpty || _archiving) {
      return;
    }

    setState(() => _archiving = true);

    try {
      await widget.onArchiveNotifications(items);
      if (!mounted) {
        return;
      }

      setState(() {
        _notifications = [
          for (final item in _notifications)
            if (!items.any((archived) => archived.readKey == item.readKey))
              item,
        ];
      });
    } finally {
      if (mounted) {
        setState(() => _archiving = false);
      }
    }
  }

  Future<void> _openNotificationDetail(
    CustomerNotificationItem notification,
  ) async {
    await Navigator.of(context).push(
      SalonPageRoute<void>(
        builder: (_) => NotificationAlertScreen(
          notification: NotificationTapPayload(
            type: notification.type,
            title: notification.title,
            body: notification.body,
            receivedAt: notification.createdAt,
            data: {
              ...notification.payload,
              'notificationId': notification.id,
              'type': notification.type,
              'title': notification.title,
              'body': notification.body,
            },
          ),
        ),
      ),
    );
  }

  VoidCallback? _resolveSecondaryAction(CustomerNotificationItem notification) {
    final action = switch (_categoryFor(notification)) {
      _NotificationCategory.agenda => widget.onOpenAgenda,
      _NotificationCategory.gallery => widget.onOpenGallery,
      _NotificationCategory.loyalty => widget.onOpenWallet,
      _NotificationCategory.campaigns => widget.onOpenPromotions,
      _NotificationCategory.general => null,
    };

    if (action == null) {
      return null;
    }

    return () {
      Navigator.of(context).maybePop();
      action();
    };
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.notification,
    required this.icon,
    required this.label,
    required this.onArchive,
    this.primaryActionLabel,
    this.secondaryActionLabel,
    this.onPrimaryAction,
    this.onSecondaryAction,
  });

  final CustomerNotificationItem notification;
  final IconData icon;
  final String label;
  final VoidCallback? onArchive;
  final String? primaryActionLabel;
  final String? secondaryActionLabel;
  final VoidCallback? onPrimaryAction;
  final VoidCallback? onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    return PremiumSurfaceCard(
      tone: notification.isRead
          ? PremiumSurfaceTone.secondary
          : PremiumSurfaceTone.contrast,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: context.premiumTheme.buttonGradient,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: context.premiumTheme.onAccent),
          ),
          const SizedBox(width: PremiumSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notification.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: PremiumSpacing.xs),
                Text(
                  notification.body,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: PremiumSpacing.sm),
                Wrap(
                  spacing: PremiumSpacing.xs,
                  runSpacing: PremiumSpacing.xs,
                  children: [
                    _NotificationBadge(
                      label: DateFormat(
                        'dd/MM • HH:mm',
                      ).format(notification.createdAt),
                    ),
                    _NotificationBadge(label: label),
                    if (!notification.isRead)
                      const _NotificationBadge(label: 'Novo'),
                  ],
                ),
                if (primaryActionLabel != null && onPrimaryAction != null) ...[
                  const SizedBox(height: PremiumSpacing.md),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: onPrimaryAction,
                          icon: const Icon(Icons.visibility_rounded),
                          label: Text(primaryActionLabel!),
                        ),
                      ),
                      if (secondaryActionLabel != null &&
                          onSecondaryAction != null) ...[
                        const SizedBox(width: PremiumSpacing.sm),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: onSecondaryAction,
                            icon: const Icon(Icons.arrow_forward_rounded),
                            label: Text(secondaryActionLabel!),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: onArchive,
            icon: const Icon(Icons.archive_outlined),
          ),
        ],
      ),
    );
  }
}

class _SummaryMetricCard extends StatelessWidget {
  const _SummaryMetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 154,
      child: PremiumSurfaceCard(
        tone: PremiumSurfaceTone.secondary,
        padding: const EdgeInsets.all(PremiumSpacing.md),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: context.premiumTheme.surfaceAccent,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: context.premiumTheme.textPrimary),
            ),
            const SizedBox(width: PremiumSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: context.premiumTheme.textMuted,
                    ),
                  ),
                  const SizedBox(height: PremiumSpacing.xs),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
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

class _NotificationBadge extends StatelessWidget {
  const _NotificationBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PremiumSpacing.sm,
        vertical: PremiumSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: context.premiumTheme.surfacePrimary,
        borderRadius: BorderRadius.circular(PremiumRadius.pill),
        border: Border.all(color: context.premiumTheme.strokeSoft),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall),
    );
  }
}

_NotificationCategory _categoryFor(CustomerNotificationItem notification) {
  final type = notification.type;
  if (type == 'vacancy_alert' || type.startsWith('appointment_')) {
    return _NotificationCategory.agenda;
  }
  if (type == 'feed_post_published') {
    return _NotificationCategory.gallery;
  }
  if (type.startsWith('loyalty_') || type.startsWith('referral_')) {
    return _NotificationCategory.loyalty;
  }
  if (type.startsWith('promotion_') ||
      type.startsWith('membership_') ||
      type == 'winback_offer' ||
      type == 'smart_rebook_prompt' ||
      type.startsWith('service_')) {
    return _NotificationCategory.campaigns;
  }

  return _NotificationCategory.general;
}

String _filterLabel(_NotificationFilter filter) {
  return switch (filter) {
    _NotificationFilter.all => 'Tudo',
    _NotificationFilter.agenda => 'Agenda',
    _NotificationFilter.campaigns => 'Campanhas',
    _NotificationFilter.loyalty => 'Fidelidade',
    _NotificationFilter.gallery => 'Vitrine',
  };
}

IconData _iconFor(CustomerNotificationItem notification) {
  return switch (_categoryFor(notification)) {
    _NotificationCategory.agenda => Icons.calendar_month_rounded,
    _NotificationCategory.campaigns => Icons.local_offer_rounded,
    _NotificationCategory.loyalty => Icons.workspace_premium_rounded,
    _NotificationCategory.gallery => Icons.photo_library_outlined,
    _NotificationCategory.general => Icons.notifications_active_outlined,
  };
}

String _labelFor(CustomerNotificationItem notification) {
  return switch (_categoryFor(notification)) {
    _NotificationCategory.agenda => 'Agenda',
    _NotificationCategory.campaigns => 'Campanha',
    _NotificationCategory.loyalty => 'Benefício',
    _NotificationCategory.gallery => 'Vitrine',
    _NotificationCategory.general => 'Atualização',
  };
}

String _primaryActionLabelFor(CustomerNotificationItem notification) {
  switch (notification.type) {
    case 'appointment_confirmation_required':
      return 'Responder agora';
    case 'appointment_staff_reassigned':
      return 'Ver mudança';
    case 'appointment_confirmed':
    case 'appointment_cancelled':
    case 'appointment_completed':
    case 'appointment_reminder_1h':
    case 'appointment_auto_cancelled_unconfirmed':
      return 'Ver horário';
    case 'vacancy_alert':
      return 'Ver encaixe';
    case 'feed_post_published':
      return 'Ver inspiração';
    case 'loyalty_tier_unlocked':
    case 'loyalty_vip_unlocked':
    case 'loyalty_program_updated':
      return 'Ver benefício';
    case 'referral_reward_unlocked':
      return 'Ver recompensa';
    case 'referral_qualified':
    case 'referral_program_updated':
      return 'Ver indicação';
    case 'service_published':
    case 'service_updated':
      return 'Ver serviço';
    case 'promotion_published':
    case 'promotion_updated':
    case 'membership_published':
    case 'membership_updated':
    case 'winback_offer':
    case 'smart_rebook_prompt':
      return 'Ver campanha';
    default:
      return 'Ver aviso';
  }
}

String? _secondaryActionLabelFor(CustomerNotificationItem notification) {
  return switch (_categoryFor(notification)) {
    _NotificationCategory.agenda => 'Abrir agenda',
    _NotificationCategory.campaigns => 'Abrir central',
    _NotificationCategory.loyalty => 'Abrir carteira',
    _NotificationCategory.gallery => 'Abrir galeria',
    _NotificationCategory.general => null,
  };
}
