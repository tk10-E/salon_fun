import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/home/home_data_loader.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  test(
    'merges notifications, keeps read state and removes archived items',
    () async {
      final loader = HomeDataLoader(
        repository: _FakeHomeDataRepository(
          services: const [
            ServiceItem(
              id: 'svc-1',
              name: 'Corte',
              price: 50,
              duration: 30,
              sortOrder: 0,
            ),
          ],
          appointments: const [],
          vacancyAlerts: [
            VacancyAlert(
              id: 'alert-1',
              headline: 'Horario liberado',
              body: 'Hoje as 14h',
              startsAt: DateTime(2026, 3, 21, 14),
              endsAt: DateTime(2026, 3, 21, 14, 30),
              createdAt: DateTime(2026, 3, 21, 10),
              createdBy: 'salon',
              serviceId: 'svc-1',
            ),
          ],
          posts: const [],
          offers: const [],
          growthSuggestions: CustomerGrowthSuggestionFeed(
            suggestions: [
              CustomerGrowthSuggestionItem(
                id: 'growth-1',
                type: 'rebooking',
                serviceId: 'svc-1',
                serviceName: 'Corte',
                basedOnServiceName: 'Corte',
                lastVisitAt: DateTime(2026, 3, 1, 10),
                recommendedIntervalDays: 30,
                recommendedBookingDate: DateTime(2026, 3, 31, 10),
                urgency: 'due_soon',
              ),
            ],
          ),
          loyaltySummary: null,
          notifications: [
            CustomerNotificationItem(
              id: 'notif-1',
              sourceType: 'salon_notification',
              type: 'update',
              title: 'Promocao',
              body: 'Semana da beleza',
              createdAt: DateTime(2026, 3, 21, 9),
            ),
            CustomerNotificationItem(
              id: 'notif-2',
              sourceType: 'salon_notification',
              type: 'update',
              title: 'Arquivada',
              body: 'Essa nao deve aparecer',
              createdAt: DateTime(2026, 3, 20, 9),
            ),
          ],
          receiptSnapshot: const NotificationReceiptSnapshot(
            readKeys: {'salon_notification:notif-1'},
            archivedKeys: {'salon_notification:notif-2'},
          ),
          dayAvailabilityByDate: {
            '2026-03-21': DayAvailability(
              day: DateTime(2026, 3, 21),
              timezone: 'America/Sao_Paulo',
              slotStepMinutes: 30,
              serviceDuration: 30,
              isOpen: true,
              staffMembers: [],
              availableSlots: [
                AvailableSlot(
                  startAt: DateTime(2026, 3, 21, 14),
                  endsAt: DateTime(2026, 3, 21, 14, 30),
                  staffMemberId: 'staff-1',
                  staffMemberName: 'Ana',
                ),
              ],
            ),
          },
          referralSummary: null,
          smartSchedule: null,
        ),
        now: () => DateTime(2026, 3, 21, 8),
      );

      final data = await loader.load(customerId: 'customer-1');

      expect(data.notifications.map((item) => item.id), ['alert-1', 'notif-1']);
      expect(data.notifications.first.sourceType, 'vacancy_alert');
      expect(data.notifications.last.isRead, isTrue);
      expect(data.nextAvailableAt, DateTime(2026, 3, 21, 14));
      expect(data.growthSuggestions?.suggestions.single.serviceName, 'Corte');
    },
  );

  test(
    'keeps searching next available slot after an availability error',
    () async {
      final loader = HomeDataLoader(
        repository: _FakeHomeDataRepository(
          services: const [
            ServiceItem(
              id: 'svc-1',
              name: 'Escova',
              price: 80,
              duration: 45,
              sortOrder: 0,
            ),
          ],
          appointments: const [],
          vacancyAlerts: const [],
          posts: const [],
          offers: const [],
          growthSuggestions: null,
          loyaltySummary: null,
          notifications: const [],
          receiptSnapshot: const NotificationReceiptSnapshot(
            readKeys: {},
            archivedKeys: {},
          ),
          dayAvailabilityErrors: {'2026-03-21'},
          dayAvailabilityByDate: {
            '2026-03-22': DayAvailability(
              day: DateTime(2026, 3, 22),
              timezone: 'America/Sao_Paulo',
              slotStepMinutes: 30,
              serviceDuration: 45,
              isOpen: true,
              staffMembers: [],
              availableSlots: [
                AvailableSlot(
                  startAt: DateTime(2026, 3, 22, 11),
                  endsAt: DateTime(2026, 3, 22, 11, 45),
                  staffMemberId: 'staff-2',
                  staffMemberName: 'Bruna',
                ),
              ],
            ),
          },
          referralSummary: null,
          smartSchedule: null,
        ),
        now: () => DateTime(2026, 3, 21, 8),
      );

      final data = await loader.load(customerId: 'customer-1');

      expect(data.nextAvailableAt, DateTime(2026, 3, 22, 11));
    },
  );
}

