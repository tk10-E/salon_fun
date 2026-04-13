import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  buildRedirectNotice,
  queueCustomerNotification,
  resolveDashboardReturnPath,
  SUBSCRIPTIONS_PATH,
} from "./shared";

const CUSTOMERS_PATH = "/dashboard/customers";
const NOTIFICATIONS_PATH = "/dashboard/notifications";

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizePhone(value: FormDataEntryValue | null) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  return digits;
}

function normalizeConsentStatus(value: FormDataEntryValue | null) {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  if (
    normalizedValue === "pending" ||
    normalizedValue === "signed" ||
    normalizedValue === "not_required"
  ) {
    return normalizedValue;
  }

  return "not_required";
}

function normalizeDate(value: FormDataEntryValue | null) {
  const normalizedValue = String(value ?? "").trim();

  if (!normalizedValue) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : null;
}

function formatCustomerMembershipError(message: string) {
  if (message.includes("customer_not_found")) {
    return "Não foi possível localizar esse cliente para ativar o pacote.";
  }

  if (message.includes("offer_not_found")) {
    return "Não foi possível localizar o clube ou pacote selecionado.";
  }

  if (message.includes("offer_not_membership")) {
    return "Somente clubes e pacotes podem ser ativados como saldo operacional.";
  }

  if (message.includes("membership_offer_not_operational")) {
    return "Esse clube ou pacote ainda não está pronto para uso operacional. Configure serviço, sessões e validade no comercial.";
  }

  return `Não foi possível ativar o pacote agora. ${message}`;
}

function resolveCustomersReturnPath(value: FormDataEntryValue | null) {
  const path = String(value ?? "").trim();

  if (!path.startsWith(CUSTOMERS_PATH)) {
    return CUSTOMERS_PATH;
  }

  return path;
}

function resolveMembershipManagementReturnPath(formData: FormData) {
  return resolveDashboardReturnPath(formData, SUBSCRIPTIONS_PATH, [
    "/dashboard",
    CUSTOMERS_PATH,
    SUBSCRIPTIONS_PATH,
  ]);
}

function normalizeOptionalNotes(value: FormDataEntryValue | null, maxLength = 1000) {
  return normalizeText(value, maxLength);
}

function formatMembershipRequestError(message: string) {
  if (message.includes("membership_request_not_found")) {
    return "Não foi possível localizar esse pedido de assinatura.";
  }

  if (message.includes("membership_request_not_pending")) {
    return "Esse pedido já foi tratado pelo salão.";
  }

  if (message.includes("membership_offer_not_operational")) {
    return "Esse plano ainda não está pronto para ativação. Revise serviço, sessões e validade.";
  }

  if (message.includes("offer_not_found")) {
    return "Não foi possível localizar o plano selecionado para esse pedido.";
  }

  return `Não foi possível tratar a assinatura agora. ${message}`;
}

function formatNotificationDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

export async function saveOwnerCustomerProfileActionImpl(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const returnPath = resolveCustomersReturnPath(formData.get("returnPath"));
  const phone = normalizePhone(formData.get("phone"));
  const crmLabel = normalizeText(formData.get("crmLabel"), 40);
  const preferences = normalizeText(formData.get("preferences"), 800);
  const beautyProducts = normalizeText(formData.get("beautyProducts"), 800);
  const allergies = normalizeText(formData.get("allergies"), 800);
  const internalNotes = normalizeText(formData.get("internalNotes"), 2000);
  const beautyGoals = normalizeText(formData.get("beautyGoals"), 800);
  const contraindications = normalizeText(
    formData.get("contraindications"),
    800,
  );
  const technicalNotes = normalizeText(formData.get("technicalNotes"), 1200);
  const consentStatus = normalizeConsentStatus(formData.get("consentStatus"));
  const lastAssessmentAt = normalizeDate(formData.get("lastAssessmentAt"));
  const birthDate = normalizeDate(formData.get("birthDate"));

  await requireOwnerSalon();
  const supabase = createClient();

  if (!customerId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Cliente inválido para atualizar o CRM.",
        "error",
      ),
    );
  }

  if (phone && (phone.length < 10 || phone.length > 15)) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Informe um telefone válido com DDD e código do país, se necessário.",
        "error",
      ),
    );
  }

  const { error } = await supabase.rpc("update_owner_customer_profile", {
    customer_uuid: customerId,
    phone_input: phone,
    preferences_input: preferences,
    allergies_input: allergies,
    beauty_products_input: beautyProducts,
    crm_label_input: crmLabel,
    internal_notes_input: internalNotes,
    beauty_goals_input: beautyGoals,
    contraindications_input: contraindications,
    technical_notes_input: technicalNotes,
    consent_status_input: consentStatus,
    last_assessment_at_input: lastAssessmentAt,
    birth_date_input: birthDate,
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Não foi possível salvar o CRM desse cliente agora.",
        "error",
      ),
    );
  }

  revalidatePath(CUSTOMERS_PATH);
  redirect(
    buildRedirectNotice(
      returnPath,
      "CRM do cliente atualizado com sucesso.",
      "success",
    ),
  );
}

