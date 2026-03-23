"use server";
import {
  signInActionImpl,
  signOutActionImpl,
  signUpActionImpl,
} from "./_actions/auth";
import {
  createSalonOfferActionImpl,
  deleteSalonOfferActionImpl,
  saveSalonGrowthAutomationActionImpl,
  saveSalonLoyaltyProgramActionImpl,
  saveSalonReferralProgramActionImpl,
  updateSalonOfferActionImpl,
} from "./_actions/commercial";
import { updateAppointmentStatusActionImpl } from "./_actions/appointments";
import { createSalonActionImpl } from "./_actions/onboarding";
import {
  createServiceActionImpl,
  deleteServiceActionImpl,
  updateServiceCatalogActionImpl,
} from "./_actions/services";
import { deleteSalonNotificationActionImpl } from "./_actions/notifications";
import {
  regenerateSalonCodeActionImpl,
  updateSalonBrandingActionImpl,
  updateSalonScheduleActionImpl,
} from "./_actions/settings";
import {
  createSalonPostActionImpl,
  deleteSalonPostActionImpl,
  deleteSalonPostCommentActionImpl,
} from "./_actions/feed";
import {
  approveInstagramMentionActionImpl,
  disconnectInstagramConnectionActionImpl,
  publishInstagramMentionActionImpl,
  rejectInstagramMentionActionImpl,
  saveInstagramConnectionActionImpl,
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
  saveInventoryProductActionImpl,
  saveStaffCommissionSettingsActionImpl,
} from "./_actions/operations";

export async function signInAction(formData: FormData) {
  return signInActionImpl(formData);
}

export async function signUpAction(formData: FormData) {
  return signUpActionImpl(formData);
}

export async function signOutAction() {
  return signOutActionImpl();
}

export async function createSalonAction(formData: FormData) {
  return createSalonActionImpl(formData);
}

export async function createServiceAction(formData: FormData) {
  return createServiceActionImpl(formData);
}

export async function updateServiceCatalogAction(formData: FormData) {
  return updateServiceCatalogActionImpl(formData);
}

export async function deleteServiceAction(formData: FormData) {
  return deleteServiceActionImpl(formData);
}

export async function createSalonOfferAction(formData: FormData) {
  return createSalonOfferActionImpl(formData);
}

export async function updateSalonOfferAction(formData: FormData) {
  return updateSalonOfferActionImpl(formData);
}

export async function deleteSalonOfferAction(formData: FormData) {
  return deleteSalonOfferActionImpl(formData);
}

export async function saveSalonReferralProgramAction(formData: FormData) {
  return saveSalonReferralProgramActionImpl(formData);
}

export async function saveSalonLoyaltyProgramAction(formData: FormData) {
  return saveSalonLoyaltyProgramActionImpl(formData);
}

export async function saveSalonGrowthAutomationAction(formData: FormData) {
  return saveSalonGrowthAutomationActionImpl(formData);
}

export async function deleteSalonNotificationAction(formData: FormData) {
  return deleteSalonNotificationActionImpl(formData);
}

export async function createStaffMemberAction(formData: FormData) {
  return createStaffMemberActionImpl(formData);
}

export async function updateStaffMemberAssignmentsAction(formData: FormData) {
  return updateStaffMemberAssignmentsActionImpl(formData);
}

export async function updateStaffBusinessHoursAction(formData: FormData) {
  return updateStaffBusinessHoursActionImpl(formData);
}

export async function toggleStaffMemberStatusAction(formData: FormData) {
  return toggleStaffMemberStatusActionImpl(formData);
}

export async function deleteStaffMemberAction(formData: FormData) {
  return deleteStaffMemberActionImpl(formData);
}

export async function offboardStaffMemberAction(formData: FormData) {
  return offboardStaffMemberActionImpl(formData);
}

export async function createStaffBlockAction(formData: FormData) {
  return createStaffBlockActionImpl(formData);
}

export async function deleteStaffBlockAction(formData: FormData) {
  return deleteStaffBlockActionImpl(formData);
}

export async function updateAppointmentStatusAction(formData: FormData) {
  return updateAppointmentStatusActionImpl(formData);
}

export async function regenerateSalonCodeAction() {
  return regenerateSalonCodeActionImpl();
}

export async function updateSalonBrandingAction(formData: FormData) {
  return updateSalonBrandingActionImpl(formData);
}

export async function updateSalonScheduleAction(formData: FormData) {
  return updateSalonScheduleActionImpl(formData);
}

export async function createSalonPostAction(formData: FormData) {
  return createSalonPostActionImpl(formData);
}

export async function deleteSalonPostAction(formData: FormData) {
  return deleteSalonPostActionImpl(formData);
}

export async function deleteSalonPostCommentAction(formData: FormData) {
  return deleteSalonPostCommentActionImpl(formData);
}

export async function saveInstagramConnectionAction(formData: FormData) {
  return saveInstagramConnectionActionImpl(formData);
}

export async function disconnectInstagramConnectionAction() {
  return disconnectInstagramConnectionActionImpl();
}

export async function validateInstagramConnectionTokenAction(formData: FormData) {
  return validateInstagramConnectionTokenActionImpl(formData);
}

export async function approveInstagramMentionAction(formData: FormData) {
  return approveInstagramMentionActionImpl(formData);
}

export async function rejectInstagramMentionAction(formData: FormData) {
  return rejectInstagramMentionActionImpl(formData);
}

export async function publishInstagramMentionAction(formData: FormData) {
  return publishInstagramMentionActionImpl(formData);
}

export async function saveStaffCommissionSettingsAction(formData: FormData) {
  return saveStaffCommissionSettingsActionImpl(formData);
}

export async function saveInventoryProductAction(formData: FormData) {
  return saveInventoryProductActionImpl(formData);
}

export async function registerInventoryMovementAction(formData: FormData) {
  return registerInventoryMovementActionImpl(formData);
}
