"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { requireOwnerSalon } from "@/lib/auth";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import {
  cancelAppointmentPlanReservationByAdmin,
  finalizeAppointmentPlanReservation,
  neutralizeMembershipPlanAppointment,
  reprocessMembershipPlanSeriesByAdmin,
  resolveAppointmentPlanReservation,
} from "@/lib/appointmentPlanReservations";
import { resolveAuthoritativeAppointmentPayment } from "@/lib/paymentIntegrity";
import {
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_PATHS,
  combineDateAndTimeToUtc,
} from "@/lib/management";
import { recordSecurityAuditEvent } from "@/lib/security";
import {
  managementAppointmentSchema,
  managementAppointmentStatusSchema,
  managementAppointmentUpdateSchema,
  managementCategorySchema,
  managementCategoryUpdateSchema,
  managementClientSchema,
  managementClientUpdateSchema,
  managementDeleteSchema,
  managementPaymentSchema,
  managementProfessionalSchema,
  managementProfessionalUpdateSchema,
  managementServiceSchema,
  managementServiceUpdateSchema,
} from "@/lib/management-schemas";
import { createClient } from "@/lib/supabase/server";
import {
  buildInlineActionState,
  isInlineAction,
  type InlineActionState,
} from "@/lib/inline-action-state";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";

import {
  buildAppointmentNoShowNotification,
  buildAppointmentRescheduledNotification,
  buildRedirectNotice,
  buildServiceCatalogNotification,
  buildStaffAvailabilityNotification,
  formatAppointmentDateTimeLabel,
  prepareCustomerNotificationPayload,
  queueCustomerNotification,
  rethrowIfRedirectError,
  resolveDashboardReturnPath,
} from "./shared";

const APPOINTMENTS_PATH = `${MANAGEMENT_BASE_PATH}/agendamentos`;
const CLIENTS_PATH = `${MANAGEMENT_BASE_PATH}/clientes`;
const PROFESSIONALS_PATH = `${MANAGEMENT_BASE_PATH}/profissionais`;
const CATEGORIES_PATH = `${MANAGEMENT_BASE_PATH}/categorias`;
const SERVICES_PATH = `${MANAGEMENT_BASE_PATH}/servicos`;
const PAYMENTS_PATH = `${MANAGEMENT_BASE_PATH}/pagamentos`;
const COMMISSIONS_PATH = `${MANAGEMENT_BASE_PATH}/comissoes`;
const SERVICE_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.service;
const PROFESSIONAL_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.service;

const REVALIDATE_PATHS = [
  MANAGEMENT_BASE_PATH,
  APPOINTMENTS_PATH,
  CLIENTS_PATH,
  PROFESSIONALS_PATH,
  CATEGORIES_PATH,
  SERVICES_PATH,
  PAYMENTS_PATH,
  COMMISSIONS_PATH,
  "/dashboard",
] as const;

type NotificationRelation<T> = T | T[] | null | undefined;

type FutureProfessionalAppointment = {
  id: string;
  customer_id: string | null;
  service_id: string;
  date: string;
  ends_at: string;
  notes: string | null;
  status: "pending" | "confirmed";
  customers: NotificationRelation<{
    name: string | null;
    phone: string | null;
  }>;
  services: NotificationRelation<{
    name: string | null;
    duration?: number | null;
  }>;
};

type ReplacementCandidate = {
  completedCount: number;
  id: string;
  name: string;
  upcomingCount: number;
};

type AvailableStaffSlot = {
  ends_at: string;
  staff_member_id: string;
  staff_member_name: string;
  start_at: string;
};

type AppointmentTransferPlan = {
  appointmentId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  keepsSameTime: boolean;
  nextEndsAt: string;
  nextStartAt: string;
  previousEndsAt: string;
  previousNotes: string | null;
  previousStartAt: string;
  previousStatus: "pending" | "confirmed";
  previousStaffMemberName: string;
  replacementStaffMemberId: string;
  replacementStaffMemberName: string;
  serviceId: string;
  serviceName: string;
};

class ManagementActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagementActionError";
  }
}

function throwManagementActionError(message: string): never {
  throw new ManagementActionError(message);
}

function extractMembershipDayKey(
  value: string | null | undefined,
  timeZone: string,
) {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return null;
  }

  const directMatch = normalized.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  if (directMatch) {
    return directMatch;
  }

  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return formatLocalDateKey(parsed, timeZone);
}

function isDateWithinMembershipPlanWindow(args: {
  membershipExpiresAt?: string | null;
  membershipStartedAt?: string | null;
  scheduledAt: Date;
  timeZone: string;
}) {
  const scheduledDayKey = formatLocalDateKey(args.scheduledAt, args.timeZone);
  const startDayKey = extractMembershipDayKey(
    args.membershipStartedAt,
    args.timeZone,
  );
  const endDayKey = extractMembershipDayKey(
    args.membershipExpiresAt,
    args.timeZone,
  );

  if (startDayKey && scheduledDayKey < startDayKey) {
    return false;
  }

  if (endDayKey && scheduledDayKey > endDayKey) {
    return false;
  }

  return true;
}

type DatabaseActionError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
};

function flag(formData: FormData, field: string) {
  const value = formData.get(field);
  return value === "on" || value === "true";
}

