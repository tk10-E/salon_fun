"use server";
import {
  signInActionImpl,
  signInWithGoogleActionImpl,
  sendPasswordResetActionImpl,
  signOutActionImpl,
  signUpActionImpl,
  updatePasswordActionImpl,
} from "./_actions/auth";
import {
  createSalonOfferActionImpl,
  markReferralRewardRedeemedActionImpl,
  deleteSalonOfferActionImpl,
  saveSalonGrowthAutomationActionImpl,
  saveSalonLoyaltyProgramActionImpl,
  saveSalonReferralProgramActionImpl,
  updateSalonOfferActionImpl,
} from "./_actions/commercial";
import {
  cancelSalonSubscriptionActionImpl,
  changeSalonPlanActionImpl,
  resumeSalonSubscriptionActionImpl,
  startStripeBillingPortalActionImpl,
  startStripeCheckoutActionImpl,
} from "./_actions/billing";
import {
  consumeAppointmentMembershipActionImpl,
  reverseAppointmentMembershipActionImpl,
  sendAppointmentWhatsAppActionImpl,
  updateAppointmentDepositActionImpl,
  updateAppointmentStatusActionImpl,
} from "./_actions/appointments";
import { createSalonActionImpl } from "./_actions/onboarding";
import {
  createServiceActionImpl,
  deleteServiceActionImpl,
  updateServiceCatalogActionImpl,
} from "./_actions/services";
import { deleteSalonNotificationActionImpl } from "./_actions/notifications";
import {
  regenerateSalonCodeActionImpl,
  sendSalonManualWhatsAppActionImpl,
  updateSalonBookingPolicyActionImpl,
  updateSalonBrandingActionImpl,
  updateSalonSecurityPolicyActionImpl,
  updateSalonScheduleActionImpl,
  updateSalonWhatsAppSettingsActionImpl,
} from "./_actions/settings";
import {
  createSalonPostActionImpl,
  deleteSalonPostActionImpl,
  deleteSalonPostCommentActionImpl,
} from "./_actions/feed";
import { createSalonFinancialTransactionActionImpl } from "./_actions/finance";
import { sendMarketingCustomerCampaignActionImpl } from "./_actions/marketing";
import {
  approveInstagramMentionActionImpl,
  disconnectInstagramConnectionActionImpl,
  publishInstagramMentionActionImpl,
  rejectInstagramMentionActionImpl,
  saveInstagramConnectionActionImpl,
  syncInstagramActivityActionImpl,
  validateInstagramConnectionTokenActionImpl,
} from "./_actions/instagram";
import {
  createStaffBlockActionImpl,
  createStaffMemberActionImpl,
  deleteStaffBlockActionImpl,
  deleteStaffMemberActionImpl,
  offboardStaffMemberActionImpl,
  toggleStaffMemberStatusActionImpl,
  updateStaffBusinessHoursActionImpl,
  updateStaffMemberAssignmentsActionImpl,
} from "./_actions/staff";
import {
  registerInventoryMovementActionImpl,
  runSalonAutoPilotActionImpl,
  saveSalonMonthlyTargetsActionImpl,
  saveInventoryProductActionImpl,
  saveStaffCommissionSettingsActionImpl,
  updateCustomerProductOrderStatusActionImpl,
  sendCustomerReactivationActionImpl,
} from "./_actions/operations";
import {
  addTabItemActionImpl,
  addTabPaymentActionImpl,
  closeTabActionImpl,
  openTabActionImpl,
} from "./_actions/tabs";
import {
  approveCustomerMembershipRequestActionImpl,
  assignCustomerMembershipPackageActionImpl,
  rejectCustomerMembershipRequestActionImpl,
  saveOwnerCustomerProfileActionImpl,
  sendCustomerNudgeActionImpl,
} from "./_actions/customers";
import {
  buildAuthRateLimitKey,
  runProtectedAction,
  runProtectedFormAction,
} from "./_actions/security";

