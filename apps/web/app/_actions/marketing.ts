import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { recordAiGenerationAudit } from "@/lib/ai/audit";
import {
  generateMarketingCampaignMessageWithAi,
  isMarketingCampaignAiEnabled,
} from "@/lib/ai/marketingCampaign";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  MARKETING_CAMPAIGN_PROMPT_PROFILE,
  MARKETING_CAMPAIGN_PROMPT_VERSION,
} from "@/lib/ai/prompts/marketingCampaignPrompt";
import {
  LEGACY_MANAGEMENT_ROUTES,
  MANAGEMENT_ROUTES,
} from "@/lib/management-navigation";
import { createClient } from "@/lib/supabase/server";

import {
  buildRedirectNotice,
  prepareCustomerNotificationPayload,
  truncateNotificationText,
} from "./shared";

const MARKETING_PATH = "/dashboard/benefits";
const CUSTOMERS_PATH = MANAGEMENT_ROUTES.clients;
const LEGACY_CUSTOMERS_PATH = LEGACY_MANAGEMENT_ROUTES.customers;
const NOTIFICATIONS_PATH = "/dashboard/notifications";

type MarketingCampaignType = "birthday_campaign" | "manual_reactivation";

function normalizeText(value: FormDataEntryValue | null, maxLength: number) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeInteger(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function normalizeLegacyCustomersReturnPath(path: string) {
  if (!path.startsWith(LEGACY_CUSTOMERS_PATH)) {
    return path;
  }

  return `${CUSTOMERS_PATH}${path.slice(LEGACY_CUSTOMERS_PATH.length)}`;
}

function resolveMarketingReturnPath(value: FormDataEntryValue | null) {
  const path = String(value ?? "").trim();

  if (path.startsWith(MARKETING_PATH) || path.startsWith(CUSTOMERS_PATH)) {
    return path;
  }

  if (path.startsWith(LEGACY_CUSTOMERS_PATH)) {
    return normalizeLegacyCustomersReturnPath(path);
  }

  return MARKETING_PATH;
}

function normalizeCampaignType(
  value: FormDataEntryValue | null,
): MarketingCampaignType | null {
  const normalized = String(value ?? "").trim();

  if (normalized === "birthday_campaign" || normalized === "manual_reactivation") {
    return normalized;
  }

  return null;
}

function customerFirstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "Cliente";
}

function fillTemplate(
  template: string,
  replacements: Record<string, string | number | null | undefined>,
) {
  return Object.entries(replacements).reduce((content, [key, value]) => {
    const normalizedValue = value == null ? "" : String(value);
    return content.replaceAll(`{${key}}`, normalizedValue);
  }, template);
}

