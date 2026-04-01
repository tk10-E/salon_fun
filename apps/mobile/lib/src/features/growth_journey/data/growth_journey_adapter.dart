import '../../../models/app_models.dart';
import '../domain/growth_journey_models.dart';

GrowthJourneySnapshot buildGrowthJourneySnapshotFromExisting({
  required CustomerProfile profile,
  required List<ServiceItem> services,
  required List<AppointmentItem> appointments,
  Set<String> favoriteServiceIds = const <String>{},
  Set<String> favoriteStaffMemberIds = const <String>{},
  CustomerLoyaltySummary? loyaltySummary,
  ReferralSummary? referralSummary,
  DayAvailability? availability,
  SmartScheduleOpportunityFeed? smartSchedule,
  DateTime? nextAvailableAt,
  bool allowPush = true,
  bool allowWhatsApp = true,
  bool allowPromotionalOffers = true,
}) {
  final normalizedServices = services
      .map(
        (service) => GrowthServiceSummary(
          id: service.id,
          name: service.name,
          category: service.category,
          price: service.price,
          durationMinutes: service.duration,
        ),
      )
      .toList();

  final serviceByName = <String, ServiceItem>{
    for (final service in services) _normalize(service.name): service,
  };

  final completedAppointments =
      appointments
          .where(
            (appointment) =>
                appointment.status == 'completed' ||
                appointment.completedAt != null,
          )
          .toList()
        ..sort((left, right) {
          final leftDate = left.completedAt ?? left.date;
          final rightDate = right.completedAt ?? right.date;
          return rightDate.compareTo(leftDate);
        });

  final visitHistory = completedAppointments.map((appointment) {
    final matchedService = serviceByName[_normalize(appointment.serviceName)];
    return GrowthVisitHistoryEntry(
      id: appointment.id,
      serviceId: matchedService?.id,
      serviceName: appointment.serviceName,
      serviceCategory: matchedService?.category,
      visitedAt: appointment.completedAt ?? appointment.date,
      ticketAmount: appointment.servicePrice,
      durationMinutes: appointment.serviceDuration,
      staffMemberName: appointment.staffMemberName,
    );
  }).toList();

  final preferredWeekdays = <int>{};
  final preferredDayParts = <GrowthDayPart>{};
  for (final visit in visitHistory.take(6)) {
    preferredWeekdays.add(visit.visitedAt.weekday);
    preferredDayParts.add(GrowthDayPart.fromHour(visit.visitedAt.hour));
  }

  final windows = <GrowthAvailableWindow>[
    if (availability != null)
      ...availability.availableSlots.map(
        (slot) => GrowthAvailableWindow(
          startAt: slot.startAt,
          endAt: slot.endsAt,
          staffMemberId: slot.staffMemberId,
          staffMemberName: slot.staffMemberName,
        ),
      ),
    if (smartSchedule != null)
      ...smartSchedule.suggestions.map(
        (suggestion) => GrowthAvailableWindow(
          startAt: suggestion.suggestedStart,
          endAt: suggestion.suggestedEnd,
          staffMemberId: suggestion.staffMemberId,
          staffMemberName: suggestion.staffMemberName,
        ),
      ),
    if (nextAvailableAt != null)
      GrowthAvailableWindow(
        startAt: nextAvailableAt,
        endAt: nextAvailableAt.add(const Duration(minutes: 60)),
        staffMemberName: 'Equipe do salão',
      ),
  ];

  return GrowthJourneySnapshot(
    customerName: profile.name,
    salonName: profile.salonName,
    preferences: GrowthUserPreferences(
      favoriteServiceIds: favoriteServiceIds,
      favoriteStaffMemberIds: favoriteStaffMemberIds,
      preferredWeekdays: preferredWeekdays,
      preferredDayParts: preferredDayParts,
      allowPush: allowPush,
      allowWhatsApp: allowWhatsApp,
      allowPromotionalOffers: allowPromotionalOffers,
    ),
    services: normalizedServices,
    visitHistory: visitHistory,
    availableWindows: windows,
    loyalty: GrowthLoyaltySnapshot(
      cashbackBalance: loyaltySummary?.cashbackBalance ?? 0,
      pointsBalance: loyaltySummary?.pointsBalance ?? 0,
      completedVisits: loyaltySummary?.completedVisits ?? 0,
      visitsToNextTier: loyaltySummary?.visitsToNextTier ?? 0,
      availableRewardsCount: referralSummary?.availableRewardsCount ?? 0,
      qualifiedReferralCount: referralSummary?.qualifiedCount ?? 0,
    ),
  );
}

String _normalize(String value) {
  return value
      .toLowerCase()
      .replaceAll('á', 'a')
      .replaceAll('à', 'a')
      .replaceAll('ã', 'a')
      .replaceAll('â', 'a')
      .replaceAll('é', 'e')
      .replaceAll('ê', 'e')
      .replaceAll('í', 'i')
      .replaceAll('ó', 'o')
      .replaceAll('ô', 'o')
      .replaceAll('õ', 'o')
      .replaceAll('ú', 'u')
      .replaceAll('ç', 'c');
}
