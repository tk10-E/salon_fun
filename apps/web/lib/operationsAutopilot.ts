import { finalizeAppointmentPlanReservation } from "@/lib/appointmentPlanReservations";
import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const AUTOPILOT_COMPLETION_GRACE_MINUTES = 20;
export const AUTOPILOT_PENDING_NO_SHOW_GRACE_MINUTES = 120;
export const AUTOPILOT_CONFIRMED_NO_SHOW_GRACE_MINUTES = 240;
const AUTOPILOT_MAX_APPOINTMENTS_PER_SALON = 80;

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

type SalonAutopilotRow = {
  client_app_config: unknown;
  id: string;
  name: string;
};

export type AppointmentAutopilotRow = {
  customer_confirmation_requested_at?: string | null;
  customer_presence_confirmed_at?: string | null;
  deposit_customer_reported_paid_at?: string | null;
  deposit_paid_at?: string | null;
  ends_at: string;
  id: string;
  protection_confirmation_required?: boolean | null;
  salon_id: string;
  status: AppointmentStatus;
};

export type OperationsAutopilotInspection = {
  action: "complete" | "no_show" | "watch";
  reason: string;
  signalBadges: string[];
};

export type OperationsAutopilotSummary = {
  completed: number;
  eligible: number;
  errors: number;
  noShow: number;
  processed: number;
  salons: Array<{
    completed: number;
    eligible: number;
    errors: number;
    name: string;
    noShow: number;
    processed: number;
    salonId: string;
    skipped: number;
  }>;
  skipped: number;
};

function isOpenAppointmentStatus(status: AppointmentStatus) {
  return status === "pending" || status === "confirmed";
}

function getEndedAtDate(value: string) {
  const endedAt = new Date(value);
  return Number.isNaN(endedAt.getTime()) ? null : endedAt;
}

export function hasObjectiveAttendanceSignal(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_presence_confirmed_at"
    | "deposit_customer_reported_paid_at"
    | "deposit_paid_at"
  >,
) {
  return Boolean(
    appointment.customer_presence_confirmed_at ||
      appointment.deposit_paid_at ||
      appointment.deposit_customer_reported_paid_at,
  );
}

export function buildAppointmentAutopilotSignalBadges(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_presence_confirmed_at"
    | "deposit_customer_reported_paid_at"
    | "deposit_paid_at"
  >,
) {
  const signalBadges: string[] = [];

  if (appointment.customer_presence_confirmed_at) {
    signalBadges.push("Cliente confirmou");
  }

  if (appointment.deposit_paid_at) {
    signalBadges.push("Sinal pago");
  }

  if (appointment.deposit_customer_reported_paid_at) {
    signalBadges.push("Sinal informado");
  }

  return signalBadges;
}

export function resolveAppointmentNoShowGraceMinutes(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_confirmation_requested_at"
    | "protection_confirmation_required"
    | "status"
  >,
) {
  if (appointment.status === "pending") {
    return AUTOPILOT_PENDING_NO_SHOW_GRACE_MINUTES;
  }

  if (
    appointment.customer_confirmation_requested_at ||
    appointment.protection_confirmation_required
  ) {
    return AUTOPILOT_PENDING_NO_SHOW_GRACE_MINUTES;
  }

  return AUTOPILOT_CONFIRMED_NO_SHOW_GRACE_MINUTES;
}

export function shouldAutoCompleteAppointment(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_presence_confirmed_at"
    | "deposit_customer_reported_paid_at"
    | "deposit_paid_at"
    | "ends_at"
    | "status"
  >,
  now = new Date(),
) {
  if (!isOpenAppointmentStatus(appointment.status)) {
    return false;
  }

  const endedAt = getEndedAtDate(appointment.ends_at);
  if (!endedAt) {
    return false;
  }

  const completionThreshold = new Date(
    now.getTime() - AUTOPILOT_COMPLETION_GRACE_MINUTES * 60 * 1000,
  );

  if (endedAt > completionThreshold) {
    return false;
  }

  return hasObjectiveAttendanceSignal(appointment);
}

export function shouldAutoMarkNoShowAppointment(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_confirmation_requested_at"
    | "customer_presence_confirmed_at"
    | "deposit_customer_reported_paid_at"
    | "deposit_paid_at"
    | "ends_at"
    | "protection_confirmation_required"
    | "status"
  >,
  now = new Date(),
) {
  if (!isOpenAppointmentStatus(appointment.status)) {
    return false;
  }

  if (hasObjectiveAttendanceSignal(appointment)) {
    return false;
  }

  const endedAt = getEndedAtDate(appointment.ends_at);
  if (!endedAt) {
    return false;
  }

  const noShowThreshold = new Date(
    now.getTime() -
      resolveAppointmentNoShowGraceMinutes(appointment) * 60 * 1000,
  );

  return endedAt <= noShowThreshold;
}

