export const MEMBERSHIP_PLAN_MIN_DAYS = 30;

export function isMonthlyMembershipPlan(
  validityDays: number | null | undefined,
) {
  return (validityDays ?? 0) >= MEMBERSHIP_PLAN_MIN_DAYS;
}

export function resolveMembershipOfferLabel(
  validityDays: number | null | undefined,
) {
  return isMonthlyMembershipPlan(validityDays) ? "Plano" : "Pacote";
}

export function resolveMembershipLifecycleCopy(
  validityDays: number | null | undefined,
) {
  return isMonthlyMembershipPlan(validityDays) ? "plano" : "pacote";
}
