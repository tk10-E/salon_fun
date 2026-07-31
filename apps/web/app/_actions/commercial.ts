import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingEntitlements } from "@/lib/billing";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import {
  resolveMembershipLifecycleCopy,
  resolveMembershipOfferLabel,
} from "@/lib/membershipOffers";
import { createClient } from "@/lib/supabase/server";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";

import {
  buildRedirectNotice,
  COMMERCIAL_OVERVIEW_PATH,
  COMMERCIAL_AUTOMATIONS_PATH,
  COMMERCIAL_LOYALTY_PATH,
  COMMERCIAL_PROMOTIONS_PATH,
  COMMERCIAL_REFERRALS_PATH,
  formatPercentLabel,
  queueCustomerNotification,
  revalidateCommercialPaths,
  resolveDashboardReturnPath,
  SUBSCRIPTIONS_PATH,
} from "./shared";

const COMMERCIAL_OFFER_PATHS = [
  COMMERCIAL_PROMOTIONS_PATH,
  SUBSCRIPTIONS_PATH,
] as const;
const OFFER_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.offer;

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function buildOfferImagePath(
  salonId: string,
  fileId: string,
  extension: string,
) {
  return `${salonId}/offers/${fileId}.${extension}`;
}

async function uploadOfferImage(args: {
  imageFile: File;
  redirectPath: string;
  salonId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  if (!args.imageFile.type.startsWith("image/")) {
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        "Envie uma imagem válida para a assinatura.",
        "error",
      ),
    );
  }

  if (args.imageFile.size > OFFER_IMAGE_PRESET.maxInputBytes) {
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        `A foto da assinatura deve ter no máximo ${formatPresetMegabytes(
          OFFER_IMAGE_PRESET.maxInputBytes,
        )} MB.`,
        "error",
      ),
    );
  }

  let optimizedImage;

  try {
    optimizedImage = await optimizeUploadedImage(args.imageFile, "offer");
  } catch {
    redirect(
      buildRedirectNotice(
        args.redirectPath,
        "Não foi possível processar a foto da assinatura.",
        "error",
      ),
    );
  }

  const imagePath = buildOfferImagePath(
    args.salonId,
    randomUUID(),
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
        "Não foi possível enviar a foto da assinatura.",
        "error",
      ),
    );
  }

  return imagePath;
}

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
  membershipValidityDays?: number | null;
  startsOn: string | null;
}) {
  const typePrefix = args.kind === "membership" ? "membership" : "promotion";
  const membershipLabel =
    args.kind === "membership"
      ? resolveMembershipLifecycleCopy(args.membershipValidityDays)
      : null;
  const notificationTitle =
    args.action === "created"
      ? args.kind === "membership"
        ? `Novo ${membershipLabel} no salão`
        : "Nova promoção no salão"
      : args.kind === "membership"
        ? `${resolveMembershipOfferLabel(args.membershipValidityDays)} atualizado`
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
  const redirectPath = resolveDashboardReturnPath(
    formData,
    COMMERCIAL_PROMOTIONS_PATH,
    COMMERCIAL_OFFER_PATHS,
  );
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
  const imageFile = readUploadedFile(formData, "offerImage");
  const priceValue = String(formData.get("price") ?? "").trim();
  const startsOnValue = String(formData.get("startsOn") ?? "").trim();
  const endsOnValue = String(formData.get("endsOn") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  let imagePath: string | null = null;

  if (
    !["promotion", "membership"].includes(kind) ||
    !title ||
    Number.isNaN(sortOrder) ||
    sortOrder < 0
  ) {
    redirect(
      buildRedirectNotice(
        redirectPath,
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
        redirectPath,
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
        redirectPath,
        "A data final precisa ser igual ou posterior à data inicial.",
        "error",
      ),
    );
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(
      buildRedirectNotice(
        redirectPath,
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
        redirectPath,
        "Preencha serviço, sessões e validade para publicar um plano ou pacote operacional.",
        "error",
      ),
    );
  }

  if (imageFile) {
    imagePath = await uploadOfferImage({
      imageFile,
      redirectPath,
      salonId: salon.id,
      supabase,
    });
  }

  const { error } = await supabase.from("salon_offers").insert({
    salon_id: salon.id,
    kind,
    title,
    description: description || null,
    highlight_text: highlightText || null,
    image_path: imagePath,
    membership_service_id: membershipServiceId || null,
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
    if (imagePath) {
      await supabase.storage
        .from("salon-assets")
        .remove([imagePath])
        .catch(() => undefined);
    }
    redirect(
      buildRedirectNotice(
        redirectPath,
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
      membershipValidityDays,
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

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH, SUBSCRIPTIONS_PATH);
  redirect(
    buildRedirectNotice(redirectPath, "Oferta salva com sucesso.", "success"),
  );
}

export async function updateSalonOfferActionImpl(formData: FormData) {
  const redirectPath = resolveDashboardReturnPath(
    formData,
    COMMERCIAL_PROMOTIONS_PATH,
    COMMERCIAL_OFFER_PATHS,
  );
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
  const removeImage = formData.get("removeImage") === "on";
  const imageFile = readUploadedFile(formData, "offerImage");
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
        redirectPath,
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
        redirectPath,
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
        redirectPath,
        "A data final precisa ser igual ou posterior à data inicial.",
        "error",
      ),
    );
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(
      buildRedirectNotice(
        redirectPath,
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
        redirectPath,
        "Preencha serviço, sessões e validade para atualizar esse plano ou pacote.",
        "error",
      ),
    );
  }

  const { data: currentOffer, error: currentOfferError } = await supabase
    .from("salon_offers")
    .select("id, image_path")
    .eq("id", offerId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (currentOfferError || !currentOffer) {
    redirect(
      buildRedirectNotice(
        redirectPath,
        "Não foi possível localizar esta assinatura.",
        "error",
      ),
    );
  }

  const previousImagePath = currentOffer.image_path ?? null;
  let nextImagePath = previousImagePath;
  let uploadedImagePath: string | null = null;

  if (imageFile) {
    uploadedImagePath = await uploadOfferImage({
      imageFile,
      redirectPath,
      salonId: salon.id,
      supabase,
    });
    nextImagePath = uploadedImagePath;
  } else if (removeImage) {
    nextImagePath = null;
  }

  const { error } = await supabase
    .from("salon_offers")
    .update({
      kind,
      title,
      description: description || null,
      highlight_text: highlightText || null,
      image_path: nextImagePath,
      membership_service_id: membershipServiceId || null,
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
    if (uploadedImagePath) {
      await supabase.storage
        .from("salon-assets")
        .remove([uploadedImagePath])
        .catch(() => undefined);
    }
    redirect(
      buildRedirectNotice(
        redirectPath,
        "Não foi possível atualizar a oferta.",
        "error",
      ),
    );
  }

  if (previousImagePath && previousImagePath !== nextImagePath) {
    await supabase.storage
      .from("salon-assets")
      .remove([previousImagePath])
      .catch(() => undefined);
  }

  if (isActive) {
    const notification = buildOfferNotification({
      action: "updated",
      kind,
      title,
      highlightText,
      membershipValidityDays,
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

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH, SUBSCRIPTIONS_PATH);
  redirect(
    buildRedirectNotice(
      redirectPath,
      "Oferta atualizada com sucesso.",
      "success",
    ),
  );
}

export async function deleteSalonOfferActionImpl(formData: FormData) {
  const redirectPath = resolveDashboardReturnPath(
    formData,
    COMMERCIAL_PROMOTIONS_PATH,
    COMMERCIAL_OFFER_PATHS,
  );
  const offerId = String(formData.get("offerId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!offerId) {
    redirect(buildRedirectNotice(redirectPath, "Oferta inválida.", "error"));
  }

  const { data: currentOffer, error: currentOfferError } = await supabase
    .from("salon_offers")
    .select("id, image_path")
    .eq("id", offerId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (currentOfferError || !currentOffer) {
    redirect(
      buildRedirectNotice(
        redirectPath,
        "Não foi possível localizar esta oferta.",
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
        redirectPath,
        "Não foi possível remover a oferta.",
        "error",
      ),
    );
  }

  if (currentOffer.image_path) {
    await supabase.storage
      .from("salon-assets")
      .remove([currentOffer.image_path])
      .catch(() => undefined);
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH, SUBSCRIPTIONS_PATH);
  redirect(
    buildRedirectNotice(
      redirectPath,
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

export async function markReferralRewardRedeemedActionImpl(formData: FormData) {
  const redirectPath = resolveDashboardReturnPath(
    formData,
    COMMERCIAL_REFERRALS_PATH,
    [COMMERCIAL_OVERVIEW_PATH, COMMERCIAL_REFERRALS_PATH],
  );
  const unlockId = String(formData.get("unlockId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!unlockId) {
    redirect(
      buildRedirectNotice(redirectPath, "Recompensa inválida.", "error"),
    );
  }

  const { data: rewardUnlock, error } = await supabase
    .from("salon_referral_reward_unlocks")
    .update({
      redeemed_at: new Date().toISOString(),
      status: "redeemed",
    })
    .eq("id", unlockId)
    .eq("salon_id", salon.id)
    .eq("status", "available")
    .select("id")
    .maybeSingle();

  if (error || !rewardUnlock?.id) {
    redirect(
      buildRedirectNotice(
        redirectPath,
        "Não foi possível marcar a recompensa como entregue.",
        "error",
      ),
    );
  }

  revalidateCommercialPaths(COMMERCIAL_REFERRALS_PATH);
  redirect(
    buildRedirectNotice(
      redirectPath,
      "Recompensa marcada como entregue.",
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