export function inspectOperationsAutopilotAppointment(
  appointment: Pick<
    AppointmentAutopilotRow,
    | "customer_confirmation_requested_at"
    | "customer_presence_confirmed_at"
    | "deposit_customer_reported_paid_at"
    | "deposit_paid_at"
    | "ends_at"
    | "protection_confirmation_required"
    | "status"
  >,
  now = new Date(),
): OperationsAutopilotInspection {
  const signalBadges = buildAppointmentAutopilotSignalBadges(appointment);

  if (shouldAutoCompleteAppointment(appointment, now)) {
    return {
      action: "complete",
      reason:
        signalBadges.length > 0
          ? `Horario encerrado com sinal real: ${signalBadges.join(", ")}.`
          : "Horario encerrado com sinal suficiente para concluir sozinho.",
      signalBadges,
    };
  }

  if (shouldAutoMarkNoShowAppointment(appointment, now)) {
    return {
      action: "no_show",
      reason:
        appointment.status === "pending"
          ? "Horario pendente venceu sem resposta suficiente da cliente."
          : "Horario terminou e ficou sem confirmacao de presenca ou pagamento.",
      signalBadges,
    };
  }

  const endedAt = getEndedAtDate(appointment.ends_at);
  if (!endedAt) {
    return {
      action: "watch",
      reason: "Horario com data invalida. Revise este cadastro.",
      signalBadges,
    };
  }

  if (endedAt > now) {
    return {
      action: "watch",
      reason:
        appointment.customer_confirmation_requested_at ||
        appointment.protection_confirmation_required
          ? "Reserva protegida aguardando confirmacao ou sinal da cliente."
          : "Horario futuro seguindo a regra do salao.",
      signalBadges,
    };
  }

  const completionThreshold = new Date(
    now.getTime() - AUTOPILOT_COMPLETION_GRACE_MINUTES * 60 * 1000,
  );
  if (endedAt > completionThreshold) {
    return {
      action: "watch",
      reason: "Horario acabou agora. O sistema ainda espera a janela de fechamento.",
      signalBadges,
    };
  }

  return {
    action: "watch",
    reason:
      "Sem sinal suficiente ainda. O sistema acompanha ate a janela de falta.",
    signalBadges,
  };
}