const wrapOwnerFormAction = <T>(
  actionName: string,
  action: (formData: FormData) => Promise<T>,
) => {
  return async (formData: FormData) =>
    runProtectedFormAction(action, formData, {
      actionName,
      fallbackPath: "/dashboard",
    });
};

const wrapOwnerAction = <T>(actionName: string, action: () => Promise<T>) => {
  return async () =>
    runProtectedAction(action, {
      actionName,
      fallbackPath: "/dashboard",
    });
};

const wrapAuthFormAction = <T>(
  actionName: string,
  action: (formData: FormData) => Promise<T>,
  options?: {
    fallbackPath?: string;
    limit?: number;
    rateLimitKey?: (formData: FormData) => string | null;
    windowSeconds?: number;
  },
) => {
  return async (formData: FormData) =>
    runProtectedFormAction(action, formData, {
      actionName,
      fallbackPath: options?.fallbackPath ?? "/login",
      limit: options?.limit,
      rateLimitKey: options?.rateLimitKey?.(formData) ?? undefined,
      windowSeconds: options?.windowSeconds,
    });
};

export const signInAction = wrapAuthFormAction(
  "auth.sign_in",
  signInActionImpl,
  {
    limit: 8,
    rateLimitKey: (formData) => buildAuthRateLimitKey(formData, "email"),
    windowSeconds: 600,
  },
);

export const signInWithGoogleAction = wrapAuthFormAction(
  "auth.sign_in_google",
  signInWithGoogleActionImpl,
  {
    limit: 12,
    windowSeconds: 600,
  },
);

export const signUpAction = wrapAuthFormAction(
  "auth.sign_up",
  signUpActionImpl,
  {
    limit: 6,
    rateLimitKey: (formData) => buildAuthRateLimitKey(formData, "email"),
    windowSeconds: 1800,
  },
);

export const sendPasswordResetAction = wrapAuthFormAction(
  "auth.password_reset",
  sendPasswordResetActionImpl,
  {
    limit: 5,
    rateLimitKey: (formData) => buildAuthRateLimitKey(formData, "email"),
    windowSeconds: 1800,
  },
);

export const signOutAction = wrapOwnerAction(
  "auth.sign_out",
  signOutActionImpl,
);

export const updatePasswordAction = wrapAuthFormAction(
  "auth.password_update",
  updatePasswordActionImpl,
  {
    fallbackPath: "/auth/recovery",
    limit: 5,
    windowSeconds: 1800,
  },
);

export const createSalonAction = wrapAuthFormAction(
  "onboarding.create_salon",
  createSalonActionImpl,
  {
    fallbackPath: "/onboarding",
    limit: 20,
    windowSeconds: 600,
  },
);

export const createServiceAction = wrapOwnerFormAction(
  "service.create",
  createServiceActionImpl,
);

export const updateServiceCatalogAction = wrapOwnerFormAction(
  "service.update_catalog",
  updateServiceCatalogActionImpl,
);

export const deleteServiceAction = wrapOwnerFormAction(
  "service.delete",
  deleteServiceActionImpl,
);

export const createSalonOfferAction = wrapOwnerFormAction(
  "offer.create",
  createSalonOfferActionImpl,
);

export const updateSalonOfferAction = wrapOwnerFormAction(
  "offer.update",
  updateSalonOfferActionImpl,
);

export const deleteSalonOfferAction = wrapOwnerFormAction(
  "offer.delete",
  deleteSalonOfferActionImpl,
);

export const saveSalonReferralProgramAction = wrapOwnerFormAction(
  "referral_program.save",
  saveSalonReferralProgramActionImpl,
);

export const markReferralRewardRedeemedAction = wrapOwnerFormAction(
  "referral_reward.redeem",
  markReferralRewardRedeemedActionImpl,
);

export const saveSalonLoyaltyProgramAction = wrapOwnerFormAction(
  "loyalty_program.save",
  saveSalonLoyaltyProgramActionImpl,
);

export const saveSalonGrowthAutomationAction = wrapOwnerFormAction(
  "growth_automation.save",
  saveSalonGrowthAutomationActionImpl,
);

export const changeSalonPlanAction = wrapOwnerFormAction(
  "billing.change_plan",
  changeSalonPlanActionImpl,
);

