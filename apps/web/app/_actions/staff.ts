import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingEntitlements } from "@/lib/billing";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";
import { WEEKDAY_OPTIONS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

import {
  buildRedirectNotice,
  buildStaffAvailabilityNotification,
  prepareCustomerNotificationPayload,
  queueCustomerNotification,
} from "./shared";

const TEAM_PATH = MANAGEMENT_ROUTES.professionals;
const APPOINTMENTS_PATH = MANAGEMENT_ROUTES.appointments;
const DASHBOARD_PATH = "/dashboard";
const SERVICES_PATH = MANAGEMENT_ROUTES.services;

function readStringValues(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

function normalizeBusinessTimeInput(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${value}:00`;
}

function businessTimeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function isStaffOpeningAlignedToSalonGrid(args: {
  salonOpensAt: string;
  slotStepMinutes: number;
  staffOpensAt: string;
}) {
  const staffOpenMinutes = businessTimeToMinutes(args.staffOpensAt);
  const salonOpenMinutes = businessTimeToMinutes(args.salonOpensAt);

  if (staffOpenMinutes <= salonOpenMinutes) {
    return true;
  }

  return (staffOpenMinutes - salonOpenMinutes) % args.slotStepMinutes === 0;
}

async function touchStaffMemberSyncStamp(args: {
  supabase: any;
  salonId: string;
  staffMemberId: string;
}) {
  // Touch the salon-scoped staff row so realtime listeners refresh even when
  // the change happened in child tables such as hours or assignments.
  await args.supabase
    .from("staff_members")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", args.staffMemberId)
    .eq("salon_id", args.salonId);
}

export async function createStaffMemberActionImpl(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const requestedServiceIds = readStringValues(formData, "serviceIds");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const billing = await getSalonBillingEntitlements(salon.id);

  if (!name) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Informe o nome do profissional.",
        "error",
      ),
    );
  }

  if (billing.maxStaffMembers !== null) {
    const { count } = await supabase
      .from("staff_members")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true);

    if ((count ?? 0) >= billing.maxStaffMembers) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `Seu plano ${billing.currentPlan.displayName} permite até ${billing.maxStaffMembers} profissionais ativos. Faça upgrade no Billing para ampliar a equipe.`,
          "error",
        ),
      );
    }
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", salon.id);

  if (servicesError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível carregar os serviços para a equipe.",
        "error",
      ),
    );
  }

  const salonServiceIds = new Set(
    (services ?? []).map((service) => service.id),
  );
  const selectedServiceIds = requestedServiceIds.length
    ? requestedServiceIds
    : [...salonServiceIds];

  if (selectedServiceIds.some((serviceId) => !salonServiceIds.has(serviceId))) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Selecione apenas serviços do seu salão.",
        "error",
      ),
    );
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .insert({
      salon_id: salon.id,
      name,
      role: role || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível cadastrar o profissional.",
        "error",
      ),
    );
  }

  if (selectedServiceIds.length) {
    const { error: assignmentsError } = await supabase
      .from("staff_service_assignments")
      .insert(
        selectedServiceIds.map((serviceId) => ({
          staff_member_id: staffMember.id,
          service_id: serviceId,
        })),
      );

    if (assignmentsError) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "O profissional foi criado, mas não foi possível vincular os serviços.",
          "error",
        ),
      );
    }
  }

  const notification = buildStaffAvailabilityNotification({
    action: "created",
    staffMemberName: name,
    staffRole: role || null,
  });
  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
  });

  revalidatePath(TEAM_PATH);
  revalidatePath(SERVICES_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      "Profissional adicionado com sucesso.",
      "success",
    ),
  );
}

export async function updateStaffMemberAssignmentsActionImpl(
  formData: FormData,
) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const requestedServiceIds = readStringValues(formData, "serviceIds");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Profissional inválido.", "error"));
  }

  const staffLookupResult = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();
  const staffMember = staffLookupResult.data as {
    id: string;
    name: string;
    role: string | null;
    is_active: boolean;
  } | null;
  const staffError = staffLookupResult.error;

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível localizar esse profissional.",
        "error",
      ),
    );
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", salon.id);

  if (servicesError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível carregar os serviços do salão.",
        "error",
      ),
    );
  }

  const validServiceIds = new Set(
    (services ?? []).map((service) => service.id),
  );

  if (
    requestedServiceIds.some((serviceId) => !validServiceIds.has(serviceId))
  ) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Selecione apenas serviços válidos para esse profissional.",
        "error",
      ),
    );
  }

  const { error: deleteError } = await supabase
    .from("staff_service_assignments")
    .delete()
    .eq("staff_member_id", staffMemberId);

  if (deleteError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível atualizar os serviços do profissional.",
        "error",
      ),
    );
  }

  if (requestedServiceIds.length) {
    const { error: insertError } = await supabase
      .from("staff_service_assignments")
      .insert(
        requestedServiceIds.map((serviceId) => ({
          staff_member_id: staffMemberId,
          service_id: serviceId,
        })),
      );

    if (insertError) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "Não foi possível salvar os serviços desse profissional.",
          "error",
        ),
      );
    }
  }

  await touchStaffMemberSyncStamp({
    supabase,
    salonId: salon.id,
    staffMemberId,
  });

  revalidatePath(TEAM_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      "Serviços do profissional atualizados com sucesso.",
      "success",
    ),
  );
}

export async function updateStaffBusinessHoursActionImpl(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível localizar esse profissional.",
        "error",
      ),
    );
  }

  const { data: salonBusinessHours, error: salonBusinessHoursError } =
    await supabase
      .from("salon_business_hours")
      .select("weekday, is_open, opens_at")
      .eq("salon_id", salon.id);

  if (salonBusinessHoursError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível carregar a grade oficial do salão.",
        "error",
      ),
    );
  }

  const salonBusinessHoursByWeekday = new Map(
    (
      (salonBusinessHours ?? []) as Array<{
        is_open: boolean;
        opens_at: string | null;
        weekday: number;
      }>
    ).map((entry) => [entry.weekday, entry]),
  );
  const slotStepMinutes = salon.slot_step_minutes ?? 30;

  const businessHours = WEEKDAY_OPTIONS.map((weekday) => {
    const isOpen = formData.get(`staffIsOpen_${weekday.value}`) === "on";
    const opensAt = String(
      formData.get(`staffOpensAt_${weekday.value}`) ?? "",
    ).trim();
    const closesAt = String(
      formData.get(`staffClosesAt_${weekday.value}`) ?? "",
    ).trim();

    if (!isOpen) {
      return {
        staff_member_id: staffMemberId,
        weekday: weekday.value,
        is_open: false,
        opens_at: null,
        closes_at: null,
      };
    }

    const normalizedOpen = normalizeBusinessTimeInput(opensAt);
    const normalizedClose = normalizeBusinessTimeInput(closesAt);

    if (!normalizedOpen || !normalizedClose) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `Preencha um horário válido para ${weekday.label.toLowerCase()} na agenda do profissional.`,
          "error",
        ),
      );
    }

    if (normalizedOpen >= normalizedClose) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `O horário de abertura precisa ser antes do fechamento em ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    const salonBusinessHour = salonBusinessHoursByWeekday.get(weekday.value);

    if (
      salonBusinessHour?.is_open &&
      salonBusinessHour.opens_at &&
      !isStaffOpeningAlignedToSalonGrid({
        salonOpensAt: salonBusinessHour.opens_at,
        slotStepMinutes,
        staffOpensAt: normalizedOpen,
      })
    ) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `A abertura do profissional em ${weekday.label.toLowerCase()} precisa seguir o intervalo oficial da agenda do salão.`,
          "error",
        ),
      );
    }

    return {
      staff_member_id: staffMemberId,
      weekday: weekday.value,
      is_open: true,
      opens_at: normalizedOpen,
      closes_at: normalizedClose,
    };
  });

  const { error } = await supabase
    .from("staff_business_hours")
    .upsert(businessHours, {
      onConflict: "staff_member_id,weekday",
    });

  if (error) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível salvar a agenda desse profissional.",
        "error",
      ),
    );
  }

  await touchStaffMemberSyncStamp({
    supabase,
    salonId: salon.id,
    staffMemberId,
  });

  revalidatePath(TEAM_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      "Agenda do profissional atualizada com sucesso.",
      "success",
    ),
  );
}