async function completeAppointment(args: {
  admin: ReturnType<typeof createAdminClient>;
  appointment: AppointmentAutopilotRow;
}) {
  const completionResult = await args.admin.rpc("mark_appointment_completed", {
    appointment_uuid: args.appointment.id,
  });

  if (!completionResult.error) {
    await finalizeAppointmentPlanReservation({
      admin: args.admin as any,
      appointmentId: args.appointment.id,
      ownerSupabase: args.admin as any,
      salonId: args.appointment.salon_id,
    });
    return;
  }

  const errorMessage = (completionResult.error.message ?? "").toLowerCase();
  const canFallbackComplete =
    !errorMessage.includes("appointment_not_finished") &&
    !errorMessage.includes("appointment_already_completed") &&
    !errorMessage.includes("cancelled_appointment_cannot_be_completed") &&
    !errorMessage.includes("appointment_not_found") &&
    !errorMessage.includes("unauthorized");

  if (!canFallbackComplete) {
    throw completionResult.error;
  }

  const fallbackUpdate = await args.admin
    .from("appointments")
    .update({
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
      completed_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", args.appointment.id)
    .eq("salon_id", args.appointment.salon_id);

  if (fallbackUpdate.error) {
    throw fallbackUpdate.error;
  }

  await finalizeAppointmentPlanReservation({
    admin: args.admin as any,
    appointmentId: args.appointment.id,
    ownerSupabase: args.admin as any,
    salonId: args.appointment.salon_id,
  });
}

async function markAppointmentAsNoShow(args: {
  admin: ReturnType<typeof createAdminClient>;
  appointment: AppointmentAutopilotRow;
}) {
  const noShowPayload = {
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    completed_at: null,
    status: "no_show",
  };
  const noShowUpdate = await args.admin
    .from("appointments")
    .update(noShowPayload as any)
    .eq("id", args.appointment.id)
    .eq("salon_id", args.appointment.salon_id);

  if (noShowUpdate.error) {
    throw noShowUpdate.error;
  }

  await finalizeAppointmentPlanReservation({
    admin: args.admin as any,
    appointmentId: args.appointment.id,
    ownerSupabase: args.admin as any,
    salonId: args.appointment.salon_id,
  });
}

export async function hasOperationsAutopilotSchedulerConfig() {
  try {
    const admin = createAdminClient() as any;
    const result = await admin
      .schema("private")
      .from("runtime_config")
      .select("key, value")
      .in("key", [
        "operations_autopilot_job_url",
        "operations_autopilot_job_secret",
      ]);

    if (result.error) {
      return false;
    }

    const keys = new Set(
      (result.data ?? [])
        .filter(
          (entry: { key?: string | null; value?: string | null }) =>
            Boolean(entry.key) && Boolean(entry.value?.trim()),
        )
        .map((entry: { key: string }) => entry.key),
    );

    return (
      keys.has("operations_autopilot_job_url") &&
      keys.has("operations_autopilot_job_secret")
    );
  } catch {
    return false;
  }
}

export async function runOperationsAutopilot(
  now = new Date(),
): Promise<OperationsAutopilotSummary> {
  const admin = createAdminClient();
  const salonsResult = await admin
    .from("salons")
    .select("id, name, client_app_config");

  if (salonsResult.error) {
    throw salonsResult.error;
  }

  const autopilotSalons = ((salonsResult.data ?? []) as SalonAutopilotRow[])
    .filter((salon) =>
      normalizeSalonClientAppConfig(
        salon.client_app_config as never,
      ).autoPilotEnabled,
    );

  const summary: OperationsAutopilotSummary = {
    completed: 0,
    eligible: 0,
    errors: 0,
    noShow: 0,
    processed: 0,
    salons: [],
    skipped: 0,
  };

  const cutoffIso = new Date(
    now.getTime() - AUTOPILOT_COMPLETION_GRACE_MINUTES * 60 * 1000,
  ).toISOString();

  for (const salon of autopilotSalons) {
    const appointmentsResult = await admin
      .from("appointments")
      .select(
        "id, salon_id, status, ends_at, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_paid_at, deposit_customer_reported_paid_at, protection_confirmation_required",
      )
      .eq("salon_id", salon.id)
      .in("status", ["pending", "confirmed"])
      .lte("ends_at", cutoffIso)
      .order("ends_at", { ascending: true })
      .limit(AUTOPILOT_MAX_APPOINTMENTS_PER_SALON);

    if (appointmentsResult.error) {
      summary.errors += 1;
      summary.salons.push({
        completed: 0,
        eligible: 0,
        errors: 1,
        name: salon.name,
        noShow: 0,
        processed: 0,
        salonId: salon.id,
        skipped: 0,
      });
      continue;
    }

    const appointments = (appointmentsResult.data ?? []) as AppointmentAutopilotRow[];
    let salonCompleted = 0;
    let salonEligible = 0;
    let salonErrors = 0;
    let salonNoShow = 0;
    let salonSkipped = 0;

    for (const appointment of appointments) {
      summary.processed += 1;

      const shouldComplete = shouldAutoCompleteAppointment(appointment, now);
      const shouldNoShow =
        !shouldComplete && shouldAutoMarkNoShowAppointment(appointment, now);

      if (!shouldComplete && !shouldNoShow) {
        summary.skipped += 1;
        salonSkipped += 1;
        continue;
      }

      summary.eligible += 1;
      salonEligible += 1;

      try {
        if (shouldComplete) {
          await completeAppointment({
            admin,
            appointment,
          });
          summary.completed += 1;
          salonCompleted += 1;
        } else {
          await markAppointmentAsNoShow({
            admin,
            appointment,
          });
          summary.noShow += 1;
          salonNoShow += 1;
        }
      } catch (error) {
        summary.errors += 1;
        salonErrors += 1;
        console.error("[operations-autopilot] transition_failed", {
          action: shouldComplete ? "complete" : "no_show",
          appointmentId: appointment.id,
          error:
            error instanceof Error && error.message.trim()
              ? error.message
              : "transition_failed",
          salonId: salon.id,
        });
      }
    }

    summary.salons.push({
      completed: salonCompleted,
      eligible: salonEligible,
      errors: salonErrors,
      name: salon.name,
      noShow: salonNoShow,
      processed: appointments.length,
      salonId: salon.id,
      skipped: salonSkipped,
    });
  }

  return summary;
}
