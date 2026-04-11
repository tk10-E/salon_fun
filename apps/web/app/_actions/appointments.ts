import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizePhone, sendSalonWhatsAppTextMessage } from "@/lib/whatsapp";

import {
  buildRedirectNotice,
  COMMERCIAL_AUTOMATIONS_PATH,
  COMMERCIAL_LOYALTY_PATH,
  COMMERCIAL_REFERRALS_PATH,
  formatAppointmentDateTimeLabel,
  queueCustomerNotification,
  revalidateCommercialPaths,
} from "./shared";

const APPOINTMENTS_PATH = "/dashboard/appointments";
const DASHBOARD_PATH = "/dashboard";

type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";
type MutableAppointmentStatus = "confirmed" | "cancelled" | "completed";
type AppointmentDepositStatus = "pending" | "received" | "waived" | "refunded";
type AppointmentContext = {
  deposit_amount?: number | null;
  deposit_paid_at?: string | null;
  deposit_status?: string | null;
  id: string;
  customer_id: string;
  customers:
    | {
        name: string | null;
        phone: string | null;
        whatsapp_phone?: string | null;
      }
    | {
        name: string | null;
        phone: string | null;
        whatsapp_phone?: string | null;
      }[]
    | null;
  date: string;
  ends_at: string;
  status: AppointmentStatus;
  services: { name: string | null } | null;
  staff_members: { name: string | null } | null;
};

type AppointmentWhatsAppMode = "confirmation" | "reminder" | "reschedule";

function formatAppointmentStatusError(message: string) {
  if (message.includes("appointment_not_finished")) {
    return "Esse atendimento ainda não terminou. Marque como atendido apenas depois do horário final.";
  }

  if (message.includes("appointment_already_completed")) {
    return "Esse agendamento já foi marcado como atendido.";
  }

  if (message.includes("cancelled_appointment_cannot_be_completed")) {
    return "Um agendamento cancelado não pode ser marcado como atendido.";
  }

  if (message.includes("appointment_not_found")) {
    return "Não foi possível localizar esse agendamento.";
  }

  if (message.includes("unauthorized")) {
    return "Sua conta não tem permissão para concluir esse atendimento.";
  }

  if (message.includes("past_appointment_cannot_be_cancelled")) {
    return "Não é possível cancelar um horário que já passou.";
  }

  return `Não foi possível atualizar o agendamento. ${message}`;
}

function formatAppointmentDepositError(message: string) {
  if (message.includes("appointment_not_found")) {
    return "Nao foi possivel localizar esse agendamento.";
  }

  if (message.includes("unauthorized")) {
    return "Sua conta nao tem permissao para atualizar o sinal desse agendamento.";
  }

  return `Nao foi possivel atualizar o sinal. ${message}`;
}

function formatAppointmentMembershipError(message: string) {
  if (message.includes("appointment_not_completed")) {
    return "Conclua o atendimento antes de consumir uma sessão do pacote.";
  }

  if (message.includes("appointment_membership_already_consumed")) {
    return "Esse atendimento já consumiu uma sessão de pacote.";
  }

  if (message.includes("membership_not_found")) {
    return "Não foi possível localizar um pacote ativo compatível para esse atendimento.";
  }

  if (message.includes("membership_customer_mismatch")) {
    return "O pacote selecionado pertence a outra cliente.";
  }

  if (message.includes("membership_service_mismatch")) {
    return "O pacote selecionado não corresponde ao serviço desse atendimento.";
  }

  if (message.includes("membership_expired")) {
    return "Esse pacote já expirou e não pode mais consumir sessões.";
  }

  if (message.includes("membership_no_sessions_remaining")) {
    return "Esse pacote já usou todas as sessões disponíveis.";
  }

  if (message.includes("membership_redemption_not_found")) {
    return "Esse atendimento não tem sessão de pacote ativa para estornar.";
  }

  return `Não foi possível atualizar o pacote agora. ${message}`;
}

async function clearAppointmentVacancyAlerts(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  appointmentId: string;
}) {
  const { supabase, salonId, appointmentId } = params;

  await supabase
    .from("salon_vacancy_alerts")
    .delete()
    .eq("appointment_id", appointmentId)
    .eq("salon_id", salonId);
}

function firstAppointmentRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildAppointmentWhatsAppBody(params: {
  appointmentContext: AppointmentContext;
  mode: AppointmentWhatsAppMode;
  salonName: string;
}) {
  const { appointmentContext, mode, salonName } = params;
  const customer = firstAppointmentRelation(appointmentContext.customers);
  const serviceName =
    appointmentContext.services?.name?.trim() || "seu atendimento";
  const staffName = appointmentContext.staff_members?.name?.trim();
  const appointmentLabel = formatAppointmentDateTimeLabel(
    appointmentContext.date,
  );
  const customerName = customer?.name?.trim() || "cliente";

  if (mode === "confirmation") {
    return staffName
      ? `Oi ${customerName}, seu horario de ${serviceName} no ${salonName} foi confirmado para ${appointmentLabel} com ${staffName}. Se precisar reagendar, responda esta mensagem.`
      : `Oi ${customerName}, seu horario de ${serviceName} no ${salonName} foi confirmado para ${appointmentLabel}. Se precisar reagendar, responda esta mensagem.`;
  }

  if (mode === "reminder") {
    return staffName
      ? `Lembrete do ${salonName}: ${serviceName} com ${staffName} em ${appointmentLabel}. Se precisar ajustar o horario, fale com a gente por aqui.`
      : `Lembrete do ${salonName}: ${serviceName} em ${appointmentLabel}. Se precisar ajustar o horario, fale com a gente por aqui.`;
  }

  return staffName
    ? `Oi ${customerName}, o ${salonName} separou novas opcoes para reagendar seu ${serviceName} com ${staffName}. Responda esta mensagem que continuamos por aqui.`
    : `Oi ${customerName}, o ${salonName} separou novas opcoes para reagendar seu ${serviceName}. Responda esta mensagem que continuamos por aqui.`;
}

async function sendAppointmentWhatsApp(params: {
  appointmentContext: AppointmentContext | null;
  mode: AppointmentWhatsAppMode;
  salonId: string;
  salonName: string;
}) {
  const { appointmentContext, mode, salonId, salonName } = params;
  const customer = firstAppointmentRelation(appointmentContext?.customers);
  const targetPhone = sanitizePhone(
    customer?.whatsapp_phone ?? customer?.phone ?? null,
  );

  if (!appointmentContext || !targetPhone) {
    return { ok: false as const, reason: "missing_phone" as const };
  }

  return sendSalonWhatsAppTextMessage(
    salonId,
    targetPhone,
    buildAppointmentWhatsAppBody({
      appointmentContext,
      mode,
      salonName,
    }),
  );
}

async function notifyCustomerAboutAppointmentStatus(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  salonName: string;
  appointmentId: string;
  status: MutableAppointmentStatus;
  cancellationReason: string;
  appointmentContext: AppointmentContext | null;
}) {
  const {
    supabase,
    salonId,
    salonName,
    appointmentId,
    status,
    cancellationReason,
    appointmentContext,
  } = params;

  if (!appointmentContext?.customer_id) {
    return;
  }

  const appointmentLabel = formatAppointmentDateTimeLabel(
    appointmentContext.date,
  );
  const serviceName =
    appointmentContext.services?.name?.trim() || "seu atendimento";
  const staffName = appointmentContext.staff_members?.name?.trim();

  if (status === "confirmed") {
    await queueCustomerNotification({
      supabase,
      salonId,
      customerId: appointmentContext.customer_id,
      audience: "single_customer",
      notificationType: "appointment_confirmed",
      title: "Seu horário foi confirmado",
      body: staffName
        ? `${serviceName} em ${appointmentLabel} com ${staffName} foi confirmado pelo salão.`
        : `${serviceName} em ${appointmentLabel} foi confirmado pelo salão.`,
      payload: {
        type: "appointment_confirmed",
        appointmentId,
      },
    });

    await sendAppointmentWhatsApp({
      appointmentContext,
      mode: "confirmation",
      salonId,
      salonName,
    });
  }

  if (status === "cancelled") {
    await queueCustomerNotification({
      supabase,
      salonId,
      customerId: appointmentContext.customer_id,
      audience: "single_customer",
      notificationType: "appointment_cancelled",
      title: "Seu horário foi cancelado pelo salão",
      body: cancellationReason
        ? `${serviceName} em ${appointmentLabel} foi cancelado. Motivo: ${cancellationReason}.`
        : `${serviceName} em ${appointmentLabel} foi cancelado pelo salão.`,
      payload: {
        type: "appointment_cancelled",
        appointmentId,
      },
    });

    await sendAppointmentWhatsApp({
      appointmentContext,
      mode: "reschedule",
      salonId,
      salonName,
    });
  }

  if (status === "completed") {
    await queueCustomerNotification({
      supabase,
      salonId,
      customerId: appointmentContext.customer_id,
      audience: "single_customer",
      notificationType: "appointment_completed",
      title: "Atendimento concluído",
      body: staffName
        ? `${serviceName} com ${staffName} foi marcado como concluído pelo salão.`
        : `${serviceName} foi marcado como concluído pelo salão.`,
      payload: {
        type: "appointment_completed",
        appointmentId,
      },
    });
  }
}

