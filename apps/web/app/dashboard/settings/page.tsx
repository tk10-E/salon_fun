import Link from "next/link";
import type { ReactNode } from "react";

import {
  regenerateSalonCodeAction,
  updateSalonBookingPolicyAction,
  updateSalonSecurityPolicyAction,
  updateSalonScheduleAction,
} from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { SalonSecuritySettingsPanel } from "@/components/SalonSecuritySettingsPanel";
import { SettingsBrandingForm } from "@/components/SettingsBrandingForm";
import {
  SettingsCampaignsField,
  type SettingsClientAppCampaignDraft,
} from "@/components/SettingsCampaignsField";
import { requireOwnerSalon } from "@/lib/auth";
import {
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
import { coerceSalonSecurityPolicy } from "@/lib/panelSecurityPolicy";
import { SALON_SEGMENT_OPTIONS } from "@/lib/salonSegments";
import { SALON_TIMEZONE_OPTIONS, SLOT_STEP_OPTIONS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

type SettingsPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

const UPDATE_SALON_BRANDING_PATH = "/api/internal/dashboard/settings/branding";

const EXTRA_WORKSPACE_LINK_GROUPS = [
  {
    description: "Cadastros que você ajusta de vez em quando.",
    links: [
      { href: MANAGEMENT_ROUTES.services, label: "Serviços" },
      { href: MANAGEMENT_ROUTES.professionals, label: "Equipe" },
      { href: MANAGEMENT_ROUTES.categories, label: "Categorias" },
      { href: MANAGEMENT_ROUTES.payments, label: "Pagamentos" },
    ],
    title: "Cadastro",
  },
  {
    description: "Áreas operacionais que não precisam ficar no menu principal.",
    links: [
      { href: "/dashboard/operations/comandas", label: "Comandas" },
      { href: "/dashboard/inventory", label: "Estoque" },
      { href: "/dashboard/finance/despesas", label: "Despesas" },
      { href: "/dashboard/billing", label: "Assinatura do sistema" },
    ],
    title: "Operação extra",
  },
  {
    description: "Ferramentas de app, conteúdo e retorno para abrir só quando precisar.",
    links: [
      { href: "/dashboard/client-app", label: "App do cliente" },
      { href: "/dashboard/feed", label: "Feed" },
      { href: "/dashboard/notifications", label: "Lembretes" },
      { href: "/dashboard/subscriptions", label: "Planos do salão" },
      { href: "/dashboard/benefits/loyalty", label: "Fidelidade" },
      { href: "/dashboard/benefits/automations", label: "Retenção" },
      { href: "/dashboard/benefits/referrals", label: "Indicações" },
      { href: "/dashboard/birthdays", label: "Aniversários" },
    ],
    title: "Cliente e retorno",
  },
] as const;

type SettingsFormSectionProps = {
  id?: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

function SettingsFormSection({
  id,
  title,
  description,
  children,
  className,
}: SettingsFormSectionProps) {
  return (
    <section
      id={id}
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
  fileHint: string;
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
  fileHint,
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
        <small className="muted">{fileHint}</small>
      </label>

      <label className="checkbox-field">
        <input type="checkbox" name={removeName} defaultChecked={false} />
        {removeLabel}
      </label>
    </article>
  );
}

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
): SettingsClientAppCampaignDraft[] {
  return campaigns.map((campaign, index) => ({
    slot: index + 1,
    id: campaign.id,
    isActive: campaign.isActive,
    priority: campaign.priority,
    startsAt: formatDateTimeLocalValue(campaign.startsAt),
    endsAt: formatDateTimeLocalValue(campaign.endsAt),
    audience: campaign.audience,
    eyebrow: campaign.eyebrow ?? "",
    title: campaign.title,
    message: campaign.message,
    campaignLabel: campaign.campaignLabel ?? "",
    ctaLabel: campaign.ctaLabel ?? "",
    ctaTarget: campaign.ctaTarget,
  }));
}

export default async function SettingsPage({
  searchParams: searchParamsPromise,
}: SettingsPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
  const supabase = createClient() as any;
  const securitySettingsResult = await supabase
    .from("salon_security_settings")
    .select("mfa_totp_enabled, geo_allowlist_enabled, allowed_country_codes")
    .eq("salon_id", salon.id)
    .maybeSingle();
  const securityPolicy = coerceSalonSecurityPolicy({
    row:
      securitySettingsResult.data &&
      typeof securitySettingsResult.data === "object"
        ? (securitySettingsResult.data as Record<string, unknown>)
        : null,
    salonId: salon.id,
  });
  const clientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
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
  const slotStepValue = salon.slot_step_minutes ?? 30;
  const bookingPolicyEnabled = salon.booking_policy_enabled ?? false;
  const bookingPolicyAutoConfirmNewAppointments =
    salon.booking_policy_auto_confirm_new_appointments ?? false;
  const bookingPolicyConfirmationRequired =
    salon.booking_policy_confirmation_required ?? true;
  const bookingPolicyRequiresDeposit =
    salon.booking_policy_requires_deposit ?? false;
  const bookingPolicyDepositAmount = Number(
    salon.booking_policy_deposit_amount ?? 0,
  );
  const bookingPolicyPaymentMode =
    salon.booking_policy_payment_mode ?? "manual";
  const autoPilotStatusLabel = clientAppConfig.autoPilotEnabled
    ? "Ligado"
    : "Desligado";
  const bookingPolicyStatusLabel = bookingPolicyEnabled ? "Ativa" : "Desligada";
  const panelAutoAcceptStatusLabel = bookingPolicyAutoConfirmNewAppointments
    ? "Ligado"
    : "Desligado";
  const publicAppReference = clientAppConfig.customDomain
    ? clientAppConfig.customDomain
    : `Código ${salon.join_code}`;
  return (
    <div className="page-grid workspace-page settings-page settings-lean">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <section className="simple-hero">
        <p className="eyebrow">Configurações</p>
        <h1>{salon.name}</h1>
        <p className="muted">
          Comece por marca, agenda e automação. O resto fica guardado para quando precisar.
        </p>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Comece por aqui</h2>
            <p className="muted">O salão quase sempre só precisa mexer nestes três blocos.</p>
          </div>
        </div>
        <div className="settings-summary-grid settings-summary-grid--three">
          <article className="settings-summary-card">
            <p className="eyebrow">App e marca</p>
            <strong>Nome, cor, logo e vitrine</strong>
            <p>Referência atual: {publicAppReference}.</p>
            <Link href="#brand-identity" className="secondary-button">
              Abrir identidade
            </Link>
          </article>

          <article className="settings-summary-card">
            <p className="eyebrow">Agenda</p>
            <strong>Fuso e intervalo dos horários</strong>
            <p>
              Hoje: {timezoneValue} • {slotStepValue} min por faixa.
            </p>
            <Link href="#agenda-online" className="secondary-button">
              Abrir agenda
            </Link>
          </article>

          <article className="settings-summary-card">
            <p className="eyebrow">Automação</p>
            <strong>Reserva, confirmações e piloto</strong>
            <p>
              Piloto {autoPilotStatusLabel.toLowerCase()} • política{" "}
              {bookingPolicyStatusLabel.toLowerCase()}.
            </p>
            <Link href="#reserva-protegida" className="secondary-button">
              Abrir regras
            </Link>
          </article>
        </div>
      </section>

      <section className="card content-card accordion">
        <details>
          <summary>
            <div>
              <h2>Áreas menos usadas</h2>
              <p className="muted">
                O que não precisa ficar no menu principal do dia a dia.
              </p>
            </div>
            <span className="accordion__cta">Abrir</span>
          </summary>

          <div className="simple-list">
            {EXTRA_WORKSPACE_LINK_GROUPS.map((group) => (
              <article key={group.title} className="simple-row">
                <h3>{group.title}</h3>
                <p className="muted">{group.description}</p>
                <div
                  className="simple-row__actions"
                  style={{ justifyContent: "flex-start", flexWrap: "wrap" }}
                >
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="secondary-button"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </details>
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

          <SettingsBrandingForm
            action={UPDATE_SALON_BRANDING_PATH}
            salonId={salon.id}
          >
            <div className="settings-section-stack">
              <SettingsFormSection
                title="Base do salão"
                description="Nome, segmento e descrição curta."
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
                description="Nome, contato, cor e logo."
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
                      Opcional. Pode colar o link completo que o painel salva
                      só o domínio.
                    </small>
                  </label>
                </div>

                <div className="split-grid">
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
                      PNG, JPG, WEBP ou SVG • até 2 MB. Essa logo também
                      aparece no topo do painel quando estiver publicada.
                    </small>
                  </label>
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
                </div>
              </SettingsFormSection>

              <details className="settings-inline-advanced">
                <summary>
                  <div>
                    <strong>Mais ajustes do app</strong>
                    <span>
                      Abra só quando quiser mexer em visual, capas, campanhas e links.
                    </span>
                  </div>
                  <span className="accordion__cta">Abrir</span>
                </summary>

                <div className="settings-inline-advanced__body settings-section-stack">
                  <SettingsFormSection
                    title="Conteúdo e visual do app"
                    description="Mensagens, cores e estilo."
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
                    <small className="muted">Opcional. Use #RRGGBB.</small>
                  </label>

                  <label className="field">
                    <span>Cor de destaque do app</span>
                    <input
                      id="clientAppAccentColor"
                      name="clientAppAccentColor"
                      defaultValue={clientAppConfig.accentColor ?? ""}
                      placeholder="#C56B43"
                    />
                    <small className="muted">Opcional. Use #RRGGBB.</small>
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
                    <small className="muted">Nota e total de avaliações.</small>
                  </label>
                </div>
                  </SettingsFormSection>

                  <SettingsFormSection
                    title="Capas do app"
                    description="Use de 0 a 3 imagens: principal, galeria e perfil."
                  >
                <div className="settings-upload-grid">
                  <SettingsMediaCard
                    title="Imagem principal"
                    description="Banner principal do app."
                    urlId="clientAppHeroImageUrl"
                    urlName="clientAppHeroImageUrl"
                    urlLabel="URL da imagem principal"
                    urlValue={clientAppConfig.heroImageUrl ?? ""}
                    fileId="clientAppHeroImageFile"
                    fileName="clientAppHeroImageFile"
                    fileLabel="Arquivo da imagem principal"
                    fileHint="PNG, JPG ou WEBP • até 3 MB • 1 por vez."
                    removeName="removeClientAppHeroImage"
                    removeLabel="Remover imagem principal atual"
                  />

                  <SettingsMediaCard
                    title="Capa da galeria"
                    description="Imagem da área de fotos."
                    urlId="clientAppGalleryCoverImageUrl"
                    urlName="clientAppGalleryCoverImageUrl"
                    urlLabel="URL da capa da galeria"
                    urlValue={clientAppConfig.galleryCoverImageUrl ?? ""}
                    fileId="clientAppGalleryCoverImageFile"
                    fileName="clientAppGalleryCoverImageFile"
                    fileLabel="Arquivo da capa da galeria"
                    fileHint="PNG, JPG ou WEBP • até 3 MB • 1 por vez."
                    removeName="removeClientAppGalleryCoverImage"
                    removeLabel="Remover capa da galeria atual"
                  />

                  <SettingsMediaCard
                    title="Capa do perfil"
                    description="Imagem da área institucional."
                    urlId="clientAppProfileCoverImageUrl"
                    urlName="clientAppProfileCoverImageUrl"
                    urlLabel="URL da capa do perfil"
                    urlValue={clientAppConfig.profileCoverImageUrl ?? ""}
                    fileId="clientAppProfileCoverImageFile"
                    fileName="clientAppProfileCoverImageFile"
                    fileLabel="Arquivo da capa do perfil"
                    fileHint="PNG, JPG ou WEBP • até 3 MB • 1 por vez."
                    removeName="removeClientAppProfileCoverImage"
                    removeLabel="Remover capa do perfil atual"
                  />
                </div>
                  </SettingsFormSection>

                  <SettingsFormSection
                    title="Campanhas da central"
                    description="Comece com uma campanha principal e adicione novas quando quiser."
                  >
                    <SettingsCampaignsField initialCampaigns={campaignDrafts} />
                  </SettingsFormSection>

                  <SettingsFormSection
                    title="Links e presença pública"
                    description="Suporte, localização e documentos."
                  >
                    <div className="split-grid">

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
                    description="Escolha o que aparece na home."
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
              </details>
            </div>

            <div className="settings-submit-bar">
              <button type="submit" className="primary-button">
                Salvar identidade
              </button>
            </div>
          </SettingsBrandingForm>
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

          <form
            action={updateSalonBookingPolicyAction}
            className="form-grid settings-identity-form"
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="salonId" value={salon.id} />

            <div className="settings-section-stack">
              <SettingsFormSection
                title="Automação do salão"
                description="Deixe a agenda aceitar, concluir e marcar falta seguindo suas regras."
              >
                <div className="settings-summary-grid settings-summary-grid--three">
                  <article className="settings-status-card">
                    <strong>Piloto automático</strong>
                    <p>{autoPilotStatusLabel}</p>
                  </article>

                  <article className="settings-status-card">
                    <strong>Política de reserva</strong>
                    <p>{bookingPolicyStatusLabel}</p>
                  </article>

                  <article className="settings-status-card">
                    <strong>Lançamentos do painel</strong>
                    <p>{panelAutoAcceptStatusLabel}</p>
                  </article>
                </div>

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
                      name="clientAppAutoPilotEnabled"
                      defaultChecked={clientAppConfig.autoPilotEnabled}
                    />
                    Piloto automático do salão
                  </label>

                  <label className="checkbox-field" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      name="bookingPolicyAutoConfirmNewAppointments"
                      defaultChecked={bookingPolicyAutoConfirmNewAppointments}
                    />
                    Aceitar sozinho horários lançados no painel
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

                <p className="muted">
                  Horários escolhidos pela cliente no app entram confirmados
                  automaticamente quando a vaga está disponível. Use esta opção
                  para deixar o sistema cuidar do fluxo sem depender de botão do salão.
                </p>
              </SettingsFormSection>

              <SettingsFormSection
                title="Mensagem para a cliente"
                description="Defina como a reserva aparece e o que a cliente precisa ler."
              >
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

      <section id="panel-security" className="card content-card accordion">
        <details>
          <summary>
            <div>
              <h2>Segurança do painel</h2>
              <p className="muted">MFA, países permitidos e proteção do acesso.</p>
            </div>
            <span className="accordion__cta">Editar</span>
          </summary>

          <SalonSecuritySettingsPanel
            action={updateSalonSecurityPolicyAction}
            initialAllowedCountryCodes={securityPolicy.allowedCountryCodes}
            initialGeoAllowlistEnabled={securityPolicy.geoAllowlistEnabled}
            initialMfaTotpEnabled={securityPolicy.mfaTotpEnabled}
          />
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
