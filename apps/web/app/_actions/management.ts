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
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_PATHS,
  combineDateAndTimeToUtc,
} from "@/lib/management";
import {
  sanitizePhone,
  sendSalonWhatsAppTextMessage,
} from "@/lib/whatsapp";
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
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";

import {
  buildRedirectNotice,
  buildServiceCatalogNotification,
  buildStaffAvailabilityNotification,
  queueCustomerNotification,
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
  serviceName: string;
};

function flag(formData: FormData, field: string) {
  const value = formData.get(field);
  return value === "on" || value === "true";
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function buildServiceImagePath(salonId: string, extension: string) {
  return `${salonId}/services/${randomUUID()}.${extension}`;
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
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        "Envie uma imagem válida para o serviço.",
        "error",
      ),
    );
  }

  if (imageFile.size > SERVICE_IMAGE_PRESET.maxInputBytes) {
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        `A foto do servico deve ter no maximo ${formatPresetMegabytes(
          SERVICE_IMAGE_PRESET.maxInputBytes,
        )} MB.`,
        "error",
      ),
    );
  }

  let optimizedImage;

  try {
    optimizedImage = await optimizeUploadedImage(imageFile, "service");
  } catch {
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        "Nao foi possivel processar a foto do servico.",
        "error",
      ),
    );
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
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        "Nao foi possivel enviar a foto do servico.",
        "error",
      ),
    );
  }

  return imagePath;
}

function firstMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function rethrowIfRedirectError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("NEXT_REDIRECT") ||
      error.message.startsWith("TEST_REDIRECT:"))
  ) {
    throw error;
  }
}

function getReturnPath(formData: FormData, fallbackPath: string) {
  return resolveDashboardReturnPath(formData, fallbackPath, MANAGEMENT_PATHS);
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

function dayAtIso(daysOffset: number) {
  return new Date(Date.now() + daysOffset * 24 * 60 * 60 * 1000).toISOString();
}

function getLocalDatePart(date: Date, timeZone: string, part: "year" | "month" | "day") {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      [part]: "2-digit",
    } as Intl.DateTimeFormatOptions)
      .formatToParts(date)
      .find((item) => item.type === part)
      ?.value ?? ""
  );
}

function formatLocalDateKey(date: Date, timeZone: string) {
  const year = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  })
    .formatToParts(date)
    .find((item) => item.type === "year")
    ?.value;
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
    throw new Error("Não foi possível carregar os profissionais ativos do salão.");
  }

  if (appointmentsResult.error) {
    throw new Error("Não foi possível medir a força da equipe para o remanejamento.");
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
      (appointment.status === "pending" || appointment.status === "confirmed") &&
      appointment.date >= nowIso
    ) {
      current.upcomingCount += 1;
    }

    if (appointment.status === "completed") {
      current.completedCount += 1;
    }

    counters.set(appointment.staff_member_id, current);
  }

  return ((professionalsResult.data ?? []) as Array<{
    id: string;
    is_active: boolean;
    name: string;
  }>)
    .filter(
      (professional) =>
        professional.is_active && professional.id !== args.excludedProfessionalId,
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

  const result = await args.supabase.rpc("get_available_staff_slots_for_service", {
    service_uuid: args.serviceId,
    target_day: args.targetDay,
  });

  if (result.error) {
    throw new Error("Não foi possível calcular os encaixes da agenda para o remanejamento.");
  }

  const slots = (result.data ?? []) as AvailableStaffSlot[];
  args.cache.set(cacheKey, slots);
  return slots;
}

