import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/serialized_refresh_controller.dart';
import '../features/home/home_data.dart';
import '../features/home/home_data_loader.dart';
import '../models/app_models.dart';
import '../repositories/salon_repository.dart';
import '../services/push_notification_service.dart';
import '../services/push_token_sync_service.dart';
import '../theme/salon_branding.dart';
import '../widgets/app_backdrop.dart';
import '../widgets/cancel_appointment_sheet.dart';
import '../widgets/customer_growth_suggestion_card.dart';
import '../widgets/empty_state.dart';
import '../widgets/featured_smart_schedule_card.dart';
import '../widgets/feed_comments_sheet.dart';
import '../widgets/loyalty_summary_card.dart';
import '../widgets/notification_center_sheet.dart';
import '../widgets/premium_service_card.dart';
import '../widgets/referral_program_card.dart';
import '../widgets/salon_brand_mark.dart';
import '../widgets/salon_feed_post_card.dart';
import '../widgets/salon_hero_card.dart';
import '../widgets/salon_highlight_card.dart';
import '../widgets/salon_home_skeleton.dart';
import '../widgets/salon_offer_card.dart';
import '../widgets/smart_schedule_opportunity_card.dart';
import '../widgets/status_badge.dart';
import '../widgets/soft_card.dart';
import '../widgets/vacancy_alert_card.dart';
import 'benefits_wallet_screen.dart';
import 'book_appointment_screen.dart';
import 'profile_screen.dart';

