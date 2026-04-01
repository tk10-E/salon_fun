import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/growth_journey/application/high_retention_experience_builder.dart';
import 'package:salon_client/src/features/growth_journey/data/growth_journey_sample_data.dart';
import 'package:salon_client/src/features/growth_journey/domain/growth_journey_models.dart';

void main() {
  group('HighRetentionExperienceBuilder', () {
    test('builds home sections with premium retention copy', () {
      const builder = HighRetentionExperienceBuilder();
      final model = builder.build(buildGrowthJourneySampleSnapshot());

      expect(model.home.sections.length, 6);
      expect(model.home.sections.first.title, contains('Corte premium'));
      expect(model.booking.confirmAction.label, 'Confirmar em 1 toque');
      expect(model.emotionalMessages.length, greaterThanOrEqualTo(10));
    });

    test('changes hero language when customer is lapsed', () {
      const builder = HighRetentionExperienceBuilder();
      final now = DateTime(2026, 3, 31, 19);
      final snapshot = buildGrowthJourneySampleSnapshot();
      final lapsed = GrowthJourneySnapshot(
        customerName: snapshot.customerName,
        salonName: snapshot.salonName,
        preferences: snapshot.preferences,
        services: snapshot.services,
        availableWindows: snapshot.availableWindows,
        loyalty: snapshot.loyalty,
        visitHistory: [
          GrowthVisitHistoryEntry(
            id: 'late',
            serviceId: 'service-haircut',
            serviceName: 'Corte premium',
            serviceCategory: 'corte',
            visitedAt: now.subtract(const Duration(days: 75)),
            ticketAmount: 95,
            durationMinutes: 60,
            staffMemberId: 'staff-lia',
            staffMemberName: 'Lia',
          ),
        ],
      );

      final model = builder.build(lapsed, now: now);

      expect(model.home.headerTitle, contains('trazer de volta'));
      expect(model.home.stickyCta.label, 'Voltar com facilidade');
    });
  });
}
