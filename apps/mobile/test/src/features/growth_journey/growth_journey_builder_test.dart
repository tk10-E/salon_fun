import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/growth_journey/application/growth_journey_builder.dart';
import 'package:salon_client/src/features/growth_journey/data/growth_journey_sample_data.dart';
import 'package:salon_client/src/features/growth_journey/domain/growth_journey_models.dart';

void main() {
  group('GrowthJourneyBuilder', () {
    test('builds a due-now routine for an overdue haircut cadence', () {
      final builder = GrowthJourneyBuilder();
      final playbook = builder.build(buildGrowthJourneySampleSnapshot());

      expect(playbook.routineInsight.urgency, GrowthUrgency.dueNow);
      expect(playbook.recommendedService.name, 'Corte premium');
      expect(
        playbook.screen(GrowthScreenType.home).blocks.first.title,
        'Hero de rebook inteligente',
      );
    });

    test('promotes lapsed urgency when visit is far beyond the cadence', () {
      final builder = GrowthJourneyBuilder();
      final now = DateTime(2026, 3, 31);
      final snapshot = buildGrowthJourneySampleSnapshot();
      final lapsedSnapshot = GrowthJourneySnapshot(
        customerName: snapshot.customerName,
        salonName: snapshot.salonName,
        preferences: snapshot.preferences,
        services: snapshot.services,
        availableWindows: snapshot.availableWindows,
        loyalty: snapshot.loyalty,
        visitHistory: [
          GrowthVisitHistoryEntry(
            id: 'visit-lapsed',
            serviceId: 'service-haircut',
            serviceName: 'Corte premium',
            serviceCategory: 'corte',
            visitedAt: now.subtract(const Duration(days: 70)),
            ticketAmount: 95,
            durationMinutes: 60,
            staffMemberId: 'staff-lia',
            staffMemberName: 'Lia',
          ),
        ],
      );

      final playbook = builder.build(lapsedSnapshot, now: now);

      expect(playbook.routineInsight.urgency, GrowthUrgency.lapsed);
      expect(
        playbook.screen(GrowthScreenType.home).blocks.first.highlight,
        'Winback',
      );
    });
  });
}