enum _AccountMenuAction { profile, wallet, signOut }

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.repository,
    required this.profile,
  });

  final SalonRepository repository;
  final CustomerProfile profile;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  late CustomerProfile _profile;
  late final TabController _tabController;
  late final HomeDataLoader _homeDataLoader;
  late final SerializedRefreshController _refreshController;
  late final PushTokenSyncService _pushTokenSyncService;
  late Future<HomeData> _homeFuture;
  HomeData? _cachedData;
  int _homeLoadVersion = 0;
  RealtimeChannel? _vacancyAlertsChannel;
  RealtimeChannel? _customerNotificationsChannel;
  RealtimeChannel? _salonContentChannel;
  Timer? _contentRefreshDebounce;
  final Set<String> _busyPostIds = <String>{};
  final Set<String> _busyVacancyAlertIds = <String>{};
  final Set<String> _bookedVacancyAlertIds = <String>{};
  final Set<String> _knownVacancyAlertIds = <String>{};
  bool _primedVacancyAlerts = false;
  bool _suppressRealtimeVacancyNotice = false;

  @override
  void initState() {
    super.initState();
    _profile = widget.profile;
    _homeDataLoader = HomeDataLoader(repository: widget.repository);
    _refreshController = SerializedRefreshController(_performRefresh);
    _pushTokenSyncService = PushTokenSyncService(repository: widget.repository);
    _tabController = TabController(length: 3, vsync: this)
      ..addListener(() {
        if (!_tabController.indexIsChanging) {
          setState(() {});
        }
      });
    _loadData();
    _subscribeToVacancyAlerts();
    _subscribeToCustomerNotifications();
    _subscribeToSalonContent();
    unawaited(_pushTokenSyncService.start());
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile.id != widget.profile.id ||
        oldWidget.profile.name != widget.profile.name ||
        oldWidget.profile.salonName != widget.profile.salonName ||
        oldWidget.profile.salonBrandColor != widget.profile.salonBrandColor ||
        oldWidget.profile.salonLogoUrl != widget.profile.salonLogoUrl) {
      _profile = widget.profile;
    }
  }

  @override
  void dispose() {
    final channel = _vacancyAlertsChannel;
    if (channel != null) {
      unawaited(widget.repository.client.removeChannel(channel));
    }
    final notificationsChannel = _customerNotificationsChannel;
    if (notificationsChannel != null) {
      unawaited(widget.repository.client.removeChannel(notificationsChannel));
    }
    final contentChannel = _salonContentChannel;
    if (contentChannel != null) {
      unawaited(widget.repository.client.removeChannel(contentChannel));
    }
    _refreshController.dispose();
    unawaited(_pushTokenSyncService.dispose());
    _contentRefreshDebounce?.cancel();
    _tabController.dispose();
    super.dispose();
  }

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

  Future<void> _openBooking(ServiceItem service) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookAppointmentScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
        ),
      ),
    );

    if (created == true) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agendamento criado com sucesso.')),
      );
      _refreshDataInBackground();
    }
  }

  Future<void> _openSuggestedBooking(
    ServiceItem service,
    SmartScheduleSuggestionItem suggestion,
  ) async {
    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookAppointmentScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
          initialDay: suggestion.suggestedStart,
          initialSlot: suggestion.suggestedStart,
          initialStaffMemberId: suggestion.staffMemberId,
          entryMessage: suggestion.headline,
        ),
      ),
    );

    if (created == true) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agendamento criado com sucesso.')),
      );
      _refreshDataInBackground();
    }
  }

  Future<void> _openGrowthSuggestion(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion,
  ) async {
    final recommendedDate = suggestion.recommendedBookingDate;
    final now = DateTime.now();
    final normalizedInitialDay = recommendedDate == null
        ? null
        : DateTime(
            recommendedDate.year,
            recommendedDate.month,
            recommendedDate.day,
          ).isBefore(DateTime(now.year, now.month, now.day))
        ? DateTime(now.year, now.month, now.day)
        : DateTime(
            recommendedDate.year,
            recommendedDate.month,
            recommendedDate.day,
          );

    final created = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => BookAppointmentScreen(
          repository: widget.repository,
          service: service,
          profile: _profile,
          initialDay: normalizedInitialDay,
          entryMessage: suggestion.hasIncentive
              ? 'Reativar sua frequência com esse serviço'
              : suggestion.isHabitBased
              ? 'Rebook inteligente baseado no seu horário de costume'
              : suggestion.isCombo
              ? 'Sugestão de combo para sua próxima visita'
              : 'Sugestão automática para você não perder o melhor momento',
        ),
      ),
    );

    if (created == true) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Agendamento criado com sucesso.')),
      );
      _refreshDataInBackground();
    }
  }

  Future<void> _claimVacancyAlert(VacancyAlert alert) async {
    if (_busyVacancyAlertIds.contains(alert.id) ||
        _bookedVacancyAlertIds.contains(alert.id)) {
      return;
    }

    setState(() => _busyVacancyAlertIds.add(alert.id));

    try {
      await widget.repository.claimVacancyAlert(alertId: alert.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _busyVacancyAlertIds.remove(alert.id);
        _bookedVacancyAlertIds.remove(alert.id);
      });
      _removeVacancyAlertLocally(alert.id);

      _showMessage('Horário marcado com sucesso.');
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _busyVacancyAlertIds.remove(alert.id));

      final raw = error.message.toLowerCase();
      if (raw.contains('vacancy_alert_not_found') ||
          raw.contains('vacancy_alert_not_available') ||
          raw.contains('time_slot_unavailable')) {
        _showMessage('Essa vaga acabou de ser ocupada.');
        _refreshDataInBackground();
        return;
      }

      if (raw.contains('customer_not_linked') ||
          raw.contains('unauthenticated')) {
        _showMessage('Entre novamente no app para reservar essa vaga.');
        return;
      }

      _showMessage('Não foi possível marcar essa vaga agora.');
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() => _busyVacancyAlertIds.remove(alert.id));
      _showMessage('Não foi possível marcar essa vaga agora.');
    }
  }

  Future<void> _cancelAppointment(AppointmentItem appointment) async {
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) =>
          CancelAppointmentSheet(serviceName: appointment.serviceName),
    );

    if (reason == null || reason.trim().isEmpty) {
      return;
    }

    try {
      await widget.repository.cancelAppointment(
        appointmentId: appointment.id,
        reason: reason,
      );
      _suppressRealtimeVacancyNotice = true;
      unawaited(
        Future<void>.delayed(const Duration(seconds: 3)).then((_) {
          _suppressRealtimeVacancyNotice = false;
        }),
      );
      _updateAppointmentLocally(
        appointment.id,
        (current) => current.copyWith(
          status: 'cancelled',
          cancelledAt: DateTime.now(),
          cancelledBy: 'salon',
          cancellationReason: reason,
          clearCompletedAt: true,
        ),
      );
      if (mounted) {
        _showMessage(
          'Horário desmarcado com sucesso. O salão recebeu o motivo do cancelamento.',
        );
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      final raw = error.message;
      if (raw.contains('cancellation_reason_required')) {
        _showMessage('Informe o motivo para concluir o cancelamento.');
        return;
      }
      if (raw.contains('appointment_already_cancelled')) {
        _showMessage('Esse horário já foi cancelado.');
        _refreshDataInBackground();
        return;
      }
      if (raw.contains('appointment_already_completed')) {
        _showMessage('Esse atendimento já foi concluído pelo salão.');
        _refreshDataInBackground();
        return;
      }
      if (raw.contains('past_appointment_cannot_be_cancelled')) {
        _showMessage(
          'Esse horário já passou e não pode mais ser cancelado pelo app.',
        );
        _refreshDataInBackground();
        return;
      }

      _showMessage('Não foi possível desmarcar esse horário agora.');
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível desmarcar esse horário agora.');
      }
    }
  }

  Future<void> _confirmAppointmentPresence(AppointmentItem appointment) async {
    try {
      await widget.repository.confirmUpcomingAppointmentPresence(
        appointmentId: appointment.id,
      );
      _updateAppointmentLocally(
        appointment.id,
        (current) => current.copyWith(
          customerPresenceConfirmedAt: DateTime.now(),
        ),
      );
      if (mounted) {
        _showMessage('Presença confirmada com sucesso.');
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (!mounted) {
        return;
      }

      final raw = error.message.toLowerCase();
      final message = raw.contains('confirmation_not_requested')
          ? 'A confirmação ainda não foi liberada para esse horário.'
          : raw.contains('appointment_already_started')
          ? 'Esse atendimento já começou.'
          : raw.contains('appointment_not_confirmed')
          ? 'Esse horário ainda não foi confirmado pelo salão.'
          : raw.contains('appointment_not_found')
          ? 'Esse horário não foi encontrado.'
          : 'Não foi possível confirmar sua presença agora.';

      _showMessage(message);
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível confirmar sua presença agora.');
      }
    }
  }

  Future<void> _signOut() async {
    await _pushTokenSyncService.deactivateCurrentToken();
    await widget.repository.signOut();
  }

  Future<void> _openBenefitsWallet([HomeData? data]) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => BenefitsWalletScreen(
          repository: widget.repository,
          profile: _profile,
          initialLoyaltySummary: data?.loyaltySummary,
          initialReferralSummary: data?.referralSummary,
        ),
      ),
    );
  }

  Future<void> _openProfile([HomeData? data]) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ProfileScreen(
          repository: widget.repository,
          profile: _profile,
          userEmail: widget.repository.currentUser?.email,
          initialLoyaltySummary: data?.loyaltySummary,
          initialReferralSummary: data?.referralSummary,
          onSignOut: _signOut,
          onWhatsApp: _openWhatsApp,
          onProfileChanged: (updatedProfile) {
            if (!mounted) {
              return;
            }

            setState(() => _profile = updatedProfile);
          },
        ),
      ),
    );
  }

  Future<void> _handleAccountMenuSelection(
    _AccountMenuAction action, [
    HomeData? data,
  ]) async {
    switch (action) {
      case _AccountMenuAction.profile:
        await _openProfile(data);
        return;
      case _AccountMenuAction.wallet:
        await _openBenefitsWallet(data);
        return;
      case _AccountMenuAction.signOut:
        await _signOut();
        return;
    }
  }

  Future<void> _openNotificationsCenter(
    List<CustomerNotificationItem> notifications,
  ) async {
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
    );

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.82,
        child: NotificationCenterSheet(
          branding: branding,
          notifications: notifications,
          onArchiveNotifications: widget.repository.archiveNotifications,
        ),
      ),
    );

    final unreadItems = notifications.where((item) => !item.isRead).toList();
    try {
      if (unreadItems.isNotEmpty) {
        await widget.repository.markNotificationsRead(unreadItems);
        _markNotificationsReadLocally(
          unreadItems.map((item) => item.readKey),
        );
      }

      if (mounted) {
        _refreshDataInBackground();
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível atualizar o status das notificações.');
      }
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _copyReferralCode(String code) async {
    if (code.trim().isEmpty) {
      return;
    }

    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) {
      return;
    }

    _showMessage('Código de indicação copiado.');
  }

  void _showWhatsAppFallback([String? message]) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message ??
              'O WhatsApp de ${_profile.salonName} ainda não foi configurado no app.',
        ),
      ),
    );
  }

  Future<void> _openWhatsApp() async {
    final whatsappDigits = _profile.salonWhatsappPhone?.replaceAll(
      RegExp(r'\D'),
      '',
    );

    if (whatsappDigits == null || whatsappDigits.length < 10) {
      _showWhatsAppFallback();
      return;
    }

    final message = Uri.encodeComponent(
      'Olá, quero agendar com ${_profile.salonName}.',
    );
    final uri = Uri.parse('https://wa.me/$whatsappDigits?text=$message');
    final launched = await launchUrl(uri, mode: LaunchMode.platformDefault);

    if (!launched && mounted) {
      _showWhatsAppFallback(
        'Não foi possível abrir o WhatsApp agora. Tente novamente em instantes.',
      );
    }
  }

  String _humanizeFeedError(String raw) {
    if (raw.contains('duplicate key')) {
      return 'Você já curtiu esta foto.';
    }
    if (raw.contains('customer_not_found')) {
      return 'Não encontramos seu perfil agora. Tente entrar novamente.';
    }
    if (raw.contains('row-level security') || raw.contains('permission')) {
      return 'Não foi possível concluir sua interação agora.';
    }
    if (raw.contains('salon_post_') || raw.contains('salon_posts')) {
      return 'O feed ainda não foi ativado no servidor.';
    }

    return 'Não foi possível concluir sua interação agora.';
  }

  Future<void> _runPostAction(
    String postId,
    Future<void> Function() action, {
    SalonPost Function(SalonPost current)? localTransform,
    String? successMessage,
  }) async {
    if (_busyPostIds.contains(postId)) {
      return;
    }

    setState(() => _busyPostIds.add(postId));

    try {
      await action();
      if (localTransform != null) {
        _updatePostLocally(postId, localTransform);
      }
      if (!mounted) {
        return;
      }

      if (successMessage != null) {
        _showMessage(successMessage);
      }
      _refreshDataInBackground();
    } on PostgrestException catch (error) {
      if (mounted) {
        _showMessage(_humanizeFeedError(error.message));
      }
    } catch (_) {
      if (mounted) {
        _showMessage('Não foi possível concluir sua interação agora.');
      }
    } finally {
      if (mounted) {
        setState(() => _busyPostIds.remove(postId));
      }
    }
  }

  Future<void> _togglePostLike(SalonPost post) async {
    final liking = !post.likedByMe;
    await _runPostAction(
      post.id,
      () async {
        if (post.likedByMe) {
          await widget.repository.unlikePost(
            postId: post.id,
            customerId: _profile.id,
          );
        } else {
          await widget.repository.likePost(postId: post.id);
        }
      },
      localTransform: (current) => current.copyWith(
        likedByMe: liking,
        likeCount: liking
            ? current.likeCount + 1
            : (current.likeCount > 0 ? current.likeCount - 1 : 0),
      ),
    );
  }

  Future<void> _openComments(SalonPost post) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: const Color(0xFFFFFBF7),
      builder: (context) => FeedCommentsSheet(
        post: post,
        branding: SalonBranding.fromName(
          _profile.salonName,
          overrideHexColor: _profile.salonBrandColor,
        ),
        onSubmitComment: (body) =>
            widget.repository.addPostComment(postId: post.id, body: body),
      ),
    );

    if (created == true) {
      if (mounted) {
        _showMessage('Comentário enviado com sucesso.');
      }
      _refreshDataInBackground();
    }
  }

  String _buildHeroSubtitle(List<ServiceItem> services) {
    final profileTagline = _profile.salonTagline?.trim();
    if (profileTagline != null && profileTagline.isNotEmpty) {
      return profileTagline;
    }

    if (services.isEmpty) {
      return 'Agenda sob medida, cuidado em cada detalhe e um atendimento que acompanha seu ritmo.';
    }

    final highlights = services
        .take(3)
        .map((service) => service.name.trim())
        .where((name) => name.isNotEmpty)
        .toList();

    return highlights.join(' • ');
  }

  String _formatNextAvailable(DateTime? slot) {
    if (slot == null) {
      return 'Consulte o salão';
    }

    final now = DateTime.now();
    final sameDay =
        slot.year == now.year && slot.month == now.month && slot.day == now.day;
    final timeFormat = DateFormat('HH:mm');

    if (sameDay) {
      return 'Hoje, ${timeFormat.format(slot)}';
    }

    return '${DateFormat('dd/MM').format(slot)} • ${timeFormat.format(slot)}';
  }

  String _todayAttendanceLabel(List<AppointmentItem> appointments) {
    final now = DateTime.now();
    final todayAppointments = appointments.where((appointment) {
      final date = appointment.date;
      return date.year == now.year &&
          date.month == now.month &&
          date.day == now.day &&
          appointment.status.toLowerCase() != 'cancelled';
    }).length;

    if (todayAppointments == 0) {
      return 'Agenda livre';
    }

    if (todayAppointments == 1) {
      return '1 atendimento';
    }

    return '$todayAppointments atendimentos';
  }

  @override
  Widget build(BuildContext context) {
    final branding = SalonBranding.fromName(
      _profile.salonName,
      overrideHexColor: _profile.salonBrandColor,
    );

    return FutureBuilder<HomeData>(
      future: _homeFuture,
      builder: (context, snapshot) {
        final data = snapshot.data ?? _cachedData;
        final isLoading =
            snapshot.connectionState == ConnectionState.waiting && data == null;
        final hasError = snapshot.hasError && data == null;
        final notificationCount =
            data?.notifications.where((item) => !item.isRead).length ?? 0;

        return Scaffold(
          appBar: AppBar(
            titleSpacing: 20,
            title: Row(
              children: [
                SalonBrandMark(
                  salonName: _profile.salonName,
                  logoUrl: _profile.salonLogoUrl,
                  branding: branding,
                  size: 44,
                  borderRadius: 16,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _profile.salonName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: branding.deep,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'Seu app do salão',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: branding.mutedText,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            foregroundColor: branding.deep,
            actions: [
              IconButton(
                onPressed: data == null
                    ? null
                    : () {
                        unawaited(_openNotificationsCenter(data.notifications));
                      },
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.notifications_none_rounded),
                    if (notificationCount > 0)
                      Positioned(
                        right: -6,
                        top: -5,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 18),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: branding.primary,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: Colors.white, width: 1.4),
                          ),
                          child: Text(
                            notificationCount > 9
                                ? '9+'
                                : notificationCount.toString(),
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                          ),
                        ),
                      ),
                  ],
                ),
                tooltip: 'Notificações',
              ),
              PopupMenuButton<_AccountMenuAction>(
                tooltip: 'Minha conta',
                onSelected: (action) {
                  unawaited(_handleAccountMenuSelection(action, data));
                },
                itemBuilder: (context) => const [
                  PopupMenuItem(
                    value: _AccountMenuAction.profile,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.person_outline_rounded),
                      title: Text('Minha conta'),
                    ),
                  ),
                  PopupMenuItem(
                    value: _AccountMenuAction.wallet,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.account_balance_wallet_outlined),
                      title: Text('Minha carteira'),
                    ),
                  ),
                  PopupMenuDivider(),
                  PopupMenuItem(
                    value: _AccountMenuAction.signOut,
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(Icons.logout_rounded),
                      title: Text('Sair'),
                    ),
                  ),
                ],
                icon: const Icon(Icons.account_circle_outlined),
              ),
            ],
            bottom: TabBar(
              controller: _tabController,
              indicatorColor: branding.primary,
              labelColor: branding.deep,
              tabs: const [
                Tab(text: 'Salão'),
                Tab(text: 'Feed'),
                Tab(text: 'Histórico'),
              ],
            ),
          ),
          body: AppBackdrop(
            child: TabBarView(
              controller: _tabController,
              children: [
                if (isLoading)
                  SalonHomeSkeleton(branding: branding)
                else if (hasError)
                  _LoadErrorView(
                    title: 'Não foi possível carregar o salão',
                    message:
                        'Verifique sua conexão e tente atualizar para buscar os dados novamente.',
                    onRetry: _refreshData,
                    accentColor: branding.primary,
                  )
                else
                  _ServicesTab(
                    profile: _profile,
                    branding: branding,
                    data: data!,
                    onRefresh: _refreshData,
                    onWhatsApp: () {
                      _openWhatsApp();
                    },
                    busyVacancyAlertIds: _busyVacancyAlertIds,
                    bookedVacancyAlertIds: _bookedVacancyAlertIds,
                    onBookVacancyAlert: _claimVacancyAlert,
                    onCopyReferral: _copyReferralCode,
                    onBook: _openBooking,
                    onBookGrowthSuggestion: _openGrowthSuggestion,
                    onBookSuggested: _openSuggestedBooking,
                    heroSubtitle: _buildHeroSubtitle(data.services),
                    nextAvailableLabel: _formatNextAvailable(
                      data.nextAvailableAt,
                    ),
                    todayAttendanceLabel: _todayAttendanceLabel(
                      data.appointments,
                    ),
                  ),
                if (isLoading)
                  SalonHomeSkeleton(branding: branding, historyMode: true)
                else if (hasError)
                  _LoadErrorView(
                    title: 'Não foi possível carregar o feed do salão',
                    message:
                        'Atualize a tela para buscar novamente as fotos e os comentários.',
                    onRetry: _refreshData,
                    accentColor: branding.primary,
                  )
                else
                  _FeedTab(
                    profile: _profile,
                    branding: branding,
                    posts: data!.posts,
                    onRefresh: _refreshData,
                    onWhatsApp: () {
                      _openWhatsApp();
                    },
                    onToggleLike: _togglePostLike,
                    onOpenComments: _openComments,
                    onBookService: _openBooking,
                    busyPostIds: _busyPostIds,
                  ),
                if (isLoading)
                  SalonHomeSkeleton(branding: branding, historyMode: true)
                else if (hasError)
                  _LoadErrorView(
                    title: 'Não foi possível carregar seu histórico',
                    message:
                        'Atualize a tela para buscar novamente os horários do salão.',
                    onRetry: _refreshData,
                    accentColor: branding.primary,
                  )
                else
                  _HistoryTab(
                    profile: _profile,
                    branding: branding,
                    appointments: data!.appointments,
                    onRefresh: _refreshData,
                    onWhatsApp: () {
                      _openWhatsApp();
                    },
                    onCancelAppointment: _cancelAppointment,
                    onConfirmAppointmentPresence: _confirmAppointmentPresence,
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ServicesTab extends StatelessWidget {
  const _ServicesTab({
    required this.profile,
    required this.branding,
    required this.data,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.busyVacancyAlertIds,
    required this.bookedVacancyAlertIds,
    required this.onBookVacancyAlert,
    required this.onCopyReferral,
    required this.onBook,
    required this.onBookGrowthSuggestion,
    required this.onBookSuggested,
    required this.heroSubtitle,
    required this.nextAvailableLabel,
    required this.todayAttendanceLabel,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final HomeData data;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final Set<String> busyVacancyAlertIds;
  final Set<String> bookedVacancyAlertIds;
  final Future<void> Function(VacancyAlert alert) onBookVacancyAlert;
  final Future<void> Function(String code) onCopyReferral;
  final Future<void> Function(ServiceItem service) onBook;
  final Future<void> Function(
    ServiceItem service,
    CustomerGrowthSuggestionItem suggestion,
  )
  onBookGrowthSuggestion;
  final Future<void> Function(
    ServiceItem service,
    SmartScheduleSuggestionItem suggestion,
  )
  onBookSuggested;
  final String heroSubtitle;
  final String nextAvailableLabel;
  final String todayAttendanceLabel;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 120),
        children: [
          SalonHeroCard(
            profile: profile,
            branding: branding,
            subtitle: heroSubtitle,
            logoUrl: profile.salonLogoUrl,
            onWhatsApp: onWhatsApp,
          ),
          const SizedBox(height: 22),
          if (data.growthSuggestions?.hasVisibleContent == true) ...[
            const _SectionIntro(
              eyebrow: 'Retorno inteligente',
              title: 'O app já sabe o que pode render sua próxima visita',
              description:
                  'Sugestões automáticas baseadas no seu último atendimento, no ciclo ideal do serviço e em oportunidades reais de retorno para o salão.',
            ),
            const SizedBox(height: 14),
            Column(
              children: data.growthSuggestions!.suggestions.take(2).map((
                suggestion,
              ) {
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) => service?.id == suggestion.serviceId,
                      orElse: () => null,
                    );

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: CustomerGrowthSuggestionCard(
                    suggestion: suggestion,
                    branding: branding,
                    onBook: matchedService == null
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Esse serviço não está disponível para agendamento agora.',
                                ),
                              ),
                            );
                          }
                        : () {
                            unawaited(
                              onBookGrowthSuggestion(
                                matchedService,
                                suggestion,
                              ),
                            );
                          },
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 6),
          ],
          if (data.smartSchedule?.hasSuggestions == true) ...[
            _SectionIntro(
              eyebrow: 'Agenda inteligente',
              title: 'Melhor encaixe real encontrado agora',
              description:
                  'Esse destaque usa a agenda real do salão e dos profissionais para mostrar o melhor horário livre do momento.',
            ),
            const SizedBox(height: 14),
            Builder(
              builder: (context) {
                final featuredSuggestion =
                    data.smartSchedule!.suggestions.first;
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) =>
                          service?.id == featuredSuggestion.suggestedService.id,
                      orElse: () => null,
                    );

                return FeaturedSmartScheduleCard(
                  suggestion: featuredSuggestion,
                  branding: branding,
                  onBook: matchedService == null
                      ? () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Esse encaixe ainda não está disponível para reserva.',
                              ),
                            ),
                          );
                        }
                      : () {
                          unawaited(
                            onBookSuggested(matchedService, featuredSuggestion),
                          );
                        },
                );
              },
            ),
            const SizedBox(height: 20),
          ],
          if (data.vacancyAlerts.isNotEmpty) ...[
            _SectionIntro(
              eyebrow: 'Horários liberados',
              title: 'Vagas abertas recentemente no salão',
              description:
                  'Quando alguém desmarca um horário, a vaga aparece aqui para você aproveitar mais rápido.',
            ),
            const SizedBox(height: 14),
            Column(
              children: data.vacancyAlerts
                  .map(
                    (alert) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: VacancyAlertCard(
                        alert: alert,
                        branding: branding,
                        isBooking: busyVacancyAlertIds.contains(alert.id),
                        isBooked: bookedVacancyAlertIds.contains(alert.id),
                        onBook: () {
                          unawaited(onBookVacancyAlert(alert));
                        },
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 14),
          ],
          _SectionIntro(
            eyebrow: 'Destaques do dia',
            title: 'Tudo o que você precisa ver antes de agendar',
            description:
                'Informações rápidas para você decidir sem perder tempo.',
          ),
          const SizedBox(height: 14),
          _HighlightsGrid(
            branding: branding,
            nextAvailableLabel: nextAvailableLabel,
            serviceCount: data.services.length,
            todayAttendanceLabel: todayAttendanceLabel,
          ),
          if ((data.smartSchedule?.suggestions.length ?? 0) > 1) ...[
            const SizedBox(height: 28),
            const _SectionIntro(
              eyebrow: 'Agenda inteligente',
              title: 'Outros encaixes encontrados para hoje',
              description:
                  'Além do destaque principal, estes horários também cabem na agenda real do salão sem criar conflito.',
            ),
            const SizedBox(height: 16),
            Column(
              children: data.smartSchedule!.suggestions.skip(1).take(3).map((
                suggestion,
              ) {
                final matchedService = data.services
                    .cast<ServiceItem?>()
                    .firstWhere(
                      (service) =>
                          service?.id == suggestion.suggestedService.id,
                      orElse: () => null,
                    );

                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: SmartScheduleOpportunityCard(
                    suggestion: suggestion,
                    branding: branding,
                    onBook: matchedService == null
                        ? () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Esse encaixe ainda não está disponível para reserva.',
                                ),
                              ),
                            );
                          }
                        : () {
                            unawaited(
                              onBookSuggested(matchedService, suggestion),
                            );
                          },
                  ),
                );
              }).toList(),
            ),
          ],
          if (data.loyaltySummary?.hasVisibleContent == true) ...[
            const SizedBox(height: 28),
            _SectionIntro(
              eyebrow: data.loyaltySummary?.isVip == true
                  ? 'Clube VIP'
                  : 'Ranking e fidelidade',
              title: data.loyaltySummary?.isVip == true
                  ? 'Seu lugar no topo do salão'
                  : 'Cada visita acumula vantagem real',
              description: data.loyaltySummary?.isVip == true
                  ? 'Seu status VIP, cashback e desconto progressivo ficam atualizados aqui sempre que um atendimento é concluído.'
                  : 'Pontos por visita, ranking, cashback e desconto progressivo aparecem aqui no ritmo da sua frequência no salão.',
            ),
            const SizedBox(height: 16),
            LoyaltySummaryCard(
              summary: data.loyaltySummary!,
              branding: branding,
            ),
          ],
          if (data.referralSummary?.hasVisibleContent == true) ...[
            const SizedBox(height: 28),
            _SectionIntro(
              eyebrow:
                  data.referralSummary?.qualifiedCount != null &&
                      data.referralSummary!.qualifiedCount > 0
                  ? 'Indicações validadas'
                  : 'Indicação válida',
              title:
                  data.referralSummary?.qualifiedCount != null &&
                      data.referralSummary!.qualifiedCount > 0
                  ? 'Seu benefício já foi liberado'
                  : 'Compartilhe seu código pelo app',
              description:
                  data.referralSummary?.qualifiedCount != null &&
                      data.referralSummary!.qualifiedCount > 0
                  ? 'Quando a indicação conclui a visita, o benefício aparece aqui com o andamento atualizado.'
                  : 'A indicação só vira benefício quando a pessoa entra no app, agenda e conclui a primeira visita no salão.',
            ),
            const SizedBox(height: 16),
            ReferralProgramCard(
              summary: data.referralSummary!,
              branding: branding,
              onCopyCode: () {
                unawaited(onCopyReferral(data.referralSummary!.referralCode));
              },
            ),
          ],
          if (data.offers.isNotEmpty) ...[
            const SizedBox(height: 28),
            const _SectionIntro(
              eyebrow: 'Promoções e planos',
              title: 'Campanhas publicadas pelo salão',
              description:
                  'Tudo o que o salão ativou no painel aparece aqui com vigência e valor reais.',
            ),
            const SizedBox(height: 16),
            Column(
              children: data.offers
                  .map(
                    (offer) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: SalonOfferCard(offer: offer, branding: branding),
                    ),
                  )
                  .toList(),
            ),
          ],
          const SizedBox(height: 28),
          _SectionIntro(
            eyebrow: 'Serviços do salão',
            title: 'Escolha seu próximo cuidado',
            description:
                'Cards mais claros, preços visíveis e reserva direta pelo app.',
          ),
          const SizedBox(height: 16),
          if (data.services.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.auto_awesome_rounded,
              eyebrow: 'Agenda em preparacao',
              title: 'Os serviços ainda não apareceram por aqui',
              message:
                  'Assim que ${profile.salonName} liberar os atendimentos no app, você já poderá reservar seus horários.',
              actionLabel: 'Falar com salão',
              onAction: onWhatsApp,
              accentColor: branding.primary,
            )
          else
            _ServicesGrid(
              branding: branding,
              services: data.services,
              onBook: onBook,
            ),
        ],
      ),
    );
  }
}

