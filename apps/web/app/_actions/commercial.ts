import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingEntitlements } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

import {
  buildRedirectNotice,
  COMMERCIAL_AUTOMATIONS_PATH,
  COMMERCIAL_LOYALTY_PATH,
  COMMERCIAL_PROMOTIONS_PATH,
  COMMERCIAL_REFERRALS_PATH,
  formatPercentLabel,
  queueCustomerNotification,
  revalidateCommercialPaths,
} from "./shared";

function normalizeDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function normalizeOptionalId(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizePositiveInteger(value: FormDataEntryValue | null) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function buildOfferNotification(args: {
  action: "created" | "updated";
  kind: string;
  title: string;
  highlightText: string;
  startsOn: string | null;
}) {
  const typePrefix = args.kind === "membership" ? "membership" : "promotion";
  const notificationTitle =
    args.action === "created"
      ? args.kind === "membership"
        ? "Novo plano mensal no salão"
        : "Nova promoção no salão"
      : args.kind === "membership"
        ? "Plano mensal atualizado"
        : "Promoção atualizada";

  const defaultBody =
    args.action === "created"
      ? `${args.title} já está disponível no app do salão.`
      : `${args.title} foi atualizada. Confira os detalhes no app.`;

  const startsHint = args.startsOn
    ? ` Válida a partir de ${formatDateLabel(args.startsOn)}.`
    : "";

  return {
    title: notificationTitle,
    body: `${args.highlightText || defaultBody}${startsHint}`,
    type:
      args.action === "created"
        ? `${typePrefix}_published`
        : `${typePrefix}_updated`,
  };
}

export async function createSalonOfferActionImpl(formData: FormData) {
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const highlightText = String(formData.get("highlightText") ?? "").trim();
  const membershipServiceId = normalizeOptionalId(
    formData.get("membershipServiceId"),
  );
  const membershipSessionsIncluded = normalizePositiveInteger(
    formData.get("membershipSessionsIncluded"),
  );
  const membershipValidityDays = normalizePositiveInteger(
    formData.get("membershipValidityDays"),
  );
  const priceValue = String(formData.get("price") ?? "").trim();
  const startsOnValue = String(formData.get("startsOn") ?? "").trim();
  const endsOnValue = String(formData.get("endsOn") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !["promotion", "membership"].includes(kind) ||
    !title ||
    Number.isNaN(sortOrder) ||
    sortOrder < 0
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Preencha os dados principais da oferta.",
        "error",
      ),
    );
  }

  const normalizedStartsOn = startsOnValue
    ? normalizeDateInput(startsOnValue)
    : null;
  const normalizedEndsOn = endsOnValue ? normalizeDateInput(endsOnValue) : null;
  const price = priceValue ? Number(priceValue) : null;

  if (
    (startsOnValue && !normalizedStartsOn) ||
    (endsOnValue && !normalizedEndsOn)
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Informe datas válidas para a vigência da oferta.",
        "error",
      ),
    );
  }

  if (
    normalizedStartsOn &&
    normalizedEndsOn &&
    normalizedEndsOn < normalizedStartsOn
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "A data final precisa ser igual ou posterior à data inicial.",
        "error",
      ),
    );
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Informe um valor válido para a oferta.",
        "error",
      ),
    );
  }

  if (
    kind === "membership" &&
    (!membershipServiceId ||
      membershipSessionsIncluded == null ||
      membershipValidityDays == null)
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Preencha serviço, sessões e validade para publicar um clube ou pacote operacional.",
        "error",
      ),
    );
  }

  const { error } = await supabase.from("salon_offers").insert({
    salon_id: salon.id,
    kind,
    title,
    description: description || null,
    highlight_text: highlightText || null,
    membership_service_id: kind === "membership" ? membershipServiceId : null,
    membership_sessions_included:
      kind === "membership" ? membershipSessionsIncluded : null,
    membership_validity_days:
      kind === "membership" ? membershipValidityDays : null,
    price,
    starts_on: normalizedStartsOn,
    ends_on: normalizedEndsOn,
    sort_order: sortOrder,
    is_active: isActive,
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Não foi possível salvar a oferta.",
        "error",
      ),
    );
  }

  if (isActive) {
    const notification = buildOfferNotification({
      action: "created",
      kind,
      title,
      highlightText,
      startsOn: normalizedStartsOn,
    });

    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: {
        type: notification.type,
        offerTitle: title,
        offerKind: kind,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_PROMOTIONS_PATH,
      "Oferta salva com sucesso.",
      "success",
    ),
  );
}