export async function sendMarketingCustomerCampaignActionImpl(formData: FormData) {
  const campaignType = normalizeCampaignType(formData.get("campaignType"));
  const customerId = String(formData.get("customerId") ?? "").trim();
  const fallbackCustomerName =
    normalizeText(formData.get("customerName"), 120) ?? "Cliente do salão";
  const serviceName = normalizeText(formData.get("serviceName"), 120);
  const inactiveDays = normalizeInteger(formData.get("inactiveDays"));
  const messageTitleOverride = normalizeText(formData.get("messageTitle"), 90);
  const messageBodyOverride = normalizeText(formData.get("messageBody"), 320);
  const returnPath = resolveMarketingReturnPath(formData.get("returnPath"));

  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();

  if (!campaignType || !customerId) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Não foi possível identificar a cliente desta campanha.",
        "error",
      ),
    );
  }

  const [customerResult, automationSettingsResult, activeOfferResult] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, name")
        .eq("salon_id", salon.id)
        .eq("id", customerId)
        .maybeSingle(),
      supabase
        .from("salon_growth_automation_settings")
        .select(
          "winback_inactive_days, winback_discount_percent, winback_title, winback_body_template",
        )
        .eq("salon_id", salon.id)
        .maybeSingle(),
      supabase
        .from("salon_offers")
        .select("id, title, kind")
        .eq("salon_id", salon.id)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);

  if (customerResult.error || !customerResult.data) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Não foi possível localizar essa cliente para disparar a campanha.",
        "error",
      ),
    );
  }

  const customerName = customerResult.data.name?.trim() || fallbackCustomerName;
  const firstName = customerFirstName(customerName);
  const activeOfferTitle = normalizeText(activeOfferResult.data?.title ?? null, 120);
  const automationSettings = automationSettingsResult.data;
  const discountPercent = Number(automationSettings?.winback_discount_percent ?? 10);
  const resolvedInactiveDays =
    inactiveDays ?? Number(automationSettings?.winback_inactive_days ?? 30);
  const resolvedServiceName = serviceName ?? "atendimento";

  let notificationType: string;
  let title: string;
  let body: string;
  let successMessage: string;
  let payload: Record<string, string | number | boolean | null> = {
    type: campaignType,
  };

  if (campaignType === "birthday_campaign") {
    notificationType = "birthday_campaign";
    title = activeOfferTitle
      ? "Seu presente de aniversário já está no app"
      : "Seu mês ganhou um cuidado especial";
    body = activeOfferTitle
      ? `${firstName}, o salão separou ${activeOfferTitle} para comemorar seu mês. Abra o app e veja a condição especial da sua próxima visita.`
      : `${firstName}, seu mês chegou e o salão deixou uma condição especial pronta no app para a sua próxima visita.`;
    successMessage = "Mensagem de aniversário enviada para o app.";
    payload = {
      ...payload,
      offerTitle: activeOfferTitle,
    };
  } else {
    const defaultBody =
      "Já faz {inactive_days} dias desde seu último {service_name}. Abra o app e confira a condição separada para seu retorno.";

    notificationType = "manual_reactivation";
    title = fillTemplate(
      automationSettings?.winback_title?.trim() || "Hora de voltar para o salão",
      {
        customer_name: firstName,
        discount: discountPercent,
        inactive_days: resolvedInactiveDays,
        service_name: resolvedServiceName,
      },
    ).slice(0, 90);
    body = fillTemplate(
      automationSettings?.winback_body_template?.trim() || defaultBody,
      {
        customer_name: firstName,
        discount: discountPercent,
        inactive_days: resolvedInactiveDays,
        service_name: resolvedServiceName,
      },
    );
    successMessage = "Mensagem de reativação enviada para o app.";
    payload = {
      ...payload,
      discountPercent,
      inactiveDays: resolvedInactiveDays,
      offerTitle: activeOfferTitle,
      serviceName: resolvedServiceName,
    };
  }

  if (messageTitleOverride) {
    title = messageTitleOverride;
  }

  if (messageBodyOverride) {
    body = messageBodyOverride;
  } else if (isMarketingCampaignAiEnabled()) {
    try {
      const aiDraft = await generateMarketingCampaignMessageWithAi({
        activeOfferTitle,
        campaignType,
        customerName,
        discountPercent:
          campaignType === "manual_reactivation" ? discountPercent : null,
        inactiveDays:
          campaignType === "manual_reactivation" ? resolvedInactiveDays : null,
        salonName: salon.name,
        serviceName:
          campaignType === "manual_reactivation" ? resolvedServiceName : null,
      });

      title = aiDraft.title;
      body = aiDraft.body;
      payload = {
        ...payload,
        aiGenerated: true,
        aiModel: aiDraft.model,
      };
      await recordAiGenerationAudit({
        actorUserId: user.id,
        feature: AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
        metadata: {
          aiModel: aiDraft.model,
          campaignType,
          usedFallback: aiDraft.model.includes("(fallback)"),
        },
        outcome: "generated",
        promptProfile: MARKETING_CAMPAIGN_PROMPT_PROFILE,
        promptVersion: MARKETING_CAMPAIGN_PROMPT_VERSION,
        requestPath: MARKETING_PATH,
        salonId: salon.id,
        targetId: customerId,
        targetType: "customer",
      });
    } catch {
      payload = {
        ...payload,
        aiGenerated: false,
      };
      await recordAiGenerationAudit({
        actorUserId: user.id,
        feature: AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
        metadata: {
          campaignType,
        },
        outcome: "failed",
        promptProfile: MARKETING_CAMPAIGN_PROMPT_PROFILE,
        promptVersion: MARKETING_CAMPAIGN_PROMPT_VERSION,
        requestPath: MARKETING_PATH,
        salonId: salon.id,
        targetId: customerId,
        targetType: "customer",
      });
    }
  }

  const { error } = await supabase.from("salon_customer_notifications").insert({
    salon_id: salon.id,
    customer_id: customerId,
    audience: "single_customer",
    notification_type: notificationType,
    title: title.trim() || "Aviso do salão",
    body: truncateNotificationText(body),
    payload: prepareCustomerNotificationPayload(notificationType, payload),
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Não foi possível enviar a campanha para esta cliente agora.",
        "error",
      ),
    );
  }

  revalidatePath(MARKETING_PATH);
  revalidatePath(CUSTOMERS_PATH);
  revalidatePath(NOTIFICATIONS_PATH);
  redirect(buildRedirectNotice(returnPath, successMessage, "success"));
}
