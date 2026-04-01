import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/features/growth_journey/domain/growth_journey_models.dart';
import 'package:salon_client/src/features/retention_v1/application/retention_v1_builder.dart';
import 'package:salon_client/src/features/retention_v1/application/retention_v1_push_planner.dart';
import 'package:salon_client/src/features/retention_v1/domain/retention_v1_models.dart';

void main() {
  group('RetentionV1Builder', () {
    test(
      'falls back to default mode when there is only one completed visit',
      () {
        final experience = const RetentionV1Builder().build(
          _snapshot(
            visitHistory: [
              _visit(
                id: 'visit-1',
                visitedAt: DateTime(2026, 2, 20, 14),
                staffMemberName: 'Lia',
              ),
            ],
            availableWindows: [
              _window(
                startAt: DateTime(2026, 3, 31, 14),
                staffMemberName: 'Lia',
              ),
            ],
          ),
          flags: const RetentionV1FeatureFlags(),
          now: DateTime(2026, 3, 31, 10),
        );

        expect(experience, isNotNull);
        expect(experience!.mode, RetentionV1Mode.defaultMode);
        expect(experience.confidence, RetentionV1Confidence.weak);
        expect(experience.home.primaryCtaLabel, 'Repetir último serviço');
        expect(experience.bookingRequest.initialSlot, isNull);
        expect(experience.safety.smartModeAllowed, isFalse);
      },
    );

    test(
      'unlocks smart mode only when service, staff and time are consistent',
      () {
        final experience = const RetentionV1Builder().build(
          _snapshot(
            visitHistory: [
              _visit(
                id: 'visit-1',
                visitedAt: DateTime(2026, 3, 1, 14),
                staffMemberName: 'Lia',
              ),
              _visit(
                id: 'visit-2',
                visitedAt: DateTime(2026, 2, 1, 14),
                staffMemberName: 'Lia',
              ),
            ],
            availableWindows: [
              _window(
                startAt: DateTime(2026, 3, 31, 14),
                staffMemberName: 'Lia',
                staffMemberId: 'staff-1',
              ),
            ],
          ),
          flags: const RetentionV1FeatureFlags(),
          now: DateTime(2026, 3, 31, 10),
        );

        expect(experience, isNotNull);
        expect(experience!.mode, RetentionV1Mode.smartMode);
        expect(experience.confidence, RetentionV1Confidence.trusted);
        expect(experience.home.primaryCtaLabel, 'Quero esse horário');
        expect(
          experience.bookingRequest.initialSlot,
          DateTime(2026, 3, 31, 14),
        );
        expect(experience.bookingRequest.initialStaffMemberId, 'staff-1');
        expect(experience.safety.canUseStaffPersonalization, isTrue);
        expect(experience.safety.canUseExactTimeRecommendation, isTrue);
      },
    );
  });

  group('RetentionV1PushPlanner', () {
    test('builds only the safe push types for the retention flow', () {
      final experience = const RetentionV1Builder().build(
        _snapshot(
          visitHistory: [
            _visit(
              id: 'visit-1',
              visitedAt: DateTime(2026, 3, 1, 14),
              staffMemberName: 'Lia',
            ),
            _visit(
              id: 'visit-2',
              visitedAt: DateTime(2026, 2, 1, 14),
              staffMemberName: 'Lia',
            ),
          ],
          availableWindows: [
            _window(
              startAt: DateTime(2026, 3, 31, 14),
              staffMemberName: 'Lia',
              staffMemberId: 'staff-1',
            ),
          ],
        ),
        flags: const RetentionV1FeatureFlags(),
        now: DateTime(2026, 3, 31, 10),
      )!;

      final planner = const RetentionV1PushPlanner();
      final dueSoon = planner.buildDueSoonPlan(experience);
      final abandoned = planner.buildAbandonedBookingPlan(
        experience.bookingRequest,
        flags: experience.flags,
      );
      final matchedVacancy = planner.buildMatchedVacancyPlan(
        experience,
        _window(
          startAt: DateTime(2026, 3, 31, 17, 20),
          staffMemberName: 'Lia',
          staffMemberId: 'staff-1',
        ),
      );

      expect(dueSoon?.type, RetentionV1PushType.dueSoon);
      expect(abandoned?.type, RetentionV1PushType.abandonedBooking);
      expect(matchedVacancy?.type, RetentionV1PushType.matchedVacancy);
    });
  });
}

GrowthJourneySnapshot _snapshot({
  required List<GrowthVisitHistoryEntry> visitHistory,
  required List<GrowthAvailableWindow> availableWindows,
}) {
  return GrowthJourneySnapshot(
    customerName: 'Talita',
    salonName: 'Salon Fun',
    preferences: const GrowthUserPreferences(),
    services: const [
      GrowthServiceSummary(
        id: 'service-1',
        name: 'Corte premium',
        category: 'Cabelo',
        price: 120,
        durationMinutes: 60,
      ),
    ],
    visitHistory: visitHistory,
    availableWindows: availableWindows,
    loyalty: const GrowthLoyaltySnapshot(),
  );
}

GrowthVisitHistoryEntry _visit({
  required String id,
  required DateTime visitedAt,
  required String staffMemberName,
}) {
  return GrowthVisitHistoryEntry(
    id: id,
    serviceId: 'service-1',
    serviceName: 'Corte premium',
    serviceCategory: 'Cabelo',
    visitedAt: visitedAt,
    ticketAmount: 120,
    durationMinutes: 60,
    staffMemberName: staffMemberName,
  );
}

GrowthAvailableWindow _window({
  required DateTime startAt,
  required String staffMemberName,
  String? staffMemberId,
}) {
  return GrowthAvailableWindow(
    startAt: startAt,
    endAt: startAt.add(const Duration(hours: 1)),
    staffMemberId: staffMemberId,
    staffMemberName: staffMemberName,
  );
}
