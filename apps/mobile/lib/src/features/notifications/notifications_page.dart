import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import 'customer_notifications_controller.dart';
import 'notification_models.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({
    super.key,
    required this.controller,
    required this.onNavigate,
  });

  final CustomerNotificationsController controller;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final items = controller.notifications;
        final preview =
            controller.sessionController.session?.landingData?.preview;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Avisos'),
            actions: [
              if (controller.unreadCount > 0)
                TextButton(
                  onPressed: controller.markAllRead,
                  child: const Text('Marcar tudo'),
                ),
            ],
          ),
          body: AppGradientBackground(
            accentColor: parseHexColor(preview?.brandColor),
            backgroundImageUrl:
                preview?.profileCoverImageUrl ?? preview?.heroImageUrl,
            bannerStyle: preview?.bannerStyle,
            child: SafeArea(
              top: false,
              child: controller.isLoadingInbox && items.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : items.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(20),
                      child: EmptyStateCard(
                        title: 'Nenhum aviso por agora',
                        message:
                            'Quando o salão mexer em algo importante, o sino começa a sinalizar aqui.',
                        icon: Icons.notifications_none_rounded,
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return _NotificationCard(
                          item: item,
                          onTap: () async {
                            await controller.markNotificationRead(item);
                            if (!context.mounted) {
                              return;
                            }
                            onNavigate(item.targetTabIndex);
                            Navigator.of(context).pop();
                          },
                        );
                      },
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 12),
                      itemCount: items.length,
                    ),
            ),
          ),
        );
      },
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final AppNotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final tone = item.isLocal ? spec.secondaryColor : spec.primaryColor;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.panelRadius),
      child: SalonPanel(
        accent: tone,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                Pill(
                  label: item.sourceLabel,
                  icon: item.isLocal
                      ? Icons.flash_on_rounded
                      : Icons.notifications_active_rounded,
                  backgroundColor: tone.withValues(alpha: 0.12),
                  foregroundColor: tone,
                ),
                if (!item.isRead)
                  Pill(
                    label: 'Novo',
                    icon: Icons.brightness_1_rounded,
                    backgroundColor: spec.accentColor,
                    foregroundColor: spec.inkColor,
                  ),
                Pill(
                  label: formatShortDate(item.createdAt),
                  icon: Icons.schedule_rounded,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(item.title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(item.body, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