export async function updateAppointmentStatusActionImpl(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requestedStatus = String(formData.get("status") ?? "");
  const membershipPackageId = String(
    formData.get("membershipPackageId") ?? "",
  ).trim();
  const cancellationReason = String(
    formData.get("cancellationReason") ?? "",
  ).trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !appointmentId ||
    !["confirmed", "cancelled", "completed"].includes(requestedStatus)
  ) {
    redirect(buildRedirectNotice(APPOINTMENTS_PATH, "Ação inválida.", "error"));
  }

  const status = requestedStatus as MutableAppointmentStatus;

  const { data: appointmentContext } = await supabase
    .from("appointments")
    .select(
      "id, customer_id, date, ends_at, status, customers(name, phone), services(name), staff_members(name)",
    )
    .eq("id", appointmentId)
    .eq("salon_id", salon.id)
    .maybeSingle<AppointmentContext>();

  let error = null as { message: string } | null;

  if (status === "cancelled") {
    const cancelResult = await supabase.rpc("cancel_appointment", {
      appointment_uuid: appointmentId,
      cancellation_reason_input: cancellationReason || "Cancelado pelo salão.",
    });

    if (cancelResult.error) {
      error = cancelResult.error;
    }
  } else if (status === "completed") {
    const completeResult = await supabase.rpc("mark_appointment_completed", {
      appointment_uuid: appointmentId,
    });

    if (completeResult.error) {
      const completeErrorMessage = completeResult.error.message ?? "";
      const canFallbackComplete =
        appointmentContext != null &&
        appointmentContext.status !== "cancelled" &&
        appointmentContext.status !== "completed" &&
        new Date(appointmentContext.ends_at) <= new Date() &&
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
          .eq("id", appointmentId)
          .eq("salon_id", salon.id);

        if (fallbackUpdate.error) {
          error = fallbackUpdate.error;
        } else {
          await clearAppointmentVacancyAlerts({
            supabase,
            salonId: salon.id,
            appointmentId,
          });
        }
      } else {
        error = completeResult.error;
      }
    }
  } else {
    const updateResult = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        completed_at: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      })
      .eq("id", appointmentId)
      .eq("salon_id", salon.id);

    if (updateResult.error) {
      error = updateResult.error;
    } else {
      await clearAppointmentVacancyAlerts({
        supabase,
        salonId: salon.id,
        appointmentId,
      });
    }
  }

  if (error) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        formatAppointmentStatusError(error.message),
        "error",
      ),
    );
  }

  if (status === "completed" && membershipPackageId) {
    const membershipResult = await supabase.rpc(
      "consume_customer_membership_package",
      {
        appointment_uuid: appointmentId,
        membership_uuid: membershipPackageId,
        notes_input: null,
      },
    );

    if (membershipResult.error) {
      revalidatePath(DASHBOARD_PATH);
      revalidatePath(APPOINTMENTS_PATH);
      revalidatePath("/dashboard/customers");
      revalidateCommercialPaths(
        COMMERCIAL_LOYALTY_PATH,
        COMMERCIAL_REFERRALS_PATH,
        COMMERCIAL_AUTOMATIONS_PATH,
      );
      redirect(
        buildRedirectNotice(
          APPOINTMENTS_PATH,
          `Atendimento concluído, mas o pacote não foi consumido. ${formatAppointmentMembershipError(
            membershipResult.error.message,
          )}`,
          "info",
        ),
      );
    }
  }

  await notifyCustomerAboutAppointmentStatus({
    supabase,
    salonId: salon.id,
    salonName: salon.name,
    appointmentId,
    status,
    cancellationReason,
    appointmentContext,
  });

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  revalidateCommercialPaths(
    COMMERCIAL_LOYALTY_PATH,
    COMMERCIAL_REFERRALS_PATH,
    COMMERCIAL_AUTOMATIONS_PATH,
  );
  redirect(
    buildRedirectNotice(
      APPOINTMENTS_PATH,
      status === "confirmed"
        ? "Agendamento confirmado com sucesso."
        : status === "completed"
          ? "Atendimento concluído com sucesso."
          : "Agendamento cancelado com sucesso.",
      "success",
    ),
  );
}