export async function updateSalonOfferActionImpl(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const highlightText = String(formData.get("highlightText") ?? "").trim();
  const membershipServiceId = normalizeOptionalId(
    formData.get("membershipServiceId"),
  );
  const membershipSessionsIncluded = normalizePositiveInteger(
    formData.get("membershipSessionsIncluded"),
  );
  const membershipValidityDays = normalizePositiveInteger(
    formData.get("membershipValidityDays"),
  );
  const priceValue = String(formData.get("price") ?? "").trim();
  const startsOnValue = String(formData.get("startsOn") ?? "").trim();
  const endsOnValue = String(formData.get("endsOn") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !offerId ||
    !["promotion", "membership"].includes(kind) ||
    !title ||
    Number.isNaN(sortOrder) ||
    sortOrder < 0
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Dados inválidos para atualizar a oferta.",
        "error",
      ),
    );
  }

  const normalizedStartsOn = startsOnValue
    ? normalizeDateInput(startsOnValue)
    : null;
  const normalizedEndsOn = endsOnValue ? normalizeDateInput(endsOnValue) : null;
  const price = priceValue ? Number(priceValue) : null;

  if (
    (startsOnValue && !normalizedStartsOn) ||
    (endsOnValue && !normalizedEndsOn)
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Informe datas válidas para a vigência da oferta.",
        "error",
      ),
    );
  }

  if (
    normalizedStartsOn &&
    normalizedEndsOn &&
    normalizedEndsOn < normalizedStartsOn
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "A data final precisa ser igual ou posterior à data inicial.",
        "error",
      ),
    );
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Informe um valor válido para a oferta.",
        "error",
      ),
    );
  }

  if (
    kind === "membership" &&
    (!membershipServiceId ||
      membershipSessionsIncluded == null ||
      membershipValidityDays == null)
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Preencha serviço, sessões e validade para atualizar esse clube ou pacote.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("salon_offers")
    .update({
      kind,
      title,
      description: description || null,
      highlight_text: highlightText || null,
      membership_service_id: kind === "membership" ? membershipServiceId : null,
      membership_sessions_included:
        kind === "membership" ? membershipSessionsIncluded : null,
      membership_validity_days:
        kind === "membership" ? membershipValidityDays : null,
      price,
      starts_on: normalizedStartsOn,
      ends_on: normalizedEndsOn,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .eq("id", offerId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Não foi possível atualizar a oferta.",
        "error",
      ),
    );
  }

  if (isActive) {
    const notification = buildOfferNotification({
      action: "updated",
      kind,
      title,
      highlightText,
      startsOn: normalizedStartsOn,
    });

    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: {
        type: notification.type,
        offerId,
        offerTitle: title,
        offerKind: kind,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_PROMOTIONS_PATH,
      "Oferta atualizada com sucesso.",
      "success",
    ),
  );
}

export async function deleteSalonOfferActionImpl(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!offerId) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Oferta inválida.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("salon_offers")
    .delete()
    .eq("id", offerId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_PROMOTIONS_PATH,
        "Não foi possível remover a oferta.",
        "error",
      ),
    );
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_PROMOTIONS_PATH,
      "Oferta removida com sucesso.",
      "success",
    ),
  );
}

export async function saveSalonReferralProgramActionImpl(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rewardForReferrer = String(
    formData.get("rewardForReferrer") ?? "",
  ).trim();
  const rewardForInvited = String(
    formData.get("rewardForInvited") ?? "",
  ).trim();
  const requiredQualifiedReferrals = Number(
    formData.get("requiredQualifiedReferrals") ?? 10,
  );
  const rewardServiceId = String(formData.get("rewardServiceId") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !title ||
    !rewardForReferrer ||
    !Number.isInteger(requiredQualifiedReferrals) ||
    requiredQualifiedReferrals < 1
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_REFERRALS_PATH,
        "Preencha o título e o benefício principal da indicação.",
        "error",
      ),
    );
  }

  if (rewardServiceId) {
    const { data: rewardService } = await supabase
      .from("services")
      .select("id")
      .eq("id", rewardServiceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (!rewardService?.id) {
      redirect(
        buildRedirectNotice(
          COMMERCIAL_REFERRALS_PATH,
          "Escolha um serviço válido do seu catálogo para a recompensa.",
          "error",
        ),
      );
    }
  }

  const { error } = await supabase.from("salon_referral_programs").upsert(
    {
      salon_id: salon.id,
      title,
      description: description || null,
      reward_for_referrer: rewardForReferrer,
      reward_for_invited: rewardForInvited || null,
      required_qualified_referrals: requiredQualifiedReferrals,
      reward_service_id: rewardServiceId || null,
      is_active: isActive,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_REFERRALS_PATH,
        "Não foi possível salvar o programa de indicação.",
        "error",
      ),
    );
  }

  await supabase.rpc("reconcile_salon_referral_reward_unlocks", {
    target_salon_id: salon.id,
  });

  if (isActive) {
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: "referral_program_updated",
      title: "Indique amigos e ganhe",
      body: rewardForInvited
        ? `${title}: a cada ${requiredQualifiedReferrals} indicações validadas, o salão libera a recompensa principal e mantém benefício para quem entra com o código.`
        : `${title}: a cada ${requiredQualifiedReferrals} indicações validadas, uma nova recompensa é liberada no app.`,
      payload: {
        type: "referral_program_updated",
        referralTitle: title,
        requiredQualifiedReferrals,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_REFERRALS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_REFERRALS_PATH,
      "Programa de indicação atualizado com sucesso.",
      "success",
    ),
  );
}

