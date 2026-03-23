part of 'home_screen.dart';

mixin _HomeScreenDataMixin on _HomeScreenStateBase {
  void _loadData() {
    _homeFuture = _createHomeFuture();
  }

  Future<HomeData> _createHomeFuture() {
    final loadVersion = ++_homeLoadVersion;

    return _homeDataLoader.load(customerId: _profile.id).then((data) {
      if (loadVersion == _homeLoadVersion) {
        _handleVacancyAlertUpdates(data.vacancyAlerts);
        _cachedData = data;
      }

      return data;
    });
  }

  @override
  Future<void> _refreshData() async {
    await _refreshController.run();
  }

  Future<void> _performRefresh() async {
    if (!mounted) {
      return;
    }

    setState(_loadData);
    await _homeFuture;
  }

  @override
  void _replaceCachedData(HomeData Function(HomeData current) transform) {
    final current = _cachedData;
    if (!mounted || current == null) {
      return;
    }

    final updated = transform(current);
    setState(() {
      _cachedData = updated;
      _homeFuture = Future<HomeData>.value(updated);
    });
  }

  @override
  void _refreshDataInBackground() {
    unawaited(_runBackgroundRefresh());
  }

  Future<void> _runBackgroundRefresh() async {
    try {
      await _refreshData();
    } catch (_) {
      // Keep the current snapshot alive and let the next explicit refresh recover.
    }
  }

  @override
  void _upsertNotificationLocally(CustomerNotificationItem notification) {
    _replaceCachedData((current) {
      final notifications = [
        notification,
        ...current.notifications.where(
          (item) => item.readKey != notification.readKey,
        ),
      ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));

      return current.copyWith(notifications: notifications);
    });
  }

  @override
  void _upsertVacancyAlertLocally(VacancyAlert alert) {
    _replaceCachedData((current) {
      final alerts = [
        alert,
        ...current.vacancyAlerts.where((item) => item.id != alert.id),
      ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));
      final notification = CustomerNotificationItem.fromVacancyAlert(alert);
      final notifications = [
        notification,
        ...current.notifications.where(
          (item) => item.readKey != notification.readKey,
        ),
      ]..sort((left, right) => right.createdAt.compareTo(left.createdAt));

      return current.copyWith(
        vacancyAlerts: alerts,
        notifications: notifications,
      );
    });
  }

  @override
  void _removeVacancyAlertLocally(String alertId) {
    _replaceCachedData((current) {
      return current.copyWith(
        vacancyAlerts: current.vacancyAlerts
            .where((alert) => alert.id != alertId)
            .toList(),
        notifications: current.notifications
            .where(
              (notification) =>
                  !(notification.sourceType == 'vacancy_alert' &&
                      notification.id == alertId),
            )
            .toList(),
      );
    });
  }

  @override
  void _updateAppointmentLocally(
    String appointmentId,
    AppointmentItem Function(AppointmentItem current) transform,
  ) {
    _replaceCachedData((current) {
      final appointments = current.appointments
          .map(
            (appointment) => appointment.id == appointmentId
                ? transform(appointment)
                : appointment,
          )
          .toList();

      return current.copyWith(appointments: appointments);
    });
  }

  @override
  void _updatePostLocally(
    String postId,
    SalonPost Function(SalonPost current) transform,
  ) {
    _replaceCachedData((current) {
      final posts = current.posts
          .map((post) => post.id == postId ? transform(post) : post)
          .toList();

      return current.copyWith(posts: posts);
    });
  }

  @override
  void _markNotificationsReadLocally(Iterable<String> notificationKeys) {
    final keySet = notificationKeys.toSet();
    if (keySet.isEmpty) {
      return;
    }

    _replaceCachedData((current) {
      final notifications = current.notifications
          .map(
            (item) => keySet.contains(item.readKey)
                ? item.copyWith(isRead: true)
                : item,
          )
          .toList();

      return current.copyWith(notifications: notifications);
    });
  }
}
