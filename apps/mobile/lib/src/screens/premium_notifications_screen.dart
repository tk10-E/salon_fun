import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../theme/design_tokens.dart';
import '../theme/salon_branding.dart';
import '../theme/tenant_theme.dart';
import '../widgets/premium_empty_state.dart';
import '../widgets/premium_section_header.dart';
import '../widgets/premium_surface_card.dart';

class PremiumNotificationsScreen extends StatefulWidget {
  const PremiumNotificationsScreen({
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
  State<PremiumNotificationsScreen> createState() =>
      _PremiumNotificationsScreenState();
}

class _PremiumNotificationsScreenState
    extends State<PremiumNotificationsScreen> {
  late List<CustomerNotificationItem> _notifications = [
    ...widget.notifications,
  ];
  bool _archiving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notificacoes')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        children: [
          PremiumSectionHeader(
            title: 'Notificações do salão',
            subtitle:
                'Lembretes, campanhas e sinais do salao organizados com prioridade visual.',
            actionLabel: _notifications.isEmpty || _archiving
                ? null
                : 'Apagar avisos',
            onAction: _notifications.isEmpty || _archiving
                ? null
                : _archiveReadNotifications,
          ),
          const SizedBox(height: PremiumSpacing.lg),
          if (_notifications.isEmpty)
            const PremiumEmptyState(
              eyebrow: 'Tudo em dia',
              title: 'Nenhum aviso por enquanto',
              message:
                  'Quando houver atualizacoes do salao, elas aparecerao aqui com a mesma identidade premium do app.',
              icon: Icons.notifications_none_rounded,
            )
          else
            ..._notifications.map(
              (notification) => Padding(
                padding: const EdgeInsets.only(bottom: PremiumSpacing.md),
                child: PremiumSurfaceCard(
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
                        child: Icon(
                          _iconFor(notification),
                          color: context.premiumTheme.onAccent,
                        ),
                      ),
                      const SizedBox(width: PremiumSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              notification.title,
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
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
                                _NotificationBadge(
                                  label: _labelFor(notification),
                                ),
                                if (!notification.isRead)
                                  const _NotificationBadge(label: 'Novo'),
                              ],
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: _archiving
                            ? null
                            : () => _archive(notification),
                        icon: const Icon(Icons.archive_outlined),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _archiveReadNotifications() async {
    final items = [..._notifications];
    await _archiveItems(items);
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

  IconData _iconFor(CustomerNotificationItem notification) {
    switch (notification.type) {
      case 'vacancy_alert':
        return Icons.flash_on_rounded;
      case 'promotion':
        return Icons.local_offer_outlined;
      case 'appointment_confirmation_required':
        return Icons.event_available_rounded;
      default:
        return Icons.notifications_active_outlined;
    }
  }

  String _labelFor(CustomerNotificationItem notification) {
    switch (notification.type) {
      case 'vacancy_alert':
        return 'Encaixe';
      case 'promotion':
        return 'Promocao';
      case 'appointment_confirmation_required':
        return 'Lembrete';
      default:
        return 'Atualizacao';
    }
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
