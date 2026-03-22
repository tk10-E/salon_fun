import 'package:flutter_test/flutter_test.dart';
import 'package:salon_client/src/models/app_models.dart';

void main() {
  test('parses loyalty transaction and derives kind metadata', () {
    final item = LoyaltyTransactionItem.fromMap({
      'id': 'tx-1',
      'transaction_kind': 'cashback_redemption',
      'points_delta': -10,
      'cashback_delta': -15.5,
      'completed_visit_delta': 0,
      'description': 'Resgate aplicado na recepção',
      'metadata': {'source': 'desk'},
      'created_at': '2026-03-21T12:00:00Z',
    });

    expect(item.id, 'tx-1');
    expect(item.isRedemption, isTrue);
    expect(item.isVisitReward, isFalse);
    expect(item.kindLabel, 'Resgate de cashback');
    expect(item.title, 'Resgate aplicado na recepção');
    expect(item.cashbackDelta, -15.5);
    expect(item.metadata['source'], 'desk');
  });
}