export async function toggleStaffMemberStatusActionImpl(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const nextStatus = String(formData.get("isActive") ?? "") === "true";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Profissional inválido.", "error"));
  }

  const staffLookupResult = await supabase
    .from("staff_members")
    .select("id, name, role, is_active")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();
  const staffMember = staffLookupResult.data as {
    id: string;
    name: string;
    role: string | null;
    is_active: boolean;
  } | null;
  const staffError = staffLookupResult.error;

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível localizar esse profissional.",
        "error",
      ),
    );
  }

  const { error: updateError } = await supabase
    .from("staff_members")
    .update({ is_active: nextStatus })
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (updateError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível atualizar o status do profissional.",
        "error",
      ),
    );
  }

  if (nextStatus) {
    const { count, error: countError } = await supabase
      .from("staff_service_assignments")
      .select("*", { count: "exact", head: true })
      .eq("staff_member_id", staffMemberId);

    if (!countError && (count ?? 0) === 0) {
      const { data: services } = await supabase
        .from("services")
        .select("id")
        .eq("salon_id", salon.id);
      if (services?.length) {
        await supabase.from("staff_service_assignments").insert(
          services.map((service) => ({
            staff_member_id: staffMemberId,
            service_id: service.id,
          })),
        );
      }
    }

    if (!staffMember.is_active) {
      const notification = buildStaffAvailabilityNotification({
        action: "reactivated",
        staffMemberName: staffMember.name,
        staffRole: staffMember.role,
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
  }

  revalidatePath(TEAM_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      nextStatus
        ? "Profissional reativado com sucesso."
        : "Profissional pausado com sucesso.",
      "success",
    ),
  );
}

export async function deleteStaffMemberActionImpl(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, is_default")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível localizar esse profissional.",
        "error",
      ),
    );
  }

  if (staffMember.is_default) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "O profissional inicial do sistema não pode ser removido. Se ele saiu do salão, use Pausar para preservar o histórico.",
        "error",
      ),
    );
  }

  const { count: appointmentsCount, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salon.id)
    .eq("staff_member_id", staffMemberId);

  if (appointmentsError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível verificar se esse profissional ainda possui atendimentos vinculados.",
        "error",
      ),
    );
  }

  if ((appointmentsCount ?? 0) > 0) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        `${staffMember.name} não pode ser removido porque já possui agendamentos ou histórico vinculados. Use Pausar se ele saiu do salão.`,
        "error",
      ),
    );
  }

  const { error: deleteError } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (deleteError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível remover esse profissional.",
        "error",
      ),
    );
  }

  revalidatePath(TEAM_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      `${staffMember.name} foi removido da equipe.`,
      "success",
    ),
  );
}