export async function sendCustomerNudgeActionImpl(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const customerName =
    normalizeText(formData.get("customerName"), 120) ?? "cliente";
  const serviceName = normalizeText(formData.get("serviceName"), 120);
  const tierLabel = normalizeText(formData.get("tierLabel"), 80);
  const cashbackBalance = Number(formData.get("cashbackBalance") ?? 0);
  const isVip = String(formData.get("isVip") ?? "") === "true";
  const returnPath = resolveCustomersReturnPath(formData.get("returnPath"));
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!customerId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Cliente inválido para enviar o lembrete.",
        "error",
      ),
    );
  }

  const notificationType =
    cashbackBalance > 0 || isVip
      ? "loyalty_balance_reminder"
      : "smart_rebook_prompt";
  const title =
    cashbackBalance > 0
      ? "Seu saldo já pode virar nova visita"
      : isVip
        ? "Seu próximo passo VIP está esperando"
        : serviceName
          ? `Hora de pensar no próximo ${serviceName}`
          : "Seu próximo horário pode ser agora";
  const body =
    cashbackBalance > 0
      ? `${customerName}, você já tem ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cashbackBalance)} em cashback no salão. Vale usar esse saldo na próxima visita.`
      : isVip
        ? `${customerName}, seu perfil ${tierLabel ? `${tierLabel} ` : ""}já libera benefícios do salão. Aproveite para travar sua próxima visita antes da agenda encher.`
        : serviceName
          ? `${customerName}, o salão separou um lembrete para você voltar a ${serviceName.toLowerCase()} e manter o resultado em dia.`
          : `${customerName}, o salão separou um lembrete para você marcar o próximo retorno e manter sua rotina em dia.`;

  const { error } = await supabase.from("salon_customer_notifications").insert({
    salon_id: salon.id,
    customer_id: customerId,
    audience: "single_customer",
    notification_type: notificationType,
    title,
    body,
    payload: {
      type: notificationType,
      serviceName,
      tierLabel,
      cashbackBalance: Number.isFinite(cashbackBalance) ? cashbackBalance : 0,
    },
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Não foi possível enviar o lembrete para esse cliente agora.",
        "error",
      ),
    );
  }

  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(NOTIFICATIONS_PATH);
  redirect(
    buildRedirectNotice(
      returnPath,
      "Lembrete enviado para o app do cliente.",
      "success",
    ),
  );
}