export async function saveSalonLoyaltyProgramActionImpl(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsPerVisit = Number(formData.get("pointsPerVisit") ?? 0);
  const cashbackPercent = Number(formData.get("cashbackPercent") ?? 0);
  const tierOneName = String(formData.get("tierOneName") ?? "").trim();
  const tierOneMinVisits = Number(formData.get("tierOneMinVisits") ?? 0);
  const tierOneDiscountPercent = Number(
    formData.get("tierOneDiscountPercent") ?? 0,
  );
  const tierTwoName = String(formData.get("tierTwoName") ?? "").trim();
  const tierTwoMinVisits = Number(formData.get("tierTwoMinVisits") ?? 0);
  const tierTwoDiscountPercent = Number(
    formData.get("tierTwoDiscountPercent") ?? 0,
  );
  const vipTierName = String(formData.get("vipTierName") ?? "").trim();
  const vipMinVisits = Number(formData.get("vipMinVisits") ?? 0);
  const vipDiscountPercent = Number(formData.get("vipDiscountPercent") ?? 0);
  const vipRewardServiceId = String(
    formData.get("vipRewardServiceId") ?? "",
  ).trim();
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  let vipRewardServiceName: string | null = null;

  const integerFields = [
    pointsPerVisit,
    tierOneMinVisits,
    tierTwoMinVisits,
    vipMinVisits,
  ];
  const percentFields = [
    cashbackPercent,
    tierOneDiscountPercent,
    tierTwoDiscountPercent,
    vipDiscountPercent,
  ];

  if (
    !title ||
    !tierOneName ||
    !tierTwoName ||
    !vipTierName ||
    integerFields.some((value) => !Number.isInteger(value) || value < 0) ||
    pointsPerVisit < 1 ||
    tierOneMinVisits < 1 ||
    tierTwoMinVisits < 1 ||
    vipMinVisits < 1
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Preencha título, níveis e quantidades válidas para o programa de fidelidade.",
        "error",
      ),
    );
  }

  if (
    percentFields.some(
      (value) => Number.isNaN(value) || value < 0 || value > 100,
    )
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Cashback e descontos precisam ficar entre 0% e 100%.",
        "error",
      ),
    );
  }

  if (
    !(tierOneMinVisits < tierTwoMinVisits && tierTwoMinVisits < vipMinVisits)
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "As visitas mínimas precisam crescer do primeiro nível até o VIP.",
        "error",
      ),
    );
  }

  if (
    !(
      tierOneDiscountPercent <= tierTwoDiscountPercent &&
      tierTwoDiscountPercent <= vipDiscountPercent
    )
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Os descontos progressivos precisam crescer do primeiro nível até o VIP.",
        "error",
      ),
    );
  }

  if (vipRewardServiceId) {
    const { data: vipRewardService } = await supabase
      .from("services")
      .select("id, name")
      .eq("id", vipRewardServiceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (!vipRewardService) {
      redirect(
        buildRedirectNotice(
          COMMERCIAL_LOYALTY_PATH,
          "Escolha um serviço válido para a recompensa do nível Ouro.",
          "error",
        ),
      );
    }

    vipRewardServiceName = vipRewardService.name;
  }

  const { error } = await supabase.from("salon_loyalty_programs").upsert(
    {
      salon_id: salon.id,
      title,
      description: description || null,
      points_per_visit: pointsPerVisit,
      cashback_percent: cashbackPercent,
      tier_one_name: tierOneName,
      tier_one_min_visits: tierOneMinVisits,
      tier_one_discount_percent: tierOneDiscountPercent,
      tier_two_name: tierTwoName,
      tier_two_min_visits: tierTwoMinVisits,
      tier_two_discount_percent: tierTwoDiscountPercent,
      vip_tier_name: vipTierName,
      vip_min_visits: vipMinVisits,
      vip_discount_percent: vipDiscountPercent,
      vip_reward_service_id: vipRewardServiceId || null,
      is_active: isActive,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Não foi possível salvar o programa de fidelidade.",
        "error",
      ),
    );
  }

  if (isActive) {
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: "loyalty_program_updated",
      title: "Seu clube de fidelidade foi atualizado",
      body: `${title}: cada visita soma ${pointsPerVisit} pontos, gera ${formatPercentLabel(cashbackPercent)}% de cashback e pode chegar até ${formatPercentLabel(vipDiscountPercent)}% de desconto no nível ${vipTierName}.${vipRewardServiceName ? ` Ao chegar lá, o salão também libera ${vipRewardServiceName} como recompensa.` : ""}`,
      payload: {
        type: "loyalty_program_updated",
        loyaltyTitle: title,
        vipRewardServiceName,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_LOYALTY_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_LOYALTY_PATH,
      "Programa de fidelidade atualizado com sucesso.",
      "success",
    ),
  );
}