export async function sendAppointmentWhatsAppActionImpl(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const requestedMode = String(formData.get("mode") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !appointmentId ||
    !["confirmation", "reminder", "reschedule"].includes(requestedMode)
  ) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Ação de WhatsApp inválida para esse atendimento.",
        "error",
      ),
    );
  }

  const mode = requestedMode as AppointmentWhatsAppMode;
  const { data: appointmentContext } = await supabase
    .from("appointments")
    .select(
      "id, customer_id, date, ends_at, status, customers(name, phone), services(name), staff_members(name)",
    )
    .eq("id", appointmentId)
    .eq("salon_id", salon.id)
    .maybeSingle<AppointmentContext>();

  if (!appointmentContext?.id) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Agendamento não encontrado para enviar WhatsApp.",
        "error",
      ),
    );
  }

  const result = await sendAppointmentWhatsApp({
    appointmentContext,
    mode,
    salonId: salon.id,
    salonName: salon.name,
  });

  if (!result.ok) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        result.reason === "missing_config"
          ? "Configure o canal tecnico do WhatsApp deste salão antes de enviar mensagens automáticas."
          : result.reason === "request_failed"
            ? "O WhatsApp nao aceitou esse envio agora. Tente novamente em instantes."
            : "Esse atendimento não tem telefone válido para WhatsApp no cadastro.",
        "error",
      ),
    );
  }

  redirect(
    buildRedirectNotice(
      APPOINTMENTS_PATH,
      mode === "confirmation"
        ? "WhatsApp de confirmação enviado."
        : mode === "reminder"
          ? "WhatsApp de lembrete enviado."
          : "WhatsApp de reagendamento enviado.",
      "success",
    ),
  );
}

export async function consumeAppointmentMembershipActionImpl(
  formData: FormData,
) {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const membershipPackageId = String(
    formData.get("membershipPackageId") ?? "",
  ).trim();

  await requireOwnerSalon();
  const supabase = createClient();

  if (!appointmentId) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Atendimento inválido para consumir pacote.",
        "error",
      ),
    );
  }

  const consumeResult = await supabase.rpc(
    "consume_customer_membership_package",
    {
      appointment_uuid: appointmentId,
      membership_uuid: membershipPackageId || null,
      notes_input: null,
    },
  );

  if (consumeResult.error) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        formatAppointmentMembershipError(consumeResult.error.message),
        "error",
      ),
    );
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  revalidatePath("/dashboard/customers");
  redirect(
    buildRedirectNotice(
      APPOINTMENTS_PATH,
      "Sessão do pacote consumida com sucesso.",
      "success",
    ),
  );
}

export async function reverseAppointmentMembershipActionImpl(
  formData: FormData,
) {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();

  await requireOwnerSalon();
  const supabase = createClient();

  if (!appointmentId) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Atendimento inválido para estornar a sessão.",
        "error",
      ),
    );
  }

  const reverseResult = await supabase.rpc(
    "reverse_customer_membership_package_consumption",
    {
      appointment_uuid: appointmentId,
    },
  );

  if (reverseResult.error) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        formatAppointmentMembershipError(reverseResult.error.message),
        "error",
      ),
    );
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  revalidatePath("/dashboard/customers");
  redirect(
    buildRedirectNotice(
      APPOINTMENTS_PATH,
      "Sessão do pacote estornada com sucesso.",
      "success",
    ),
  );
}

export async function updateAppointmentDepositActionImpl(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const requestedDepositStatus = String(formData.get("depositStatus") ?? "");
  const depositNotes = String(formData.get("depositNotes") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !appointmentId ||
    !["pending", "received", "waived", "refunded"].includes(
      requestedDepositStatus,
    )
  ) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Acao de sinal invalida.",
        "error",
      ),
    );
  }

  const depositStatus = requestedDepositStatus as AppointmentDepositStatus;
  const { data: appointmentContext, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, deposit_amount, deposit_paid_at, deposit_status")
    .eq("id", appointmentId)
    .eq("salon_id", salon.id)
    .maybeSingle<AppointmentContext>();

  if (appointmentError || !appointmentContext?.id) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        formatAppointmentDepositError(
          appointmentError?.message ?? "appointment_not_found",
        ),
        "error",
      ),
    );
  }

  if (Number(appointmentContext.deposit_amount ?? 0) <= 0) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        "Esse agendamento nao possui sinal configurado.",
        "error",
      ),
    );
  }

  const nextDepositPaidAt =
    depositStatus === "received"
      ? new Date().toISOString()
      : depositStatus === "refunded"
        ? (appointmentContext.deposit_paid_at ?? null)
        : null;
  const { error } = await supabase
    .from("appointments")
    .update({
      deposit_status: depositStatus,
      deposit_paid_at: nextDepositPaidAt,
      deposit_notes: depositNotes || null,
      ...(depositStatus === "pending"
        ? {
            deposit_reminder_sent_at: null,
            deposit_customer_reported_paid_at: null,
            deposit_customer_reported_paid_via: null,
            deposit_customer_reported_reference: null,
          }
        : {}),
    })
    .eq("id", appointmentId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        APPOINTMENTS_PATH,
        formatAppointmentDepositError(error.message),
        "error",
      ),
    );
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  redirect(
    buildRedirectNotice(
      APPOINTMENTS_PATH,
      depositStatus === "received"
        ? "Sinal marcado como recebido."
        : depositStatus === "waived"
          ? "Sinal dispensado nesse agendamento."
          : depositStatus === "refunded"
            ? "Sinal marcado como estornado."
            : "Sinal voltou para pendente.",
      "success",
    ),
  );
}
