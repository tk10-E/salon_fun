import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
type AppointmentContext = {
  id: string;
  customer_id: string;
  date: string;
  ends_at: string;
  status: AppointmentStatus;
  services: { name: string | null } | null;
  staff_members: { name: string | null } | null;
};

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

async function clearAppointmentVacancyAlerts(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  appointmentId: string;
}) {
  const { supabase, salonId, appointmentId } = params;

  await supabase.from("salon_vacancy_alerts").delete().eq("appointment_id", appointmentId).eq("salon_id", salonId);
}

async function notifyCustomerAboutAppointmentStatus(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  appointmentId: string;
  status: MutableAppointmentStatus;
  cancellationReason: string;
  appointmentContext: AppointmentContext | null;
}) {
  const { supabase, salonId, appointmentId, status, cancellationReason, appointmentContext } = params;

  if (!appointmentContext?.customer_id) {
    return;
  }

  const appointmentLabel = formatAppointmentDateTimeLabel(appointmentContext.date);
  const serviceName = appointmentContext.services?.name?.trim() || "seu atendimento";
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
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!appointmentId || !["confirmed", "cancelled", "completed"].includes(requestedStatus)) {
    redirect(buildRedirectNotice(APPOINTMENTS_PATH, "Ação inválida.", "error"));
  }

  const status = requestedStatus as MutableAppointmentStatus;

  const { data: appointmentContext } = await supabase
    .from("appointments")
    .select("id, customer_id, date, ends_at, status, services(name), staff_members(name)")
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
        !completeErrorMessage.includes("cancelled_appointment_cannot_be_completed") &&
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
    redirect(buildRedirectNotice(APPOINTMENTS_PATH, formatAppointmentStatusError(error.message), "error"));
  }

  await notifyCustomerAboutAppointmentStatus({
    supabase,
    salonId: salon.id,
    appointmentId,
    status,
    cancellationReason,
    appointmentContext,
  });

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  revalidateCommercialPaths(COMMERCIAL_LOYALTY_PATH, COMMERCIAL_REFERRALS_PATH, COMMERCIAL_AUTOMATIONS_PATH);
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