export async function offboardStaffMemberActionImpl(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const replacementStaffMemberId = String(
    formData.get("replacementStaffMemberId") ?? "",
  ).trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const now = new Date().toISOString();

  if (!staffMemberId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, is_default, is_active")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível localizar esse profissional.",
        "error",
      ),
    );
  }

  if (staffMember.is_default) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "O profissional inicial do sistema não pode ser desligado. Use Pausar para tirá-lo da agenda sem perder o histórico.",
        "error",
      ),
    );
  }

  const { data: futureAppointments, error: futureAppointmentsError } =
    await supabase
      .from("appointments")
      .select("id, service_id, customer_id, date, services(name)")
      .eq("salon_id", salon.id)
      .eq("staff_member_id", staffMemberId)
      .gt("date", now)
      .in("status", ["pending", "confirmed"]);

  if (futureAppointmentsError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível carregar a agenda futura desse profissional.",
        "error",
      ),
    );
  }

  const futureItems = futureAppointments ?? [];

  if (futureItems.length && !replacementStaffMemberId) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        `${staffMember.name} ainda tem agenda futura. Escolha outro profissional para receber esses horários antes de desligar.`,
        "error",
      ),
    );
  }

  let replacementName: string | null = null;

  if (futureItems.length) {
    if (replacementStaffMemberId === staffMemberId) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "Escolha outro profissional para receber a agenda futura.",
          "error",
        ),
      );
    }

    const { data: replacementStaffMember, error: replacementError } =
      await supabase
        .from("staff_members")
        .select("id, name, is_active")
        .eq("id", replacementStaffMemberId)
        .eq("salon_id", salon.id)
        .maybeSingle();

    if (
      replacementError ||
      !replacementStaffMember ||
      !replacementStaffMember.is_active
    ) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "O profissional escolhido para receber a agenda não está disponível.",
          "error",
        ),
      );
    }

    replacementName = replacementStaffMember.name;

    const appointmentServiceIds = Array.from(
      new Set(futureItems.map((item) => item.service_id)),
    );
    const { data: replacementAssignments, error: replacementAssignmentsError } =
      await supabase
        .from("staff_service_assignments")
        .select("service_id")
        .eq("staff_member_id", replacementStaffMemberId);

    if (replacementAssignmentsError) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "Não foi possível validar os serviços do profissional que vai receber a agenda.",
          "error",
        ),
      );
    }

    const replacementServiceIds = new Set(
      (replacementAssignments ?? []).map((assignment) => assignment.service_id),
    );

    if (
      appointmentServiceIds.some(
        (serviceId) => !replacementServiceIds.has(serviceId),
      )
    ) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `${replacementStaffMember.name} não atende todos os serviços da agenda futura de ${staffMember.name}. Ajuste os serviços antes de desligar.`,
          "error",
        ),
      );
    }

    const { error: reassignError } = await supabase
      .from("appointments")
      .update({ staff_member_id: replacementStaffMemberId })
      .in(
        "id",
        futureItems.map((item) => item.id),
      )
      .eq("salon_id", salon.id)
      .eq("staff_member_id", staffMemberId);

    if (reassignError) {
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          "Não foi possível transferir a agenda futura desse profissional.",
          "error",
        ),
      );
    }

    const notifications = futureItems.map((item) => {
      const serviceRelation =
        item.services && Array.isArray(item.services)
          ? item.services[0]
          : item.services;
      const serviceName =
        typeof serviceRelation?.name === "string" &&
        serviceRelation.name.trim().length
          ? serviceRelation.name.trim()
          : "atendimento";

      return {
        salon_id: salon.id,
        customer_id: item.customer_id,
        audience: "single_customer",
        notification_type: "appointment_staff_reassigned",
        title: "Seu horário teve troca de profissional",
        body: `${staffMember.name} não atende mais no salão. Seu ${serviceName} continua no mesmo horário e agora será com ${replacementStaffMember.name}.`,
        payload: {
          ...prepareCustomerNotificationPayload(
            "appointment_staff_reassigned",
            {
              type: "appointment_staff_reassigned",
              appointmentId: item.id,
              appointmentAt: item.date,
              serviceName,
              staffMemberName: replacementStaffMember.name,
              previousStaffMemberName: staffMember.name,
              replacementStaffMemberName: replacementStaffMember.name,
            },
          ),
        },
      };
    });

    const { error: notificationsError } = await supabase
      .from("salon_customer_notifications")
      .insert(notifications);

    if (notificationsError) {
      revalidatePath(TEAM_PATH);
      revalidatePath(APPOINTMENTS_PATH);
      redirect(
        buildRedirectNotice(
          TEAM_PATH,
          `${staffMember.name} foi desligado e a agenda futura foi transferida, mas não foi possível avisar os clientes pelo app.`,
          "error",
        ),
      );
    }
  }

  const { error: blocksError } = await supabase
    .from("staff_blocks")
    .delete()
    .eq("staff_member_id", staffMemberId)
    .gte("ends_at", now);

  if (blocksError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "A agenda futura foi tratada, mas não foi possível limpar os bloqueios desse profissional.",
        "error",
      ),
    );
  }

  const { error: pauseError } = await supabase
    .from("staff_members")
    .update({ is_active: false })
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (pauseError) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível concluir o desligamento desse profissional.",
        "error",
      ),
    );
  }

  revalidatePath(TEAM_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      futureItems.length
        ? `${staffMember.name} foi desligado do salão. ${futureItems.length} ${futureItems.length === 1 ? "agendamento foi transferido" : "agendamentos foram transferidos"} para ${replacementName}.`
        : `${staffMember.name} foi desligado do salão e saiu da agenda ativa.`,
      "success",
    ),
  );
}

