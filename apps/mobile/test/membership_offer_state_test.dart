import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/src/features/shared/app_models.dart';
import 'package:mobile/src/features/shared/membership_offer_state.dart';

void main() {
  test('marks offer as pending when customer already requested approval', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: CustomerMembershipOverview(
        memberships: const [],
        pendingRequests: [
          CustomerMembershipRequest(
            id: 'request-1',
            offerId: 'offer-1',
            offerTitle: 'Plano glow',
            status: 'pending',
            requestedAt: DateTime(2026, 4, 10),
            priceSnapshot: 149.9,
            notes: null,
          ),
        ],
      ),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.pendingApproval);
    expect(state.isPending, isTrue);
    expect(state.allowsRequest, isFalse);
  });

  test('keeps offer waiting for payment until the salon confirms it', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: CustomerMembershipOverview(
        memberships: const [],
        pendingRequests: [
          CustomerMembershipRequest(
            id: 'request-1',
            offerId: 'offer-1',
            offerTitle: 'Plano glow',
            status: 'approved',
            requestedAt: DateTime(2026, 4, 10),
            priceSnapshot: 149.9,
            notes: null,
            approvedStartsOn: DateTime(2026, 4, 15),
            decidedAt: DateTime(2026, 4, 11, 10, 30),
            membershipId: null,
          ),
        ],
      ),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.awaitingPayment);
    expect(state.isAwaitingPayment, isTrue);
    expect(state.request?.isAwaitingPayment, isTrue);
    expect(state.allowsRequest, isFalse);
    expect(state.activePlan, isNull);
  });

  test('marks offer as renewal due in the last five days', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: CustomerMembershipOverview(
        memberships: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano glow',
            serviceId: 'service-1',
            serviceName: 'Hidratacao premium',
            status: 'active',
            sessionsIncluded: 3,
            sessionsUsed: 1,
            startedAt: DateTime(2026, 4, 1),
            expiresAt: DateTime(2026, 4, 15),
            priceSnapshot: 149.9,
          ),
        ],
        pendingRequests: const [],
      ),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.renewalDue);
    expect(state.isActive, isTrue);
    expect(state.allowsRequest, isTrue);
    expect(state.isExpiringSoon, isTrue);
    expect(state.daysUntilExpiry, 4);
    expect(state.expiryCountdownLabel, 'Vence em 4 dias');
  });

  test('keeps offer available when there is no active plan yet', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: const CustomerMembershipOverview.empty(),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.subscribe);
    expect(state.allowsRequest, isTrue);
    expect(state.activePlan, isNull);
  });

  test('marks offer as scheduled when activation starts in the future', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: CustomerMembershipOverview(
        memberships: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano glow',
            serviceId: 'service-1',
            serviceName: 'Hidratacao premium',
            status: 'active',
            sessionsIncluded: 3,
            sessionsUsed: 0,
            startedAt: DateTime(2026, 4, 20),
            expiresAt: DateTime(2026, 5, 19),
            priceSnapshot: 149.9,
          ),
        ],
        pendingRequests: const [],
      ),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.scheduled);
    expect(state.isScheduled, isTrue);
    expect(state.allowsRequest, isFalse);
    expect(state.activePlan, isNull);
    expect(state.scheduledPlan?.startedAt, DateTime(2026, 4, 20));
  });

  test('only treats membership as active inside the configured period', () {
    final membership = CustomerMembershipPlan(
      id: 'membership-1',
      offerId: 'offer-1',
      title: 'Plano glow',
      serviceId: 'service-1',
      serviceName: 'Hidratacao premium',
      status: 'active',
      sessionsIncluded: 3,
      sessionsUsed: 0,
      startedAt: DateTime(2026, 4, 20),
      expiresAt: DateTime(2026, 5, 19),
      priceSnapshot: 149.9,
    );

    expect(membership.isActiveOn(DateTime(2026, 4, 11)), isFalse);
    expect(membership.startsInFuture(DateTime(2026, 4, 11)), isTrue);
    expect(membership.isActiveOn(DateTime(2026, 4, 20)), isTrue);
  });

  test('formats countdown label for same-day expiration', () {
    final state = MembershipOfferState.resolve(
      offerId: 'offer-1',
      overview: CustomerMembershipOverview(
        memberships: [
          CustomerMembershipPlan(
            id: 'membership-1',
            offerId: 'offer-1',
            title: 'Plano glow',
            serviceId: 'service-1',
            serviceName: 'Hidratacao premium',
            status: 'active',
            sessionsIncluded: 3,
            sessionsUsed: 2,
            startedAt: DateTime(2026, 4, 1),
            expiresAt: DateTime(2026, 4, 11),
            priceSnapshot: 149.9,
          ),
        ],
        pendingRequests: const [],
      ),
      now: DateTime(2026, 4, 11),
    );

    expect(state.actionKind, MembershipOfferActionKind.renewalDue);
    expect(state.expiryCountdownLabel, 'Vence hoje');
  });
}
