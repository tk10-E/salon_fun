import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/src/features/shared/app_models.dart';

void main() {
  test('decodes preferred schedule from legacy membership request notes', () {
    final encodedNotes = encodeLegacyMembershipRequestNotes(
      notes: 'Quero manter esse horario.',
      preferredStartAt: DateTime.utc(2026, 5, 12, 12),
      preferredStaffMemberId: 'staff-1',
      preferredStaffMemberName: 'Equipe principal',
    );

    final request = CustomerMembershipRequest.fromJson({
      'id': 'request-1',
      'offer_id': 'offer-1',
      'offer_title_snapshot': 'Kit completo beleza',
      'status': 'pending',
      'requested_at': '2026-05-10T15:00:00Z',
      'price_snapshot': 149,
      'notes': encodedNotes,
    });

    expect(request.notes, 'Quero manter esse horario.');
    expect(request.preferredStaffMemberId, 'staff-1');
    expect(request.preferredStaffMemberName, 'Equipe principal');
    expect(request.preferredStartAt?.toUtc(), DateTime.utc(2026, 5, 12, 12));
  });
}
