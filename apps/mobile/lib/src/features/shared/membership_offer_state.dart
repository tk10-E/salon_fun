import 'app_models.dart';

enum MembershipOfferActionKind {
  subscribe,
  pendingApproval,
  awaitingPayment,
  scheduled,
  active,
  renewalDue,
}

class MembershipOfferState {
  const MembershipOfferState({
    required this.actionKind,
    required this.activePlan,
    required this.request,
    required this.scheduledPlan,
    required this.daysUntilExpiry,
  });

  factory MembershipOfferState.resolve({
    required String offerId,
    required CustomerMembershipOverview overview,
    DateTime? now,
  }) {
    final activePlan = overview.activePlanForOffer(offerId, now: now);
    final scheduledPlan = overview.upcomingPlanForOffer(offerId, now: now);
    final request = overview.openRequestForOffer(offerId);

    if (request != null) {
      return MembershipOfferState(
        actionKind: request.isAwaitingPayment
            ? MembershipOfferActionKind.awaitingPayment
            : MembershipOfferActionKind.pendingApproval,
        activePlan: activePlan,
        request: request,
        scheduledPlan: scheduledPlan,
        daysUntilExpiry: _resolveDaysUntilExpiry(activePlan, now),
      );
    }

    if (activePlan != null) {
      final daysUntilExpiry = _resolveDaysUntilExpiry(activePlan, now);
      return MembershipOfferState(
        actionKind: daysUntilExpiry != null && daysUntilExpiry <= 5
            ? MembershipOfferActionKind.renewalDue
            : MembershipOfferActionKind.active,
        activePlan: activePlan,
        request: null,
        scheduledPlan: null,
        daysUntilExpiry: daysUntilExpiry,
      );
    }

    if (scheduledPlan != null) {
      return MembershipOfferState(
        actionKind: MembershipOfferActionKind.scheduled,
        activePlan: null,
        request: null,
        scheduledPlan: scheduledPlan,
        daysUntilExpiry: null,
      );
    }

    return const MembershipOfferState(
      actionKind: MembershipOfferActionKind.subscribe,
      activePlan: null,
      request: null,
      scheduledPlan: null,
      daysUntilExpiry: null,
    );
  }

  final MembershipOfferActionKind actionKind;
  final CustomerMembershipPlan? activePlan;
  final CustomerMembershipRequest? request;
  final CustomerMembershipPlan? scheduledPlan;
  final int? daysUntilExpiry;

  bool get allowsRequest =>
      actionKind == MembershipOfferActionKind.subscribe ||
      actionKind == MembershipOfferActionKind.renewalDue;

  bool get isPending => actionKind == MembershipOfferActionKind.pendingApproval;

  bool get isAwaitingPayment =>
      actionKind == MembershipOfferActionKind.awaitingPayment;

  bool get hasOpenRequest => isPending || isAwaitingPayment;

  bool get isScheduled => actionKind == MembershipOfferActionKind.scheduled;

  bool get isActive =>
      actionKind == MembershipOfferActionKind.active ||
      actionKind == MembershipOfferActionKind.renewalDue;

  bool get isExpiringSoon =>
      daysUntilExpiry != null && daysUntilExpiry! >= 0 && daysUntilExpiry! <= 5;

  String? get expiryCountdownLabel =>
      formatDaysUntilExpiryLabel(daysUntilExpiry);

  static String? formatDaysUntilExpiryLabel(int? daysUntilExpiry) {
    if (daysUntilExpiry == null) {
      return null;
    }

    if (daysUntilExpiry <= 0) {
      return 'Vence hoje';
    }

    if (daysUntilExpiry == 1) {
      return 'Vence amanha';
    }

    return 'Vence em $daysUntilExpiry dias';
  }

  static int? resolveDaysUntilDate(DateTime? expiresAt, {DateTime? now}) {
    if (expiresAt == null) {
      return null;
    }

    final baseDate = now ?? DateTime.now();
    final today = DateTime(baseDate.year, baseDate.month, baseDate.day);
    final expiry = DateTime(expiresAt.year, expiresAt.month, expiresAt.day);
    return expiry.difference(today).inDays;
  }

  static int? _resolveDaysUntilExpiry(
    CustomerMembershipPlan? activePlan,
    DateTime? now,
  ) {
    return resolveDaysUntilDate(activePlan?.expiresAt, now: now);
  }
}
