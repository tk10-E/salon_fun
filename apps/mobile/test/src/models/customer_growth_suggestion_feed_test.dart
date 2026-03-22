import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  test('parses customer growth suggestions with incentive and combo', () {
    final feed = CustomerGrowthSuggestionFeed.fromMap({
      'generated_at': '2026-03-21T12:00:00Z',
      'last_visit_service_name': 'Barba premium',
      'last_visit_at': '2026-02-10T15:30:00Z',
      'inactive_days': 39,
      'suggestions': [
        {
          'id': 'rebooking:svc-1',
          'type': 'rebooking',
          'service_id': 'svc-1',
          'service_name': 'Barba premium',
          'service_category': 'Barba',
          'service_price': 45,
          'service_duration': 30,
          'based_on_service_name': 'Barba premium',
          'last_visit_at': '2026-02-10T15:30:00Z',
          'recommended_interval_days': 15,
          'recommended_booking_date': '2026-02-25T15:30:00Z',
          'urgency': 'due_now',
          'inactive_days': 39,
          'incentive_percent': 10,
          'habit_weekday': 'no sábado',
          'habit_period': 'de manhã',
          'habit_confidence': 'high',
        },
        {
          'id': 'combo:svc-2',
          'type': 'combo',
          'service_id': 'svc-2',
          'service_name': 'Corte completo',
          'service_category': 'Cabelo',
          'service_price': 70,
          'service_duration': 45,
          'based_on_service_name': 'Barba premium',
          'last_visit_at': '2026-02-10T15:30:00Z',
          'urgency': 'cross_sell',
          'inactive_days': 39,
        },
      ],
    });

    expect(feed.hasVisibleContent, isTrue);
    expect(feed.lastVisitServiceName, 'Barba premium');
    expect(feed.inactiveDays, 39);
    expect(feed.suggestions, hasLength(2));
    expect(feed.suggestions.first.isRebooking, isTrue);
    expect(feed.suggestions.first.hasIncentive, isTrue);
    expect(feed.suggestions.first.isHabitBased, isTrue);
    expect(feed.suggestions.first.incentivePercent, 10);
    expect(feed.suggestions.first.habitWeekday, 'no sábado');
    expect(feed.suggestions.last.isCombo, isTrue);
    expect(feed.suggestions.last.serviceName, 'Corte completo');
  });
}