function readStringValues(formData: FormData, field: string) {
  return Array.from(
    new Set(
      formData
        .getAll(field)
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function buildServiceImagePath(salonId: string, extension: string) {
  return `${salonId}/services/${randomUUID()}.${extension}`;
}

function buildProfessionalImagePath(salonId: string, extension: string) {
  return `${salonId}/staff/${randomUUID()}.${extension}`;
}

async function uploadManagementServiceImage(args: {
  formData: FormData;
  field: string;
  salonId: string;
  supabase: ReturnType<typeof createClient>;
  redirectPath: string;
}) {
  const imageFile = readUploadedFile(args.formData, args.field);
  if (!imageFile) {
    return null;
  }

  if (!imageFile.type.startsWith("image/")) {
    throwManagementActionError("Envie uma imagem válida para o serviço.");
  }

  if (imageFile.size > SERVICE_IMAGE_PRESET.maxInputBytes) {
    throwManagementActionError(
      `A foto do serviço deve ter no máximo ${formatPresetMegabytes(
        SERVICE_IMAGE_PRESET.maxInputBytes,
      )} MB.`,
    );
  }

  let optimizedImage;

  try {
    optimizedImage = await optimizeUploadedImage(imageFile, "service");
  } catch {
    throwManagementActionError("Não foi possível processar a foto do serviço.");
  }

  const imagePath = buildServiceImagePath(
    args.salonId,
    optimizedImage.extension,
  );
  const { error: uploadError } = await args.supabase.storage
    .from("salon-assets")
    .upload(imagePath, optimizedImage.buffer, {
      contentType: optimizedImage.contentType,
      upsert: true,
    });

  if (uploadError) {
    throwManagementActionError("Não foi possível enviar a foto do serviço.");
  }

  return imagePath;
}

async function uploadManagementProfessionalImage(args: {
  formData: FormData;
  field: string;
  salonId: string;
  supabase: ReturnType<typeof createClient>;
  redirectPath: string;
}) {
  const imageFile = readUploadedFile(args.formData, args.field);
  if (!imageFile) {
    return null;
  }

  if (!imageFile.type.startsWith("image/")) {
    throwManagementActionError("Envie uma imagem valida para o profissional.");
  }

  if (imageFile.size > PROFESSIONAL_IMAGE_PRESET.maxInputBytes) {
    throwManagementActionError(
      `A foto do profissional deve ter no máximo ${formatPresetMegabytes(
        PROFESSIONAL_IMAGE_PRESET.maxInputBytes,
      )} MB.`,
    );
  }

  let optimizedImage;

  try {
    optimizedImage = await optimizeUploadedImage(imageFile, "service");
  } catch {
    throwManagementActionError(
      "Não foi possível processar a foto do profissional.",
    );
  }

  const imagePath = buildProfessionalImagePath(
    args.salonId,
    optimizedImage.extension,
  );
  const { error: uploadError } = await args.supabase.storage
    .from("salon-assets")
    .upload(imagePath, optimizedImage.buffer, {
      contentType: optimizedImage.contentType,
      upsert: true,
    });

  if (uploadError) {
    throwManagementActionError(
      "Não foi possível enviar a foto do profissional.",
    );
  }

  return imagePath;
}

function firstMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message?.trim();
    if (
      !message ||
      message.startsWith("Invalid input") ||
      message.includes("received null")
    ) {
      return fallback;
    }

    return message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function normalizeDatabaseErrorText(
  error: DatabaseActionError | null | undefined,
) {
  return [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();
}

function isMissingDatabaseColumnError(
  error: DatabaseActionError | null | undefined,
  columnName: string,
) {
  const normalizedText = normalizeDatabaseErrorText(error);
  const normalizedColumnName = columnName.trim().toLowerCase();
  const mentionsMissingColumn =
    normalizedText.includes(normalizedColumnName) &&
    (normalizedText.includes("column") ||
      normalizedText.includes("schema cache") ||
      normalizedText.includes("could not find")) &&
    (normalizedText.includes("does not exist") ||
      normalizedText.includes("missing") ||
      normalizedText.includes("schema cache") ||
      normalizedText.includes("could not find"));

  return (
    mentionsMissingColumn ||
    ((error?.code === "42703" ||
      error?.code === "PGRST204" ||
      error?.code === "PGRST205") &&
      normalizedText.includes(normalizedColumnName))
  );
}

function getReturnPath(formData: FormData, fallbackPath: string) {
  return resolveDashboardReturnPath(formData, fallbackPath, [
    ...MANAGEMENT_PATHS,
    "/dashboard",
  ]);
}

function invalidateManagementPages() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function firstRelation<T>(value: NotificationRelation<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function notifyCustomerAboutManagementAppointmentStatus(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  appointmentId: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  cancellationReason?: string | null;
  appointmentContext: {
    customer_id?: string | null;
    date: string;
    services?: NotificationRelation<{ name: string | null }>;
    staff_members?: NotificationRelation<{ name: string | null }>;
  };
}) {
  const {
    supabase,
    salonId,
    appointmentId,
    status,
    cancellationReason,
    appointmentContext,
  } = params;

  if (!appointmentContext.customer_id) {
    return;
  }

  const appointmentLabel = formatAppointmentDateTimeLabel(
    appointmentContext.date,
  );
  const serviceName =
    firstRelation(appointmentContext.services)?.name?.trim() ||
    "seu atendimento";
  const staffName =
    firstRelation(appointmentContext.staff_members)?.name?.trim() || null;
  const trimmedReason = cancellationReason?.trim() || null;

  const notificationByStatus = {
    confirmed: {
      notificationType: "appointment_confirmed",
      title: "Seu horário foi confirmado",
      body: staffName
        ? `${serviceName} em ${appointmentLabel} com ${staffName} foi confirmado pelo salão.`
        : `${serviceName} em ${appointmentLabel} foi confirmado pelo salão.`,
    },
    completed: {
      notificationType: "appointment_completed",
      title: "Atendimento concluído",
      body: staffName
        ? `${serviceName} com ${staffName} foi marcado como concluído pelo salão.`
        : `${serviceName} foi marcado como concluído pelo salão.`,
    },
    cancelled: {
      notificationType: "appointment_cancelled",
      title: "Seu horário foi cancelado pelo salão",
      body: trimmedReason
        ? `${serviceName} em ${appointmentLabel} foi cancelado. Motivo: ${trimmedReason}.`
        : `${serviceName} em ${appointmentLabel} foi cancelado pelo salão.`,
    },
    no_show: buildAppointmentNoShowNotification({
      appointmentId,
      serviceName,
      startsAt: appointmentContext.date,
      staffMemberName: staffName,
    }),
  } as const;

  const notification = notificationByStatus[status];
  const notificationType =
    "notificationType" in notification
      ? notification.notificationType
      : notification.type;

  await queueCustomerNotification({
    supabase,
    salonId,
    customerId: appointmentContext.customer_id,
    audience: "single_customer",
    notificationType,
    title: notification.title,
    body: notification.body,
    payload: {
      type: notificationType,
      appointmentId,
      appointmentStartsAt: appointmentContext.date,
      ctaTarget: "appointments",
      openInbox: true,
      serviceName,
      staffMemberName: staffName,
      targetTabIndex: 1,
    },
  });
}

function dayAtIso(daysOffset: number) {
  return new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
}

function getLocalDatePart(
  date: Date,
  timeZone: string,
  part: "year" | "month" | "day",
) {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      [part]: "2-digit",
    } as Intl.DateTimeFormatOptions)
      .formatToParts(date)
      .find((item) => item.type === part)?.value ?? ""
  );
}

function formatLocalDateKey(date: Date, timeZone: string) {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  })
    .formatToParts(date)
    .find((item) => item.type === "year")?.value;
  const month = getLocalDatePart(date, timeZone, "month");
  const day = getLocalDatePart(date, timeZone, "day");

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function formatLocalDateTime(value: string, timeZone: string) {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

  return formatted.replace(",", " às");
}

function rangesOverlap(args: {
  endA: string;
  endB: string;
  startA: string;
  startB: string;
}) {
  return (
    new Date(args.startA).getTime() < new Date(args.endB).getTime() &&
    new Date(args.startB).getTime() < new Date(args.endA).getTime()
  );
}