class _HistoryTab extends StatelessWidget {
  const _HistoryTab({
    required this.profile,
    required this.branding,
    required this.appointments,
    required this.onCancelAppointment,
    required this.onConfirmAppointmentPresence,
    required this.onRefresh,
    required this.onWhatsApp,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<AppointmentItem> appointments;
  final Future<void> Function(AppointmentItem appointment) onCancelAppointment;
  final Future<void> Function(AppointmentItem appointment)
  onConfirmAppointmentPresence;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    if (appointments.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            _HistoryBrandHeader(
              profile: profile,
              branding: branding,
              appointmentCount: appointments.length,
            ),
            const SizedBox(height: 20),
            const _SectionIntro(
              eyebrow: 'Seu histórico',
              title: 'Seus horários vão aparecer aqui',
              description:
                  'Assim que você fizer um agendamento, será fácil acompanhar status, datas e serviços.',
            ),
            const SizedBox(height: 16),
            EmptyState(
              centered: true,
              icon: Icons.history_toggle_off_rounded,
              eyebrow: 'Nenhum horário ainda',
              title: 'Seu histórico está vazio',
              message:
                  'Quando você reservar um atendimento, o salão e seus horários vão ficar salvos aqui.',
              actionLabel: 'Falar com salão',
              onAction: onWhatsApp,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        itemCount: appointments.length + 1,
        separatorBuilder: (_, index) => index == 0
            ? const SizedBox(height: 18)
            : const SizedBox(height: 14),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _HistoryBrandHeader(
                  profile: profile,
                  branding: branding,
                  appointmentCount: appointments.length,
                ),
                const SizedBox(height: 20),
                const _SectionIntro(
                  eyebrow: 'Seu histórico',
                  title: 'Acompanhe seus atendimentos com clareza',
                  description:
                      'Datas, horários e status organizados para ficar fácil revisar cada visita.',
                ),
              ],
            );
          }

          final appointment = appointments[index - 1];
          return _AppointmentCard(
            appointment: appointment,
            branding: branding,
            onCancelAppointment: onCancelAppointment,
            onConfirmAppointmentPresence: onConfirmAppointmentPresence,
          );
        },
      ),
    );
  }
}

