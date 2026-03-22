import '../../models/app_models.dart';
import 'home_data.dart';

abstract interface class HomeDataRepository {
  Future<List<ServiceItem>> getServices();

  Future<List<AppointmentItem>> getAppointments();

  Future<List<VacancyAlert>> getVacancyAlerts();

  Future<List<SalonPost>> getFeedPosts({required String customerId});

  Future<List<SalonOfferItem>> getSalonOffers();

  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions();

  Future<CustomerLoyaltySummary?> getLoyaltySummary();

  Future<ReferralSummary?> getReferralSummary();

  Future<List<CustomerNotificationItem>> getCustomerNotifications();

  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot();

  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  });

  Future<SmartScheduleOpportunityFeed?> getSmartScheduleOpportunities({
    DateTime? targetDay,
  });
}

class HomeDataLoader {
  HomeDataLoader({
    required this.repository,
    DateTime Function()? now,
    this.lookAheadDays = 14,
  }) : _now = now ?? DateTime.now;

  final HomeDataRepository repository;
  final DateTime Function() _now;
  final int lookAheadDays;

  Future<HomeData> load({required String customerId}) async {
    final servicesFuture = repository.getServices();
    final nextAvailableAtFuture = servicesFuture.then(_findNextAvailableSlot);
    final appointmentsFuture = repository.getAppointments();
    final vacancyAlertsFuture = repository.getVacancyAlerts();
    final postsFuture = repository.getFeedPosts(customerId: customerId);
    final offersFuture = repository.getSalonOffers();
    final growthSuggestionsFuture = repository.getCustomerGrowthSuggestions();
    final loyaltySummaryFuture = repository.getLoyaltySummary();
    final referralSummaryFuture = repository.getReferralSummary();
    final notificationsFuture = repository.getCustomerNotifications();
    final smartScheduleFuture = repository.getSmartScheduleOpportunities();
    final receiptSnapshotFuture = repository.getNotificationReceiptSnapshot();

    final services = await servicesFuture;
    final appointments = await appointmentsFuture;
    final vacancyAlerts = await vacancyAlertsFuture;
    final posts = await postsFuture;
    final offers = await offersFuture;
    final growthSuggestions = await growthSuggestionsFuture;
    final loyaltySummary = await loyaltySummaryFuture;
    final referralSummary = await referralSummaryFuture;
    final notifications = await notificationsFuture;
    final smartSchedule = await smartScheduleFuture;
    final receiptSnapshot = await receiptSnapshotFuture;
    final nextAvailableAt = await nextAvailableAtFuture;

    return HomeData(
      services: services,
      appointments: appointments,
      vacancyAlerts: vacancyAlerts,
      posts: posts,
      offers: offers,
      growthSuggestions: growthSuggestions,
      loyaltySummary: loyaltySummary,
      referralSummary: referralSummary,
      notifications: _mergeNotifications(
        notifications: notifications,
        vacancyAlerts: vacancyAlerts,
        receiptSnapshot: receiptSnapshot,
      ),
      nextAvailableAt: nextAvailableAt,
      smartSchedule: smartSchedule,
    );
  }

  Future<DateTime?> _findNextAvailableSlot(List<ServiceItem> services) async {
    if (services.isEmpty) {
      return null;
    }

    final referenceService = services.reduce(
      (left, right) => left.duration <= right.duration ? left : right,
    );

    for (var dayOffset = 0; dayOffset < lookAheadDays; dayOffset++) {
      final targetDay = _normalizeDay(_now().add(Duration(days: dayOffset)));

      try {
        final availability = await repository.getDayAvailability(
          serviceId: referenceService.id,
          day: targetDay,
        );

        if (availability.availableSlots.isNotEmpty) {
          return availability.availableSlots.first.startAt;
        }
      } catch (_) {
        continue;
      }
    }

    return null;
  }

  List<CustomerNotificationItem> _mergeNotifications({
    required List<CustomerNotificationItem> notifications,
    required List<VacancyAlert> vacancyAlerts,
    required NotificationReceiptSnapshot receiptSnapshot,
  }) {
    return [
        ...notifications.map(
          (item) => item.copyWith(
            isRead: receiptSnapshot.readKeys.contains(item.readKey),
          ),
        ),
        ...vacancyAlerts.map(
          (alert) => CustomerNotificationItem.fromVacancyAlert(
            alert,
            isRead: receiptSnapshot.readKeys.contains(
              'vacancy_alert:${alert.id}',
            ),
          ),
        ),
      ]
      ..removeWhere(
        (item) => receiptSnapshot.archivedKeys.contains(item.readKey),
      )
      ..sort((left, right) => right.createdAt.compareTo(left.createdAt));
  }

  DateTime _normalizeDay(DateTime date) {
    return DateTime(date.year, date.month, date.day);
  }
}
