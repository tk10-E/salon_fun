import Image from "next/image";

import {
  regenerateSalonCodeAction,
  updateSalonBrandingAction,
  updateSalonScheduleAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { FlashMessage } from "@/components/FlashMessage";
import { PremiumImageCropField } from "@/components/PremiumImageCropField";
import { requireOwnerSalon } from "@/lib/auth";
import { CLIENT_APP_IMAGE_VARIANT_SPECS } from "@/lib/clientAppImageVariants";
import {
  CLIENT_APP_BANNER_STYLE_OPTIONS,
  CLIENT_APP_BUTTON_STYLE_OPTIONS,
  CLIENT_APP_CARD_STYLE_OPTIONS,
  CLIENT_APP_HOME_MODULE_OPTIONS,
  CLIENT_APP_THEME_MODE_OPTIONS,
  CLIENT_EXPERIENCE_MODEL_OPTIONS,
  CLIENT_APP_VISUAL_STYLE_OPTIONS,
  CLIENT_HOME_EMPHASIS_OPTIONS,
  getClientAppBannerStyleOption,
  getClientAppButtonStyleOption,
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
import { formatDate } from "@/lib/formatters";

type SettingsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const businessHoursResponse = await supabase
    .from("salon_business_hours")
    .select("weekday, is_open, opens_at, closes_at")
    .eq("salon_id", salon.id)
    .order("weekday");
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
  const themeModeOption = getClientAppThemeModeOption(clientAppConfig.themeMode);
  const buttonStyleOption = getClientAppButtonStyleOption(
    clientAppConfig.buttonStyle,
  );
  const cardStyleOption = getClientAppCardStyleOption(clientAppConfig.cardStyle);
  const bannerStyleOption = getClientAppBannerStyleOption(
    clientAppConfig.bannerStyle,
  );
  const selectedHomeModules = CLIENT_APP_HOME_MODULE_OPTIONS.filter((option) =>
    clientAppConfig.visibleHomeModules.includes(option.value),
  );
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

      <section className="card content-card">
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
                      <small>{clientAppConfig.accentColor ?? "Automático"}</small>
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
                    {buttonStyleOption?.label ?? "Botões resolvidos pelo preset"}
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
                  <label htmlFor="clientAppSecondaryColor">Cor secundária</label>
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
                  <label htmlFor="clientAppAccentColor">
                    Cor de destaque
                  </label>
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
                  typeof clientAppConfig.rawConfig.galleryCoverImageSourcePath ===
                    "string" ||
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

      <section className="card content-card">
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

      <section className="card content-card">
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