export const cancelSalonSubscriptionAction = wrapOwnerAction(
  "billing.cancel_subscription",
  cancelSalonSubscriptionActionImpl,
);

export const resumeSalonSubscriptionAction = wrapOwnerAction(
  "billing.resume_subscription",
  resumeSalonSubscriptionActionImpl,
);

export const startStripeCheckoutAction = wrapOwnerFormAction(
  "billing.start_checkout",
  startStripeCheckoutActionImpl,
);

export const startStripeBillingPortalAction = wrapOwnerAction(
  "billing.open_portal",
  startStripeBillingPortalActionImpl,
);

export const deleteSalonNotificationAction = wrapOwnerFormAction(
  "notification.delete",
  deleteSalonNotificationActionImpl,
);

export const createStaffMemberAction = wrapOwnerFormAction(
  "staff.create",
  createStaffMemberActionImpl,
);

export const updateStaffMemberAssignmentsAction = wrapOwnerFormAction(
  "staff.update_assignments",
  updateStaffMemberAssignmentsActionImpl,
);

export const updateStaffBusinessHoursAction = wrapOwnerFormAction(
  "staff.update_business_hours",
  updateStaffBusinessHoursActionImpl,
);

export const toggleStaffMemberStatusAction = wrapOwnerFormAction(
  "staff.toggle_status",
  toggleStaffMemberStatusActionImpl,
);

export const deleteStaffMemberAction = wrapOwnerFormAction(
  "staff.delete",
  deleteStaffMemberActionImpl,
);

export const offboardStaffMemberAction = wrapOwnerFormAction(
  "staff.offboard",
  offboardStaffMemberActionImpl,
);

export const createStaffBlockAction = wrapOwnerFormAction(
  "staff_block.create",
  createStaffBlockActionImpl,
);

export const deleteStaffBlockAction = wrapOwnerFormAction(
  "staff_block.delete",
  deleteStaffBlockActionImpl,
);

export const updateAppointmentStatusAction = wrapOwnerFormAction(
  "appointment.update_status",
  updateAppointmentStatusActionImpl,
);

export const updateAppointmentDepositAction = wrapOwnerFormAction(
  "appointment.update_deposit",
  updateAppointmentDepositActionImpl,
);

export const consumeAppointmentMembershipAction = wrapOwnerFormAction(
  "appointment.consume_membership",
  consumeAppointmentMembershipActionImpl,
);

export const reverseAppointmentMembershipAction = wrapOwnerFormAction(
  "appointment.reverse_membership",
  reverseAppointmentMembershipActionImpl,
);

export const sendAppointmentWhatsAppAction = wrapOwnerFormAction(
  "appointment.send_whatsapp",
  sendAppointmentWhatsAppActionImpl,
);

export const saveOwnerCustomerProfileAction = wrapOwnerFormAction(
  "customer.save_profile",
  saveOwnerCustomerProfileActionImpl,
);

export const assignCustomerMembershipPackageAction = wrapOwnerFormAction(
  "membership.assign_package",
  assignCustomerMembershipPackageActionImpl,
);

export const approveCustomerMembershipRequestAction = wrapOwnerFormAction(
  "membership.approve_request",
  approveCustomerMembershipRequestActionImpl,
);

export const rejectCustomerMembershipRequestAction = wrapOwnerFormAction(
  "membership.reject_request",
  rejectCustomerMembershipRequestActionImpl,
);

export const sendCustomerNudgeAction = wrapOwnerFormAction(
  "customer.send_nudge",
  sendCustomerNudgeActionImpl,
);

export const regenerateSalonCodeAction = wrapOwnerAction(
  "salon.regenerate_join_code",
  regenerateSalonCodeActionImpl,
);

export const updateSalonBrandingAction = wrapOwnerFormAction(
  "salon.update_branding",
  updateSalonBrandingActionImpl,
);

export const updateSalonWhatsAppSettingsAction = wrapOwnerFormAction(
  "salon.update_whatsapp_settings",
  updateSalonWhatsAppSettingsActionImpl,
);

