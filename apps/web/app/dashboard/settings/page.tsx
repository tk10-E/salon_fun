import type { ReactNode } from "react";

import {
  regenerateSalonCodeAction,
  updateSalonBookingPolicyAction,
  updateSalonScheduleAction,
} from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import {
  CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS,
  CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS,
  CLIENT_APP_CAMPAIGN_TARGET_OPTIONS,
  CLIENT_APP_BANNER_STYLE_OPTIONS,
  CLIENT_APP_BUTTON_STYLE_OPTIONS,
  CLIENT_APP_CARD_STYLE_OPTIONS,
  CLIENT_APP_HOME_MODULE_OPTIONS,
  CLIENT_APP_THEME_MODE_OPTIONS,
  CLIENT_APP_VISUAL_STYLE_OPTIONS,
  CLIENT_EXPERIENCE_MODEL_OPTIONS,
  CLIENT_HOME_EMPHASIS_OPTIONS,
  normalizeSalonClientAppConfig,
} from "@/lib/clientAppConfig";
import { SALON_SEGMENT_OPTIONS } from "@/lib/salonSegments";
import { SALON_TIMEZONE_OPTIONS, SLOT_STEP_OPTIONS } from "@/lib/schedule";

type SettingsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

const UPDATE_SALON_BRANDING_PATH = "/api/internal/dashboard/settings/branding";

type SettingsSummaryCardProps = {
  eyebrow: string;
  title: string;
  description: string;
};

function SettingsSummaryCard({
  eyebrow,
  title,
  description,
}: SettingsSummaryCardProps) {
  return (
    <article className="settings-summary-card">
      <span className="eyebrow">{eyebrow}</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </article>
  );
}

type SettingsFormSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

function SettingsFormSection({
  title,
  description,
  children,
  className,
}: SettingsFormSectionProps) {
  return (
    <section
      className={`settings-form-section${className ? ` ${className}` : ""}`}
    >
      <div className="settings-form-section__header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="settings-form-section__body">{children}</div>
    </section>
  );
}

type SettingsMediaCardProps = {
  title: string;
  description: string;
  urlId: string;
  urlName: string;
  urlLabel: string;
  urlValue: string;
  fileId: string;
  fileName: string;
  fileLabel: string;
  removeName: string;
  removeLabel: string;
};

function SettingsMediaCard({
  title,
  description,
  urlId,
  urlName,
  urlLabel,
  urlValue,
  fileId,
  fileName,
  fileLabel,
  removeName,
  removeLabel,
}: SettingsMediaCardProps) {
  return (
    <article className="settings-upload-card">
      <div className="settings-upload-card__header">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <label className="field">
        <span>{urlLabel}</span>
        <input
          id={urlId}
          name={urlName}
          defaultValue={urlValue}
          placeholder="https://..."
        />
      </label>

      <label className="field">
        <span>{fileLabel}</span>
        <input
          id={fileId}
          name={fileName}
          type="file"
          accept="image/png,image/jpeg,image/webp"
        />
      </label>

      <label className="checkbox-field">
        <input type="checkbox" name={removeName} defaultChecked={false} />
        {removeLabel}
      </label>
    </article>
  );
}

type SettingsClientAppCampaignDraft = {
  slot: number;
  id: string;
  isActive: boolean;
  priority: string;
  startsAt: string;
  endsAt: string;
  audience: string;
  eyebrow: string;
  title: string;
  message: string;
  campaignLabel: string;
  ctaLabel: string;
  ctaTarget: string;
};

type SettingsCampaignCardProps = {
  campaign: SettingsClientAppCampaignDraft;
};

function formatDateTimeLocalValue(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }

  return normalized.length >= 16 ? normalized.slice(0, 16) : normalized;
}

function buildSettingsCampaignDrafts(
  campaigns: ReturnType<
    typeof normalizeSalonClientAppConfig
  >["centralCampaigns"],
  slotCount = 3,
): SettingsClientAppCampaignDraft[] {
  return Array.from({ length: slotCount }, (_, index) => {
    const campaign = campaigns[index];
    const slot = index + 1;

    return {
      slot,
      id: campaign?.id ?? `campaign-${slot}`,
      isActive: campaign?.isActive ?? false,
      priority: campaign?.priority ?? "medium",
      startsAt: formatDateTimeLocalValue(campaign?.startsAt),
      endsAt: formatDateTimeLocalValue(campaign?.endsAt),
      audience: campaign?.audience ?? "all",
      eyebrow: campaign?.eyebrow ?? "",
      title: campaign?.title ?? "",
      message: campaign?.message ?? "",
      campaignLabel: campaign?.campaignLabel ?? "",
      ctaLabel: campaign?.ctaLabel ?? "",
      ctaTarget: campaign?.ctaTarget ?? "explore",
    };
  });
}

