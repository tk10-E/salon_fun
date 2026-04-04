import 'dart:async';

import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../core/notification_destination.dart';
import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../services/app_analytics_service.dart';
import '../widgets/premium_ui.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.repository});

  final SalonRepository repository;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final AppAnalyticsService _analytics = AppAnalyticsService.instance;
  bool _isLoading = true;
  Object? _error;
  List<CustomerNotificationItem> _notifications = const [];
  List<OperationalIssue> _issues = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_analytics.logScreenView('client_notifications'));
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final issues = <OperationalIssue>[];
      void collectIssue(OperationalIssue issue) {
        if (issues.any(
          (item) =>
              item.scope == issue.scope &&
              item.title == issue.title &&
              item.message == issue.message,
        )) {
          return;
        }
        issues.add(issue);
      }

      final results = await Future.wait<Object?>([
        widget.repository.getCustomerNotifications(onIssue: collectIssue),
        widget.repository.getNotificationReceiptSnapshot(onIssue: collectIssue),
      ]);

      final notifications = results[0] as List<CustomerNotificationItem>;
      final receipts = results[1] as NotificationReceiptSnapshot;
      final hydrated = notifications
          .where((item) => !receipts.archivedKeys.contains(item.readKey))
          .map(
            (item) =>
                item.copyWith(isRead: receipts.readKeys.contains(item.readKey)),
          )
          .toList(growable: false);

      final unread = hydrated
          .where((item) => !item.isRead)
          .toList(growable: false);
      if (unread.isNotEmpty) {
        unawaited(widget.repository.markNotificationsRead(unread));
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _notifications = hydrated
            .map((item) => item.copyWith(isRead: true))
            .toList(growable: false);
        _issues = issues;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error;
        _issues = const [];
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = _isLoading
        ? _buildScrollableState(
            const LoadingView(label: 'Carregando notificações...'),
          )
        : _error != null
        ? _buildScrollableState(
            ErrorStateCard(message: _error.toString(), onRetry: _load),
          )
        : _notifications.isEmpty
        ? _buildScrollableState(
            Column(
              children: [
                if (_issues.isNotEmpty) ...[
                  OperationalNoticeCard(
                    title: 'A central não sincronizou tudo',
                    message: formatOperationalIssues(_issues),
                    action: OutlinedButton(
                      onPressed: _load,
                      child: const Text('Atualizar agora'),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                const EmptyStateCard(
                  title: 'Nada por aqui ainda',
                  message:
                      'Quando o salão enviar novidades, confirmações ou campanhas, elas vão aparecer nesta central.',
                ),
              ],
            ),
          )
        : ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.only(bottom: 20),
            children: [
              if (_issues.isNotEmpty) ...[
                OperationalNoticeCard(
                  title: 'Alguns avisos podem estar faltando',
                  message: formatOperationalIssues(_issues),
                  action: OutlinedButton(
                    onPressed: _load,
                    child: const Text('Sincronizar de novo'),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              for (var index = 0; index < _notifications.length; index++) ...[
                Builder(
                  builder: (context) {
                    final item = _notifications[index];
                    final destination = resolveNotificationDestination(
                      item.type,
                    );
                    return PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                              ),
                              Text(
                                formatDateTime(item.createdAt),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            item.body,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          if (!destination.opensNotificationsCenter) ...[
                            const SizedBox(height: 14),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  await _analytics.logNotificationCenterAction(
                                    type: item.type,
                                    target: destination.analyticsTarget,
                                  );
                                  if (!context.mounted) {
                                    return;
                                  }
                                  Navigator.of(context).pop(item);
                                },
                                icon: const Icon(Icons.arrow_forward_rounded),
                                label: Text(destination.actionLabel),
                              ),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
                if (index != _notifications.length - 1)
                  const SizedBox(height: 12),
              ],
            ],
          );

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Notificações'),
      ),
      body: PremiumBackground(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
        child: RefreshIndicator(onRefresh: _load, child: body),
      ),
    );
  }

  Widget _buildScrollableState(Widget child) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(top: 24, bottom: 20),
      children: [child],
    );
  }
}