export const sendSalonManualWhatsAppAction = wrapOwnerFormAction(
  "salon.send_manual_whatsapp",
  sendSalonManualWhatsAppActionImpl,
);

export const updateSalonScheduleAction = wrapOwnerFormAction(
  "salon.update_schedule",
  updateSalonScheduleActionImpl,
);

export const updateSalonBookingPolicyAction = wrapOwnerFormAction(
  "salon.update_booking_policy",
  updateSalonBookingPolicyActionImpl,
);

export const updateSalonSecurityPolicyAction = wrapOwnerFormAction(
  "salon.update_security_policy",
  updateSalonSecurityPolicyActionImpl,
);

export const createSalonPostAction = wrapOwnerFormAction(
  "feed_post.create",
  createSalonPostActionImpl,
);

export const createSalonFinancialTransactionAction = wrapOwnerFormAction(
  "finance.create_transaction",
  createSalonFinancialTransactionActionImpl,
);

export const sendMarketingCustomerCampaignAction = wrapOwnerFormAction(
  "marketing.send_campaign",
  sendMarketingCustomerCampaignActionImpl,
);

export const deleteSalonPostAction = wrapOwnerFormAction(
  "feed_post.delete",
  deleteSalonPostActionImpl,
);

export const deleteSalonPostCommentAction = wrapOwnerFormAction(
  "feed_post_comment.delete",
  deleteSalonPostCommentActionImpl,
);

export const saveInstagramConnectionAction = wrapOwnerFormAction(
  "instagram.save_connection",
  saveInstagramConnectionActionImpl,
);

export const disconnectInstagramConnectionAction = wrapOwnerAction(
  "instagram.disconnect",
  disconnectInstagramConnectionActionImpl,
);

export const syncInstagramActivityAction = wrapOwnerAction(
  "instagram.sync_activity",
  syncInstagramActivityActionImpl,
);

export const validateInstagramConnectionTokenAction = wrapOwnerFormAction(
  "instagram.validate_token",
  validateInstagramConnectionTokenActionImpl,
);

export const approveInstagramMentionAction = wrapOwnerFormAction(
  "instagram.approve_mention",
  approveInstagramMentionActionImpl,
);

export const rejectInstagramMentionAction = wrapOwnerFormAction(
  "instagram.reject_mention",
  rejectInstagramMentionActionImpl,
);

export const publishInstagramMentionAction = wrapOwnerFormAction(
  "instagram.publish_mention",
  publishInstagramMentionActionImpl,
);

export const saveStaffCommissionSettingsAction = wrapOwnerFormAction(
  "staff_commission.save",
  saveStaffCommissionSettingsActionImpl,
);

export const saveInventoryProductAction = wrapOwnerFormAction(
  "inventory.save_product",
  saveInventoryProductActionImpl,
);

export const saveSalonMonthlyTargetsAction = wrapOwnerFormAction(
  "salon.save_monthly_targets",
  saveSalonMonthlyTargetsActionImpl,
);

export const updateCustomerProductOrderStatusAction = wrapOwnerFormAction(
  "store_order.update_status",
  updateCustomerProductOrderStatusActionImpl,
);

export const registerInventoryMovementAction = wrapOwnerFormAction(
  "inventory.register_movement",
  registerInventoryMovementActionImpl,
);

export const sendCustomerReactivationAction = wrapOwnerFormAction(
  "customer.send_reactivation",
  sendCustomerReactivationActionImpl,
);

export const runSalonAutoPilotAction = wrapOwnerFormAction(
  "autopilot.run",
  runSalonAutoPilotActionImpl,
);

export const openTabAction = wrapOwnerFormAction("tab.open", openTabActionImpl);

export const addTabItemAction = wrapOwnerFormAction(
  "tab.add_item",
  addTabItemActionImpl,
);

export const addTabPaymentAction = wrapOwnerFormAction(
  "tab.add_payment",
  addTabPaymentActionImpl,
);

export const closeTabAction = wrapOwnerFormAction(
  "tab.close",
  closeTabActionImpl,
);