export async function createStaffBlockActionImpl(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId || !startsAt || !endsAt) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Preencha profissional, início e fim do bloqueio.",
        "error",
      ),
    );
  }

  const { error } = await supabase.rpc("create_staff_block", {
    staff_member_uuid: staffMemberId,
    local_start: startsAt,
    local_end: endsAt,
    block_reason: reason || null,
  });

  if (error) {
    const message = error.message.includes("staff_block_overlap")
      ? "Já existe um bloqueio nesse intervalo para o profissional."
      : error.message.includes("invalid_block_range")
        ? "O horário final precisa ser depois do horário inicial."
        : "Não foi possível criar o bloqueio manual.";

    redirect(buildRedirectNotice(TEAM_PATH, message, "error"));
  }

  revalidatePath(TEAM_PATH);
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  redirect(
    buildRedirectNotice(
      TEAM_PATH,
      "Bloqueio manual criado com sucesso.",
      "success",
    ),
  );
}

export async function deleteStaffBlockActionImpl(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!blockId) {
    redirect(buildRedirectNotice(TEAM_PATH, "Bloqueio inválido.", "error"));
  }

  const { error } = await supabase
    .from("staff_blocks")
    .delete()
    .eq("id", blockId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        TEAM_PATH,
        "Não foi possível remover o bloqueio.",
        "error",
      ),
    );
  }

  revalidatePath(TEAM_PATH);
  revalidatePath(APPOINTMENTS_PATH);
  redirect(
    buildRedirectNotice(TEAM_PATH, "Bloqueio removido com sucesso.", "success"),
  );
}
