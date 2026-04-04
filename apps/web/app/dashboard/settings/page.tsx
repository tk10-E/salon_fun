import Image from "next/image";
import Link from "next/link";

import {
  regenerateSalonCodeAction,
  updateSalonBookingPolicyAction,
  updateSalonBrandingAction,
  updateSalonScheduleAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { FlashMessage } from "@/components/FlashMessage";
import { PremiumImageCropField } from "@/components/PremiumImageCropField";
import { requireOwnerSalon } from "@/lib/auth";
import { CLIENT_APP_IMAGE_VARIANT_SPECS } from "@/lib/clientAppImageVariants";
import {
  CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS,
  CLIENT_APP_BANNER_STYLE_OPTIONS,
  CLIENT_APP_BUTTON_STYLE_OPTIONS,
  CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS,
  CLIENT_APP_CAMPAIGN_TARGET_OPTIONS,
  CLIENT_APP_CARD_STYLE_OPTIONS,
  CLIENT_APP_HOME_MODULE_OPTIONS,
  CLIENT_APP_THEME_MODE_OPTIONS,
  CLIENT_EXPERIENCE_MODEL_OPTIONS,
  CLIENT_APP_VISUAL_STYLE_OPTIONS,
  CLIENT_HOME_EMPHASIS_OPTIONS,
  getClientAppBannerStyleOption,
  getClientAppButtonStyleOption,
  getClientAppCampaignAudienceOption,
  getClientAppCampaignPriorityOption,
  getClientAppCampaignTargetOption,
  getClientAppCardStyleOption,
  getClientAppThemeModeOption,
  getClientExperienceModelOption,
  getClientAppVisualStyleOption,
  getClientHomeEmphasisOption,
  normalizeSalonClientAppConfig,
  resolveClientExperienceModel,
  resolveClientAppVisualStyle,
  resolveClientHomeEmphasis,
} from "@/lib/clientAppConfig";
import {
  SALON_TIMEZONE_OPTIONS,
  SLOT_STEP_OPTIONS,
  WEEKDAY_OPTIONS,
  formatBusinessTime,
} from "@/lib/schedule";
import {
  getSalonSegmentPreset,
  SALON_SEGMENT_OPTIONS,
} from "@/lib/salonSegments";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/formatters";

type SettingsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

function formatDateTimeLocalFieldValue(value: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }

  const shortIsoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (shortIsoMatch) {
    return shortIsoMatch[1];
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const localTime = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000,
  );
  return localTime.toISOString().slice(0, 16);
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const readinessWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [
    businessHoursResponse,
    servicesCountResult,
    postsCountResult,
    offersCountResult,
    notificationsCountResult,
    pushTokensCountResult,
    recentPushTokensResult,
    instagramConnectionCountResult,
  ] = await Promise.all([
    supabase
      .from("salon_business_hours")
      .select("weekday, is_open, opens_at, closes_at")
      .eq("salon_id", salon.id)
      .order("weekday"),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_posts")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_customer_notifications")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", readinessWindowStart),
    supabase
      .from("customer_push_tokens")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("customer_push_tokens")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .gte("last_seen_at", readinessWindowStart),
    supabase
      .from("instagram_connections")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
  ]);
  const brandColor = salon.brand_color ?? "#C56B43";
  const segmentPreset = getSalonSegmentPreset(salon.business_segment);
  const clientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
  const experienceModelOption = getClientExperienceModelOption(
    clientAppConfig.experienceModel,
  );
  const visualStyleOption = getClientAppVisualStyleOption(
    clientAppConfig.visualStyle,
  );
  const emphasisOption = getClientHomeEmphasisOption(
    clientAppConfig.homeEmphasis,
  );
  const resolvedExperienceModel = resolveClientExperienceModel(
    clientAppConfig.experienceModel,
    segmentPreset.value,
  );
  const resolvedVisualStyle = resolveClientAppVisualStyle(
    clientAppConfig.visualStyle,
    segmentPreset.value,
    clientAppConfig.experienceModel,
  );
  const resolvedHomeEmphasis = resolveClientHomeEmphasis(
    clientAppConfig.homeEmphasis,
    segmentPreset.value,
    clientAppConfig.experienceModel,
  );
  const timezone = salon.timezone ?? "America/Sao_Paulo";
  const slotStepMinutes = salon.slot_step_minutes ?? 30;
  const bookingPolicyEnabled = salon.booking_policy_enabled ?? false;
  const bookingPolicyTitle = salon.booking_policy_title ?? "Reserva protegida";
  const bookingPolicySummary = salon.booking_policy_summary ?? "";
  const bookingPolicyCancellationWindowHours =
    salon.booking_policy_cancellation_window_hours ?? 24;
  const bookingPolicyConfirmationRequired =
    salon.booking_policy_confirmation_required ?? true;
  const bookingPolicyConfirmationLeadMinutes =
    salon.booking_policy_confirmation_lead_minutes ?? 30;
  const bookingPolicyAutoCancelUnconfirmed =
    salon.booking_policy_auto_cancel_unconfirmed ?? true;
  const bookingPolicyAutoCancelLeadMinutes =
    salon.booking_policy_auto_cancel_lead_minutes ?? 10;
  const bookingPolicyAutoCancelPendingDeposit =
    salon.booking_policy_auto_cancel_pending_deposit ?? false;
  const bookingPolicyDepositReminderLeadHours =
    salon.booking_policy_deposit_reminder_lead_hours ?? 6;
  const bookingPolicyPaymentMode =
    salon.booking_policy_payment_mode ?? "manual";
  const bookingPolicyAsaasEnvironment =
    salon.booking_policy_asaas_environment ?? "sandbox";
  const bookingPolicyAsaasApiKey = salon.booking_policy_asaas_api_key ?? "";
  const bookingPolicyAsaasWebhookToken =
    salon.booking_policy_asaas_webhook_token ?? "";
  const bookingPolicyPixKey = salon.booking_policy_pix_key ?? "";
  const bookingPolicyPixRecipientName =
    salon.booking_policy_pix_recipient_name ?? "";
  const bookingPolicyPixRecipientCity =
    salon.booking_policy_pix_recipient_city ?? "";
  const bookingPolicyExternalCheckoutUrl =
    salon.booking_policy_external_checkout_url ?? "";
  const bookingPolicyRequiresDeposit =
    salon.booking_policy_requires_deposit ?? false;
  const bookingPolicyDepositAmount =
    salon.booking_policy_deposit_amount != null
      ? Number(salon.booking_policy_deposit_amount)
      : null;
  const bookingPolicyPaymentInstructions =
    salon.booking_policy_payment_instructions ?? "";
  const bookingPolicyVersion =
    salon.booking_policy_version ?? "2026-04-booking-policy-v1";
  const bookingPolicyPaymentModeLabel =
    bookingPolicyPaymentMode === "pix"
      ? "Pix direto no app"
      : bookingPolicyPaymentMode === "asaas_pix"
        ? "Pix automatico via Asaas"
        : bookingPolicyPaymentMode === "external_checkout"
          ? "Checkout externo"
          : "Operação manual";
  const bookingPolicyPaymentModeDescription =
    bookingPolicyPaymentMode === "pix"
      ? "A cliente copia o Pix no app e avisa a equipe quando pagar."
      : bookingPolicyPaymentMode === "asaas_pix"
        ? "O sistema cria uma cobranca Pix por reserva e confirma o sinal automaticamente quando o Asaas avisar o webhook."
        : bookingPolicyPaymentMode === "external_checkout"
          ? "A cliente abre um checkout externo configurado pelo salão para concluir o sinal."
          : "A equipe segue manualmente com a cobrança usando as orientações do salão.";
  const bookingPolicyAsaasWebhookUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ""}/functions/v1/asaas-webhook`;
  const logoUrl = salon.logo_path
    ? supabase.storage.from("salon-assets").getPublicUrl(salon.logo_path).data
        .publicUrl
    : null;
  const salonName = salon.name?.trim() || "Salão";
  const initials = salonName.slice(0, 2).toUpperCase();
  const businessHoursMap = new Map(
    (businessHoursResponse.data ?? []).map((entry) => [
      entry.weekday,
      {
        is_open: entry.is_open,
        opens_at: entry.opens_at,
        closes_at: entry.closes_at,
      },
    ]),
  );
  const businessHours = WEEKDAY_OPTIONS.map((weekday) => ({
    ...weekday,
    ...(businessHoursMap.get(weekday.value) ?? {
      is_open: weekday.value !== 0,
      opens_at: weekday.value === 0 ? null : "09:00:00",
      closes_at: weekday.value === 0 ? null : "18:00:00",
    }),
  }));
  const timezoneLabel =
    SALON_TIMEZONE_OPTIONS.find((option) => option.value === timezone)?.label ??
    timezone;
  const slotStepLabel =
    SLOT_STEP_OPTIONS.find((option) => option.value === slotStepMinutes)
      ?.label ?? `${slotStepMinutes} min`;
  const openDaysCount = businessHours.filter((entry) => entry.is_open).length;
  const resolvedVisualStyleLabel =
    CLIENT_APP_VISUAL_STYLE_OPTIONS.find(
      (option) => option.value === resolvedVisualStyle,
    )?.label ?? visualStyleOption.label;
  const resolvedExperienceModelOption =
    CLIENT_EXPERIENCE_MODEL_OPTIONS.find(
      (option) => option.value === resolvedExperienceModel,
    ) ?? experienceModelOption;
  const resolvedExperienceModelLabel = resolvedExperienceModelOption.label;
  const resolvedHomeEmphasisLabel =
    CLIENT_HOME_EMPHASIS_OPTIONS.find(
      (option) => option.value === resolvedHomeEmphasis,
    )?.label ?? emphasisOption.label;
  const themeModeOption = getClientAppThemeModeOption(
    clientAppConfig.themeMode,
  );
  const buttonStyleOption = getClientAppButtonStyleOption(
    clientAppConfig.buttonStyle,
  );
  const cardStyleOption = getClientAppCardStyleOption(
    clientAppConfig.cardStyle,
  );
  const bannerStyleOption = getClientAppBannerStyleOption(
    clientAppConfig.bannerStyle,
  );
  const selectedHomeModules = CLIENT_APP_HOME_MODULE_OPTIONS.filter((option) =>
    clientAppConfig.visibleHomeModules.includes(option.value),
  );
  const centralCampaignSlots = Array.from({ length: 3 }, (_, index) => {
    const existing = clientAppConfig.centralCampaigns[index];
    return {
      id: existing?.id ?? `campaign-${index + 1}`,
      isActive: existing?.isActive ?? index == 0,
      priority: existing?.priority ?? (index === 0 ? "high" : "medium"),
      priorityOption: getClientAppCampaignPriorityOption(
        existing?.priority ?? (index === 0 ? "high" : "medium"),
      ),
      startsAt: formatDateTimeLocalFieldValue(existing?.startsAt ?? null),
      endsAt: formatDateTimeLocalFieldValue(existing?.endsAt ?? null),
      audience: existing?.audience ?? "all",
      audienceOption: getClientAppCampaignAudienceOption(
        existing?.audience ?? "all",
      ),
      eyebrow: existing?.eyebrow ?? "",
      title: existing?.title ?? "",
      message: existing?.message ?? "",
      campaignLabel: existing?.campaignLabel ?? "",
      ctaLabel: existing?.ctaLabel ?? "",
      ctaTarget: existing?.ctaTarget ?? "explore",
      ctaTargetOption: getClientAppCampaignTargetOption(
        existing?.ctaTarget ?? "explore",
      ),
    };
  });
  const heroImageFocusX = clientAppConfig.heroImageFocusX ?? 50;
  const heroImageFocusY = clientAppConfig.heroImageFocusY ?? 50;
  const previewHeroImageUrl =
    clientAppConfig.heroImageVariantUrl ?? clientAppConfig.heroImageUrl;
  const heroImageEditorUrl =
    typeof clientAppConfig.rawConfig.heroImageSourceUrl === "string"
      ? clientAppConfig.rawConfig.heroImageSourceUrl
      : clientAppConfig.heroImageUrl;
  const galleryImageEditorUrl =
    typeof clientAppConfig.rawConfig.galleryCoverImageSourceUrl === "string"
      ? clientAppConfig.rawConfig.galleryCoverImageSourceUrl
      : clientAppConfig.galleryCoverImageUrl;
  const profileCoverEditorUrl =
    typeof clientAppConfig.rawConfig.profileCoverImageSourceUrl === "string"
      ? clientAppConfig.rawConfig.profileCoverImageSourceUrl
      : clientAppConfig.profileCoverImageUrl;
  const heroImageSpec = CLIENT_APP_IMAGE_VARIANT_SPECS.hero;
  const galleryImageSpec = CLIENT_APP_IMAGE_VARIANT_SPECS.galleryCover;
  const profileCoverSpec = CLIENT_APP_IMAGE_VARIANT_SPECS.profileCover;
  const servicesCount = servicesCountResult.count ?? 0;
  const postsCount = postsCountResult.count ?? 0;
  const activeOffersCount = offersCountResult.count ?? 0;
  const recentNotificationsCount = notificationsCountResult.count ?? 0;
  const activePushTokensCount = pushTokensCountResult.count ?? 0;
  const recentPushTokensCount = recentPushTokensResult.count ?? 0;
  const instagramConnectionCount = instagramConnectionCountResult.count ?? 0;
  const publicSalonPath = `/s/${salon.join_code}`;
  const hasTagline = Boolean(salon.tagline?.trim());
  const hasWhatsApp = Boolean(salon.whatsapp_phone?.trim());
  const hasHeroImage = Boolean(previewHeroImageUrl);
  const hasGalleryCoverImage = Boolean(
    clientAppConfig.galleryCoverImageVariantUrl ??
    clientAppConfig.galleryCoverImageUrl,
  );
  const hasProfileCoverImage = Boolean(
    clientAppConfig.profileCoverImageVariantUrl ??
    clientAppConfig.profileCoverImageUrl,
  );
  const brandCoverageCount = [
    Boolean(logoUrl),
    hasTagline,
    hasWhatsApp,
    hasHeroImage,
    hasGalleryCoverImage,
    hasProfileCoverImage,
  ].filter(Boolean).length;
  const missingBrandSignals = [
    logoUrl ? null : "logo",
    hasTagline ? null : "tagline",
    hasWhatsApp ? null : "WhatsApp",
    hasHeroImage ? null : "hero",
    hasGalleryCoverImage ? null : "capa da galeria",
    hasProfileCoverImage ? null : "capa do perfil",
  ].filter((value): value is string => Boolean(value));
  const brandCoverageNote = missingBrandSignals.length
    ? `Ativos ${brandCoverageCount}/6. Próximos pontos: ${missingBrandSignals
        .slice(0, 2)
        .join(" e ")}${missingBrandSignals.length > 2 ? "..." : ""}.`
    : "Logo, contato, textos e capas principais já deixam a marca pronta para vender no app.";
  const readinessCards = [
    {
      href: "/dashboard/services",
      eyebrow: "Catálogo",
      title: "Vitrine e catálogo",
      value: `${servicesCount} serviços`,
      note: `${postsCount} posts e ${activeOffersCount} ofertas ativas já abastecem o app do cliente.`,
      tone: servicesCount > 0 ? ("accent" as const) : ("warm" as const),
    },
    {
      href: "/dashboard/feed",
      eyebrow: "Conteúdo",
      title: "Feed e prova social",
      value: `${postsCount} posts`,
      note:
        postsCount > 0
          ? "Publicações reais ajudam a transformar desejo em agenda."
          : "O feed está pronto para começar a vender resultado com prova social real.",
      tone: postsCount > 0 ? ("success" as const) : ("soft" as const),
    },
    {
      href: "/dashboard/notifications",
      eyebrow: "Alcance",
      title: "Push e comunicação",
      value: `${activePushTokensCount} dispositivos`,
      note:
        activePushTokensCount > 0
          ? `${recentPushTokensCount} ativos nos últimos 30 dias e ${recentNotificationsCount} avisos recentes no histórico.`
          : "Sem dispositivos ativos ainda. O app já está pronto para captar instalações e reativação.",
      tone:
        activePushTokensCount > 0 ? ("success" as const) : ("warm" as const),
    },
    {
      href: "/dashboard/instagram",
      eyebrow: "Social commerce",
      title: "Instagram e menções",
      value: instagramConnectionCount > 0 ? "Meta conectada" : "Conectar Meta",
      note:
        instagramConnectionCount > 0
          ? "A conta já pode puxar menções, revisão e conteúdo para o app do cliente."
          : "Conecte Instagram/Facebook para liberar menções reais e mais repertório comercial.",
      tone:
        instagramConnectionCount > 0 ? ("accent" as const) : ("soft" as const),
    },
    {
      href: "/dashboard/settings#brand-identity",
      eyebrow: "Marca",
      title: "Identidade pronta",
      value: `${brandCoverageCount}/6 ativos`,
      note: brandCoverageNote,
      tone: brandCoverageCount >= 4 ? ("soft" as const) : ("warm" as const),
    },
    {
      href: "/dashboard/settings#brand-identity",
      eyebrow: "Modelo do app",
      title: "Experiência do cliente",
      value: `${selectedHomeModules.length} módulos`,
      note: `${resolvedExperienceModelLabel}, ${resolvedVisualStyleLabel.toLowerCase()} e ${(themeModeOption?.label ?? "tema automático").toLowerCase()}.`,
      tone: "soft" as const,
    },
    {
      href: "/dashboard/settings#agenda-online",
      eyebrow: "Agenda",
      title: "Reserva online",
      value: `${openDaysCount} dias`,
      note: `${slotStepLabel} entre horários e fuso ${timezoneLabel}.`,
      tone: "success" as const,
    },
    {
      href: publicSalonPath,
      eyebrow: "Go live",
      title: "Vitrine pública",
      value: salon.join_code,
      note: "Esse link cai direto no salão certo e já funciona como porta de entrada para o app.",
      tone: "accent" as const,
    },
  ];

  return (
    <div className="page-grid workspace-page settings-page">
      <DashboardWorkspaceHero
        eyebrow="Configuração de marca"
        title="Marca, agenda e modelo do app do cliente em uma área só."
        description="Essa tela virou a central de identidade do produto: o salão define nome, cor, logo, ritmo da agenda e o tipo de experiência visual que o cliente sente no app, sem sair dos dados reais de produção."
        highlight={{
          label: "Modelo ativo do app",
          value: resolvedExperienceModelLabel,
          note: `${resolvedVisualStyleLabel} como visual, ${resolvedHomeEmphasisLabel.toLowerCase()} na home e CTA "${clientAppConfig.primaryCtaLabel || "Agendar agora"}".`,
        }}
        signals={[
          {
            label: "Segmento",
            value: segmentPreset.label,
            tone: "soft",
          },
          {
            label: "Agenda online",
            value: `${openDaysCount} dias`,
            tone: "success",
          },
          {
            label: "Intervalo",
            value: slotStepLabel,
            tone: "accent",
          },
        ]}
        stats={[
          {
            label: "Código do salão",
            value: "Pronto para uso",
            note: "Código usado para conectar clientes ao estabelecimento.",
            tone: "warm",
          },
          {
            label: "Fuso horário",
            value: timezoneLabel,
            note: "Base da agenda real exibida para o cliente.",
            tone: "soft",
          },
          {
            label: "Estilo resolvido",
            value: resolvedVisualStyleLabel,
            note: "Visual efetivo considerando segmento e configuração manual.",
            tone: "accent",
          },
          {
            label: "Modelo resolvido",
            value: resolvedExperienceModelLabel,
            note: "Arquitetura real da home que o cliente sente no app.",
            tone: "soft",
          },
          {
            label: "Criado em",
            value: formatDate(salon.created_at),
            note: "Data de entrada dessa operação na plataforma.",
            tone: "success",
          },
        ]}
        actions={
          <>
            <Link href={publicSalonPath} className="primary-button">
              Abrir vitrine pública
            </Link>
            <Link href="/dashboard/notifications" className="secondary-button">
              Push e avisos
            </Link>
            <Link href="/dashboard/instagram" className="secondary-button">
              Instagram
            </Link>
          </>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Direção do produto</span>
            <h3>
              {salonName} já pode ter uma experiência de marca mais própria.
            </h3>
            <p>
              O salão não fica preso a um visual genérico: você consegue moldar
              linguagem, hero, CTA, ritmo da agenda e apresentação da marca
              preservando a mesma base operacional do sistema.
            </p>
          </>
        }
      />

      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <section className="dashboard-capability-map">
        <div className="section-heading dashboard-capability-map__heading">
          <div>
            <span className="eyebrow">Prontidão real do produto</span>
            <h2>O que já está pronto para vender, operar e distribuir</h2>
            <p className="muted">
              Em vez de olhar só para layout, esta leitura mostra o que do app
              já tem conteúdo, alcance, agenda e marca funcionando com dados do
              próprio salão.
            </p>
          </div>
        </div>

        <div className="dashboard-capability-grid">
          {readinessCards.map((card) => (
            <article
              key={`${card.href}-${card.title}`}
              className={`dashboard-panel dashboard-capability-card dashboard-capability-card--${card.tone}`}
            >
              <div className="dashboard-capability-card__topline">
                <span className="workspace-panel__eyebrow">{card.eyebrow}</span>
                <strong>{card.value}</strong>
              </div>
              <div className="dashboard-capability-card__body">
                <h3>{card.title}</h3>
                <p>{card.note}</p>
              </div>
              <Link
                href={card.href}
                className="dashboard-capability-card__link"
              >
                Abrir frente
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section id="brand-identity" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Identidade do salão</h2>
            <p className="muted">
              Esses dados alimentam a experiência do app do cliente com cor,
              texto, logo e contato.
            </p>
          </div>
        </div>

        <div className="brand-settings-grid" style={{ marginTop: 18 }}>
          <div className="brand-preview-card">
            <div
              className="brand-preview-hero"
              style={{
                background: `linear-gradient(135deg, ${brandColor}, color-mix(in srgb, ${brandColor} 28%, white))`,
              }}
            >
              <div className="brand-preview-logo">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`Logo de ${salonName}`}
                    fill
                    sizes="82px"
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="brand-preview-copy">
                <span className="eyebrow">Preview do app</span>
                <h3>{salonName}</h3>
                <p>{salon.tagline || segmentPreset.description}</p>
              </div>
            </div>

            <div className="brand-preview-meta">
              <div>
                <span className="eyebrow">Segmento</span>
                <p>{segmentPreset.label}</p>
              </div>
              <div>
                <span className="eyebrow">WhatsApp</span>
                <p>{salon.whatsapp_phone || "Ainda não configurado"}</p>
              </div>
              <div>
                <span className="eyebrow">Cor principal</span>
                <div className="brand-color-chip">
                  <span style={{ backgroundColor: brandColor }} />
                  <strong>{brandColor}</strong>
                </div>
              </div>
            </div>

            <div className="brand-preview-mobile">
              <div className="brand-preview-mobile__frame">
                <div
                  className="brand-preview-mobile__hero"
                  style={{
                    background: `linear-gradient(145deg, ${brandColor}, color-mix(in srgb, ${brandColor} 18%, #2F231C))`,
                  }}
                >
                  <div className="brand-preview-mobile__brand">
                    <div className="brand-preview-mobile__logo">
                      {logoUrl ? (
                        <Image
                          src={logoUrl}
                          alt={`Preview de ${salonName}`}
                          fill
                          sizes="44px"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div>
                      <strong>{salonName}</strong>
                      <span>
                        {salon.tagline || segmentPreset.mobileSupport}
                      </span>
                    </div>
                  </div>

                  <div className="brand-preview-mobile__headline">
                    {segmentPreset.mobileHeadline}
                  </div>
                </div>

                <div className="brand-preview-mobile__cards">
                  {segmentPreset.previewCards.map((card) => (
                    <div
                      key={card.title}
                      className="brand-preview-mobile__card"
                    >
                      <span className="eyebrow">{card.eyebrow}</span>
                      <strong>{card.title}</strong>
                      <p>{card.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <form
            action={updateSalonBrandingAction}
            className="form-grid"
            encType="multipart/form-data"
          >
            <div className="field">
              <label htmlFor="name">Nome do salão</label>
              <input id="name" name="name" defaultValue={salon.name} required />
            </div>

            <div className="field">
              <label htmlFor="tagline">Descrição curta</label>
              <textarea
                id="tagline"
                name="tagline"
                defaultValue={salon.tagline ?? ""}
                rows={3}
                placeholder="Ex.: Escova, corte e manicure em um ambiente leve e acolhedor."
              />
            </div>

            <div className="field">
              <label htmlFor="businessSegment">Segmento do salão</label>
              <select
                id="businessSegment"
                name="businessSegment"
                defaultValue={segmentPreset.value}
              >
                {SALON_SEGMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small className="muted">
                Esse preset muda a linguagem, os destaques e a sensação do app
                do cliente sem trocar a estrutura do produto.
              </small>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="brandColor">Cor principal</label>
                <input
                  id="brandColor"
                  name="brandColor"
                  type="color"
                  defaultValue={brandColor}
                />
              </div>

              <div className="field">
                <label htmlFor="whatsappPhone">WhatsApp</label>
                <input
                  id="whatsappPhone"
                  name="whatsappPhone"
                  type="tel"
                  defaultValue={salon.whatsapp_phone ?? ""}
                  placeholder="5511999999999"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="logo">Logo que aparece no app do cliente</label>
              <input
                id="logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
              />
              <small className="muted">
                PNG, JPG, WEBP ou SVG com até 2 MB. Essa imagem aparece no topo
                do app do cliente.
              </small>
            </div>

            {logoUrl ? (
              <div className="field">
                <label>Logo atual</label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: 14,
                    borderRadius: 18,
                    border: "1px solid #E3D5C7",
                    background: "#FBF7F2",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 72,
                      height: 72,
                      borderRadius: 20,
                      overflow: "hidden",
                      background: "#FFFFFF",
                      border: "1px solid #E3D5C7",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      src={logoUrl}
                      alt={`Logo atual de ${salonName}`}
                      fill
                      sizes="72px"
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ color: "#2F231C" }}>
                      Essa é a imagem que o cliente vê no app.
                    </strong>
                    <span className="muted">
                      Se quiser trocar, envie outra imagem acima. Se quiser
                      limpar, marque a opção abaixo.
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {logoUrl ? (
              <div className="field">
                <label className="toggle-pill" style={{ width: "fit-content" }}>
                  <input type="checkbox" name="removeLogo" />
                  <span>Remover logo atual</span>
                </label>
                <small className="muted">
                  Se marcar essa opção e salvar, o app do cliente volta a
                  mostrar as iniciais do salão.
                </small>
              </div>
            ) : null}

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "#FBF7F2",
                border: "1px solid #E3D5C7",
              }}
            >
              <strong
                style={{ display: "block", color: "#2F231C", marginBottom: 6 }}
              >
                Onde essa logo aparece
              </strong>
              <p className="muted" style={{ margin: 0 }}>
                A logo fica no destaque principal do app do cliente, junto do
                nome do salão, da cor da marca e do botão de contato.
              </p>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "#FBF7F2",
                border: "1px solid #E3D5C7",
                display: "grid",
                gap: 10,
              }}
            >
              <strong style={{ display: "block", color: "#2F231C" }}>
                Preset ativo: {segmentPreset.label}
              </strong>
              <p className="muted" style={{ margin: 0 }}>
                {segmentPreset.shortDescription}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {segmentPreset.focusAreas.map((focus) => (
                  <span
                    key={focus}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: "1px solid #E3D5C7",
                      background: "rgba(255,255,255,0.92)",
                      color: "#2F231C",
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {focus}
                  </span>
                ))}
              </div>
            </div>

            <div className="client-model-card">
              <div className="client-model-card__preview">
                <div className="client-model-card__eyebrow">
                  Modelo do app do cliente
                </div>
                <h3>
                  {clientAppConfig.welcomeHeadline ||
                    clientAppConfig.heroHeadline ||
                    resolvedExperienceModelOption.previewTitle}
                </h3>
                <p>
                  {clientAppConfig.welcomeMessage ||
                    clientAppConfig.heroSupportLine ||
                    resolvedExperienceModelOption.previewSupport}
                </p>

                <div className="client-model-card__chips">
                  <span>{resolvedExperienceModelLabel}</span>
                  <span>{visualStyleOption.label}</span>
                  <span>{emphasisOption.label}</span>
                  <span>{themeModeOption?.label ?? "Tema automático"}</span>
                </div>

                <div className="brand-preview-palette">
                  <div className="brand-preview-palette__item">
                    <span
                      className="brand-preview-palette__swatch"
                      style={{ backgroundColor: brandColor }}
                    />
                    <div>
                      <strong>Primária</strong>
                      <small>{brandColor}</small>
                    </div>
                  </div>
                  <div className="brand-preview-palette__item">
                    <span
                      className="brand-preview-palette__swatch"
                      style={{
                        backgroundColor:
                          clientAppConfig.secondaryColor ??
                          "color-mix(in srgb, white 82%, var(--accent) 18%)",
                      }}
                    />
                    <div>
                      <strong>Secundária</strong>
                      <small>
                        {clientAppConfig.secondaryColor ?? "Automática"}
                      </small>
                    </div>
                  </div>
                  <div className="brand-preview-palette__item">
                    <span
                      className="brand-preview-palette__swatch"
                      style={{
                        backgroundColor:
                          clientAppConfig.accentColor ??
                          "color-mix(in srgb, var(--accent) 68%, #ffffff 32%)",
                      }}
                    />
                    <div>
                      <strong>Destaque</strong>
                      <small>
                        {clientAppConfig.accentColor ?? "Automático"}
                      </small>
                    </div>
                  </div>
                </div>

                <div className="client-model-card__phone">
                  <div
                    className={`client-model-card__phone-hero client-model-card__phone-hero--${resolvedVisualStyle}`}
                    style={
                      previewHeroImageUrl
                        ? {
                            backgroundImage: `linear-gradient(180deg, rgba(17, 14, 12, 0.16), rgba(17, 14, 12, 0.72)), url(${previewHeroImageUrl})`,
                            backgroundPosition: `center, ${heroImageFocusX}% ${heroImageFocusY}%`,
                            backgroundRepeat: "no-repeat",
                            backgroundSize: `cover, ${(clientAppConfig.heroImageZoom ?? 1) * 100}%`,
                          }
                        : {
                            background: `linear-gradient(145deg, ${brandColor}, ${clientAppConfig.accentColor ?? `color-mix(in srgb, ${brandColor} 18%, #2F231C)`})`,
                          }
                    }
                  >
                    <strong>{salonName}</strong>
                    <span>
                      {clientAppConfig.welcomeMessage ||
                        clientAppConfig.heroSupportLine ||
                        salon.tagline ||
                        segmentPreset.mobileSupport}
                    </span>
                    <b>{clientAppConfig.primaryCtaLabel || "Agendar agora"}</b>
                  </div>
                  <div className="client-model-card__phone-grid">
                    {(selectedHomeModules.length > 0
                      ? selectedHomeModules.map((option) => option.label)
                      : resolvedExperienceModelOption.previewBlocks
                    ).map((block) => (
                      <span key={block}>{block}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="client-model-card__meta">
                <div>
                  <span className="eyebrow">Modelo resolvido</span>
                  <p>{resolvedExperienceModelLabel}</p>
                </div>
                <div>
                  <span className="eyebrow">Estilo resolvido</span>
                  <p>
                    {CLIENT_APP_VISUAL_STYLE_OPTIONS.find(
                      (option) => option.value === resolvedVisualStyle,
                    )?.label ?? visualStyleOption.label}
                  </p>
                </div>
                <div>
                  <span className="eyebrow">Ênfase resolvida</span>
                  <p>
                    {CLIENT_HOME_EMPHASIS_OPTIONS.find(
                      (option) => option.value === resolvedHomeEmphasis,
                    )?.label ?? emphasisOption.label}
                  </p>
                </div>
                <div>
                  <span className="eyebrow">CTA principal</span>
                  <p>{clientAppConfig.primaryCtaLabel || "Agendar agora"}</p>
                </div>
                <div>
                  <span className="eyebrow">Tema do app</span>
                  <p>{themeModeOption?.label ?? "Automático por segmento"}</p>
                </div>
                <div>
                  <span className="eyebrow">Botões</span>
                  <p>
                    {buttonStyleOption?.label ??
                      "Botões resolvidos pelo preset"}
                  </p>
                </div>
                <div>
                  <span className="eyebrow">Cards</span>
                  <p>{cardStyleOption?.label ?? "Cards automáticos"}</p>
                </div>
                <div>
                  <span className="eyebrow">Banner hero</span>
                  <p>{bannerStyleOption?.label ?? "Hero automático"}</p>
                </div>
                <div>
                  <span className="eyebrow">Módulos da home</span>
                  <p>
                    {selectedHomeModules.length > 0
                      ? `${selectedHomeModules.length} módulos selecionados`
                      : "Automáticos por segmento"}
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: "#FBF7F2",
                border: "1px solid #E3D5C7",
                display: "grid",
                gap: 14,
              }}
            >
              <div>
                <strong style={{ display: "block", color: "#2F231C" }}>
                  Modelo do app do cliente
                </strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Esse bloco deixa o salão escolher qual leitura visual o
                  cliente vai sentir no app, sem trocar a base do produto nem
                  perder os dados reais de agenda, galeria, carteira e
                  recorrência.
                </p>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppExperienceModel">
                    Modelo da experiência
                  </label>
                  <select
                    id="clientAppExperienceModel"
                    name="clientAppExperienceModel"
                    defaultValue={clientAppConfig.experienceModel}
                  >
                    {CLIENT_EXPERIENCE_MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {experienceModelOption.description}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppVisualStyle">Estilo visual</label>
                  <select
                    id="clientAppVisualStyle"
                    name="clientAppVisualStyle"
                    defaultValue={clientAppConfig.visualStyle}
                  >
                    {CLIENT_APP_VISUAL_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {visualStyleOption.description}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppHomeEmphasis">Ênfase da home</label>
                  <select
                    id="clientAppHomeEmphasis"
                    name="clientAppHomeEmphasis"
                    defaultValue={clientAppConfig.homeEmphasis}
                  >
                    {CLIENT_HOME_EMPHASIS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">{emphasisOption.description}</small>
                </div>
              </div>

              <div className="field">
                <label htmlFor="clientAppHeroHeadline">
                  Headline principal da home
                </label>
                <input
                  id="clientAppHeroHeadline"
                  name="clientAppHeroHeadline"
                  defaultValue={clientAppConfig.heroHeadline ?? ""}
                  placeholder="Ex.: Seu próximo cuidado favorito começa aqui."
                />
                <small className="muted">
                  Se deixar vazio, o app usa a headline automática do modelo e
                  do segmento escolhido.
                </small>
              </div>

              <div className="field">
                <label htmlFor="clientAppHeroSupportLine">
                  Texto de apoio da home
                </label>
                <textarea
                  id="clientAppHeroSupportLine"
                  name="clientAppHeroSupportLine"
                  defaultValue={clientAppConfig.heroSupportLine ?? ""}
                  rows={3}
                  placeholder="Ex.: Agenda real, vitrine e atendimento no mesmo fluxo."
                />
              </div>

              <div className="field">
                <label htmlFor="clientAppPrimaryCtaLabel">
                  Texto do botão principal
                </label>
                <input
                  id="clientAppPrimaryCtaLabel"
                  name="clientAppPrimaryCtaLabel"
                  defaultValue={clientAppConfig.primaryCtaLabel ?? ""}
                  placeholder="Ex.: Agendar agora"
                />
              </div>
            </div>

            <div className="premium-settings-panel">
              <div>
                <strong style={{ display: "block", color: "#2F231C" }}>
                  Camada premium white-label
                </strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Aqui o salão trava a assinatura visual do app do cliente sem
                  precisar trocar layout, rotas ou estrutura de produto.
                </p>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppThemeMode">
                    Tema do app do cliente
                  </label>
                  <select
                    id="clientAppThemeMode"
                    name="clientAppThemeMode"
                    defaultValue={clientAppConfig.themeMode ?? ""}
                  >
                    <option value="">Automático por segmento</option>
                    {CLIENT_APP_THEME_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {themeModeOption?.description ??
                      "Deixe automático para o app seguir a atmosfera premium do segmento cadastrado."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppButtonStyle">
                    Estilo dos botões
                  </label>
                  <select
                    id="clientAppButtonStyle"
                    name="clientAppButtonStyle"
                    defaultValue={clientAppConfig.buttonStyle ?? ""}
                  >
                    <option value="">Automático por segmento</option>
                    {CLIENT_APP_BUTTON_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {buttonStyleOption?.description ??
                      "O sistema resolve o acabamento mais coerente com o preset do salão."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppCardStyle">Estilo dos cards</label>
                  <select
                    id="clientAppCardStyle"
                    name="clientAppCardStyle"
                    defaultValue={clientAppConfig.cardStyle ?? ""}
                  >
                    <option value="">Automático por segmento</option>
                    {CLIENT_APP_CARD_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {cardStyleOption?.description ??
                      "Bom para adaptar profundidade e peso visual sem criar um app novo."}
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppBannerStyle">
                    Estilo dos banners
                  </label>
                  <select
                    id="clientAppBannerStyle"
                    name="clientAppBannerStyle"
                    defaultValue={clientAppConfig.bannerStyle ?? ""}
                  >
                    <option value="">Automático por segmento</option>
                    {CLIENT_APP_BANNER_STYLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="muted">
                    {bannerStyleOption?.description ??
                      "O preset define o hero mais forte para o tipo de negócio, mas você pode travar o estilo aqui."}
                  </small>
                </div>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppSecondaryColor">
                    Cor secundária
                  </label>
                  <input
                    id="clientAppSecondaryColor"
                    name="clientAppSecondaryColor"
                    defaultValue={clientAppConfig.secondaryColor ?? ""}
                    placeholder="Ex.: #E7D8CC"
                  />
                  <small className="muted">
                    Deixe vazio para o app usar a composição automática do
                    segmento.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppAccentColor">Cor de destaque</label>
                  <input
                    id="clientAppAccentColor"
                    name="clientAppAccentColor"
                    defaultValue={clientAppConfig.accentColor ?? ""}
                    placeholder="Ex.: #CDAA74"
                  />
                  <small className="muted">
                    Usada em badges, chips, estados premium e chamadas de
                    destaque.
                  </small>
                </div>
              </div>
            </div>

            <div className="premium-settings-panel">
              <div>
                <strong style={{ display: "block", color: "#2F231C" }}>
                  Conteúdo da vitrine do app
                </strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Esses textos e imagens alimentam a home premium e a camada
                  editorial do app do cliente.
                </p>
              </div>

              <div className="field">
                <label htmlFor="clientAppWelcomeHeadline">
                  Headline premium da home
                </label>
                <input
                  id="clientAppWelcomeHeadline"
                  name="clientAppWelcomeHeadline"
                  defaultValue={clientAppConfig.welcomeHeadline ?? ""}
                  placeholder="Ex.: Seu próximo cuidado favorito começa aqui."
                />
              </div>

              <div className="field">
                <label htmlFor="clientAppWelcomeMessage">
                  Mensagem premium da home
                </label>
                <textarea
                  id="clientAppWelcomeMessage"
                  name="clientAppWelcomeMessage"
                  defaultValue={clientAppConfig.welcomeMessage ?? ""}
                  rows={3}
                  placeholder="Ex.: Agenda viva, profissionais em destaque e uma vitrine pensada para converter com elegância."
                />
              </div>

              <div className="field">
                <label htmlFor="clientAppPromotionHeadline">
                  Headline de promoções
                </label>
                <input
                  id="clientAppPromotionHeadline"
                  name="clientAppPromotionHeadline"
                  defaultValue={clientAppConfig.promotionHeadline ?? ""}
                  placeholder="Ex.: Pacotes, clube e benefícios com acabamento premium."
                />
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 24,
                  border: "1px solid #E3D5C7",
                  background: "#FBF7F2",
                  display: "grid",
                  gap: 16,
                }}
              >
                <div>
                  <strong style={{ display: "block", color: "#2F231C" }}>
                    Publicações da central do cliente
                  </strong>
                  <p className="muted" style={{ margin: "6px 0 0" }}>
                    O salão pode publicar campanhas, avisos ou chamadas
                    operacionais que aparecem com prioridade e CTA dentro do app
                    cliente.
                  </p>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  {centralCampaignSlots.map((campaign, index) => {
                    const slot = index + 1;

                    return (
                      <section
                        key={campaign.id}
                        style={{
                          padding: 18,
                          borderRadius: 22,
                          border: "1px solid #E3D5C7",
                          background: "rgba(255,255,255,0.9)",
                          display: "grid",
                          gap: 14,
                        }}
                      >
                        <input
                          type="hidden"
                          name={`clientAppCampaignId_${slot}`}
                          defaultValue={campaign.id}
                        />

                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <strong
                              style={{ display: "block", color: "#2F231C" }}
                            >
                              Publicação {slot}
                            </strong>
                            <p className="muted" style={{ margin: "6px 0 0" }}>
                              {campaign.isActive
                                ? "Essa publicação já pode aparecer no app assim que você salvar."
                                : "Deixe desligado para preparar a peça antes de publicar para a cliente."}
                            </p>
                          </div>

                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              fontWeight: 700,
                              color: "#2F231C",
                            }}
                          >
                            <input
                              type="checkbox"
                              name={`clientAppCampaignIsActive_${slot}`}
                              defaultChecked={campaign.isActive}
                            />
                            <span>Publicar no app</span>
                          </label>
                        </div>

                        <div className="split-grid">
                          <div className="field">
                            <label
                              htmlFor={`clientAppCampaignPriority_${slot}`}
                            >
                              Prioridade da publicacao {slot}
                            </label>
                            <select
                              id={`clientAppCampaignPriority_${slot}`}
                              name={`clientAppCampaignPriority_${slot}`}
                              defaultValue={campaign.priority}
                            >
                              {CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS.map(
                                (option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ),
                              )}
                            </select>
                            <small className="muted">
                              {campaign.priorityOption.description}
                            </small>
                          </div>

                          <div className="field">
                            <label
                              htmlFor={`clientAppCampaignAudience_${slot}`}
                            >
                              Publico da publicacao {slot}
                            </label>
                            <select
                              id={`clientAppCampaignAudience_${slot}`}
                              name={`clientAppCampaignAudience_${slot}`}
                              defaultValue={campaign.audience}
                            >
                              {CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS.map(
                                (option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ),
                              )}
                            </select>
                            <small className="muted">
                              {campaign.audienceOption.description}
                            </small>
                          </div>
                        </div>

                        <div className="split-grid">
                          <div className="field">
                            <label
                              htmlFor={`clientAppCampaignStartsAt_${slot}`}
                            >
                              Janela de inicio {slot}
                            </label>
                            <input
                              id={`clientAppCampaignStartsAt_${slot}`}
                              name={`clientAppCampaignStartsAt_${slot}`}
                              type="datetime-local"
                              defaultValue={campaign.startsAt}
                            />
                            <small className="muted">
                              Deixe vazio para a publicação entrar no app assim
                              que for ativada.
                            </small>
                          </div>

                          <div className="field">
                            <label htmlFor={`clientAppCampaignEndsAt_${slot}`}>
                              Janela de fim {slot}
                            </label>
                            <input
                              id={`clientAppCampaignEndsAt_${slot}`}
                              name={`clientAppCampaignEndsAt_${slot}`}
                              type="datetime-local"
                              defaultValue={campaign.endsAt}
                            />
                            <small className="muted">
                              Preencha para a peça sair do app automaticamente
                              após esse horário.
                            </small>
                          </div>
                        </div>

                        <div className="field">
                          <label htmlFor={`clientAppCampaignCtaTarget_${slot}`}>
                            Destino do CTA {slot}
                          </label>
                          <select
                            id={`clientAppCampaignCtaTarget_${slot}`}
                            name={`clientAppCampaignCtaTarget_${slot}`}
                            defaultValue={campaign.ctaTarget}
                          >
                            {CLIENT_APP_CAMPAIGN_TARGET_OPTIONS.map(
                              (option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                          <small className="muted">
                            {campaign.ctaTargetOption.description}
                          </small>
                        </div>

                        <div className="split-grid">
                          <div className="field">
                            <label htmlFor={`clientAppCampaignEyebrow_${slot}`}>
                              Selo da publicacao {slot}
                            </label>
                            <input
                              id={`clientAppCampaignEyebrow_${slot}`}
                              name={`clientAppCampaignEyebrow_${slot}`}
                              defaultValue={campaign.eyebrow}
                              placeholder="Ex.: Agora no app"
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`clientAppCampaignLabel_${slot}`}>
                              Etiqueta comercial {slot}
                            </label>
                            <input
                              id={`clientAppCampaignLabel_${slot}`}
                              name={`clientAppCampaignLabel_${slot}`}
                              defaultValue={campaign.campaignLabel}
                              placeholder="Ex.: Retorno da semana"
                            />
                          </div>
                        </div>

                        <div className="field">
                          <label htmlFor={`clientAppCampaignTitle_${slot}`}>
                            Titulo da publicacao {slot}
                          </label>
                          <input
                            id={`clientAppCampaignTitle_${slot}`}
                            name={`clientAppCampaignTitle_${slot}`}
                            defaultValue={campaign.title}
                            placeholder="Ex.: Volte essa semana e aproveite um encaixe premium."
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`clientAppCampaignMessage_${slot}`}>
                            Mensagem da publicacao {slot}
                          </label>
                          <textarea
                            id={`clientAppCampaignMessage_${slot}`}
                            name={`clientAppCampaignMessage_${slot}`}
                            defaultValue={campaign.message}
                            rows={3}
                            placeholder="Explique o que o salao quer comunicar e por que isso importa para a cliente agora."
                          />
                        </div>

                        <div className="field">
                          <label htmlFor={`clientAppCampaignCtaLabel_${slot}`}>
                            Texto do CTA {slot}
                          </label>
                          <input
                            id={`clientAppCampaignCtaLabel_${slot}`}
                            name={`clientAppCampaignCtaLabel_${slot}`}
                            defaultValue={campaign.ctaLabel}
                            placeholder="Ex.: Reservar agora"
                          />
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>

              <PremiumImageCropField
                title="Imagem hero principal"
                description="Crop interativo para a home premium com foco, zoom e derivacoes automaticas para mobile, tablet e share."
                urlFieldId="clientAppHeroImageUrl"
                urlFieldName="clientAppHeroImageUrl"
                fileFieldId="clientAppHeroImageFile"
                fileFieldName="clientAppHeroImageFile"
                removeFieldName="removeClientAppHeroImage"
                focusXFieldName="clientAppHeroImageFocusX"
                focusYFieldName="clientAppHeroImageFocusY"
                zoomFieldName="clientAppHeroImageZoom"
                defaultUrl={heroImageEditorUrl}
                defaultFocusX={clientAppConfig.heroImageFocusX}
                defaultFocusY={clientAppConfig.heroImageFocusY}
                defaultZoom={clientAppConfig.heroImageZoom}
                currentAssetManagedInStorage={
                  typeof clientAppConfig.rawConfig.heroImageSourcePath ===
                    "string" ||
                  typeof clientAppConfig.rawConfig.heroImagePath === "string"
                }
                recommendedRatioLabel={heroImageSpec.recommendedRatioLabel}
                recommendedSizeLabel={heroImageSpec.recommendedSizeLabel}
                safeAreaLabel={heroImageSpec.safeAreaLabel}
                aspectRatio={heroImageSpec.aspectRatio}
                maxWidth={heroImageSpec.outputWidth}
                maxHeight={heroImageSpec.outputHeight}
              />

              <PremiumImageCropField
                title="Imagem da galeria"
                description="Crop interativo para feed premium e descoberta visual, com derivacoes automaticas para mobile, tablet e share."
                urlFieldId="clientAppGalleryCoverImageUrl"
                urlFieldName="clientAppGalleryCoverImageUrl"
                fileFieldId="clientAppGalleryCoverImageFile"
                fileFieldName="clientAppGalleryCoverImageFile"
                removeFieldName="removeClientAppGalleryCoverImage"
                focusXFieldName="clientAppGalleryCoverImageFocusX"
                focusYFieldName="clientAppGalleryCoverImageFocusY"
                zoomFieldName="clientAppGalleryCoverImageZoom"
                defaultUrl={galleryImageEditorUrl}
                defaultFocusX={clientAppConfig.galleryCoverImageFocusX}
                defaultFocusY={clientAppConfig.galleryCoverImageFocusY}
                defaultZoom={clientAppConfig.galleryCoverImageZoom}
                currentAssetManagedInStorage={
                  typeof clientAppConfig.rawConfig
                    .galleryCoverImageSourcePath === "string" ||
                  typeof clientAppConfig.rawConfig.galleryCoverImagePath ===
                    "string"
                }
                recommendedRatioLabel={galleryImageSpec.recommendedRatioLabel}
                recommendedSizeLabel={galleryImageSpec.recommendedSizeLabel}
                safeAreaLabel={galleryImageSpec.safeAreaLabel}
                aspectRatio={galleryImageSpec.aspectRatio}
                maxWidth={galleryImageSpec.outputWidth}
                maxHeight={galleryImageSpec.outputHeight}
              />

              <PremiumImageCropField
                title="Capa institucional do perfil"
                description="Imagem dedicada para a tela institucional do salão, com derivacoes automaticas para mobile, tablet e share."
                urlFieldId="clientAppProfileCoverImageUrl"
                urlFieldName="clientAppProfileCoverImageUrl"
                fileFieldId="clientAppProfileCoverImageFile"
                fileFieldName="clientAppProfileCoverImageFile"
                removeFieldName="removeClientAppProfileCoverImage"
                focusXFieldName="clientAppProfileCoverImageFocusX"
                focusYFieldName="clientAppProfileCoverImageFocusY"
                zoomFieldName="clientAppProfileCoverImageZoom"
                defaultUrl={profileCoverEditorUrl}
                defaultFocusX={clientAppConfig.profileCoverImageFocusX}
                defaultFocusY={clientAppConfig.profileCoverImageFocusY}
                defaultZoom={clientAppConfig.profileCoverImageZoom}
                currentAssetManagedInStorage={
                  typeof clientAppConfig.rawConfig
                    .profileCoverImageSourcePath === "string" ||
                  typeof clientAppConfig.rawConfig.profileCoverImagePath ===
                    "string"
                }
                recommendedRatioLabel={profileCoverSpec.recommendedRatioLabel}
                recommendedSizeLabel={profileCoverSpec.recommendedSizeLabel}
                safeAreaLabel={profileCoverSpec.safeAreaLabel}
                aspectRatio={profileCoverSpec.aspectRatio}
                maxWidth={profileCoverSpec.outputWidth}
                maxHeight={profileCoverSpec.outputHeight}
              />
            </div>

            <div className="premium-settings-panel">
              <div>
                <strong style={{ display: "block", color: "#2F231C" }}>
                  Módulos visíveis na home
                </strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Escolha quais blocos o cliente vê na home. Se não marcar nada,
                  o sistema segue a composição automática do segmento.
                </p>
              </div>

              <div className="module-toggle-grid">
                {CLIENT_APP_HOME_MODULE_OPTIONS.map((option) => (
                  <label key={option.value} className="module-toggle-card">
                    <input
                      type="checkbox"
                      name="clientAppVisibleHomeModules"
                      value={option.value}
                      defaultChecked={clientAppConfig.visibleHomeModules.includes(
                        option.value,
                      )}
                    />
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="premium-settings-panel">
              <div>
                <strong style={{ display: "block", color: "#2F231C" }}>
                  Touchpoints institucionais do app
                </strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Informações que fortalecem confiança, descoberta e navegação
                  para o cliente final.
                </p>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppInstagramUrl">
                    Instagram do salão
                  </label>
                  <input
                    id="clientAppInstagramUrl"
                    name="clientAppInstagramUrl"
                    type="url"
                    defaultValue={clientAppConfig.instagramUrl ?? ""}
                    placeholder="https://instagram.com/..."
                  />
                </div>

                <div className="field">
                  <label htmlFor="clientAppMapUrl">Link do mapa</label>
                  <input
                    id="clientAppMapUrl"
                    name="clientAppMapUrl"
                    type="url"
                    defaultValue={clientAppConfig.mapUrl ?? ""}
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppPrivacyPolicyUrl">
                    URL da política de privacidade
                  </label>
                  <input
                    id="clientAppPrivacyPolicyUrl"
                    name="clientAppPrivacyPolicyUrl"
                    type="url"
                    defaultValue={clientAppConfig.privacyPolicyUrl ?? ""}
                    placeholder="https://seusalao.com/privacidade"
                  />
                  <small className="muted">
                    Se deixar em branco, o app usa a versão institucional local
                    com fallback para suporte.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppTermsOfUseUrl">
                    URL dos termos de uso
                  </label>
                  <input
                    id="clientAppTermsOfUseUrl"
                    name="clientAppTermsOfUseUrl"
                    type="url"
                    defaultValue={clientAppConfig.termsOfUseUrl ?? ""}
                    placeholder="https://seusalao.com/termos"
                  />
                </div>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppSupportUrl">URL de suporte</label>
                  <input
                    id="clientAppSupportUrl"
                    name="clientAppSupportUrl"
                    type="url"
                    defaultValue={clientAppConfig.supportUrl ?? ""}
                    placeholder="https://wa.me/... ou https://seusalao.com/suporte"
                  />
                </div>

                <div className="field">
                  <label htmlFor="clientAppSupportEmail">
                    E-mail de suporte
                  </label>
                  <input
                    id="clientAppSupportEmail"
                    name="clientAppSupportEmail"
                    type="email"
                    defaultValue={clientAppConfig.supportEmail ?? ""}
                    placeholder="suporte@seusalao.com"
                  />
                  <small className="muted">
                    Usado como fallback no app se a URL de suporte não for
                    preenchida.
                  </small>
                </div>
              </div>

              <div className="field">
                <label htmlFor="clientAppAddressLabel">
                  Endereço exibido no app
                </label>
                <input
                  id="clientAppAddressLabel"
                  name="clientAppAddressLabel"
                  defaultValue={clientAppConfig.addressLabel ?? ""}
                  placeholder="Ex.: Av. Paulista, 1400 - Bela Vista, São Paulo"
                />
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="clientAppRatingValue">Nota média</label>
                  <input
                    id="clientAppRatingValue"
                    name="clientAppRatingValue"
                    inputMode="decimal"
                    defaultValue={clientAppConfig.ratingValue?.toString() ?? ""}
                    placeholder="Ex.: 4.9"
                  />
                  <small className="muted">
                    Valor entre 0 e 5 para reforçar confiança no perfil do
                    salão.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="clientAppRatingCount">
                    Total de avaliações
                  </label>
                  <input
                    id="clientAppRatingCount"
                    name="clientAppRatingCount"
                    inputMode="numeric"
                    defaultValue={clientAppConfig.ratingCount?.toString() ?? ""}
                    placeholder="Ex.: 186"
                  />
                </div>
              </div>
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar identidade
              </button>
            </div>
          </form>
        </div>
      </section>

      <section id="agenda-online" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Agenda online</h2>
            <p className="muted">
              Defina o intervalo da agenda e em quais horários o cliente pode
              reservar pelo app.
            </p>
          </div>
        </div>

        <div className="schedule-settings-grid" style={{ marginTop: 18 }}>
          <div className="schedule-preview-card">
            <div className="schedule-preview-head">
              <span className="eyebrow">Como o cliente vê</span>
              <h3>Disponibilidade alinhada com sua operação</h3>
              <p>
                O app passa a mostrar somente horários dentro do seu
                atendimento. Nada de agenda fora do horário, conflito ou encaixe
                manual no susto.
              </p>
            </div>

            <div className="schedule-preview-meta">
              <div>
                <span className="eyebrow">Fuso horário</span>
                <p>
                  {SALON_TIMEZONE_OPTIONS.find(
                    (option) => option.value === timezone,
                  )?.label ?? timezone}
                </p>
              </div>
              <div>
                <span className="eyebrow">Intervalo entre horários</span>
                <p>
                  {SLOT_STEP_OPTIONS.find(
                    (option) => option.value === slotStepMinutes,
                  )?.label ?? `${slotStepMinutes} min`}
                </p>
              </div>
            </div>
          </div>

          <form action={updateSalonScheduleAction} className="form-grid">
            <div className="split-grid">
              <div className="field">
                <label htmlFor="timezone">Fuso horário</label>
                <select id="timezone" name="timezone" defaultValue={timezone}>
                  {SALON_TIMEZONE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="slotStepMinutes">Intervalo da agenda</label>
                <select
                  id="slotStepMinutes"
                  name="slotStepMinutes"
                  defaultValue={String(slotStepMinutes)}
                >
                  {SLOT_STEP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="schedule-week-grid">
              {businessHours.map((day) => (
                <div key={day.value} className="schedule-day-row">
                  <div className="schedule-day-row__title">
                    <strong>{day.label}</strong>
                    <label className="toggle-pill">
                      <input
                        type="checkbox"
                        name={`isOpen_${day.value}`}
                        defaultChecked={day.is_open}
                      />
                      <span>{day.is_open ? "Aberto" : "Fechado"}</span>
                    </label>
                  </div>

                  <div className="schedule-day-row__times">
                    <div className="field">
                      <label htmlFor={`opensAt_${day.value}`}>Abre</label>
                      <input
                        id={`opensAt_${day.value}`}
                        name={`opensAt_${day.value}`}
                        type="time"
                        defaultValue={formatBusinessTime(day.opens_at)}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor={`closesAt_${day.value}`}>Fecha</label>
                      <input
                        id={`closesAt_${day.value}`}
                        name={`closesAt_${day.value}`}
                        type="time"
                        defaultValue={formatBusinessTime(day.closes_at)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar agenda
              </button>
            </div>
          </form>
        </div>
      </section>

      <section id="reserva-protegida" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Reserva protegida</h2>
            <p className="muted">
              Transforme a agenda em operacao real: regras claras, sinal quando
              fizer sentido e menos no-show improvisado no WhatsApp.
            </p>
          </div>
        </div>

        <div className="schedule-settings-grid" style={{ marginTop: 18 }}>
          <div className="schedule-preview-card">
            <div className="schedule-preview-head">
              <span className="eyebrow">Como o cliente ve</span>
              <h3>
                {bookingPolicyEnabled
                  ? bookingPolicyTitle
                  : "Reserva sem politica ativa"}
              </h3>
              <p>
                {bookingPolicyEnabled
                  ? bookingPolicySummary ||
                    "O cliente recebe a regra do salao antes de concluir a reserva e a equipe acompanha o sinal dentro da agenda."
                  : "Ative essa camada para mostrar regras de cancelamento, orientar o sinal e proteger horarios de maior demanda."}
              </p>
            </div>

            <div className="schedule-preview-meta">
              <div>
                <span className="eyebrow">Janela de cancelamento</span>
                <p>{bookingPolicyCancellationWindowHours}h antes do horario</p>
              </div>
              <div>
                <span className="eyebrow">Confirmacao</span>
                <p>
                  {bookingPolicyConfirmationRequired
                    ? `${bookingPolicyConfirmationLeadMinutes} min antes`
                    : "Nao automatica"}
                </p>
              </div>
              <div>
                <span className="eyebrow">Sinal</span>
                <p>
                  {bookingPolicyRequiresDeposit && bookingPolicyDepositAmount
                    ? `${formatCurrency(bookingPolicyDepositAmount)} por reserva via ${bookingPolicyPaymentModeLabel.toLowerCase()}`
                    : "Nao obrigatorio"}
                </p>
              </div>
              <div>
                <span className="eyebrow">Protecao automatica</span>
                <p>
                  {bookingPolicyAutoCancelUnconfirmed
                    ? `Cancela ${bookingPolicyAutoCancelLeadMinutes} min antes sem confirmacao`
                    : "Sem auto cancelamento por presenca"}
                </p>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 16 }}>
              {bookingPolicyRequiresDeposit
                ? bookingPolicyAutoCancelPendingDeposit
                  ? `Sinal pendente cancela automaticamente ${bookingPolicyAutoCancelLeadMinutes} min antes.`
                  : `O app lembra do sinal ${bookingPolicyDepositReminderLeadHours}h antes, sem cancelar automaticamente por isso.`
                : "Fluxo focado em confirmacao de presenca e organizacao da agenda."}
            </p>

            <p className="muted" style={{ marginTop: 8 }}>
              {bookingPolicyRequiresDeposit
                ? bookingPolicyPaymentModeDescription
                : "Quando o sinal for ativado, esta camada define se a cobrança acontece por Pix, checkout ou operação manual."}
            </p>

            <p className="muted" style={{ marginTop: 16 }}>
              Versao ativa: {bookingPolicyVersion}
            </p>
          </div>

          <form action={updateSalonBookingPolicyAction} className="form-grid">
            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyTitle">Titulo da politica</label>
                <input
                  id="bookingPolicyTitle"
                  name="bookingPolicyTitle"
                  defaultValue={bookingPolicyTitle}
                  placeholder="Reserva protegida"
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyCancellationWindowHours">
                  Janela de cancelamento
                </label>
                <input
                  id="bookingPolicyCancellationWindowHours"
                  name="bookingPolicyCancellationWindowHours"
                  type="number"
                  min="0"
                  max="168"
                  step="1"
                  defaultValue={String(bookingPolicyCancellationWindowHours)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="bookingPolicySummary">
                Resumo para o cliente
              </label>
              <textarea
                id="bookingPolicySummary"
                name="bookingPolicySummary"
                rows={4}
                defaultValue={bookingPolicySummary}
                placeholder="Explique quando a reserva fica garantida, como o sinal funciona e o que acontece em cancelamentos tardios."
              />
            </div>

            <div className="split-grid">
              <label className="toggle-pill">
                <input
                  type="checkbox"
                  name="bookingPolicyEnabled"
                  defaultChecked={bookingPolicyEnabled}
                />
                <span>Ativar politica de reserva</span>
              </label>

              <label className="toggle-pill">
                <input
                  type="checkbox"
                  name="bookingPolicyRequiresDeposit"
                  defaultChecked={bookingPolicyRequiresDeposit}
                />
                <span>Exigir sinal para segurar a vaga</span>
              </label>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyDepositAmount">
                  Valor do sinal
                </label>
                <input
                  id="bookingPolicyDepositAmount"
                  name="bookingPolicyDepositAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={
                    bookingPolicyDepositAmount == null
                      ? ""
                      : bookingPolicyDepositAmount.toFixed(2)
                  }
                  placeholder="0,00"
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyPaymentMode">
                  Modo de cobranca do sinal
                </label>
                <select
                  id="bookingPolicyPaymentMode"
                  name="bookingPolicyPaymentMode"
                  defaultValue={bookingPolicyPaymentMode}
                >
                  <option value="manual">Manual pela equipe</option>
                  <option value="pix">Pix direto no app</option>
                  <option value="asaas_pix">Pix automatico (Asaas)</option>
                  <option value="external_checkout">Checkout externo</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="bookingPolicyPaymentInstructions">
                Orientacoes complementares
              </label>
              <textarea
                id="bookingPolicyPaymentInstructions"
                name="bookingPolicyPaymentInstructions"
                rows={4}
                defaultValue={bookingPolicyPaymentInstructions}
                placeholder="Ex.: Depois do pagamento, toque em 'Ja paguei' no app para a equipe validar o sinal."
              />
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyAsaasApiKey">
                  Chave de API do Asaas
                </label>
                <input
                  id="bookingPolicyAsaasApiKey"
                  name="bookingPolicyAsaasApiKey"
                  type="password"
                  autoComplete="off"
                  defaultValue={bookingPolicyAsaasApiKey}
                  placeholder="$aact_..."
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyAsaasEnvironment">
                  Ambiente do Asaas
                </label>
                <select
                  id="bookingPolicyAsaasEnvironment"
                  name="bookingPolicyAsaasEnvironment"
                  defaultValue={bookingPolicyAsaasEnvironment}
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Produção</option>
                </select>
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyAsaasWebhookToken">
                  Token do webhook do Asaas
                </label>
                <input
                  id="bookingPolicyAsaasWebhookToken"
                  name="bookingPolicyAsaasWebhookToken"
                  defaultValue={bookingPolicyAsaasWebhookToken}
                  placeholder="Gerado automaticamente na primeira configuração"
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyAsaasWebhookUrl">
                  URL do webhook
                </label>
                <input
                  id="bookingPolicyAsaasWebhookUrl"
                  value={bookingPolicyAsaasWebhookUrl}
                  readOnly
                />
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyPixKey">Chave Pix do salao</label>
                <input
                  id="bookingPolicyPixKey"
                  name="bookingPolicyPixKey"
                  defaultValue={bookingPolicyPixKey}
                  placeholder="email@studio.com ou chave aleatoria"
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyExternalCheckoutUrl">
                  URL do checkout externo
                </label>
                <input
                  id="bookingPolicyExternalCheckoutUrl"
                  name="bookingPolicyExternalCheckoutUrl"
                  defaultValue={bookingPolicyExternalCheckoutUrl}
                  placeholder="https://pay.exemplo.com/reserva-protegida"
                />
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="bookingPolicyPixRecipientName">
                  Favorecido no Pix
                </label>
                <input
                  id="bookingPolicyPixRecipientName"
                  name="bookingPolicyPixRecipientName"
                  defaultValue={bookingPolicyPixRecipientName}
                  placeholder="Studio Centro"
                />
              </div>

              <div className="field">
                <label htmlFor="bookingPolicyPixRecipientCity">
                  Cidade do Pix
                </label>
                <input
                  id="bookingPolicyPixRecipientCity"
                  name="bookingPolicyPixRecipientCity"
                  defaultValue={bookingPolicyPixRecipientCity}
                  placeholder="SAO PAULO"
                />
              </div>
            </div>

            <div className="field">
              <p className="muted">
                Use <strong>Pix direto no app</strong> para copiar o codigo de
                pagamento na hora. Use <strong>Pix automatico (Asaas)</strong>{" "}
                para gerar uma cobranca por reserva com conciliacao automatica
                via webhook. Use <strong>Checkout externo</strong> se o salao ja
                cobra o sinal por um link pronto em Mercado Pago, Asaas ou outra
                operacao.
              </p>
              <p className="muted">
                No modo Asaas, configure a URL acima no painel do Asaas e cole o
                mesmo token no campo de autenticacao do webhook para liberar a
                confirmacao automatica do sinal.
              </p>
            </div>

            <div className="field">
              <label htmlFor="bookingPolicyConfirmationLeadMinutes">
                Confirmacao de presenca
              </label>
              <div className="split-grid">
                <label className="toggle-pill">
                  <input
                    type="checkbox"
                    name="bookingPolicyConfirmationRequired"
                    defaultChecked={bookingPolicyConfirmationRequired}
                  />
                  <span>Solicitar confirmacao perto do horario</span>
                </label>

                <input
                  id="bookingPolicyConfirmationLeadMinutes"
                  name="bookingPolicyConfirmationLeadMinutes"
                  type="number"
                  min="5"
                  max="180"
                  step="1"
                  defaultValue={String(bookingPolicyConfirmationLeadMinutes)}
                />
              </div>
            </div>

            <div className="split-grid">
              <label className="toggle-pill">
                <input
                  type="checkbox"
                  name="bookingPolicyAutoCancelUnconfirmed"
                  defaultChecked={bookingPolicyAutoCancelUnconfirmed}
                />
                <span>Cancelar automaticamente sem confirmacao</span>
              </label>

              <div className="field">
                <label htmlFor="bookingPolicyAutoCancelLeadMinutes">
                  Minutos antes para auto cancelamento
                </label>
                <input
                  id="bookingPolicyAutoCancelLeadMinutes"
                  name="bookingPolicyAutoCancelLeadMinutes"
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  defaultValue={String(bookingPolicyAutoCancelLeadMinutes)}
                />
              </div>
            </div>

            <div className="split-grid">
              <label className="toggle-pill">
                <input
                  type="checkbox"
                  name="bookingPolicyAutoCancelPendingDeposit"
                  defaultChecked={bookingPolicyAutoCancelPendingDeposit}
                />
                <span>Cancelar automaticamente por sinal pendente</span>
              </label>

              <div className="field">
                <label htmlFor="bookingPolicyDepositReminderLeadHours">
                  Horas antes para lembrar do sinal
                </label>
                <input
                  id="bookingPolicyDepositReminderLeadHours"
                  name="bookingPolicyDepositReminderLeadHours"
                  type="number"
                  min="0"
                  max="72"
                  step="1"
                  defaultValue={String(bookingPolicyDepositReminderLeadHours)}
                />
              </div>
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar politica de reserva
              </button>
            </div>
          </form>
        </div>
      </section>

      <section id="client-code" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Código para clientes</h2>
            <p className="muted">
              Compartilhe esse código para que seus clientes entrem no app
              certo.
            </p>
          </div>
        </div>

        <div className="row-list" style={{ marginTop: 16 }}>
          <article className="list-row code-card">
            <div className="list-row__content">
              <h3>{salon.name}</h3>
              <small className="list-meta">
                Criado em {formatDate(salon.created_at)}
              </small>
              <div style={{ marginTop: 14 }}>
                <a
                  href={`/s/${salon.join_code}`}
                  className="secondary-button"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir vitrine pública
                </a>
              </div>
            </div>

            <div className="code-card__aside">
              <span className="eyebrow">Código</span>
              <p className="code-value">{salon.join_code}</p>
            </div>
          </article>
        </div>

        <form action={regenerateSalonCodeAction} style={{ marginTop: 24 }}>
          <button type="submit" className="secondary-button">
            Gerar novo código
          </button>
        </form>
      </section>
    </div>
  );
}