export async function saveSalonGrowthAutomationActionImpl(formData: FormData) {
  const isActive = formData.get("isActive") === "on";
  const smartRebookIsActive = formData.get("smartRebookIsActive") === "on";
  const winbackInactiveDays = Number(formData.get("winbackInactiveDays") ?? 0);
  const winbackDiscountPercent = Number(
    formData.get("winbackDiscountPercent") ?? 0,
  );
  const winbackTitle = String(formData.get("winbackTitle") ?? "").trim();
  const winbackBodyTemplate = String(
    formData.get("winbackBodyTemplate") ?? "",
  ).trim();
  const smartRebookWindowDays = Number(
    formData.get("smartRebookWindowDays") ?? 0,
  );
  const smartRebookTitle = String(
    formData.get("smartRebookTitle") ?? "",
  ).trim();
  const smartRebookBodyTemplate = String(
    formData.get("smartRebookBodyTemplate") ?? "",
  ).trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const billing = await getSalonBillingEntitlements(salon.id);

  if (!billing.includesGrowthAutomation) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        `Automações inteligentes estão disponíveis a partir do plano Growth. O seu plano atual é ${billing.currentPlan.displayName}.`,
        "error",
      ),
    );
  }

  if (
    !Number.isInteger(winbackInactiveDays) ||
    winbackInactiveDays < 7 ||
    winbackInactiveDays > 365
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um prazo de inatividade entre 7 e 365 dias para a recuperação automática.",
        "error",
      ),
    );
  }

  if (
    !Number.isInteger(winbackDiscountPercent) ||
    winbackDiscountPercent < 0 ||
    winbackDiscountPercent > 100
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "O desconto de recuperação precisa ser um número inteiro entre 0% e 100%.",
        "error",
      ),
    );
  }

  if (!winbackTitle || winbackTitle.length > 120) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um título de até 120 caracteres para a campanha de recuperação.",
        "error",
      ),
    );
  }

  if (!winbackBodyTemplate || winbackBodyTemplate.length > 220) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Use um texto de até 220 caracteres para a mensagem automática de recuperação.",
        "error",
      ),
    );
  }

  if (
    !Number.isInteger(smartRebookWindowDays) ||
    smartRebookWindowDays < 1 ||
    smartRebookWindowDays > 14
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "A janela do rebook inteligente precisa ficar entre 1 e 14 dias.",
        "error",
      ),
    );
  }

  if (!smartRebookTitle || smartRebookTitle.length > 120) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um título de até 120 caracteres para o rebook inteligente.",
        "error",
      ),
    );
  }

  if (!smartRebookBodyTemplate || smartRebookBodyTemplate.length > 220) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Use um texto de até 220 caracteres para a mensagem de rebook inteligente.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("salon_growth_automation_settings")
    .upsert(
      {
        salon_id: salon.id,
        is_active: isActive,
        winback_inactive_days: winbackInactiveDays,
        winback_discount_percent: winbackDiscountPercent,
        winback_title: winbackTitle,
        winback_body_template: winbackBodyTemplate,
        smart_rebook_is_active: smartRebookIsActive,
        smart_rebook_window_days: smartRebookWindowDays,
        smart_rebook_title: smartRebookTitle,
        smart_rebook_body_template: smartRebookBodyTemplate,
      },
      { onConflict: "salon_id" },
    );

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Não foi possível salvar a automação de recuperação de clientes.",
        "error",
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  revalidateCommercialPaths(COMMERCIAL_AUTOMATIONS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_AUTOMATIONS_PATH,
      isActive
        ? `Automação comercial salva: winback em ${winbackInactiveDays} dias com ${formatPercentLabel(winbackDiscountPercent)}% e rebook inteligente ${smartRebookIsActive ? `ativo até ${smartRebookWindowDays} dias antes da janela ideal` : "pausado"}.`
        : "Automação comercial salva, mas o winback está pausado.",
      "success",
    ),
  );
}