class _FakeHomeDataRepository implements HomeDataRepository {
  _FakeHomeDataRepository({
    required this.services,
    required this.appointments,
    required this.vacancyAlerts,
    required this.posts,
    required this.offers,
    required this.growthSuggestions,
    required this.loyaltySummary,
    required this.notifications,
    required this.receiptSnapshot,
    this.referralSummary,
    this.smartSchedule,
    this.dayAvailabilityByDate = const {},
    this.dayAvailabilityErrors = const {},
  });

  final List<ServiceItem> services;
  final List<AppointmentItem> appointments;
  final List<VacancyAlert> vacancyAlerts;
  final List<SalonPost> posts;
  final List<SalonOfferItem> offers;
  final CustomerGrowthSuggestionFeed? growthSuggestions;
  final CustomerLoyaltySummary? loyaltySummary;
  final ReferralSummary? referralSummary;
  final List<CustomerNotificationItem> notifications;
  final NotificationReceiptSnapshot receiptSnapshot;
  final SmartScheduleOpportunityFeed? smartSchedule;
  final Map<String, DayAvailability> dayAvailabilityByDate;
  final Set<String> dayAvailabilityErrors;

  @override
  Future<List<AppointmentItem>> getAppointments() async => appointments;

  @override
  Future<List<CustomerNotificationItem>> getCustomerNotifications() async =>
      notifications;

  @override
  Future<DayAvailability> getDayAvailability({
    required String serviceId,
    required DateTime day,
  }) async {
    final key = _dayKey(day);
    if (dayAvailabilityErrors.contains(key)) {
      throw Exception('availability_failed');
    }

    return dayAvailabilityByDate[key] ??
        DayAvailability(
          day: DateTime(day.year, day.month, day.day),
          timezone: 'America/Sao_Paulo',
          slotStepMinutes: 30,
          serviceDuration: 30,
          isOpen: true,
          staffMembers: const [],
          availableSlots: const [],
        );
  }

  @override
  Future<List<SalonPost>> getFeedPosts({required String customerId}) async =>
      posts;

  @override
  Future<CustomerGrowthSuggestionFeed?> getCustomerGrowthSuggestions() async =>
      growthSuggestions;

  @override
  Future<NotificationReceiptSnapshot> getNotificationReceiptSnapshot() async =>
      receiptSnapshot;

  @override
  Future<ReferralSummary?> getReferralSummary() async => referralSummary;

  @override
  Future<CustomerLoyaltySummary?> getLoyaltySummary() async => loyaltySummary;

  @override
  Future<List<SalonOfferItem>> getSalonOffers() async => offers;

  @override
  Future<List<ServiceItem>> getServices() async => services;

  @override
  Future<SmartScheduleOpportunityFeed?> getSmartScheduleOpportunities({
    DateTime? targetDay,
  }) async => smartSchedule;

  @override
  Future<List<VacancyAlert>> getVacancyAlerts() async => vacancyAlerts;

  String _dayKey(DateTime day) {
    final month = day.month.toString().padLeft(2, '0');
    final date = day.day.toString().padLeft(2, '0');
    return '${day.year}-$month-$date';
  }
}