class _FeedTab extends StatelessWidget {
  const _FeedTab({
    required this.profile,
    required this.branding,
    required this.posts,
    required this.onRefresh,
    required this.onWhatsApp,
    required this.onToggleLike,
    required this.onOpenComments,
    required this.onBookService,
    required this.busyPostIds,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final List<SalonPost> posts;
  final Future<void> Function() onRefresh;
  final VoidCallback onWhatsApp;
  final Future<void> Function(SalonPost post) onToggleLike;
  final Future<void> Function(SalonPost post) onOpenComments;
  final Future<void> Function(ServiceItem service) onBookService;
  final Set<String> busyPostIds;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          _HistoryBrandHeader(
            profile: profile,
            branding: branding,
            appointmentCount: posts.length,
            collectionLabel: posts.length == 1
                ? '1 publicação no feed do salão'
                : '${posts.length} publicações no feed do salão',
            fallbackMessage:
                'Resultados, novidades e inspirações com a identidade do seu salão.',
          ),
          const SizedBox(height: 20),
          const _SectionIntro(
            eyebrow: 'Feed do salão',
            title: 'Resultados, novidades e inspirações',
            description:
                'Veja as últimas fotos publicadas pelo salão, curta e deixe um comentário pelo app.',
          ),
          const SizedBox(height: 16),
          if (posts.isEmpty)
            EmptyState(
              centered: true,
              icon: Icons.photo_library_outlined,
              eyebrow: 'Feed em preparacao',
              title: 'As fotos do salão vão aparecer aqui',
              message:
                  'Quando o salão publicar seus resultados, você vai poder curtir e comentar sem sair do app.',
              actionLabel: 'Falar com salão',
              onAction: onWhatsApp,
              accentColor: branding.primary,
            )
          else
            Column(
              children: posts
                  .map(
                    (post) => Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: SalonFeedPostCard(
                        post: post,
                        branding: branding,
                        interactionBusy: busyPostIds.contains(post.id),
                        onToggleLike: () => onToggleLike(post),
                        onOpenComments: () => onOpenComments(post),
                        onBookService: post.linkedService == null
                            ? null
                            : () => onBookService(post.linkedService!),
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }
}

class _HistoryBrandHeader extends StatelessWidget {
  const _HistoryBrandHeader({
    required this.profile,
    required this.branding,
    required this.appointmentCount,
    this.collectionLabel,
    this.fallbackMessage,
  });

  final CustomerProfile profile;
  final SalonBranding branding;
  final int appointmentCount;
  final String? collectionLabel;
  final String? fallbackMessage;

  @override
  Widget build(BuildContext context) {
    final upcomingCount = appointmentCount;
    final summaryLabel =
        collectionLabel ??
        (upcomingCount == 1
            ? '1 horário salvo no seu histórico'
            : '$upcomingCount horários salvos no seu histórico');

    return SoftCard(
      padding: const EdgeInsets.all(20),
      gradient: LinearGradient(
        colors: [
          branding.surface,
          Color.lerp(branding.soft, Colors.white, 0.2)!,
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderColor: branding.outline,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SalonBrandMark(
            salonName: profile.salonName,
            logoUrl: profile.salonLogoUrl,
            branding: branding,
            size: 58,
            borderRadius: 20,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  profile.salonName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: branding.deep),
                ),
                const SizedBox(height: 6),
                Text(
                  profile.salonTagline?.trim().isNotEmpty == true
                      ? profile.salonTagline!
                      : fallbackMessage ??
                            'Seu histórico de cuidados fica salvo aqui, com a cara do seu salão.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: branding.deep.withValues(alpha: 0.82),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.74),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: branding.outline.withValues(alpha: 0.9),
                    ),
                  ),
                  child: Text(
                    summaryLabel,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: branding.deep,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HighlightsGrid extends StatelessWidget {
  const _HighlightsGrid({
    required this.branding,
    required this.nextAvailableLabel,
    required this.serviceCount,
    required this.todayAttendanceLabel,
  });

  final SalonBranding branding;
  final String nextAvailableLabel;
  final int serviceCount;
  final String todayAttendanceLabel;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 860
            ? 3
            : constraints.maxWidth >= 520
            ? 2
            : 1;
        final spacing = 14.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.schedule_rounded,
                label: 'Próximo horário disponível',
                value: nextAvailableLabel,
                note: 'Atualizado a partir da agenda do salão',
                branding: branding,
              ),
            ),
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.auto_awesome_rounded,
                label: 'Serviços do salão',
                value: serviceCount == 1
                    ? '1 serviço'
                    : '$serviceCount serviços',
                note: 'Escolha em poucos toques',
                branding: branding,
              ),
            ),
            SizedBox(
              width: width,
              child: SalonHighlightCard(
                icon: Icons.today_rounded,
                label: 'Atendimento hoje',
                value: todayAttendanceLabel,
                note: 'Visão rápida da agenda do dia',
                branding: branding,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ServicesGrid extends StatelessWidget {
  const _ServicesGrid({
    required this.branding,
    required this.services,
    required this.onBook,
  });

  final SalonBranding branding;
  final List<ServiceItem> services;
  final Future<void> Function(ServiceItem service) onBook;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1080
            ? 3
            : constraints.maxWidth >= 720
            ? 2
            : 1;
        final spacing = 16.0;
        final width =
            (constraints.maxWidth - spacing * (columns - 1)) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: services
              .map(
                (service) => SizedBox(
                  width: width,
                  child: PremiumServiceCard(
                    service: service,
                    branding: branding,
                    onBook: () => onBook(service),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _LoadErrorView extends StatelessWidget {
  const _LoadErrorView({
    required this.title,
    required this.message,
    required this.onRetry,
    required this.accentColor,
  });

  final String title;
  final String message;
  final Future<void> Function() onRetry;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(20),
      children: [
        EmptyState(
          centered: true,
          icon: Icons.cloud_off_rounded,
          eyebrow: 'Sem conexão com o salão',
          title: title,
          message: message,
          actionLabel: 'Tentar novamente',
          onAction: onRetry,
          accentColor: accentColor,
        ),
      ],
    );
  }
}

class _SectionIntro extends StatelessWidget {
  const _SectionIntro({
    required this.eyebrow,
    required this.title,
    required this.description,
  });

  final String eyebrow;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(eyebrow, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(description, style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _AppointmentCard extends StatelessWidget {
  const _AppointmentCard({
    required this.appointment,
    required this.branding,
    required this.onCancelAppointment,
    required this.onConfirmAppointmentPresence,
  });

  final AppointmentItem appointment;
  final SalonBranding branding;
  final Future<void> Function(AppointmentItem appointment) onCancelAppointment;
  final Future<void> Function(AppointmentItem appointment)
  onConfirmAppointmentPresence;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('dd/MM/yyyy');
    final timeFormat = DateFormat('HH:mm');
    final currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

    return SoftCard(
      padding: EdgeInsets.zero,
      borderColor: branding.outline.withValues(alpha: 0.72),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: branding.primary.withValues(alpha: 0.84),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        appointment.serviceName,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    const SizedBox(width: 12),
                    StatusBadge(status: appointment.status),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  '${dateFormat.format(appointment.date)} • ${timeFormat.format(appointment.date)}',
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: branding.deep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _HistoryMetaChip(
                      icon: Icons.schedule_rounded,
                      label: '${appointment.serviceDuration} min',
                      backgroundColor: branding.highlightBackground,
                      foregroundColor: branding.deep,
                    ),
                    _HistoryMetaChip(
                      icon: Icons.sell_rounded,
                      label: currency.format(appointment.servicePrice),
                      backgroundColor: const Color(0xFFF8F1E8),
                      foregroundColor: const Color(0xFF7D4E30),
                    ),
                    if (appointment.staffMemberName != null)
                      _HistoryMetaChip(
                        icon: Icons.person_rounded,
                        label: appointment.staffMemberName!,
                        backgroundColor: const Color(0xFFF7EFE7),
                        foregroundColor: const Color(0xFF6F4A32),
                      ),
                  ],
                ),
                if (appointment.status == 'cancelled' &&
                    appointment.cancellationReason != null) ...[
                  const SizedBox(height: 14),
                  Text(
                    'Motivo informado: ${appointment.cancellationReason}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF7D6657),
                    ),
                  ),
                ],
                if (appointment.status == 'cancelled' &&
                    appointment.cancelledBy != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    appointment.cancelledBy == 'customer'
                        ? 'Cancelamento enviado por você ao salão.'
                        : appointment.cancelledBy == 'system'
                        ? 'Esse horário foi liberado automaticamente porque a presença não foi confirmada a tempo.'
                        : 'Esse horário foi cancelado pelo salão.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF8B7366),
                    ),
                  ),
                ],
                if (appointment.status == 'completed' &&
                    appointment.completedAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Atendimento concluído em ${dateFormat.format(appointment.completedAt!)} às ${timeFormat.format(appointment.completedAt!)}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF587091),
                    ),
                  ),
                ],
                if (appointment.customerPresenceConfirmedAt != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Presença confirmada em ${dateFormat.format(appointment.customerPresenceConfirmedAt!)} às ${timeFormat.format(appointment.customerPresenceConfirmedAt!)}.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF2E6B4B),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if (appointment.requiresPresenceConfirmation) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F1E8),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE7D6C4)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Confirme sua presença para manter esse horário',
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF2F231C),
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'O salão pediu sua confirmação final. Se você não puder comparecer, cancele agora para liberar a agenda.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: const Color(0xFF765E4E)),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            FilledButton.icon(
                              onPressed: () =>
                                  onConfirmAppointmentPresence(appointment),
                              icon: const Icon(Icons.verified_user_rounded),
                              label: const Text('Confirmar presença'),
                            ),
                            OutlinedButton.icon(
                              onPressed: () => onCancelAppointment(appointment),
                              icon: const Icon(Icons.event_busy_rounded),
                              label: const Text('Cancelar horário'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ] else if (appointment.canBeCancelled) ...[
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: () => onCancelAppointment(appointment),
                      icon: const Icon(Icons.event_busy_rounded, size: 18),
                      label: const Text('Desmarcar horário'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryMetaChip extends StatelessWidget {
  const _HistoryMetaChip({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: foregroundColor),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: foregroundColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
