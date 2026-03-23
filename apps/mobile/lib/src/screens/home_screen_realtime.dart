part of 'home_screen.dart';

mixin _HomeScreenRealtimeMixin on _HomeScreenStateBase {
  void _subscribeToVacancyAlerts() {
    final channel =
        widget.repository.client
            .channel('salon-vacancy-alerts:${_profile.salonId}')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'salon_vacancy_alerts',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: _handleRealtimeVacancyAlert,
            )
          ..subscribe();

    _vacancyAlertsChannel = channel;
  }

  void _subscribeToCustomerNotifications() {
    final channel =
        widget.repository.client
            .channel('salon-customer-notifications:${_profile.salonId}')
            .onPostgresChanges(
              event: PostgresChangeEvent.insert,
              schema: 'public',
              table: 'salon_customer_notifications',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (payload) async {
                if (!mounted) {
                  return;
                }

                await _showRealtimeCustomerNotification(payload.newRecord);
                try {
                  _upsertNotificationLocally(
                    CustomerNotificationItem.fromMap(payload.newRecord),
                  );
                } catch (_) {
                  // Fallback to background sync if the payload shape changes.
                }

                _refreshDataInBackground();
              },
            )
          ..subscribe();

    _customerNotificationsChannel = channel;
  }

  void _subscribeToSalonContent() {
    final channel =
        widget.repository.client
            .channel('salon-content:${_profile.salonId}')
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'services',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'salon_offers',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'salon_loyalty_programs',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'salon_referral_programs',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'salon_posts',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'salon_id',
                value: _profile.salonId,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
            .onPostgresChanges(
              event: PostgresChangeEvent.all,
              schema: 'public',
              table: 'appointments',
              filter: PostgresChangeFilter(
                type: PostgresChangeFilterType.eq,
                column: 'customer_id',
                value: _profile.id,
              ),
              callback: (_) => _scheduleSalonContentRefresh(),
            )
          ..subscribe();

    _salonContentChannel = channel;
  }

  void _scheduleSalonContentRefresh() {
    if (!mounted) {
      return;
    }

    _contentRefreshDebounce?.cancel();
    _contentRefreshDebounce = Timer(
      const Duration(milliseconds: 350),
      () async {
        if (!mounted) {
          return;
        }

        await _refreshData();
      },
    );
  }

  Future<void> _handleRealtimeVacancyAlert(
    PostgresChangePayload payload,
  ) async {
    final newRecord = payload.newRecord;
    final alertId = newRecord['id']?.toString();
    if (alertId != null && alertId.isNotEmpty) {
      _knownVacancyAlertIds.add(alertId);
    }

    final alertBody = newRecord['body']?.toString().trim();

    if (mounted && !_suppressRealtimeVacancyNotice) {
      await _showRealtimeVacancyNotification(newRecord);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }

        final messenger = ScaffoldMessenger.of(context);
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              alertBody != null && alertBody.isNotEmpty
                  ? alertBody
                  : 'Um horário ficou livre no salão.',
            ),
            duration: const Duration(seconds: 6),
            action: SnackBarAction(
              label: 'Ver vaga',
              onPressed: () => _tabController.animateTo(0),
            ),
          ),
        );
      });
    }

    if (!mounted) {
      return;
    }

    try {
      _upsertVacancyAlertLocally(VacancyAlert.fromMap(newRecord));
    } catch (_) {
      // Ignore malformed realtime payloads and let the background sync fix the list.
    }

    _refreshDataInBackground();
  }

  Future<void> _showRealtimeCustomerNotification(
    Map<String, dynamic> newRecord,
  ) async {
    final audience = newRecord['audience']?.toString();
    final customerId = newRecord['customer_id']?.toString();
    final payloadValue = newRecord['payload'];
    final payloadMap = payloadValue is Map
        ? Map<String, dynamic>.from(payloadValue)
        : <String, dynamic>{};

    if (audience == 'single_customer' &&
        customerId != null &&
        customerId != _profile.id) {
      return;
    }

    await PushNotificationService.instance.showLocalNotificationPayload(
      NotificationTapPayload(
        type: newRecord['notification_type']?.toString() ?? 'update',
        title: newRecord['title']?.toString() ?? 'Novidade no salão',
        body:
            newRecord['body']?.toString() ??
            'Confira a atualização mais recente no app do salão.',
        receivedAt:
            DateTime.tryParse(newRecord['created_at']?.toString() ?? '') ??
            DateTime.now(),
        data: {
          ...payloadMap,
          'notificationId': newRecord['id']?.toString() ?? '',
          'title': newRecord['title']?.toString() ?? 'Novidade no salão',
          'body':
              newRecord['body']?.toString() ??
              'Confira a atualização mais recente no app do salão.',
          'type': newRecord['notification_type']?.toString() ?? 'update',
          'salonId': _profile.salonId,
        },
      ),
    );
  }

  Future<void> _showRealtimeVacancyNotification(
    Map<String, dynamic> newRecord,
  ) async {
    await PushNotificationService.instance.showLocalNotificationPayload(
      NotificationTapPayload(
        type: 'vacancy_alert',
        title: newRecord['headline']?.toString() ?? 'Horário liberado',
        body:
            newRecord['body']?.toString() ??
            'Um horário ficou disponível no salão.',
        receivedAt:
            DateTime.tryParse(newRecord['created_at']?.toString() ?? '') ??
            DateTime.now(),
        data: {
          'alertId': newRecord['id']?.toString() ?? '',
          'title': newRecord['headline']?.toString() ?? 'Horário liberado',
          'body':
              newRecord['body']?.toString() ??
              'Um horário ficou disponível no salão.',
          'type': 'vacancy_alert',
          'startsAt': newRecord['starts_at']?.toString() ?? '',
          'salonId': _profile.salonId,
        },
      ),
    );
  }

  @override
  void _handleVacancyAlertUpdates(List<VacancyAlert> alerts) {
    final alertIds = alerts.map((alert) => alert.id).toSet();

    if (!_primedVacancyAlerts) {
      _knownVacancyAlertIds
        ..clear()
        ..addAll(alertIds);
      _primedVacancyAlerts = true;
      return;
    }

    final newAlerts = alertIds.difference(_knownVacancyAlertIds);
    _knownVacancyAlertIds
      ..clear()
      ..addAll(alertIds);

    if (newAlerts.isEmpty || !mounted) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }

      final count = newAlerts.length;
      _showMessage(
        count == 1
            ? 'Um novo horário foi liberado no salão.'
            : '$count horários foram liberados no salão.',
      );
    });
  }
}