async function findBestTransferSlot(args: {
  appointment: FutureProfessionalAppointment;
  candidate: ReplacementCandidate;
  plannedBusyByProfessional: Map<string, Array<{ endsAt: string; startsAt: string }>>;
  slotCache: Map<string, AvailableStaffSlot[]>;
  supabase: any;
  timeZone: string;
}) {
  const originalStartAt = args.appointment.date;
  const originalDay = formatLocalDateKey(new Date(originalStartAt), args.timeZone);
  const dayAnchor = new Date(originalStartAt);
  dayAnchor.setUTCHours(12, 0, 0, 0);

  for (let offset = 0; offset <= 30; offset += 1) {
    const probeDay = new Date(dayAnchor.getTime() + offset * 24 * 60 * 60 * 1000);
    const targetDay = formatLocalDateKey(probeDay, args.timeZone);
    const slots = await getAvailableStaffSlots({
      cache: args.slotCache,
      serviceId: args.appointment.service_id,
      supabase: args.supabase,
      targetDay,
    });

    const plannedBusy = args.plannedBusyByProfessional.get(args.candidate.id) ?? [];
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
      .sort((left, right) =>
        new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
      );

    if (!filtered.length) {
      continue;
    }

    const exactSlot = filtered.find((slot) => slot.start_at === originalStartAt);
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

function mapDatabaseError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const message = error?.message?.trim() ?? "";
  const normalized = message.toLowerCase();

  if (error?.code === "23505") {
    return "Já existe um registro com esses dados.";
  }

  if (error?.code === "23P01" || normalized.includes("time_slot_unavailable")) {
    return "Esse profissional já possui outro agendamento nesse horário.";
  }

  if (normalized.includes("inactive_service_not_allowed")) {
    return "Apenas serviços ativos podem receber novos agendamentos.";
  }

  if (normalized.includes("inactive_staff_member_not_allowed")) {
    return "Apenas profissionais ativos podem receber agendamentos.";
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

  if (normalized.includes("service_category_not_found")) {
    return "Selecione uma categoria válida.";
  }

  if (normalized.includes("past_appointment_cannot_be_cancelled")) {
    return "Agendamentos passados não podem ser cancelados por essa ação.";
  }

  if (normalized.includes("appointment_not_finished")) {
    return "Espere o horário terminar antes de concluir o atendimento.";
  }

  return null;
}

function fail(returnPath: string, message: string) {
  redirect(buildRedirectNotice(returnPath, message, "error"));
}

function succeed(returnPath: string, message: string) {
  redirect(buildRedirectNotice(returnPath, message, "success"));
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
    succeed(returnPath, "Categoria cadastrada com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível criar a categoria."),
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
    succeed(returnPath, "Categoria atualizada com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar a categoria."),
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
    succeed(returnPath, "Categoria removida com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível excluir a categoria."),
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
    succeed(returnPath, "Serviço cadastrado com sucesso.");
  } catch (error) {
    rethrowIfRedirectError(error);
    fail(returnPath, firstMessage(error, "Não foi possível criar o serviço."));
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
    succeed(returnPath, "Serviço atualizado com sucesso.");
  } catch (error) {
    rethrowIfRedirectError(error);
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar o serviço."),
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
    succeed(returnPath, "Serviço removido com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível excluir o serviço."),
    );
  }
}