async function loadReplacementCandidates(args: {
  excludedProfessionalId: string;
  salonId: string;
  supabase: any;
}) {
  const [professionalsResult, appointmentsResult] = await Promise.all([
    args.supabase
      .from("staff_members")
      .select("id, name, is_active")
      .eq("salon_id", args.salonId)
      .eq("is_active", true),
    args.supabase
      .from("appointments")
      .select("staff_member_id, date, status")
      .eq("salon_id", args.salonId)
      .gte("date", dayAtIso(-120))
      .in("status", ["pending", "confirmed", "completed"]),
  ]);

  if (professionalsResult.error) {
    throw new Error(
      "Não foi possível carregar os profissionais ativos do salão.",
    );
  }

  if (appointmentsResult.error) {
    throw new Error(
      "Não foi possível medir a força da equipe para o remanejamento.",
    );
  }

  const counters = new Map<
    string,
    {
      completedCount: number;
      upcomingCount: number;
    }
  >();
  const nowIso = new Date().toISOString();

  for (const appointment of (appointmentsResult.data ?? []) as Array<{
    date: string;
    staff_member_id: string;
    status: string;
  }>) {
    const current = counters.get(appointment.staff_member_id) ?? {
      completedCount: 0,
      upcomingCount: 0,
    };

    if (
      (appointment.status === "pending" ||
        appointment.status === "confirmed") &&
      appointment.date >= nowIso
    ) {
      current.upcomingCount += 1;
    }

    if (appointment.status === "completed") {
      current.completedCount += 1;
    }

    counters.set(appointment.staff_member_id, current);
  }

  return (
    (professionalsResult.data ?? []) as Array<{
      id: string;
      is_active: boolean;
      name: string;
    }>
  )
    .filter(
      (professional) =>
        professional.is_active &&
        professional.id !== args.excludedProfessionalId,
    )
    .map((professional) => {
      const summary = counters.get(professional.id);
      return {
        completedCount: summary?.completedCount ?? 0,
        id: professional.id,
        name: professional.name,
        upcomingCount: summary?.upcomingCount ?? 0,
      };
    })
    .sort((left, right) => {
      if (right.completedCount !== left.completedCount) {
        return right.completedCount - left.completedCount;
      }

      if (right.upcomingCount !== left.upcomingCount) {
        return right.upcomingCount - left.upcomingCount;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
}

async function loadAssignmentsByProfessional(args: {
  professionalIds: string[];
  supabase: any;
}) {
  if (!args.professionalIds.length) {
    return new Map<string, Set<string>>();
  }

  const result = await args.supabase
    .from("staff_service_assignments")
    .select("staff_member_id, service_id")
    .in("staff_member_id", args.professionalIds);

  if (result.error) {
    throw new Error(
      "Não foi possível validar os serviços dos profissionais que podem receber a agenda.",
    );
  }

  const assignments = new Map<string, Set<string>>();

  for (const row of (result.data ?? []) as Array<{
    service_id: string;
    staff_member_id: string;
  }>) {
    const current = assignments.get(row.staff_member_id) ?? new Set<string>();
    current.add(row.service_id);
    assignments.set(row.staff_member_id, current);
  }

  return assignments;
}

async function getAvailableStaffSlots(args: {
  cache: Map<string, AvailableStaffSlot[]>;
  serviceId: string;
  supabase: any;
  targetDay: string;
}) {
  const cacheKey = `${args.serviceId}:${args.targetDay}`;
  const cached = args.cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const result = await args.supabase.rpc(
    "get_available_staff_slots_for_service",
    {
      service_uuid: args.serviceId,
      target_day: args.targetDay,
    },
  );

  if (result.error) {
    throw new Error(
      "Não foi possível calcular os encaixes da agenda para o remanejamento.",
    );
  }

  const slots = (result.data ?? []) as AvailableStaffSlot[];
  args.cache.set(cacheKey, slots);
  return slots;
}

async function findBestTransferSlot(args: {
  appointment: FutureProfessionalAppointment;
  candidate: ReplacementCandidate;
  plannedBusyByProfessional: Map<
    string,
    Array<{ endsAt: string; startsAt: string }>
  >;
  slotCache: Map<string, AvailableStaffSlot[]>;
  supabase: any;
  timeZone: string;
}) {
  const originalStartAt = args.appointment.date;
  const originalDay = formatLocalDateKey(
    new Date(originalStartAt),
    args.timeZone,
  );
  const dayAnchor = new Date(originalStartAt);
  dayAnchor.setUTCHours(12, 0, 0, 0);

  for (let offset = 0; offset <= 30; offset += 1) {
    const probeDay = new Date(
      dayAnchor.getTime() + offset * 24 * 60 * 60 * 1000,
    );
    const targetDay = formatLocalDateKey(probeDay, args.timeZone);
    const slots = await getAvailableStaffSlots({
      cache: args.slotCache,
      serviceId: args.appointment.service_id,
      supabase: args.supabase,
      targetDay,
    });

    const plannedBusy =
      args.plannedBusyByProfessional.get(args.candidate.id) ?? [];
    const filtered = slots
      .filter((slot) => slot.staff_member_id === args.candidate.id)
      .filter((slot) => {
        if (targetDay === originalDay && slot.start_at < originalStartAt) {
          return false;
        }

        return !plannedBusy.some((busy) =>
          rangesOverlap({
            endA: slot.ends_at,
            endB: busy.endsAt,
            startA: slot.start_at,
            startB: busy.startsAt,
          }),
        );
      })
      .sort(
        (left, right) =>
          new Date(left.start_at).getTime() -
          new Date(right.start_at).getTime(),
      );

    if (!filtered.length) {
      continue;
    }

    const exactSlot = filtered.find(
      (slot) => slot.start_at === originalStartAt,
    );
    if (exactSlot) {
      return {
        keepsSameTime: true,
        nextEndsAt: exactSlot.ends_at,
        nextStartAt: exactSlot.start_at,
      };
    }

    const firstSlot = filtered[0];

    return {
      keepsSameTime: false,
      nextEndsAt: firstSlot.ends_at,
      nextStartAt: firstSlot.start_at,
    };
  }

  return null;
}

function buildCustomerReassignmentCopy(args: {
  nextStartAt: string;
  previousStaffMemberName: string;
  replacementStaffMemberName: string;
  salonName: string;
  sameTime: boolean;
  serviceName: string;
  timeZone: string;
}) {
  if (args.sameTime) {
    return {
      body: `${args.previousStaffMemberName} não atende mais no ${args.salonName}. Reservamos seu ${args.serviceName} com ${args.replacementStaffMemberName} no mesmo horário, em ${formatLocalDateTime(args.nextStartAt, args.timeZone)}. Confirme com o salão se deseja seguir com esse profissional.`,
      title: "Seu atendimento precisa da sua confirmação",
    };
  }

  return {
    body: `${args.previousStaffMemberName} não atende mais no ${args.salonName}. Encontramos ${args.replacementStaffMemberName} disponível para o seu ${args.serviceName} em ${formatLocalDateTime(args.nextStartAt, args.timeZone)}. Confirme com o salão se esse profissional e horário funcionam para você.`,
    title: "Encontramos um novo encaixe para você",
  };
}

function buildAppointmentReassignmentNote(args: {
  nextStartAt: string;
  previousNotes: string | null;
  previousStaffMemberName: string;
  replacementStaffMemberName: string;
  sameTime: boolean;
  timeZone: string;
}) {
  const summary = args.sameTime
    ? `Remanejamento automático: ${args.previousStaffMemberName} saiu da equipe. Cliente precisa confirmar atendimento com ${args.replacementStaffMemberName} no mesmo horário (${formatLocalDateTime(args.nextStartAt, args.timeZone)}).`
    : `Remanejamento automático: ${args.previousStaffMemberName} saiu da equipe. Cliente precisa confirmar o novo encaixe com ${args.replacementStaffMemberName} em ${formatLocalDateTime(args.nextStartAt, args.timeZone)}.`;
  const baseNotes = args.previousNotes?.trim();

  if (!baseNotes) {
    return summary;
  }

  if (baseNotes.includes(summary)) {
    return baseNotes;
  }

  return `${baseNotes}\n\n${summary}`;
}

function mapDatabaseError(error: DatabaseActionError | null | undefined) {
  const message = error?.message?.trim() ?? "";
  const normalized = normalizeDatabaseErrorText(error);

  if (error?.code === "23505") {
    return "Já existe um registro com esses dados.";
  }

  if (error?.code === "23P01" || normalized.includes("time_slot_unavailable")) {
    return "Esse profissional já possui outro agendamento nesse horário.";
  }

  if (normalized.includes("customer_not_found")) {
    return "Selecione um cliente válido para esse salão.";
  }

  if (normalized.includes("inactive_service_not_allowed")) {
    return "Apenas serviços ativos podem receber novos agendamentos.";
  }

  if (normalized.includes("inactive_staff_member_not_allowed")) {
    return "Apenas profissionais ativos podem receber agendamentos.";
  }

  if (normalized.includes("appointment_not_open_for_update")) {
    return "Somente agendamentos em aberto podem ser editados.";
  }

  if (normalized.includes("inactive_service_category_not_allowed")) {
    return "A categoria desse serviço está inativa.";
  }

  if (
    normalized.includes("staff_member_cannot_perform_service") ||
    normalized.includes("service_customer_and_staff_must_belong_to_same_salon")
  ) {
    return "Esse profissional não está habilitado para o serviço selecionado.";
  }

  if (
    normalized.includes("payment_requires_completed_appointment") ||
    normalized.includes("appointment_already_completed")
  ) {
    return "Somente atendimentos concluídos podem receber pagamento.";
  }

  if (normalized.includes("invalid_payment_preference")) {
    return "Selecione uma forma preferida de pagamento válida.";
  }

  if (normalized.includes("payment_amount_must_match_service_price")) {
    return "O valor do pagamento precisa seguir o valor oficial salvo no atendimento.";
  }

  if (normalized.includes("appointment_service_price_unavailable")) {
    return "Não foi possível validar o valor oficial desse atendimento.";
  }

  if (normalized.includes("service_category_not_found")) {
    return "Selecione uma categoria válida.";
  }

  if (normalized.includes("past_appointment_cannot_be_cancelled")) {
    return "Agendamentos passados não podem ser cancelados por essa ação.";
  }

  if (normalized.includes("appointment_not_finished")) {
    return "Espere o horário terminar antes de concluir o atendimento.";
  }

  if (normalized.includes("salon_closed_on_selected_day")) {
    return "O salão não atende nessa data.";
  }

  if (normalized.includes("staff_member_closed_on_selected_day")) {
    return "Esse profissional não atende nessa data.";
  }

  if (
    normalized.includes("outside_business_hours") ||
    normalized.includes("staff_member_outside_business_hours")
  ) {
    return "Escolha um horário dentro da agenda operacional do salão e do profissional.";
  }

  if (normalized.includes("staff_member_blocked_time")) {
    return "Esse horário está bloqueado na agenda do profissional.";
  }

  if (normalized.includes("slot_step_mismatch")) {
    return "Use um horário alinhado ao intervalo configurado da agenda do salão.";
  }

  if (normalized.includes("past_time_not_allowed")) {
    return "Escolha uma data e um horário futuros para o agendamento.";
  }

  if (normalized.includes("invalid_transfer_plan")) {
    return "Não foi possível montar um plano seguro para remanejar a agenda.";
  }

  if (normalized.includes("staff_member_has_untransferred_appointments")) {
    return "Ainda existem agendamentos futuros com esse profissional. Recalcule o remanejamento antes de remover.";
  }

  if (normalized.includes("staff_members_phone_length_check")) {
    return "Telefone precisa ter entre 8 e 30 caracteres.";
  }

  if (normalized.includes("staff_members_commission_rate_percent_check")) {
    return "A comissão precisa ficar entre 0% e 100%.";
  }

  if (
    error?.code === "42501" ||
    normalized.includes("permission denied") ||
    normalized.includes("row-level security")
  ) {
    return "Sua sessão não tem permissão para concluir essa alteração. Entre novamente e tente de novo.";
  }

  return null;
}

function respond(
  formData: FormData,
  returnPath: string,
  message: string,
  tone: "success" | "error" | "info",
): InlineActionState | never {
  if (isInlineAction(formData)) {
    return buildInlineActionState(message, tone);
  }

  redirect(buildRedirectNotice(returnPath, message, tone));
}

function fail(_returnPath: string, message: string): never {
  throwManagementActionError(message);
}

function succeed(
  formData: FormData,
  returnPath: string,
  message: string,
): InlineActionState | never {
  return respond(formData, returnPath, message, "success");
}

function handleActionFailure(
  formData: FormData,
  returnPath: string,
  error: unknown,
  fallback: string,
): InlineActionState | never {
  rethrowIfRedirectError(error);

  const message =
    error instanceof ManagementActionError
      ? error.message
      : firstMessage(error, fallback);

  return respond(formData, returnPath, message, "error");
}

async function ensureActiveServiceAssignments(args: {
  supabase: any;
  salonId: string;
  professionalId: string;
}) {
  const activeServicesResult = await args.supabase
    .from("services")
    .select("id")
    .eq("salon_id", args.salonId)
    .eq("is_active", true);

  const activeServices = (activeServicesResult.data ?? []) as Array<{
    id: string;
  }>;

  if (!activeServices.length) {
    return;
  }

  await args.supabase.from("staff_service_assignments").upsert(
    activeServices.map((service) => ({
      staff_member_id: args.professionalId,
      service_id: service.id,
    })),
    {
      onConflict: "staff_member_id,service_id",
    },
  );
}

async function loadSalonServiceAssignments(args: {
  salonId: string;
  supabase: any;
}) {
  const servicesResult = await args.supabase
    .from("services")
    .select("id, name")
    .eq("salon_id", args.salonId);

  if (servicesResult.error) {
    throwManagementActionError(
      "Não foi possível carregar os serviços do salão.",
    );
  }

  return (servicesResult.data ?? []) as Array<{ id: string; name: string }>;
}

async function assertProfessionalServiceSelectionIsSafe(args: {
  professionalId: string;
  requestedServiceIds: string[];
  salonId: string;
  supabase: any;
}) {
  const openAppointmentsResult = await args.supabase
    .from("appointments")
    .select("id, service_id, services(name)")
    .eq("salon_id", args.salonId)
    .eq("staff_member_id", args.professionalId)
    .in("status", ["pending", "confirmed"])
    .gte("date", new Date().toISOString());

  if (openAppointmentsResult.error) {
    throwManagementActionError(
      "Não foi possível validar a agenda futura desse profissional.",
    );
  }

  const retainedServiceIds = new Set(args.requestedServiceIds);
  const blockedAppointments = (
    (openAppointmentsResult.data ?? []) as Array<{
      id: string;
      service_id: string;
      services: NotificationRelation<{ name: string | null }>;
    }>
  ).filter((appointment) => !retainedServiceIds.has(appointment.service_id));

  if (!blockedAppointments.length) {
    return;
  }

  const affectedServices = Array.from(
    new Set(
      blockedAppointments
        .map((appointment) => firstRelation(appointment.services)?.name?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const affectedLabel = affectedServices.length
    ? affectedServices.slice(0, 3).join(", ")
    : "esses serviços";

  throwManagementActionError(
    `Remaneje ou conclua os próximos horários de ${affectedLabel} antes de tirar esses serviços da agenda desse profissional.`,
  );
}

async function replaceProfessionalServiceAssignments(args: {
  clearExisting?: boolean;
  professionalId: string;
  requestedServiceIds: string[];
  supabase: any;
}) {
  if (args.clearExisting ?? true) {
    const deleteResult = await args.supabase
      .from("staff_service_assignments")
      .delete()
      .eq("staff_member_id", args.professionalId);

    if (deleteResult.error) {
      throwManagementActionError(
        "Não foi possível atualizar os serviços habilitados desse profissional.",
      );
    }
  }

  if (!args.requestedServiceIds.length) {
    return;
  }

  const insertResult = await args.supabase
    .from("staff_service_assignments")
    .insert(
      args.requestedServiceIds.map((serviceId) => ({
        staff_member_id: args.professionalId,
        service_id: serviceId,
      })),
    );

  if (insertResult.error) {
    throwManagementActionError(
      "Não foi possível salvar os serviços habilitados desse profissional.",
    );
  }
}

async function getAppointmentPaymentCount(
  supabase: any,
  appointmentId: string,
) {
  const { count } = await supabase
    .from("appointment_payments")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", appointmentId);

  return count ?? 0;
}

export async function createManagementCategoryAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CATEGORIES_PATH);

  try {
    const parsed = managementCategorySchema.parse({
      name: formData.get("name"),
      description: formData.get("description"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { error } = await supabase.from("service_categories").insert({
      salon_id: salon.id,
      name: parsed.name,
      description: parsed.description ?? null,
      is_active: parsed.isActive,
    });

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível criar a categoria.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Categoria cadastrada com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível criar a categoria.",
    );
  }
}

export async function updateManagementCategoryAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CATEGORIES_PATH);

  try {
    const parsed = managementCategoryUpdateSchema.parse({
      categoryId: formData.get("categoryId"),
      name: formData.get("name"),
      description: formData.get("description"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { error } = await supabase
      .from("service_categories")
      .update({
        name: parsed.name,
        description: parsed.description ?? null,
        is_active: parsed.isActive,
      })
      .eq("id", parsed.categoryId)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar a categoria.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Categoria atualizada com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar a categoria.",
    );
  }
}

export async function deleteManagementCategoryAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CATEGORIES_PATH);

  try {
    const parsed = managementDeleteSchema.parse({
      id: formData.get("categoryId"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("service_category_id", parsed.id);

    if ((count ?? 0) > 0) {
      fail(
        returnPath,
        "Remova ou reclassifique os serviços antes de excluir a categoria.",
      );
    }

    const { error } = await supabase
      .from("service_categories")
      .delete()
      .eq("id", parsed.id)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível excluir a categoria.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Categoria removida com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível excluir a categoria.",
    );
  }
}

export async function createManagementServiceAction(formData: FormData) {
  const returnPath = getReturnPath(formData, SERVICES_PATH);

  try {
    const parsed = managementServiceSchema.parse({
      name: formData.get("name"),
      serviceCategoryId: formData.get("serviceCategoryId"),
      duration: formData.get("duration"),
      price: formData.get("price"),
      description: formData.get("description"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const uploadedImagePath = await uploadManagementServiceImage({
      formData,
      field: "image",
      salonId: salon.id,
      supabase,
      redirectPath: returnPath,
    });
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id);

    const { error } = await supabase.from("services").insert({
      salon_id: salon.id,
      service_category_id: parsed.serviceCategoryId,
      name: parsed.name,
      price: parsed.price,
      duration: parsed.duration,
      description: parsed.description ?? null,
      is_active: parsed.isActive,
      sort_order: count ?? 0,
      image_path: uploadedImagePath,
    });

    if (error) {
      if (uploadedImagePath) {
        await supabase.storage.from("salon-assets").remove([uploadedImagePath]);
      }
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível criar o serviço.",
      );
    }

    if (parsed.isActive) {
      const notification = buildServiceCatalogNotification({
        action: "published",
        serviceName: parsed.name,
      });
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Serviço cadastrado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível criar o serviço.",
    );
  }
}

export async function updateManagementServiceAction(formData: FormData) {
  const returnPath = getReturnPath(formData, SERVICES_PATH);

  try {
    const parsed = managementServiceUpdateSchema.parse({
      serviceId: formData.get("serviceId"),
      name: formData.get("name"),
      serviceCategoryId: formData.get("serviceCategoryId"),
      duration: formData.get("duration"),
      price: formData.get("price"),
      description: formData.get("description"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const removeImage = flag(formData, "removeImage");
    const currentService = await supabase
      .from("services")
      .select("id, image_path, is_active")
      .eq("salon_id", salon.id)
      .eq("id", parsed.serviceId)
      .maybeSingle();

    if (!currentService.data?.id) {
      fail(returnPath, "Não foi possível localizar esse serviço.");
    }

    const previousImagePath = currentService.data.image_path ?? null;
    const uploadedImagePath = await uploadManagementServiceImage({
      formData,
      field: "image",
      salonId: salon.id,
      supabase,
      redirectPath: returnPath,
    });
    const nextImagePath = uploadedImagePath
      ? uploadedImagePath
      : removeImage
        ? null
        : previousImagePath;
    const { error } = await supabase
      .from("services")
      .update({
        service_category_id: parsed.serviceCategoryId,
        name: parsed.name,
        duration: parsed.duration,
        price: parsed.price,
        description: parsed.description ?? null,
        is_active: parsed.isActive,
        image_path: nextImagePath,
      })
      .eq("id", parsed.serviceId)
      .eq("salon_id", salon.id);

    if (error) {
      if (uploadedImagePath) {
        await supabase.storage.from("salon-assets").remove([uploadedImagePath]);
      }
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o serviço.",
      );
    }

    if (previousImagePath && previousImagePath !== nextImagePath) {
      await supabase.storage.from("salon-assets").remove([previousImagePath]);
    }

    if (parsed.isActive) {
      const notification = buildServiceCatalogNotification({
        action: currentService.data.is_active ? "updated" : "published",
        serviceId: parsed.serviceId,
        serviceName: parsed.name,
      });
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Serviço atualizado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar o serviço.",
    );
  }
}

export async function deleteManagementServiceAction(formData: FormData) {
  const returnPath = getReturnPath(formData, SERVICES_PATH);

  try {
    const parsed = managementDeleteSchema.parse({
      id: formData.get("serviceId"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("service_id", parsed.id);

    if ((count ?? 0) > 0) {
      fail(
        returnPath,
        "Esse serviço já possui atendimentos vinculados e não pode ser excluído.",
      );
    }

    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", parsed.id)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível excluir o serviço.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Serviço removido com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível excluir o serviço.",
    );
  }
}

export async function createManagementClientAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CLIENTS_PATH);

  try {
    const parsed = managementClientSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate"),
      notes: formData.get("notes"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { error } = await supabase.from("customers").insert({
      salon_id: salon.id,
      name: parsed.name,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      birth_date: parsed.birthDate ?? null,
      notes: parsed.notes ?? null,
    });

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível cadastrar o cliente.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Cliente cadastrado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível cadastrar o cliente.",
    );
  }
}

export async function updateManagementClientAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CLIENTS_PATH);

  try {
    const parsed = managementClientUpdateSchema.parse({
      clientId: formData.get("clientId"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      birthDate: formData.get("birthDate"),
      notes: formData.get("notes"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { error } = await supabase
      .from("customers")
      .update({
        name: parsed.name,
        phone: parsed.phone ?? null,
        email: parsed.email ?? null,
        birth_date: parsed.birthDate ?? null,
        notes: parsed.notes ?? null,
      })
      .eq("id", parsed.clientId)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o cliente.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Cliente atualizado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar o cliente.",
    );
  }
}

export async function deleteManagementClientAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CLIENTS_PATH);

  try {
    const parsed = managementDeleteSchema.parse({
      id: formData.get("clientId"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("customer_id", parsed.id);

    if ((count ?? 0) > 0) {
      fail(
        returnPath,
        "Esse cliente já possui histórico e não pode ser excluído.",
      );
    }

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", parsed.id)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível excluir o cliente.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Cliente removido com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível excluir o cliente.",
    );
  }
}

export async function createManagementProfessionalAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PROFESSIONALS_PATH);

  try {
    const shouldSyncServiceAssignments =
      String(formData.get("serviceSelectionReady") ?? "") === "1";
    const requestedServiceIds = readStringValues(formData, "serviceIds");
    const parsed = managementProfessionalSchema.parse({
      name: formData.get("name"),
      specialty: formData.get("specialty"),
      phone: formData.get("phone"),
      commissionRatePercent: formData.get("commissionRatePercent"),
      isActive: flag(formData, "isActive"),
      serviceIds: requestedServiceIds,
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    if (shouldSyncServiceAssignments) {
      const salonServices = await loadSalonServiceAssignments({
        supabase,
        salonId: salon.id,
      });
      const validServiceIds = new Set(
        salonServices.map((service) => service.id),
      );

      if (
        parsed.serviceIds.some((serviceId) => !validServiceIds.has(serviceId))
      ) {
        fail(returnPath, "Selecione apenas serviços do seu salão.");
      }
    }
    const uploadedImagePath = await uploadManagementProfessionalImage({
      formData,
      field: "image",
      salonId: salon.id,
      supabase,
      redirectPath: returnPath,
    });
    const insertPayload: Record<string, unknown> = {
      salon_id: salon.id,
      name: parsed.name,
      role: parsed.specialty ?? null,
      phone: parsed.phone ?? null,
      commission_rate_percent: parsed.commissionRatePercent,
      is_active: parsed.isActive,
    };

    if (uploadedImagePath) {
      insertPayload.image_path = uploadedImagePath;
    }
    const insertResult = await supabase
      .from("staff_members")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertResult.error || !insertResult.data?.id) {
      if (uploadedImagePath) {
        await supabase.storage.from("salon-assets").remove([uploadedImagePath]);
      }
      if (isMissingDatabaseColumnError(insertResult.error, "image_path")) {
        fail(
          returnPath,
          "Atualize o banco com a migration da foto dos profissionais antes de enviar esse arquivo.",
        );
      }
      fail(
        returnPath,
        mapDatabaseError(insertResult.error) ??
          "Não foi possível cadastrar o profissional.",
      );
    }

    if (shouldSyncServiceAssignments) {
      await replaceProfessionalServiceAssignments({
        clearExisting: false,
        supabase,
        professionalId: insertResult.data.id,
        requestedServiceIds: parsed.serviceIds,
      });
    } else {
      await ensureActiveServiceAssignments({
        supabase,
        salonId: salon.id,
        professionalId: insertResult.data.id,
      });
    }

    if (parsed.isActive) {
      const notification = buildStaffAvailabilityNotification({
        action: "created",
        staffMemberName: parsed.name,
        staffRole: parsed.specialty,
      });
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
    }

    invalidateManagementPages();
    return succeed(
      formData,
      returnPath,
      "Profissional cadastrado com sucesso.",
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível cadastrar o profissional.",
    );
  }
}

export async function updateManagementProfessionalAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PROFESSIONALS_PATH);

  try {
    const shouldSyncServiceAssignments =
      String(formData.get("serviceSelectionReady") ?? "") === "1";
    const requestedServiceIds = readStringValues(formData, "serviceIds");
    const parsed = managementProfessionalUpdateSchema.parse({
      professionalId: formData.get("professionalId"),
      name: formData.get("name"),
      specialty: formData.get("specialty"),
      phone: formData.get("phone"),
      commissionRatePercent: formData.get("commissionRatePercent"),
      isActive: flag(formData, "isActive"),
      serviceIds: requestedServiceIds,
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const removeImage = flag(formData, "removeImage");
    let currentProfessional = await supabase
      .from("staff_members")
      .select("id, is_active, image_path")
      .eq("id", parsed.professionalId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (isMissingDatabaseColumnError(currentProfessional.error, "image_path")) {
      currentProfessional = await supabase
        .from("staff_members")
        .select("id, is_active")
        .eq("id", parsed.professionalId)
        .eq("salon_id", salon.id)
        .maybeSingle();
    }

    if (currentProfessional.error || !currentProfessional.data?.id) {
      fail(returnPath, "Não foi possível localizar esse profissional.");
    }

    if (!parsed.isActive) {
      const { count } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("staff_member_id", parsed.professionalId)
        .in("status", ["pending", "confirmed"])
        .gte("date", new Date().toISOString());

      if ((count ?? 0) > 0) {
        fail(
          returnPath,
          "Remaneje os próximos horários antes de inativar esse profissional.",
        );
      }
    }

    if (shouldSyncServiceAssignments) {
      const salonServices = await loadSalonServiceAssignments({
        supabase,
        salonId: salon.id,
      });
      const validServiceIds = new Set(
        salonServices.map((service) => service.id),
      );

      if (
        parsed.serviceIds.some((serviceId) => !validServiceIds.has(serviceId))
      ) {
        fail(returnPath, "Selecione apenas serviços do seu salão.");
      }

      await assertProfessionalServiceSelectionIsSafe({
        supabase,
        professionalId: parsed.professionalId,
        requestedServiceIds: parsed.serviceIds,
        salonId: salon.id,
      });
    }

    const previousImagePath = currentProfessional.data.image_path ?? null;
    const uploadedImagePath = await uploadManagementProfessionalImage({
      formData,
      field: "image",
      salonId: salon.id,
      supabase,
      redirectPath: returnPath,
    });
    const nextImagePath = uploadedImagePath
      ? uploadedImagePath
      : removeImage
        ? null
        : previousImagePath;
    const updatePayload: Record<string, unknown> = {
      name: parsed.name,
      role: parsed.specialty ?? null,
      phone: parsed.phone ?? null,
      commission_rate_percent: parsed.commissionRatePercent,
      is_active: parsed.isActive,
    };

    if (uploadedImagePath || removeImage || previousImagePath) {
      updatePayload.image_path = nextImagePath;
    }
    const { error } = await supabase
      .from("staff_members")
      .update(updatePayload)
      .eq("id", parsed.professionalId)
      .eq("salon_id", salon.id);

    if (error) {
      console.error(
        "updateManagementProfessionalAction: failed to update professional",
        {
          salonId: salon.id,
          professionalId: parsed.professionalId,
          code: error.code ?? null,
          message: error.message ?? null,
        },
      );
      if (uploadedImagePath) {
        await supabase.storage.from("salon-assets").remove([uploadedImagePath]);
      }
      if (isMissingDatabaseColumnError(error, "image_path")) {
        fail(
          returnPath,
          "Atualize o banco com a migration da foto dos profissionais antes de salvar essa imagem.",
        );
      }
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o profissional.",
      );
    }

    if (previousImagePath && previousImagePath !== nextImagePath) {
      await supabase.storage.from("salon-assets").remove([previousImagePath]);
    }

    if (shouldSyncServiceAssignments) {
      await replaceProfessionalServiceAssignments({
        supabase,
        professionalId: parsed.professionalId,
        requestedServiceIds: parsed.serviceIds,
      });
    } else if (parsed.isActive) {
      await ensureActiveServiceAssignments({
        supabase,
        salonId: salon.id,
        professionalId: parsed.professionalId,
      });
    }

    if (parsed.isActive && !currentProfessional.data.is_active) {
      const notification = buildStaffAvailabilityNotification({
        action: "reactivated",
        staffMemberName: parsed.name,
        staffRole: parsed.specialty,
      });
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
    }

    invalidateManagementPages();
    return succeed(
      formData,
      returnPath,
      "Profissional atualizado com sucesso.",
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar o profissional.",
    );
  }
}

export async function deleteManagementProfessionalAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PROFESSIONALS_PATH);

  try {
    const parsed = managementDeleteSchema.parse({
      id: formData.get("professionalId"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const nowIso = new Date().toISOString();
    const timeZone = salon.timezone ?? "America/Sao_Paulo";
    const salonName =
      typeof salon.name === "string" && salon.name.trim().length
        ? salon.name.trim()
        : "salão";
    let professionalResult = await supabase
      .from("staff_members")
      .select("id, name, is_default, image_path")
      .eq("id", parsed.id)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (isMissingDatabaseColumnError(professionalResult.error, "image_path")) {
      professionalResult = await supabase
        .from("staff_members")
        .select("id, name, is_default")
        .eq("id", parsed.id)
        .eq("salon_id", salon.id)
        .maybeSingle();
    }

    if (professionalResult.error || !professionalResult.data?.id) {
      fail(returnPath, "Não foi possível localizar esse profissional.");
    }

    if (professionalResult.data.is_default) {
      fail(
        returnPath,
        "O profissional inicial do sistema não pode ser removido. Pause ou remaneje a agenda desse perfil sem apagar o histórico.",
      );
    }

    const { count } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("staff_member_id", parsed.id);

    if ((count ?? 0) === 0) {
      const { error } = await supabase
        .from("staff_members")
        .delete()
        .eq("id", parsed.id)
        .eq("salon_id", salon.id);

      if (error) {
        fail(
          returnPath,
          mapDatabaseError(error) ?? "Não foi possível excluir o profissional.",
        );
      }

      if (professionalResult.data.image_path) {
        await supabase.storage
          .from("salon-assets")
          .remove([professionalResult.data.image_path]);
      }

      invalidateManagementPages();
      return succeed(
        formData,
        returnPath,
        "Profissional removido com sucesso.",
      );
    }

    const futureAppointmentsResult = await supabase
      .from("appointments")
      .select(
        "id, customer_id, service_id, date, ends_at, notes, status, customers(name, phone), services(name, duration)",
      )
      .eq("salon_id", salon.id)
      .eq("staff_member_id", parsed.id)
      .gt("date", nowIso)
      .in("status", ["pending", "confirmed"])
      .order("date", { ascending: true });

    if (futureAppointmentsResult.error) {
      fail(
        returnPath,
        "Não foi possível carregar a agenda futura desse profissional.",
      );
    }

    const futureAppointments = (futureAppointmentsResult.data ??
      []) as FutureProfessionalAppointment[];

    if (!futureAppointments.length) {
      const [pauseResult, blocksResult] = await Promise.all([
        supabase
          .from("staff_members")
          .update({ is_active: false })
          .eq("id", parsed.id)
          .eq("salon_id", salon.id),
        supabase
          .from("staff_blocks")
          .delete()
          .eq("staff_member_id", parsed.id)
          .gte("ends_at", nowIso),
      ]);

      if (pauseResult.error) {
        fail(
          returnPath,
          mapDatabaseError(pauseResult.error) ??
            "Não foi possível desligar esse profissional da equipe.",
        );
      }

      invalidateManagementPages();
      return succeed(
        formData,
        returnPath,
        blocksResult.error
          ? `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico. Alguns bloqueios futuros ainda precisam de revisão manual.`
          : `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico.`,
      );
    }

    const replacementCandidates = await loadReplacementCandidates({
      excludedProfessionalId: parsed.id,
      salonId: salon.id,
      supabase,
    });

    if (!replacementCandidates.length) {
      fail(
        returnPath,
        "Ative ou cadastre outro profissional antes de remover quem ainda tem clientes agendados.",
      );
    }

    const assignmentsByProfessional = await loadAssignmentsByProfessional({
      professionalIds: replacementCandidates.map((candidate) => candidate.id),
      supabase,
    });
    const slotCache = new Map<string, AvailableStaffSlot[]>();
    const plannedBusyByProfessional = new Map<
      string,
      Array<{ endsAt: string; startsAt: string }>
    >();
    const transferPlans: AppointmentTransferPlan[] = [];

    for (const appointment of futureAppointments) {
      const customer = firstRelation(appointment.customers);
      const service = firstRelation(appointment.services);
      let selectedPlan: AppointmentTransferPlan | null = null;

      for (const candidate of replacementCandidates) {
        const serviceAssignments = assignmentsByProfessional.get(candidate.id);

        if (!serviceAssignments?.has(appointment.service_id)) {
          continue;
        }

        const slot = await findBestTransferSlot({
          appointment,
          candidate,
          plannedBusyByProfessional,
          slotCache,
          supabase,
          timeZone,
        });

        if (!slot) {
          continue;
        }

        selectedPlan = {
          appointmentId: appointment.id,
          customerId: appointment.customer_id,
          customerName:
            typeof customer?.name === "string" && customer.name.trim().length
              ? customer.name.trim()
              : "Cliente",
          customerPhone:
            typeof customer?.phone === "string" &&
            customer.phone.trim().length > 0
              ? customer.phone.trim()
              : null,
          keepsSameTime: slot.keepsSameTime,
          nextEndsAt: slot.nextEndsAt,
          nextStartAt: slot.nextStartAt,
          previousEndsAt: appointment.ends_at,
          previousNotes: appointment.notes ?? null,
          previousStartAt: appointment.date,
          previousStaffMemberName: professionalResult.data.name,
          previousStatus: appointment.status,
          replacementStaffMemberId: candidate.id,
          replacementStaffMemberName: candidate.name,
          serviceId: appointment.service_id,
          serviceName:
            typeof service?.name === "string" && service.name.trim().length
              ? service.name.trim()
              : "atendimento",
        };
        break;
      }

      if (!selectedPlan) {
        const service = firstRelation(appointment.services);
        const customer = firstRelation(appointment.customers);
        const serviceName =
          typeof service?.name === "string" && service.name.trim().length
            ? service.name.trim()
            : "atendimento";
        const customerName =
          typeof customer?.name === "string" && customer.name.trim().length
            ? customer.name.trim()
            : "o cliente";

        fail(
          returnPath,
          `Não encontrei um encaixe seguro para ${customerName} em ${serviceName}. Ative outro profissional ou ajuste a agenda antes de remover esse perfil.`,
        );
      }

      const resolvedPlan = selectedPlan as AppointmentTransferPlan;
      const nextBusyWindow =
        plannedBusyByProfessional.get(resolvedPlan.replacementStaffMemberId) ??
        [];
      nextBusyWindow.push({
        endsAt: resolvedPlan.nextEndsAt,
        startsAt: resolvedPlan.nextStartAt,
      });
      plannedBusyByProfessional.set(
        resolvedPlan.replacementStaffMemberId,
        nextBusyWindow,
      );
      transferPlans.push(resolvedPlan);
    }

    const transferPayload = transferPlans.map((plan) => {
      const notes = buildAppointmentReassignmentNote({
        nextStartAt: plan.nextStartAt,
        previousNotes: plan.previousNotes,
        previousStaffMemberName: plan.previousStaffMemberName,
        replacementStaffMemberName: plan.replacementStaffMemberName,
        sameTime: plan.keepsSameTime,
        timeZone,
      });

      return {
        appointmentId: plan.appointmentId,
        customerId: plan.customerId,
        nextStartAt: plan.nextStartAt,
        notes,
        replacementStaffMemberId: plan.replacementStaffMemberId,
        serviceId: plan.serviceId,
      };
    });

    const transferResult = await supabase.rpc(
      "offboard_management_professional_with_transfers",
      {
        block_cutoff: nowIso,
        target_staff_member_uuid: parsed.id,
        transfer_plans: transferPayload,
      },
    );

    if (transferResult.error) {
      fail(
        returnPath,
        mapDatabaseError(transferResult.error) ??
          "Não foi possível concluir o remanejamento da agenda desse profissional.",
      );
    }

    const notifications = transferPlans
      .filter((plan) => plan.customerId)
      .map((plan) => {
        const copy = buildCustomerReassignmentCopy({
          nextStartAt: plan.nextStartAt,
          previousStaffMemberName: plan.previousStaffMemberName,
          replacementStaffMemberName: plan.replacementStaffMemberName,
          salonName,
          sameTime: plan.keepsSameTime,
          serviceName: plan.serviceName,
          timeZone,
        });

        return {
          audience: "single_customer",
          body: copy.body,
          customer_id: plan.customerId,
          notification_type: "appointment_staff_reassigned",
          payload: {
            ...prepareCustomerNotificationPayload(
              "appointment_staff_reassigned",
              {
                appointmentId: plan.appointmentId,
                keepSameTime: plan.keepsSameTime,
                nextEndsAt: plan.nextEndsAt,
                nextStartAt: plan.nextStartAt,
                previousEndsAt: plan.previousEndsAt,
                previousStartAt: plan.previousStartAt,
                previousStatus: plan.previousStatus,
                previousStaffMemberName: plan.previousStaffMemberName,
                replacementStaffMemberId: plan.replacementStaffMemberId,
                replacementStaffMemberName: plan.replacementStaffMemberName,
                requiresCustomerConfirmation: true,
                serviceName: plan.serviceName,
                type: "appointment_staff_reassigned",
              },
            ),
          },
          salon_id: salon.id,
          title: copy.title,
        };
      });

    let warnings: string[] = [];

    if (notifications.length) {
      const notificationsResult = await supabase
        .from("salon_customer_notifications")
        .insert(notifications);

      if (notificationsResult.error) {
        warnings.push("os avisos no app");
      }
    }

    invalidateManagementPages();
    return succeed(
      formData,
      returnPath,
      warnings.length
        ? `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico. ${transferPlans.length} cliente(s) foram remanejados e precisam confirmar a troca. Atenção: ${warnings.join(" e ")}.`
        : `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico. ${transferPlans.length} cliente(s) foram remanejados para os profissionais mais fortes disponíveis e receberam pedido de confirmação.`,
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível excluir o profissional.",
    );
  }
}

export async function createManagementAppointmentAction(formData: FormData) {
  const returnPath = getReturnPath(formData, APPOINTMENTS_PATH);

  try {
    const parsed = managementAppointmentSchema.parse({
      clientId: formData.get("clientId"),
      professionalId: formData.get("professionalId"),
      serviceId: formData.get("serviceId"),
      date: formData.get("date"),
      time: formData.get("time"),
      paymentPreference: formData.get("paymentPreference"),
      notes: formData.get("notes"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const timeZone = salon.timezone ?? "America/Sao_Paulo";
    const scheduledAt = combineDateAndTimeToUtc(
      parsed.date,
      parsed.time,
      timeZone,
    );

    if (scheduledAt <= new Date()) {
      fail(
        returnPath,
        "Escolha uma data e um horário futuros para o agendamento.",
      );
    }

    const createResult = await supabase.rpc("create_management_appointment", {
      customer_uuid: parsed.clientId,
      service_uuid: parsed.serviceId,
      requested_date: scheduledAt.toISOString(),
      staff_member_uuid: parsed.professionalId,
      notes_input: parsed.notes ?? null,
      payment_preference_input: parsed.paymentPreference ?? null,
    });

    if (createResult.error) {
      fail(
        returnPath,
        mapDatabaseError(createResult.error) ??
          "Não foi possível criar o agendamento.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Agendamento criado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível criar o agendamento.",
    );
  }
}

export async function updateManagementAppointmentAction(formData: FormData) {
  const returnPath = getReturnPath(formData, APPOINTMENTS_PATH);

  try {
    const parsed = managementAppointmentUpdateSchema.parse({
      appointmentId: formData.get("appointmentId"),
      clientId: formData.get("clientId"),
      professionalId: formData.get("professionalId"),
      serviceId: formData.get("serviceId"),
      date: formData.get("date"),
      time: formData.get("time"),
      paymentPreference: formData.get("paymentPreference"),
      notes: formData.get("notes"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const currentAppointmentResult = await supabase
      .from("appointments")
      .select(
        "id, customer_id, service_id, staff_member_id, date, services(name), staff_members(name)",
      )
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (currentAppointmentResult.error || !currentAppointmentResult.data?.id) {
      fail(returnPath, "Não foi possível localizar esse agendamento.");
    }

    const scheduledAt = combineDateAndTimeToUtc(
      parsed.date,
      parsed.time,
      salon.timezone ?? "America/Sao_Paulo",
    );
    const planReservation = await resolveAppointmentPlanReservation({
      appointmentId: parsed.appointmentId,
      salonId: salon.id,
    });

    if (
      planReservation &&
      currentAppointmentResult.data.customer_id &&
      parsed.clientId !== currentAppointmentResult.data.customer_id
    ) {
      fail(
        returnPath,
        "Atendimentos cobertos por plano precisam manter a mesma cliente do app.",
      );
    }

    if (
      planReservation &&
      parsed.professionalId !== currentAppointmentResult.data.staff_member_id
    ) {
      fail(
        returnPath,
        "Atendimentos cobertos por plano precisam manter o profissional reservado para o plano.",
      );
    }

    if (
      planReservation &&
      currentAppointmentResult.data.service_id &&
      parsed.serviceId !== currentAppointmentResult.data.service_id
    ) {
      fail(
        returnPath,
        "Atendimentos cobertos por plano precisam manter o serviço do plano.",
      );
    }

    if (
      planReservation &&
      !isDateWithinMembershipPlanWindow({
        membershipExpiresAt: planReservation.membershipExpiresAt,
        membershipStartedAt: planReservation.membershipStartedAt,
        scheduledAt,
        timeZone: salon.timezone ?? "America/Sao_Paulo",
      })
    ) {
      fail(
        returnPath,
        "Esse horário precisa continuar dentro da vigência do plano mensal.",
      );
    }

    const updateResult = await supabase.rpc("update_management_appointment", {
      appointment_uuid: parsed.appointmentId,
      customer_uuid: parsed.clientId,
      service_uuid: parsed.serviceId,
      requested_date: scheduledAt.toISOString(),
      staff_member_uuid: parsed.professionalId,
      notes_input: parsed.notes ?? null,
      payment_preference_input: planReservation
        ? null
        : (parsed.paymentPreference ?? null),
    });

    if (updateResult.error) {
      fail(
        returnPath,
        mapDatabaseError(updateResult.error) ??
          "Não foi possível atualizar o agendamento.",
      );
    }

    if (planReservation) {
      await neutralizeMembershipPlanAppointment({
        appointmentId: parsed.appointmentId,
      });
    }

    const updatedAppointmentResult = await supabase
      .from("appointments")
      .select(
        "id, customer_id, service_id, staff_member_id, date, services(name), staff_members(name)",
      )
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (
      !updatedAppointmentResult.error &&
      updatedAppointmentResult.data?.customer_id
    ) {
      const previousAppointment = currentAppointmentResult.data;
      const nextAppointment = updatedAppointmentResult.data;
      const previousServiceName =
        firstRelation(previousAppointment.services)?.name?.trim() ||
        "seu atendimento";
      const nextServiceName =
        firstRelation(nextAppointment.services)?.name?.trim() ||
        previousServiceName;
      const previousStaffMemberName =
        firstRelation(previousAppointment.staff_members)?.name?.trim() || null;
      const nextStaffMemberName =
        firstRelation(nextAppointment.staff_members)?.name?.trim() ||
        previousStaffMemberName;
      const appointmentChanged =
        previousAppointment.date !== nextAppointment.date ||
        previousServiceName !== nextServiceName ||
        previousStaffMemberName !== nextStaffMemberName;

      if (appointmentChanged) {
        const notification = buildAppointmentRescheduledNotification({
          appointmentId: parsed.appointmentId,
          nextServiceName,
          nextStaffMemberName,
          nextStartsAt: nextAppointment.date,
          previousStartsAt: previousAppointment.date,
          previousStaffMemberName,
          previousServiceName,
        });

        await queueCustomerNotification({
          supabase,
          salonId: salon.id,
          customerId: nextAppointment.customer_id,
          audience: "single_customer",
          notificationType: notification.type,
          title: notification.title,
          body: notification.body,
          payload: notification.payload,
        });
      }
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Agendamento atualizado com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar o agendamento.",
    );
  }
}

export async function reprocessManagementMembershipPlanAction(
  formData: FormData,
) {
  const returnPath = getReturnPath(formData, APPOINTMENTS_PATH);

  try {
    const appointmentId = String(formData.get("appointmentId") ?? "").trim();
    if (!appointmentId) {
      fail(returnPath, "Não foi possível localizar o horário-base do plano.");
    }

    const { salon, user } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const result = await reprocessMembershipPlanSeriesByAdmin({
      actorUserId: user?.id ?? null,
      appointmentId,
      ownerSupabase: supabase,
      requestPath: returnPath,
      salonId: salon.id,
    });

    invalidateManagementPages();

    if (result.status === "reprocessed") {
      const skippedLabel =
        result.skippedCount > 0
          ? ` ${result.skippedCount} sessao(oes) ainda ficaram sem encaixe automatico.`
          : "";
      return respond(
        formData,
        returnPath,
        `Série do plano reprocessada. ${result.scheduledCount} novo(s) horário(s) foram encaixados automaticamente.${skippedLabel}`,
        "success",
      );
    }

    if (result.status === "needs_manual_review") {
      return respond(
        formData,
        returnPath,
        `Nenhum novo horário entrou automaticamente. ${result.skippedCount} sessão(ões) ainda exigem ajuste manual no mesmo dia ou horário.`,
        "info",
      );
    }

    return respond(
      formData,
      returnPath,
      "Nenhum ajuste era necessário. Essa série do plano já estava fixa ou sem novas sessões abertas.",
      "info",
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível reprocessar a série do plano.",
    );
  }
}

export async function updateManagementAppointmentStatusAction(
  formData: FormData,
) {
  const returnPath = getReturnPath(formData, APPOINTMENTS_PATH);

  try {
    const parsed = managementAppointmentStatusSchema.parse({
      appointmentId: formData.get("appointmentId"),
      status: formData.get("status"),
      cancellationReason: formData.get("cancellationReason"),
    });
    const { salon, user } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const appointmentResult = await supabase
      .from("appointments")
      .select(
        "id, date, ends_at, status, customer_id, services(name), staff_members(name)",
      )
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (appointmentResult.error || !appointmentResult.data?.id) {
      fail(returnPath, "Não foi possível localizar esse agendamento.");
    }

    if (
      appointmentResult.data.status === "completed" ||
      appointmentResult.data.status === "cancelled" ||
      appointmentResult.data.status === "no_show"
    ) {
      fail(
        returnPath,
        "Esse agendamento já foi encerrado e não pode voltar para a agenda por essa ação.",
      );
    }

    const paymentCount = await getAppointmentPaymentCount(
      supabase,
      parsed.appointmentId,
    );

    if (paymentCount > 0 && parsed.status !== "completed") {
      fail(
        returnPath,
        "Remova o pagamento antes de alterar o status desse atendimento.",
      );
    }

    const planReservation = await resolveAppointmentPlanReservation({
      appointmentId: parsed.appointmentId,
      salonId: salon.id,
    });

    if (parsed.status === "completed") {
      if (new Date(appointmentResult.data.ends_at) > new Date()) {
        fail(
          returnPath,
          "Conclua o atendimento apenas depois do horário final.",
        );
      }

      const completeResult = await supabase.rpc("mark_appointment_completed", {
        appointment_uuid: parsed.appointmentId,
      });

      if (completeResult.error) {
        const completeErrorMessage = completeResult.error.message ?? "";
        const canFallbackComplete =
          appointmentResult.data.status !== "cancelled" &&
          appointmentResult.data.status !== "completed" &&
          new Date(appointmentResult.data.ends_at) <= new Date() &&
          !completeErrorMessage.includes("appointment_not_finished") &&
          !completeErrorMessage.includes("appointment_already_completed") &&
          !completeErrorMessage.includes(
            "cancelled_appointment_cannot_be_completed",
          ) &&
          !completeErrorMessage.includes("appointment_not_found") &&
          !completeErrorMessage.includes("unauthorized");

        if (canFallbackComplete) {
          const fallbackUpdate = await supabase
            .from("appointments")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              cancelled_at: null,
              cancelled_by: null,
              cancellation_reason: null,
            })
            .eq("id", parsed.appointmentId)
            .eq("salon_id", salon.id);

          if (fallbackUpdate.error) {
            fail(
              returnPath,
              mapDatabaseError(fallbackUpdate.error) ??
                "Não foi possível concluir o atendimento.",
            );
          }
        } else {
          fail(
            returnPath,
            mapDatabaseError(completeResult.error) ??
              "Não foi possível concluir o atendimento.",
          );
        }
      }

      if (planReservation) {
        await finalizeAppointmentPlanReservation({
          appointmentId: parsed.appointmentId,
          ownerSupabase: supabase,
          salonId: salon.id,
        });
      }

      await notifyCustomerAboutManagementAppointmentStatus({
        supabase,
        salonId: salon.id,
        appointmentId: parsed.appointmentId,
        status: "completed",
        appointmentContext: appointmentResult.data,
      });

      invalidateManagementPages();
      return succeed(
        formData,
        returnPath,
        "Atendimento concluído com sucesso.",
      );
    }

    if (parsed.status === "cancelled") {
      const result = await supabase.rpc("cancel_appointment", {
        appointment_uuid: parsed.appointmentId,
        cancellation_reason_input:
          parsed.cancellationReason ?? "Cancelado pelo salão.",
      });

      if (result.error) {
        fail(
          returnPath,
          mapDatabaseError(result.error) ??
            "Não foi possível cancelar o agendamento.",
        );
      }

      if (planReservation) {
        await cancelAppointmentPlanReservationByAdmin({
          actorUserId: user?.id ?? null,
          appointmentId: parsed.appointmentId,
          requestPath: returnPath,
          salonId: salon.id,
        });
      }

      await notifyCustomerAboutManagementAppointmentStatus({
        supabase,
        salonId: salon.id,
        appointmentId: parsed.appointmentId,
        status: "cancelled",
        cancellationReason:
          parsed.cancellationReason ?? "Cancelado pelo salão.",
        appointmentContext: appointmentResult.data,
      });

      invalidateManagementPages();
      return succeed(
        formData,
        returnPath,
        "Agendamento cancelado com sucesso.",
      );
    }

    if (
      parsed.status === "no_show" &&
      new Date(appointmentResult.data.ends_at) > new Date()
    ) {
      fail(
        returnPath,
        "Registre falta apenas depois do horário final do atendimento.",
      );
    }

    if (
      (parsed.status === "pending" || parsed.status === "confirmed") &&
      new Date(appointmentResult.data.ends_at) <= new Date()
    ) {
      fail(
        returnPath,
        "Use apenas status finais para horários que já terminaram.",
      );
    }

    const { error } = await supabase
      .from("appointments")
      .update({
        status: parsed.status,
        completed_at: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      })
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o status.",
      );
    }

    if (parsed.status === "no_show" && planReservation) {
      await finalizeAppointmentPlanReservation({
        appointmentId: parsed.appointmentId,
        ownerSupabase: supabase,
        salonId: salon.id,
      });
    }

    if (parsed.status === "confirmed") {
      await notifyCustomerAboutManagementAppointmentStatus({
        supabase,
        salonId: salon.id,
        appointmentId: parsed.appointmentId,
        status: "confirmed",
        appointmentContext: appointmentResult.data,
      });
    }

    if (parsed.status === "no_show") {
      await notifyCustomerAboutManagementAppointmentStatus({
        supabase,
        salonId: salon.id,
        appointmentId: parsed.appointmentId,
        status: "no_show",
        appointmentContext: appointmentResult.data,
      });
    }

    invalidateManagementPages();
    return succeed(
      formData,
      returnPath,
      "Status do agendamento atualizado com sucesso.",
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível atualizar o status.",
    );
  }
}

export async function upsertManagementPaymentAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PAYMENTS_PATH);

  try {
    const parsed = managementPaymentSchema.parse({
      appointmentId: formData.get("appointmentId"),
      amount: formData.get("amount"),
      paymentMethod: formData.get("paymentMethod"),
      paidAtDate: formData.get("paidAtDate"),
      paidAtTime: formData.get("paidAtTime"),
      notes: formData.get("notes"),
    });
    const { salon, user } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const appointmentResult = await supabase
      .from("appointments")
      .select("id, status, service_price_snapshot, services(id, name, price)")
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (appointmentResult.error || !appointmentResult.data?.id) {
      fail(returnPath, "Selecione um atendimento válido.");
    }

    const planReservation = await resolveAppointmentPlanReservation({
      appointmentId: parsed.appointmentId,
      salonId: salon.id,
    });

    if (planReservation) {
      fail(
        returnPath,
        "Atendimentos cobertos por plano não recebem pagamento avulso.",
      );
    }

    if (appointmentResult.data.status !== "completed") {
      fail(
        returnPath,
        "Somente atendimentos concluídos podem receber pagamento.",
      );
    }

    const relatedService = firstRelation(
      appointmentResult.data.services as
        | {
            id?: string | null;
            name?: string | null;
            price?: number | string | null;
          }
        | Array<{
            id?: string | null;
            name?: string | null;
            price?: number | string | null;
          }>
        | null,
    );
    const submittedAmount = Number(parsed.amount);
    const paymentIntegrity = resolveAuthoritativeAppointmentPayment({
      servicePrice: relatedService?.price ?? null,
      servicePriceSnapshot: appointmentResult.data.service_price_snapshot,
      submittedAmount,
    });

    if (!paymentIntegrity.isValid) {
      fail(
        returnPath,
        "Não foi possível validar o valor oficial desse atendimento.",
      );
    }

    if (paymentIntegrity.hasMismatch) {
      await recordSecurityAuditEvent({
        actorUserId: user.id,
        eventType: "management.payment_amount_mismatch",
        metadata: {
          appointmentId: parsed.appointmentId,
          expectedAmount: paymentIntegrity.expectedAmount,
          serviceId: relatedService?.id ?? null,
          serviceName: relatedService?.name ?? null,
          submittedAmount,
        },
        requestPath: returnPath,
        salonId: salon.id,
        severity: "warn",
      });
    }

    const paidAt = combineDateAndTimeToUtc(
      parsed.paidAtDate,
      parsed.paidAtTime,
      salon.timezone ?? "America/Sao_Paulo",
    );
    const result = await supabase.from("appointment_payments").upsert(
      {
        salon_id: salon.id,
        appointment_id: parsed.appointmentId,
        amount: paymentIntegrity.expectedAmount,
        payment_method: parsed.paymentMethod,
        paid_at: paidAt.toISOString(),
        notes: parsed.notes ?? null,
      },
      {
        onConflict: "appointment_id",
      },
    );

    if (result.error) {
      fail(
        returnPath,
        mapDatabaseError(result.error) ??
          "Não foi possível registrar o pagamento.",
      );
    }

    invalidateManagementPages();
    return succeed(
      formData,
      returnPath,
      paymentIntegrity.hasMismatch
        ? "Pagamento salvo com o valor oficial do atendimento."
        : "Pagamento salvo com sucesso.",
    );
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível registrar o pagamento.",
    );
  }
}

export async function deleteManagementPaymentAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PAYMENTS_PATH);

  try {
    const parsed = managementDeleteSchema.parse({
      id: formData.get("paymentId"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const { error } = await supabase
      .from("appointment_payments")
      .delete()
      .eq("id", parsed.id)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível remover o pagamento.",
      );
    }

    invalidateManagementPages();
    return succeed(formData, returnPath, "Pagamento removido com sucesso.");
  } catch (error) {
    return handleActionFailure(
      formData,
      returnPath,
      error,
      "Não foi possível remover o pagamento.",
    );
  }
}
