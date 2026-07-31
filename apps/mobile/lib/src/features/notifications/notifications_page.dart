import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/salon_ui.dart';
import 'customer_notifications_controller.dart';
import 'device_notification_service.dart';
import 'notification_models.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({
    super.key,
    required this.controller,
    required this.deviceNotificationService,
    required this.onNavigate,
  });

  final CustomerNotificationsController controller;
  final DeviceNotificationService deviceNotificationService;
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([controller, deviceNotificationService]),
      builder: (context, _) {
        final items = controller.notifications;
        final preview =
            controller.sessionController.session?.landingData?.preview;
        final notificationHealth = deviceNotificationService.healthState;
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
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                itemBuilder: (context, index) {
                  if (notificationHealth.showsCustomerCard) {
                    if (index == 0) {
                      return _NotificationHealthCard(
                        state: notificationHealth,
                        onRetry: notificationHealth.canRetry
                            ? deviceNotificationService.retryActivation
                            : null,
                      );
                    }
                    index -= 1;
                  }

                  if (controller.isLoadingInbox && items.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: 40),
                      child: Center(child: CircularProgressIndicator()),
                    );
                  }

                  if (items.isEmpty) {
                    return const EmptyStateCard(
                      title: 'Nenhum aviso por agora',
                      message:
                          'Quando o salão mexer em algo importante, o sino começa a sinalizar aqui.',
                      icon: Icons.notifications_none_rounded,
                    );
                  }

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
                separatorBuilder: (context, index) => const SizedBox(height: 12),
                itemCount: (notificationHealth.showsCustomerCard ? 1 : 0) +
                    (controller.isLoadingInbox && items.isEmpty ? 1 : 0) +
                    ((!controller.isLoadingInbox && items.isEmpty) ? 1 : 0) +
                    items.length,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _NotificationHealthCard extends StatelessWidget {
  const _NotificationHealthCard({required this.state, this.onRetry});

  final DeviceNotificationHealthState state;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    final spec = AppTheme.spec(context);
    final tone = state.health == DeviceNotificationHealth.permissionDenied
        ? spec.primaryColor
        : spec.secondaryColor;

    return SalonPanel(
      accent: tone,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label: 'Lembretes do aparelho',
                icon: Icons.notifications_active_rounded,
                backgroundColor: tone.withValues(alpha: 0.12),
                foregroundColor: tone,
              ),
              if (state.systemStatus != null && state.systemStatus!.isNotEmpty)
                Pill(
                  label: state.systemStatus!,
                  icon: Icons.info_outline_rounded,
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(state.title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(state.message, style: Theme.of(context).textTheme.bodySmall),
          if (onRetry != null) ...[
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: () => onRetry!.call(),
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Atualizar lembretes'),
            ),
          ],
        ],
      ),
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