export async function createManagementClientAction(formData: FormData) {
  const returnPath = getReturnPath(formData, CLIENTS_PATH);

  try {
    const parsed = managementClientSchema.parse({
      name: formData.get("name"),
      phone: formData.get("phone"),
      whatsappPhone: formData.get("whatsappPhone"),
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
      whatsapp_phone: parsed.whatsappPhone ?? null,
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
    succeed(returnPath, "Cliente cadastrado com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível cadastrar o cliente."),
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
      whatsappPhone: formData.get("whatsappPhone"),
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
        whatsapp_phone: parsed.whatsappPhone ?? null,
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
    succeed(returnPath, "Cliente atualizado com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar o cliente."),
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
    succeed(returnPath, "Cliente removido com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível excluir o cliente."),
    );
  }
}

export async function createManagementProfessionalAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PROFESSIONALS_PATH);

  try {
    const parsed = managementProfessionalSchema.parse({
      name: formData.get("name"),
      specialty: formData.get("specialty"),
      phone: formData.get("phone"),
      commissionRatePercent: formData.get("commissionRatePercent"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const insertResult = await supabase
      .from("staff_members")
      .insert({
        salon_id: salon.id,
        name: parsed.name,
        role: parsed.specialty ?? null,
        phone: parsed.phone ?? null,
        commission_rate_percent: parsed.commissionRatePercent,
        is_active: parsed.isActive,
      })
      .select("id")
      .single();

    if (insertResult.error || !insertResult.data?.id) {
      fail(
        returnPath,
        mapDatabaseError(insertResult.error) ??
          "Não foi possível cadastrar o profissional.",
      );
    }

    await ensureActiveServiceAssignments({
      supabase,
      salonId: salon.id,
      professionalId: insertResult.data.id,
    });

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
    succeed(returnPath, "Profissional cadastrado com sucesso.");
  } catch (error) {
    rethrowIfRedirectError(error);
    fail(
      returnPath,
      firstMessage(error, "Não foi possível cadastrar o profissional."),
    );
  }
}

export async function updateManagementProfessionalAction(formData: FormData) {
  const returnPath = getReturnPath(formData, PROFESSIONALS_PATH);

  try {
    const parsed = managementProfessionalUpdateSchema.parse({
      professionalId: formData.get("professionalId"),
      name: formData.get("name"),
      specialty: formData.get("specialty"),
      phone: formData.get("phone"),
      commissionRatePercent: formData.get("commissionRatePercent"),
      isActive: flag(formData, "isActive"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const currentProfessional = await supabase
      .from("staff_members")
      .select("id, is_active")
      .eq("id", parsed.professionalId)
      .eq("salon_id", salon.id)
      .maybeSingle();

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

    const { error } = await supabase
      .from("staff_members")
      .update({
        name: parsed.name,
        role: parsed.specialty ?? null,
        phone: parsed.phone ?? null,
        commission_rate_percent: parsed.commissionRatePercent,
        is_active: parsed.isActive,
      })
      .eq("id", parsed.professionalId)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o profissional.",
      );
    }

    if (parsed.isActive) {
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
    succeed(returnPath, "Profissional atualizado com sucesso.");
  } catch (error) {
    rethrowIfRedirectError(error);
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar o profissional."),
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
    const professionalResult = await supabase
      .from("staff_members")
      .select("id, name, is_default")
      .eq("id", parsed.id)
      .eq("salon_id", salon.id)
      .maybeSingle();

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

      invalidateManagementPages();
      succeed(returnPath, "Profissional removido com sucesso.");
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

    const futureAppointments =
      (futureAppointmentsResult.data ?? []) as FutureProfessionalAppointment[];

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
      succeed(
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
          customerPhone: sanitizePhone(customer?.phone ?? null),
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
        plannedBusyByProfessional.get(resolvedPlan.replacementStaffMemberId) ?? [];
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

    for (const plan of transferPlans) {
      const notes = buildAppointmentReassignmentNote({
        nextStartAt: plan.nextStartAt,
        previousNotes: plan.previousNotes,
        previousStaffMemberName: plan.previousStaffMemberName,
        replacementStaffMemberName: plan.replacementStaffMemberName,
        sameTime: plan.keepsSameTime,
        timeZone,
      });
      const { error } = await supabase
        .from("appointments")
        .update({
          staff_member_id: plan.replacementStaffMemberId,
          date: plan.nextStartAt,
          ends_at: plan.nextEndsAt,
          notes,
          status: "pending",
        })
        .eq("id", plan.appointmentId)
        .eq("salon_id", salon.id);

      if (error) {
        fail(
          returnPath,
          mapDatabaseError(error) ??
            "Não foi possível concluir o remanejamento da agenda desse profissional.",
        );
      }
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

    let whatsappFailures = 0;

    for (const plan of transferPlans) {
      if (!plan.customerPhone) {
        continue;
      }

      const copy = buildCustomerReassignmentCopy({
        nextStartAt: plan.nextStartAt,
        previousStaffMemberName: plan.previousStaffMemberName,
        replacementStaffMemberName: plan.replacementStaffMemberName,
        salonName,
        sameTime: plan.keepsSameTime,
        serviceName: plan.serviceName,
        timeZone,
      });
      const message = `Oi, ${plan.customerName}. ${copy.body}`;
      const sendResult = await sendSalonWhatsAppTextMessage(
        salon.id,
        plan.customerPhone,
        message,
      );

      if (!sendResult.ok) {
        whatsappFailures += 1;
      }
    }

    if (whatsappFailures > 0) {
      warnings.push(
        whatsappFailures === 1
          ? "1 cliente não recebeu WhatsApp automático"
          : `${whatsappFailures} clientes não receberam WhatsApp automático`,
      );
    }

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
          "Os clientes foram remanejados, mas não foi possível finalizar a saída desse profissional.",
      );
    }

    if (blocksResult.error) {
      warnings.push("revise os bloqueios futuros desse profissional");
    }

    invalidateManagementPages();
    succeed(
      returnPath,
      warnings.length
        ? `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico. ${transferPlans.length} cliente(s) foram remanejados e precisam confirmar a troca. Atenção: ${warnings.join(" e ")}.`
        : `${professionalResult.data.name} saiu da equipe ativa e foi movido para o histórico. ${transferPlans.length} cliente(s) foram remanejados para os profissionais mais fortes disponíveis e receberam pedido de confirmação.`,
    );
  } catch (error) {
    rethrowIfRedirectError(error);
    fail(
      returnPath,
      firstMessage(error, "Não foi possível excluir o profissional."),
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

    const serviceResult = await supabase
      .from("services")
      .select("id, duration, is_active")
      .eq("id", parsed.serviceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (serviceResult.error || !serviceResult.data?.id) {
      fail(returnPath, "Selecione um serviço válido.");
    }

    if (!serviceResult.data.is_active) {
      fail(
        returnPath,
        "Apenas serviços ativos podem receber novos agendamentos.",
      );
    }

    const endsAt = new Date(
      scheduledAt.getTime() + Number(serviceResult.data.duration) * 60 * 1000,
    );
    const insertResult = await supabase.from("appointments").insert({
      salon_id: salon.id,
      customer_id: parsed.clientId,
      staff_member_id: parsed.professionalId,
      service_id: parsed.serviceId,
      date: scheduledAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "pending",
      notes: parsed.notes ?? null,
    });

    if (insertResult.error) {
      fail(
        returnPath,
        mapDatabaseError(insertResult.error) ??
          "Não foi possível criar o agendamento.",
      );
    }

    invalidateManagementPages();
    succeed(returnPath, "Agendamento criado com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível criar o agendamento."),
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
      notes: formData.get("notes"),
    });
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const appointmentResult = await supabase
      .from("appointments")
      .select("id, status")
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
      fail(returnPath, "Somente agendamentos em aberto podem ser editados.");
    }

    const serviceResult = await supabase
      .from("services")
      .select("id, duration")
      .eq("id", parsed.serviceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (serviceResult.error || !serviceResult.data?.id) {
      fail(returnPath, "Selecione um serviço válido.");
    }

    const scheduledAt = combineDateAndTimeToUtc(
      parsed.date,
      parsed.time,
      salon.timezone ?? "America/Sao_Paulo",
    );
    const endsAt = new Date(
      scheduledAt.getTime() + Number(serviceResult.data.duration) * 60 * 1000,
    );

    const { error } = await supabase
      .from("appointments")
      .update({
        customer_id: parsed.clientId,
        staff_member_id: parsed.professionalId,
        service_id: parsed.serviceId,
        date: scheduledAt.toISOString(),
        ends_at: endsAt.toISOString(),
        notes: parsed.notes ?? null,
      })
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id);

    if (error) {
      fail(
        returnPath,
        mapDatabaseError(error) ?? "Não foi possível atualizar o agendamento.",
      );
    }

    invalidateManagementPages();
    succeed(returnPath, "Agendamento atualizado com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar o agendamento."),
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
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const appointmentResult = await supabase
      .from("appointments")
      .select("id, date, ends_at, status")
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (appointmentResult.error || !appointmentResult.data?.id) {
      fail(returnPath, "Não foi possível localizar esse agendamento.");
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

    if (parsed.status === "completed") {
      const result = await supabase.rpc("mark_appointment_completed", {
        appointment_uuid: parsed.appointmentId,
      });

      if (result.error) {
        fail(
          returnPath,
          mapDatabaseError(result.error) ??
            "Não foi possível concluir o atendimento.",
        );
      }

      invalidateManagementPages();
      succeed(returnPath, "Atendimento concluído com sucesso.");
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

      invalidateManagementPages();
      succeed(returnPath, "Agendamento cancelado com sucesso.");
    }

    if (
      parsed.status === "no_show" &&
      new Date(appointmentResult.data.date) > new Date()
    ) {
      fail(returnPath, "Registre falta apenas depois do horário agendado.");
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

    invalidateManagementPages();
    succeed(returnPath, "Status do agendamento atualizado com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível atualizar o status."),
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
    const { salon } = await requireOwnerSalon();
    const supabase = createClient() as any;
    const appointmentResult = await supabase
      .from("appointments")
      .select("id, status")
      .eq("id", parsed.appointmentId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (appointmentResult.error || !appointmentResult.data?.id) {
      fail(returnPath, "Selecione um atendimento válido.");
    }

    if (appointmentResult.data.status !== "completed") {
      fail(
        returnPath,
        "Somente atendimentos concluídos podem receber pagamento.",
      );
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
        amount: parsed.amount,
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
    succeed(returnPath, "Pagamento salvo com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível registrar o pagamento."),
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
    succeed(returnPath, "Pagamento removido com sucesso.");
  } catch (error) {
    fail(
      returnPath,
      firstMessage(error, "Não foi possível remover o pagamento."),
    );
  }
}
