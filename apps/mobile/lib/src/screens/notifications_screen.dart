import 'dart:async';

import 'package:flutter/material.dart';

import '../core/formatters.dart';
import '../data/salon_repository.dart';
import '../models/app_models.dart';
import '../widgets/premium_ui.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.repository});

  final SalonRepository repository;

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _isLoading = true;
  Object? _error;
  List<CustomerNotificationItem> _notifications = const [];

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final results = await Future.wait<Object?>([
        widget.repository.getCustomerNotifications(),
        widget.repository.getNotificationReceiptSnapshot(),
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
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final body = _isLoading
        ? const LoadingView(label: 'Carregando notificações...')
        : _error != null
        ? ErrorStateCard(message: _error.toString(), onRetry: _load)
        : _notifications.isEmpty
        ? const EmptyStateCard(
            title: 'Nada por aqui ainda',
            message:
                'Quando o salão enviar novidades, confirmações ou campanhas, elas vão aparecer nesta central.',
          )
        : ListView.separated(
            itemCount: _notifications.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final item = _notifications[index];
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
                  ],
                ),
              );
            },
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
}
