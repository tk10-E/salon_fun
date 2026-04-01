import '../domain/growth_journey_models.dart';

GrowthJourneySnapshot buildGrowthJourneySampleSnapshot() {
  final now = DateTime.now();

  return GrowthJourneySnapshot(
    customerName: 'Marina',
    salonName: 'Studio Aurora',
    preferences: const GrowthUserPreferences(
      favoriteServiceIds: <String>{'service-haircut'},
      favoriteStaffMemberIds: <String>{'staff-lia'},
      preferredWeekdays: <int>{2, 4},
      preferredDayParts: <GrowthDayPart>{
        GrowthDayPart.afternoon,
        GrowthDayPart.evening,
      },
    ),
    services: const [
      GrowthServiceSummary(
        id: 'service-haircut',
        name: 'Corte premium',
        category: 'corte',
        price: 95,
        durationMinutes: 60,
      ),
      GrowthServiceSummary(
        id: 'service-treatment',
        name: 'Hidratacao gloss',
        category: 'tratamento',
        price: 55,
        durationMinutes: 30,
      ),
      GrowthServiceSummary(
        id: 'service-color',
        name: 'Retoque de cor',
        category: 'coloracao',
        price: 180,
        durationMinutes: 120,
      ),
    ],
    visitHistory: [
      GrowthVisitHistoryEntry(
        id: 'visit-1',
        serviceId: 'service-haircut',
        serviceName: 'Corte premium',
        serviceCategory: 'corte',
        visitedAt: now.subtract(const Duration(days: 33)),
        ticketAmount: 95,
        durationMinutes: 60,
        staffMemberId: 'staff-lia',
        staffMemberName: 'Lia',
      ),
      GrowthVisitHistoryEntry(
        id: 'visit-2',
        serviceId: 'service-treatment',
        serviceName: 'Hidratacao gloss',
        serviceCategory: 'tratamento',
        visitedAt: now.subtract(const Duration(days: 54)),
        ticketAmount: 55,
        durationMinutes: 30,
        staffMemberId: 'staff-lia',
        staffMemberName: 'Lia',
      ),
      GrowthVisitHistoryEntry(
        id: 'visit-3',
        serviceId: 'service-haircut',
        serviceName: 'Corte premium',
        serviceCategory: 'corte',
        visitedAt: now.subtract(const Duration(days: 88)),
        ticketAmount: 90,
        durationMinutes: 60,
        staffMemberId: 'staff-lia',
        staffMemberName: 'Lia',
      ),
    ],
    availableWindows: [
      GrowthAvailableWindow(
        startAt: DateTime(now.year, now.month, now.day + 1, 16, 0),
        endAt: DateTime(now.year, now.month, now.day + 1, 17, 0),
        staffMemberId: 'staff-lia',
        staffMemberName: 'Lia',
      ),
      GrowthAvailableWindow(
        startAt: DateTime(now.year, now.month, now.day + 2, 11, 0),
        endAt: DateTime(now.year, now.month, now.day + 2, 12, 0),
        staffMemberId: 'staff-ana',
        staffMemberName: 'Ana',
      ),
    ],
    loyalty: const GrowthLoyaltySnapshot(
      cashbackBalance: 28,
      pointsBalance: 320,
      completedVisits: 8,
      visitsToNextTier: 1,
      availableRewardsCount: 1,
      qualifiedReferralCount: 2,
    ),
  );
}
