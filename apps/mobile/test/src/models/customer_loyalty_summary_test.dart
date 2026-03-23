import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  test('parses loyalty summary with tiers and balances', () {
    final summary = CustomerLoyaltySummary.fromMap({
      'program': {
        'title': 'Clube VIP',
        'description': 'Visite mais e acumule vantagens.',
        'points_per_visit': 12,
        'cashback_percent': 5,
        'is_active': true,
        'vip_reward_service_id': 'service-1',
        'vip_reward_service_name': 'Hidratação premium',
        'tiers': [
          {
            'label': 'Cliente Frequente',
            'min_visits': 3,
            'discount_percent': 5,
            'is_vip': false,
          },
          {
            'label': 'Cliente VIP',
            'min_visits': 10,
            'discount_percent': 15,
            'is_vip': true,
          },
        ],
      },
      'points_balance': 48,
      'total_points_earned': 48,
      'cashback_balance': 12.5,
      'total_cashback_earned': 12.5,
      'completed_visits': 4,
      'rank_position': 2,
      'ranked_customers': 9,
      'current_tier': {
        'label': 'Cliente Frequente',
        'min_visits': 3,
        'discount_percent': 5,
        'is_vip': false,
      },
      'next_tier': {
        'label': 'Cliente VIP',
        'min_visits': 10,
        'discount_percent': 15,
        'is_vip': true,
      },
      'visits_to_next_tier': 6,
      'last_reward_at': '2026-03-21T10:00:00Z',
    });

    expect(summary.program?.title, 'Clube VIP');
    expect(summary.pointsBalance, 48);
    expect(summary.cashbackBalance, 12.5);
    expect(summary.completedVisits, 4);
    expect(summary.rankPosition, 2);
    expect(summary.currentTier?.label, 'Cliente Frequente');
    expect(summary.nextTier?.isVip, isTrue);
    expect(summary.program?.vipRewardServiceName, 'Hidratação premium');
    expect(summary.visitsToNextTier, 6);
    expect(summary.hasVisibleContent, isTrue);
  });

  test('stays hidden with no active program and no balances', () {
    final summary = CustomerLoyaltySummary.fromMap({
      'program': {
        'title': 'Clube VIP',
        'points_per_visit': 10,
        'cashback_percent': 5,
        'is_active': false,
        'tiers': const [],
      },
      'points_balance': 0,
      'total_points_earned': 0,
      'cashback_balance': 0,
      'total_cashback_earned': 0,
      'completed_visits': 0,
      'rank_position': null,
      'ranked_customers': 0,
      'current_tier': null,
      'next_tier': null,
      'visits_to_next_tier': 0,
      'last_reward_at': null,
    });

    expect(summary.hasVisibleContent, isFalse);
    expect(summary.isVip, isFalse);
  });
}