export async function assignCustomerMembershipPackageActionImpl(
  formData: FormData,
) {
  const customerId = String(formData.get("customerId") ?? "").trim();
  const offerId = String(formData.get("offerId") ?? "").trim();
  const startsOn = normalizeDate(formData.get("startsOn"));
  const notes = normalizeText(formData.get("notes"), 1000);
  const returnPath = resolveCustomersReturnPath(formData.get("returnPath"));

  await requireOwnerSalon();
  const supabase = createClient();

  if (!customerId || !offerId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Selecione o cliente e o pacote antes de ativar.",
        "error",
      ),
    );
  }

  const { error } = await supabase.rpc("assign_customer_membership_package", {
    customer_uuid: customerId,
    offer_uuid: offerId,
    starts_on_input: startsOn,
    notes_input: notes,
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        formatCustomerMembershipError(error.message),
        "error",
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  revalidatePath(CUSTOMERS_PATH);
  redirect(
    buildRedirectNotice(
      returnPath,
      "Pacote ativado com saldo operacional para essa cliente.",
      "success",
    ),
  );
}

export async function approveCustomerMembershipRequestActionImpl(
  formData: FormData,
) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const startsOn = normalizeDate(formData.get("startsOn"));
  const notes = normalizeOptionalNotes(formData.get("notes"));
  const returnPath = resolveMembershipManagementReturnPath(formData);

  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!requestId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Selecione um pedido antes de aprovar a assinatura.",
        "error",
      ),
    );
  }

  const { data: requestRecord } = await (supabase as any)
    .from("customer_membership_requests")
    .select(
      "id, salon_id, customer_id, offer_id, offer_title_snapshot, status",
    )
    .eq("id", requestId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!requestRecord || requestRecord.status !== "pending") {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Esse pedido não está mais pendente no painel.",
        "error",
      ),
    );
  }

  const { data: approvedMembership, error } = await (supabase as any).rpc(
    "approve_customer_membership_request",
    {
      request_uuid: requestId,
      starts_on_input: startsOn,
      notes_input: notes,
    },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        formatMembershipRequestError(error.message),
        "error",
      ),
    );
  }

  const expiresAtLabel = formatNotificationDate(
    approvedMembership?.expires_at ?? null,
  );

  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    customerId: requestRecord.customer_id,
    audience: "single_customer",
    notificationType: "membership_request_approved",
    title: "Seu plano foi ativado",
    body: expiresAtLabel
      ? `${requestRecord.offer_title_snapshot} foi aceito pelo salão e está ativo até ${expiresAtLabel}.`
      : `${requestRecord.offer_title_snapshot} foi aceito pelo salão e já está ativo no app.`,
    payload: {
      type: "membership_request_approved",
      ctaTarget: "profile",
      offerId: requestRecord.offer_id,
      membershipId: approvedMembership?.id ?? null,
      expiresAt: approvedMembership?.expires_at ?? null,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(SUBSCRIPTIONS_PATH);
  revalidatePath(NOTIFICATIONS_PATH);
  redirect(
    buildRedirectNotice(
      returnPath,
      "Assinatura aprovada e ativada para a cliente.",
      "success",
    ),
  );
}

export async function rejectCustomerMembershipRequestActionImpl(
  formData: FormData,
) {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const notes = normalizeOptionalNotes(formData.get("notes"));
  const returnPath = resolveMembershipManagementReturnPath(formData);

  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!requestId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Selecione um pedido antes de recusar a assinatura.",
        "error",
      ),
    );
  }

  const { data: requestRecord } = await (supabase as any)
    .from("customer_membership_requests")
    .select(
      "id, salon_id, customer_id, offer_id, offer_title_snapshot, status",
    )
    .eq("id", requestId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!requestRecord || requestRecord.status !== "pending") {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Esse pedido não está mais pendente no painel.",
        "error",
      ),
    );
  }

  const { error } = await (supabase as any).rpc(
    "reject_customer_membership_request",
    {
      request_uuid: requestId,
      notes_input: notes,
    },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        formatMembershipRequestError(error.message),
        "error",
      ),
    );
  }

  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    customerId: requestRecord.customer_id,
    audience: "single_customer",
    notificationType: "membership_request_rejected",
    title: "Seu pedido de plano foi respondido",
    body: (notes?.trim().length ?? 0) > 0
      ? `O salão respondeu o pedido de ${requestRecord.offer_title_snapshot}: ${notes!.trim()}`
      : `O salão respondeu o pedido de ${requestRecord.offer_title_snapshot}. Se quiser, você pode pedir novamente mais tarde.`,
    payload: {
      type: "membership_request_rejected",
      ctaTarget: "profile",
      offerId: requestRecord.offer_id,
    },
  });

  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(SUBSCRIPTIONS_PATH);
  revalidatePath(NOTIFICATIONS_PATH);
  redirect(
    buildRedirectNotice(
      returnPath,
      "Pedido recusado e cliente avisada no app.",
      "success",
    ),
  );
}