function SettingsCampaignCard({ campaign }: SettingsCampaignCardProps) {
  return (
    <article className="settings-upload-card">
      <div className="settings-upload-card__header">
        <strong>Campanha {campaign.slot}</strong>
        <p>
          Publicação que entra na home do app cliente com mensagem e atalho
          direto.
        </p>
      </div>

      <input
        type="hidden"
        name={`clientAppCampaignId_${campaign.slot}`}
        defaultValue={campaign.id}
      />

      <label className="checkbox-field">
        <input
          type="checkbox"
          name={`clientAppCampaignIsActive_${campaign.slot}`}
          defaultChecked={campaign.isActive}
        />
        Publicar esta campanha na central do app
      </label>

      <div className="split-grid">
        <label className="field">
          <span>Prioridade</span>
          <select
            name={`clientAppCampaignPriority_${campaign.slot}`}
            defaultValue={campaign.priority}
          >
            {CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Audiência</span>
          <select
            name={`clientAppCampaignAudience_${campaign.slot}`}
            defaultValue={campaign.audience}
          >
            {CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split-grid">
        <label className="field">
          <span>Selo curto</span>
          <input
            name={`clientAppCampaignEyebrow_${campaign.slot}`}
            defaultValue={campaign.eyebrow}
            placeholder="Ex.: Agora no app"
          />
        </label>

        <label className="field">
          <span>Rótulo interno</span>
          <input
            name={`clientAppCampaignLabel_${campaign.slot}`}
            defaultValue={campaign.campaignLabel}
            placeholder="Ex.: Retorno da semana"
          />
        </label>
      </div>

      <label className="field">
        <span>Título</span>
        <input
          name={`clientAppCampaignTitle_${campaign.slot}`}
          defaultValue={campaign.title}
          placeholder="Ex.: Volte essa semana"
        />
      </label>

      <label className="field">
        <span>Mensagem</span>
        <textarea
          name={`clientAppCampaignMessage_${campaign.slot}`}
          defaultValue={campaign.message}
          rows={3}
          placeholder="Explique o motivo da campanha e o próximo passo."
        />
      </label>

      <div className="split-grid">
        <label className="field">
          <span>CTA</span>
          <input
            name={`clientAppCampaignCtaLabel_${campaign.slot}`}
            defaultValue={campaign.ctaLabel}
            placeholder="Ex.: Reservar agora"
          />
        </label>

        <label className="field">
          <span>Destino do CTA</span>
          <select
            name={`clientAppCampaignCtaTarget_${campaign.slot}`}
            defaultValue={campaign.ctaTarget}
          >
            {CLIENT_APP_CAMPAIGN_TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="split-grid">
        <label className="field">
          <span>Começa em</span>
          <input
            type="datetime-local"
            name={`clientAppCampaignStartsAt_${campaign.slot}`}
            defaultValue={campaign.startsAt}
          />
        </label>

        <label className="field">
          <span>Termina em</span>
          <input
            type="datetime-local"
            name={`clientAppCampaignEndsAt_${campaign.slot}`}
            defaultValue={campaign.endsAt}
          />
        </label>
      </div>
    </article>
  );
}

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { salon } = await requireOwnerSalon();
  const clientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const salonSegmentLabel =
    SALON_SEGMENT_OPTIONS.find(
      (option) => option.value === (salon.business_segment ?? "beauty_salon"),
    )?.label ?? "Salão";
  const publicSalonHref = clientAppConfig.customDomain
    ? `https://${clientAppConfig.customDomain}`
    : `/s/${salon.join_code}`;
  const supportedHomeModules = CLIENT_APP_HOME_MODULE_OPTIONS.filter(
    (option) => option.value !== "professionals",
  );
  const visibleHomeModules =
    clientAppConfig.visibleHomeModules.length > 0
      ? clientAppConfig.visibleHomeModules
      : supportedHomeModules.map((option) => option.value);
  const campaignDrafts = buildSettingsCampaignDrafts(
    clientAppConfig.centralCampaigns,
  );
  const timezoneValue = salon.timezone ?? "America/Sao_Paulo";
  const timezoneLabel =
    SALON_TIMEZONE_OPTIONS.find((option) => option.value === timezoneValue)
      ?.label ?? timezoneValue;
  const slotStepValue = salon.slot_step_minutes ?? 30;
  const slotStepLabel =
    SLOT_STEP_OPTIONS.find((option) => option.value === slotStepValue)?.label ??
    `${slotStepValue} min`;
  const bookingPolicyEnabled = salon.booking_policy_enabled ?? false;
  const bookingPolicyConfirmationRequired =
    salon.booking_policy_confirmation_required ?? true;
  const bookingPolicyRequiresDeposit =
    salon.booking_policy_requires_deposit ?? false;
  const bookingPolicyDepositAmount = Number(
    salon.booking_policy_deposit_amount ?? 0,
  );
  const bookingPolicyPaymentMode =
    salon.booking_policy_payment_mode ?? "manual";
  const bookingPolicyPaymentModeLabel =
    bookingPolicyPaymentMode === "pix"
      ? "Pix do salão"
      : bookingPolicyPaymentMode === "external_checkout"
        ? "Link de pagamento"
        : bookingPolicyPaymentMode === "asaas_pix"
          ? "Pix automático"
          : "Cobrança manual";
  const bookingPolicyDepositLabel = bookingPolicyRequiresDeposit
    ? bookingPolicyDepositAmount > 0
      ? `Sinal de ${currencyFormatter.format(bookingPolicyDepositAmount)}`
      : "Sinal ativo sem valor definido"
    : "Sem sinal obrigatório";

  return (
    <div className="page-grid workspace-page settings-page settings-lean">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <section className="simple-hero">
        <p className="eyebrow">Configurações</p>
        <h1>{salon.name}</h1>
        <p className="muted">
          Ajuste marca, horários, política e código sem se perder.
        </p>
      </section>

      <section id="brand-identity" className="card content-card accordion">
        <details open>
          <summary>
            <div>
              <h2>Identidade do salão</h2>
              <p className="muted">Marca, vitrine, app e canal de mensagens.</p>
            </div>
            <span className="accordion__cta">Editar</span>
          </summary>

          <div className="settings-summary-grid">
            <SettingsSummaryCard
              eyebrow="Segmento"
              title={salonSegmentLabel}
              description={
                salon.tagline?.trim() ||
                "Defina uma descrição curta para deixar a proposta do salão mais clara."
              }
            />
            <SettingsSummaryCard
              eyebrow="Vitrine"
              title={
                clientAppConfig.customDomain?.trim() ||
                `Código ${salon.join_code}`
              }
              description={
                clientAppConfig.customDomain
                  ? "Domínio próprio ativo para abrir a vitrine do salão."
                  : "Sem domínio próprio. A vitrine pública continua disponível pelo código."
              }
            />
            <SettingsSummaryCard
              eyebrow="Mensagens"
              title={
                salon.whatsapp_phone?.trim()
                  ? "WhatsApp do salão"
                  : "Contato ainda não definido"
              }
              description={
                salon.whatsapp_phone?.trim() ||
                "Cadastre o número público para clientes encontrarem o atendimento."
              }
            />
            <SettingsSummaryCard
              eyebrow="Home do app"
              title={`${visibleHomeModules.length} blocos ativos`}
              description="Escolha o que aparece primeiro para a cliente quando ela abre o app."
            />
          </div>

          <form
            action={UPDATE_SALON_BRANDING_PATH}
            className="form-grid settings-identity-form"
            encType="multipart/form-data"
            method="post"
            noValidate
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="salonId" value={salon.id} />

            <div className="settings-section-stack">
              <SettingsFormSection
                title="Base do salão"
                description="Organize o essencial primeiro: nome, segmento e descrição curta para a vitrine."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Nome do salão</span>
                    <input
                      id="name"
                      name="name"
                      defaultValue={salon.name}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Segmento do salão</span>
                    <select
                      id="businessSegment"
                      name="businessSegment"
                      defaultValue={salon.business_segment ?? "beauty_salon"}
                    >
                      {SALON_SEGMENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Descrição curta</span>
                  <textarea
                    id="tagline"
                    name="tagline"
                    defaultValue={salon.tagline ?? ""}
                    rows={2}
                    placeholder="Ex.: Escova, corte e manicure em um ambiente leve."
                  />
                </label>
              </SettingsFormSection>

              <SettingsFormSection
                title="Marca e vitrine"
                description="Defina como o salão aparece no app, na vitrine pública e no contato principal."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Nome exibido no app</span>
                    <input
                      id="clientAppAppDisplayName"
                      name="clientAppAppDisplayName"
                      defaultValue={clientAppConfig.appDisplayName ?? ""}
                      placeholder="Ex.: Studio Bella"
                    />
                  </label>

                  <label className="field">
                    <span>Endereço da vitrine</span>
                    <input
                      id="clientAppCustomDomain"
                      name="clientAppCustomDomain"
                      defaultValue={clientAppConfig.customDomain ?? ""}
                      placeholder="app.seusalao.com.br"
                    />
                    <small className="muted">
                      Opcional. Use se você quiser abrir a vitrine do salão em
                      um endereço próprio.
                    </small>
                  </label>
                </div>

                <div className="split-grid settings-brand-grid">
                  <label className="field">
                    <span>WhatsApp público do salão</span>
                    <input
                      id="whatsappPhone"
                      name="whatsappPhone"
                      defaultValue={salon.whatsapp_phone ?? ""}
                      placeholder="5511999999999"
                    />
                    <small className="muted">
                      Esse é o contato que aparece na vitrine e no app do
                      cliente.
                    </small>
                  </label>

                  <div className="form-grid">
                    <label className="field settings-color-field">
                      <span>Cor principal</span>
                      <input
                        type="color"
                        id="brandColor"
                        name="brandColor"
                        defaultValue={salon.brand_color ?? "#6d5ab3"}
                      />
                    </label>

                    <label className="field">
                      <span>Logo do app</span>
                      <input
                        id="logo"
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      />
                      <small className="muted">
                        PNG, JPG, WEBP ou SVG até 2 MB.
                      </small>
                    </label>
                  </div>
                </div>

                <div className="settings-toggle-grid">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      name="clientAppWhiteLabelActive"
                      defaultChecked={clientAppConfig.whiteLabelActive}
                    />
                    White-label ativo
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      name="clientAppAutoPilotEnabled"
                      defaultChecked={clientAppConfig.autoPilotEnabled}
                    />
                    Piloto automático comercial ativo
                  </label>
                </div>
              </SettingsFormSection>

              <SettingsFormSection
                title="Conteúdo e visual do app"
                description="Tudo o que o app mobile já respeita no visual, na mensagem principal e na hierarquia da home."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Headline principal</span>
                    <input
                      id="clientAppHeroHeadline"
                      name="clientAppHeroHeadline"
                      defaultValue={clientAppConfig.heroHeadline ?? ""}
                      placeholder="Ex.: Seu melhor visual começa aqui."
                    />
                  </label>

                  <label className="field">
                    <span>Título de boas-vindas</span>
                    <input
                      id="clientAppWelcomeHeadline"
                      name="clientAppWelcomeHeadline"
                      defaultValue={clientAppConfig.welcomeHeadline ?? ""}
                      placeholder="Ex.: Seu salão em ritmo premium"
                    />
                  </label>

                  <label className="field">
                    <span>Modelo de experiência</span>
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
                  </label>

                  <label className="field">
                    <span>CTA principal</span>
                    <input
                      id="clientAppPrimaryCtaLabel"
                      name="clientAppPrimaryCtaLabel"
                      defaultValue={clientAppConfig.primaryCtaLabel ?? ""}
                      placeholder="Ex.: Agendar agora"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Mensagem principal</span>
                  <textarea
                    id="clientAppWelcomeMessage"
                    name="clientAppWelcomeMessage"
                    defaultValue={clientAppConfig.welcomeMessage ?? ""}
                    rows={2}
                    placeholder="Mensagem curta que o app mostra na primeira dobra."
                  />
                </label>

                <div className="split-grid">
                  <label className="field">
                    <span>Ênfase da home</span>
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
                  </label>

                  <label className="field">
                    <span>Linha de apoio</span>
                    <input
                      id="clientAppHeroSupportLine"
                      name="clientAppHeroSupportLine"
                      defaultValue={clientAppConfig.heroSupportLine ?? ""}
                      placeholder="Ex.: Agenda, loja e feed organizados em um só lugar."
                    />
                  </label>

                  <label className="field">
                    <span>Headline comercial</span>
                    <input
                      id="clientAppPromotionHeadline"
                      name="clientAppPromotionHeadline"
                      defaultValue={clientAppConfig.promotionHeadline ?? ""}
                      placeholder="Ex.: Ofertas e retornos com cara de marca."
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Cor secundária do app</span>
                    <input
                      id="clientAppSecondaryColor"
                      name="clientAppSecondaryColor"
                      defaultValue={clientAppConfig.secondaryColor ?? ""}
                      placeholder="#E7D9CF"
                    />
                    <small className="muted">
                      Opcional. Use no formato #RRGGBB.
                    </small>
                  </label>

                  <label className="field">
                    <span>Cor de destaque do app</span>
                    <input
                      id="clientAppAccentColor"
                      name="clientAppAccentColor"
                      defaultValue={clientAppConfig.accentColor ?? ""}
                      placeholder="#C56B43"
                    />
                    <small className="muted">
                      Opcional. Use no formato #RRGGBB.
                    </small>
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Estilo visual</span>
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
                  </label>

                  <label className="field">
                    <span>Modo de tema</span>
                    <select
                      id="clientAppThemeMode"
                      name="clientAppThemeMode"
                      defaultValue={clientAppConfig.themeMode ?? ""}
                    >
                      <option value="">Automático</option>
                      {CLIENT_APP_THEME_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Estilo dos botões</span>
                    <select
                      id="clientAppButtonStyle"
                      name="clientAppButtonStyle"
                      defaultValue={clientAppConfig.buttonStyle ?? ""}
                    >
                      <option value="">Automático</option>
                      {CLIENT_APP_BUTTON_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Estilo dos cards</span>
                    <select
                      id="clientAppCardStyle"
                      name="clientAppCardStyle"
                      defaultValue={clientAppConfig.cardStyle ?? ""}
                    >
                      <option value="">Automático</option>
                      {CLIENT_APP_CARD_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Estilo do banner</span>
                    <select
                      id="clientAppBannerStyle"
                      name="clientAppBannerStyle"
                      defaultValue={clientAppConfig.bannerStyle ?? ""}
                    >
                      <option value="">Automático</option>
                      {CLIENT_APP_BANNER_STYLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Avaliação pública</span>
                    <div className="settings-rating-grid">
                      <input
                        id="clientAppRatingValue"
                        name="clientAppRatingValue"
                        type="number"
                        min="0"
                        max="5"
                        step="0.1"
                        defaultValue={clientAppConfig.ratingValue ?? ""}
                        placeholder="4.9"
                      />
                      <input
                        id="clientAppRatingCount"
                        name="clientAppRatingCount"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={clientAppConfig.ratingCount ?? ""}
                        placeholder="120"
                      />
                    </div>
                    <small className="muted">
                      Informe nota média e quantidade de avaliações exibidas no
                      app.
                    </small>
                  </label>
                </div>
              </SettingsFormSection>

              <SettingsFormSection
                title="Capas do app"
                description="Hero, galeria e perfil institucional que o app pode usar como fundo."
              >
                <div className="settings-upload-grid">
                  <SettingsMediaCard
                    title="Imagem principal"
                    description="Aparece na primeira dobra e sustenta a identidade visual."
                    urlId="clientAppHeroImageUrl"
                    urlName="clientAppHeroImageUrl"
                    urlLabel="URL da imagem principal"
                    urlValue={clientAppConfig.heroImageUrl ?? ""}
                    fileId="clientAppHeroImageFile"
                    fileName="clientAppHeroImageFile"
                    fileLabel="Arquivo da imagem principal"
                    removeName="removeClientAppHeroImage"
                    removeLabel="Remover imagem principal atual"
                  />

                  <SettingsMediaCard
                    title="Capa da galeria"
                    description="Usada como apoio visual na área de fotos e destaques."
                    urlId="clientAppGalleryCoverImageUrl"
                    urlName="clientAppGalleryCoverImageUrl"
                    urlLabel="URL da capa da galeria"
                    urlValue={clientAppConfig.galleryCoverImageUrl ?? ""}
                    fileId="clientAppGalleryCoverImageFile"
                    fileName="clientAppGalleryCoverImageFile"
                    fileLabel="Arquivo da capa da galeria"
                    removeName="removeClientAppGalleryCoverImage"
                    removeLabel="Remover capa da galeria atual"
                  />

                  <SettingsMediaCard
                    title="Capa do perfil"
                    description="Ajuda a apresentar a marca na área institucional do salão."
                    urlId="clientAppProfileCoverImageUrl"
                    urlName="clientAppProfileCoverImageUrl"
                    urlLabel="URL da capa do perfil"
                    urlValue={clientAppConfig.profileCoverImageUrl ?? ""}
                    fileId="clientAppProfileCoverImageFile"
                    fileName="clientAppProfileCoverImageFile"
                    fileLabel="Arquivo da capa do perfil"
                    removeName="removeClientAppProfileCoverImage"
                    removeLabel="Remover capa do perfil atual"
                  />
                </div>
              </SettingsFormSection>

              <SettingsFormSection
                title="Campanhas da central"
                description="Defina até três campanhas para aparecer no topo da home do app cliente com CTA direto."
              >
                <div className="settings-upload-grid">
                  {campaignDrafts.map((campaign) => (
                    <SettingsCampaignCard
                      key={`client-app-campaign-${campaign.slot}`}
                      campaign={campaign}
                    />
                  ))}
                </div>
              </SettingsFormSection>

              <SettingsFormSection
                title="Links e presença pública"
                description="Centralize os links que o app mostra para clientes: rede social, endereço, suporte e documentos."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Instagram do salão</span>
                    <input
                      id="clientAppInstagramUrl"
                      name="clientAppInstagramUrl"
                      defaultValue={clientAppConfig.instagramUrl ?? ""}
                      placeholder="https://instagram.com/seusalao"
                    />
                  </label>

                  <label className="field">
                    <span>Endereço exibido</span>
                    <input
                      id="clientAppAddressLabel"
                      name="clientAppAddressLabel"
                      defaultValue={clientAppConfig.addressLabel ?? ""}
                      placeholder="Rua, número, bairro e cidade"
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Link do mapa</span>
                    <input
                      id="clientAppMapUrl"
                      name="clientAppMapUrl"
                      defaultValue={clientAppConfig.mapUrl ?? ""}
                      placeholder="https://maps.app..."
                    />
                  </label>

                  <label className="field">
                    <span>Link de suporte</span>
                    <input
                      id="clientAppSupportUrl"
                      name="clientAppSupportUrl"
                      defaultValue={clientAppConfig.supportUrl ?? ""}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>E-mail de suporte</span>
                    <input
                      id="clientAppSupportEmail"
                      name="clientAppSupportEmail"
                      defaultValue={clientAppConfig.supportEmail ?? ""}
                      placeholder="suporte@seusalao.com"
                    />
                  </label>

                  <label className="field">
                    <span>Política de privacidade</span>
                    <input
                      id="clientAppPrivacyPolicyUrl"
                      name="clientAppPrivacyPolicyUrl"
                      defaultValue={clientAppConfig.privacyPolicyUrl ?? ""}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Termos de uso</span>
                  <input
                    id="clientAppTermsOfUseUrl"
                    name="clientAppTermsOfUseUrl"
                    defaultValue={clientAppConfig.termsOfUseUrl ?? ""}
                    placeholder="https://..."
                  />
                </label>
              </SettingsFormSection>

              <SettingsFormSection
                title="Blocos visíveis na home"
                description="Marque o que pode aparecer na home do app cliente e deixe a primeira dobra menos carregada."
              >
                <div className="settings-module-grid">
                  {supportedHomeModules.map((module) => (
                    <label key={module.value} className="checkbox-field">
                      <input
                        type="checkbox"
                        name="clientAppVisibleHomeModules"
                        value={module.value}
                        defaultChecked={visibleHomeModules.includes(
                          module.value,
                        )}
                      />
                      {module.label}
                    </label>
                  ))}
                </div>
              </SettingsFormSection>
            </div>

            <div className="settings-submit-bar">
              <button type="submit" className="primary-button">
                Salvar identidade
              </button>
            </div>
          </form>
        </details>
      </section>

      <section id="agenda-online" className="card content-card accordion">
        <details>
          <summary>
            <div>
              <h2>Agenda online</h2>
              <p className="muted">Fuso e intervalo entre horários.</p>
            </div>
            <span className="accordion__cta">Editar</span>
          </summary>

          <div className="settings-summary-grid settings-summary-grid--three">
            <SettingsSummaryCard
              eyebrow="Fuso"
              title={timezoneLabel}
              description="Base usada para mostrar horários e automações no horário certo."
            />
            <SettingsSummaryCard
              eyebrow="Intervalo"
              title={slotStepLabel}
              description="Define a cadência dos horários disponíveis para reserva."
            />
            <SettingsSummaryCard
              eyebrow="Impacto"
              title="Agenda pública"
              description="Esses ajustes controlam a leitura da agenda no painel e no app do cliente."
            />
          </div>

          <form
            action={updateSalonScheduleAction}
            className="form-grid settings-identity-form"
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="salonId" value={salon.id} />

            <div className="settings-section-stack">
              <SettingsFormSection
                title="Configuração principal"
                description="Ajuste a base da agenda para que os horários apareçam corretamente para clientes e equipe."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Fuso horário</span>
                    <select
                      id="timezone"
                      name="timezone"
                      defaultValue={timezoneValue}
                    >
                      {SALON_TIMEZONE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Intervalo entre horários</span>
                    <select
                      id="slotStepMinutes"
                      name="slotStepMinutes"
                      defaultValue={String(slotStepValue)}
                    >
                      {SLOT_STEP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <article className="settings-status-card">
                  <strong>Como isso afeta a agenda</strong>
                  <p>
                    O fuso define a referência de horário. O intervalo controla
                    a frequência com que os slots aparecem na reserva online.
                  </p>
                </article>
              </SettingsFormSection>
            </div>

            <div className="settings-submit-bar">
              <button type="submit" className="primary-button">
                Salvar agenda
              </button>
            </div>
          </form>
        </details>
      </section>

      <section id="reserva-protegida" className="card content-card accordion">
        <details>
          <summary>
            <div>
              <h2>Política de reserva</h2>
              <p className="muted">Cancelamento, confirmação e sinal.</p>
            </div>
            <span className="accordion__cta">Editar</span>
          </summary>

          <div className="settings-summary-grid">
            <SettingsSummaryCard
              eyebrow="Status"
              title={
                bookingPolicyEnabled ? "Política ativa" : "Política desligada"
              }
              description="Liga ou pausa as regras extras de confirmação, cancelamento e cobrança."
            />
            <SettingsSummaryCard
              eyebrow="Confirmação"
              title={
                bookingPolicyConfirmationRequired
                  ? "Obrigatória"
                  : "Sem confirmação extra"
              }
              description="Define se a cliente precisa confirmar o atendimento antes do horário."
            />
            <SettingsSummaryCard
              eyebrow="Sinal"
              title={bookingPolicyDepositLabel}
              description="Use para proteger horários mais disputados ou reduzir faltas."
            />
            <SettingsSummaryCard
              eyebrow="Cobrança"
              title={bookingPolicyPaymentModeLabel}
              description="Escolha como a cliente confirma o sinal quando a reserva protegida estiver ativa."
            />
          </div>

          <form
            action={updateSalonBookingPolicyAction}
            className="form-grid settings-identity-form"
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="salonId" value={salon.id} />

            <div className="settings-section-stack">
              <SettingsFormSection
                title="Ativação e comunicação"
                description="Ligue a política, defina como ela aparece para a cliente e quando a confirmação passa a ser obrigatória."
              >
                <div className="settings-toggle-grid">
                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyEnabled"
                      defaultChecked={bookingPolicyEnabled}
                    />
                    Ativar política de reserva
                  </label>

                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyConfirmationRequired"
                      defaultChecked={bookingPolicyConfirmationRequired}
                    />
                    Exigir confirmação antes do horário
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Título da política</span>
                    <input
                      id="bookingPolicyTitle"
                      name="bookingPolicyTitle"
                      defaultValue={
                        salon.booking_policy_title ?? "Reserva protegida"
                      }
                      placeholder="Ex.: Reserva protegida"
                    />
                  </label>

                  <label className="field">
                    <span>Resumo da política</span>
                    <input
                      id="bookingPolicySummary"
                      name="bookingPolicySummary"
                      defaultValue={salon.booking_policy_summary ?? ""}
                      placeholder="Ex.: Sinal para segurar horários premium."
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Instruções de pagamento</span>
                  <textarea
                    id="bookingPolicyPaymentInstructions"
                    name="bookingPolicyPaymentInstructions"
                    rows={3}
                    defaultValue={
                      salon.booking_policy_payment_instructions ?? ""
                    }
                    placeholder="Ex.: Pague o sinal na hora para segurar o horário."
                  />
                </label>
              </SettingsFormSection>

              <SettingsFormSection
                title="Regras de confirmação e cancelamento"
                description="Organize a antecedência de confirmação, a janela de cancelamento e os cancelamentos automáticos."
              >
                <div className="split-grid">
                  <label className="field">
                    <span>Janela de cancelamento (horas)</span>
                    <input
                      id="bookingPolicyCancellationWindowHours"
                      name="bookingPolicyCancellationWindowHours"
                      type="number"
                      min="0"
                      max="168"
                      defaultValue={String(
                        salon.booking_policy_cancellation_window_hours ?? 24,
                      )}
                    />
                  </label>

                  <label className="field">
                    <span>Confirmação antes do horário (minutos)</span>
                    <input
                      id="bookingPolicyConfirmationLeadMinutes"
                      name="bookingPolicyConfirmationLeadMinutes"
                      type="number"
                      min="0"
                      max="180"
                      defaultValue={String(
                        salon.booking_policy_confirmation_lead_minutes ?? 30,
                      )}
                    />
                  </label>
                </div>

                <div className="settings-toggle-grid">
                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyAutoCancelUnconfirmed"
                      defaultChecked={
                        salon.booking_policy_auto_cancel_unconfirmed ?? true
                      }
                    />
                    Cancelar automaticamente sem confirmação
                  </label>

                  <article className="settings-status-card">
                    <strong>Fluxo recomendado</strong>
                    <p>
                      Use confirmação obrigatória com cancelamento automático
                      para reduzir no-shows em horários concorridos.
                    </p>
                  </article>
                </div>

                <label className="field">
                  <span>Auto cancelamento sem confirmação (minutos)</span>
                  <input
                    id="bookingPolicyAutoCancelLeadMinutes"
                    name="bookingPolicyAutoCancelLeadMinutes"
                    type="number"
                    min="0"
                    max="60"
                    defaultValue={String(
                      salon.booking_policy_auto_cancel_lead_minutes ?? 10,
                    )}
                  />
                </label>
              </SettingsFormSection>

              <SettingsFormSection
                title="Sinal e cobrança"
                description="Configure se o salão cobra sinal, como a cliente paga e quais dados precisam aparecer na cobrança."
              >
                <div className="settings-toggle-grid">
                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyRequiresDeposit"
                      defaultChecked={bookingPolicyRequiresDeposit}
                    />
                    Cobrar sinal no agendamento
                  </label>

                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyAutoCancelPendingDeposit"
                      defaultChecked={
                        salon.booking_policy_auto_cancel_pending_deposit ??
                        false
                      }
                    />
                    Cancelar automaticamente se o sinal continuar pendente
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Valor do sinal (opcional)</span>
                    <input
                      id="bookingPolicyDepositAmount"
                      name="bookingPolicyDepositAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={String(
                        salon.booking_policy_deposit_amount ?? 0,
                      )}
                    />
                    <small className="muted">
                      Deixe 0 para não cobrar sinal no app.
                    </small>
                  </label>

                  <label className="field">
                    <span>Lembrete do sinal (horas)</span>
                    <input
                      id="bookingPolicyDepositReminderLeadHours"
                      name="bookingPolicyDepositReminderLeadHours"
                      type="number"
                      min="0"
                      max="72"
                      defaultValue={String(
                        salon.booking_policy_deposit_reminder_lead_hours ?? 6,
                      )}
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Forma de pagamento do sinal</span>
                    <select
                      id="bookingPolicyPaymentMode"
                      name="bookingPolicyPaymentMode"
                      defaultValue={bookingPolicyPaymentMode}
                    >
                      <option value="manual">Manual</option>
                      <option value="pix">Pix do salão</option>
                      <option value="external_checkout">
                        Link de pagamento
                      </option>
                      <option value="asaas_pix">Pix automático</option>
                    </select>
                  </label>

                  <article className="settings-status-card">
                    <strong>Como isso aparece para a cliente</strong>
                    <p>
                      Pix e link de pagamento usam os dados do seu salão. O Pix
                      automático só aparece quando essa opção já estiver
                      liberada para a sua conta.
                    </p>
                  </article>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Chave Pix</span>
                    <input
                      id="bookingPolicyPixKey"
                      name="bookingPolicyPixKey"
                      defaultValue={salon.booking_policy_pix_key ?? ""}
                      placeholder="Ex.: pix@seusalao.com"
                    />
                  </label>

                  <label className="field">
                    <span>Favorecido do Pix</span>
                    <input
                      id="bookingPolicyPixRecipientName"
                      name="bookingPolicyPixRecipientName"
                      defaultValue={
                        salon.booking_policy_pix_recipient_name ?? ""
                      }
                      placeholder="Ex.: Studio Centro"
                    />
                  </label>
                </div>

                <div className="split-grid">
                  <label className="field">
                    <span>Cidade do Pix</span>
                    <input
                      id="bookingPolicyPixRecipientCity"
                      name="bookingPolicyPixRecipientCity"
                      defaultValue={
                        salon.booking_policy_pix_recipient_city ?? ""
                      }
                      placeholder="Ex.: São Paulo"
                    />
                  </label>

                  <label className="field">
                    <span>Link de pagamento</span>
                    <input
                      id="bookingPolicyExternalCheckoutUrl"
                      name="bookingPolicyExternalCheckoutUrl"
                      defaultValue={
                        salon.booking_policy_external_checkout_url ?? ""
                      }
                      placeholder="https://checkout.seusalao.com/pagar"
                    />
                  </label>
                </div>
              </SettingsFormSection>
            </div>

            <div className="settings-submit-bar">
              <button type="submit" className="primary-button">
                Salvar política
              </button>
            </div>
          </form>
        </details>
      </section>

      <section id="client-code" className="card content-card accordion">
        <details>
          <summary>
            <div>
              <h2>Código para clientes</h2>
              <p className="muted">Compartilhe para conectar clientes.</p>
            </div>
            <span className="accordion__cta">Ver código</span>
          </summary>

          <div className="row-list" style={{ marginTop: 12 }}>
            <article className="list-row code-card">
              <div className="list-row__content">
                <h3>{salon.name}</h3>
                <small className="list-meta">
                  Criado em{" "}
                  {new Date(salon.created_at).toLocaleDateString("pt-BR")}
                </small>
                <div style={{ marginTop: 10 }}>
                  <a
                    href={publicSalonHref}
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

          <form action={regenerateSalonCodeAction} style={{ marginTop: 16 }}>
            <button type="submit" className="secondary-button">
              Gerar novo código
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
