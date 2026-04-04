import type { Json } from "@/lib/database.types";
import type { SalonBusinessSegment } from "@/lib/salonSegments";

export type ClientAppVisualStyle =
  | "auto"
  | "soft_editorial"
  | "glow_signature"
  | "heritage_dark"
  | "clinical_refined";

export type ClientExperienceModel =
  | "auto"
  | "beauty_signature"
  | "nail_gallery"
  | "barber_house"
  | "brows_atelier"
  | "aesthetic_clinic";

export type ClientHomeEmphasis =
  | "auto"
  | "services"
  | "portfolio"
  | "schedule"
  | "benefits";

export type ClientAppThemeMode = "light" | "dark" | "hybrid";

export type ClientAppButtonStyle = "capsule" | "rounded" | "elevated";

export type ClientAppCardStyle = "floating" | "outlined" | "glass";

export type ClientAppBannerStyle = "immersive" | "editorial" | "spotlight";

export type ClientAppHomeModule =
  | "shortcuts"
  | "nextBooking"
  | "professionals"
  | "gallery"
  | "promotions"
  | "products"
  | "loyalty";

export type ClientAppCampaignPriority = "high" | "medium" | "low";

export type ClientAppCampaignTarget =
  | "explore"
  | "appointments"
  | "feed"
  | "profile"
  | "notifications"
  | "support";

export type ClientAppCampaignAudience =
  | "all"
  | "with_upcoming_appointment"
  | "without_upcoming_appointment"
  | "with_active_benefits"
  | "without_active_benefits";

export type ClientAppCampaign = {
  id: string;
  isActive: boolean;
  priority: ClientAppCampaignPriority;
  startsAt: string | null;
  endsAt: string | null;
  audience: ClientAppCampaignAudience;
  eyebrow: string | null;
  title: string;
  message: string;
  campaignLabel: string | null;
  ctaLabel: string | null;
  ctaTarget: ClientAppCampaignTarget;
};

export type SalonClientAppConfig = {
  experienceModel: ClientExperienceModel;
  visualStyle: ClientAppVisualStyle;
  homeEmphasis: ClientHomeEmphasis;
  heroHeadline: string | null;
  heroSupportLine: string | null;
  primaryCtaLabel: string | null;
  themeMode: ClientAppThemeMode | null;
  buttonStyle: ClientAppButtonStyle | null;
  cardStyle: ClientAppCardStyle | null;
  bannerStyle: ClientAppBannerStyle | null;
  secondaryColor: string | null;
  accentColor: string | null;
  welcomeHeadline: string | null;
  welcomeMessage: string | null;
  promotionHeadline: string | null;
  heroImageUrl: string | null;
  heroImageVariantUrl: string | null;
  heroImageTabletVariantUrl: string | null;
  heroImageShareVariantUrl: string | null;
  galleryCoverImageUrl: string | null;
  galleryCoverImageVariantUrl: string | null;
  galleryCoverImageTabletVariantUrl: string | null;
  galleryCoverImageShareVariantUrl: string | null;
  profileCoverImageUrl: string | null;
  profileCoverImageVariantUrl: string | null;
  profileCoverImageTabletVariantUrl: string | null;
  profileCoverImageShareVariantUrl: string | null;
  heroImageFocusX: number | null;
  heroImageFocusY: number | null;
  heroImageZoom: number | null;
  galleryCoverImageFocusX: number | null;
  galleryCoverImageFocusY: number | null;
  galleryCoverImageZoom: number | null;
  profileCoverImageFocusX: number | null;
  profileCoverImageFocusY: number | null;
  profileCoverImageZoom: number | null;
  instagramUrl: string | null;
  addressLabel: string | null;
  mapUrl: string | null;
  privacyPolicyUrl: string | null;
  termsOfUseUrl: string | null;
  supportUrl: string | null;
  supportEmail: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  visibleHomeModules: ClientAppHomeModule[];
  centralCampaigns: ClientAppCampaign[];
  rawConfig: Record<string, Json | undefined>;
};

type ExperienceModelOption = {
  value: ClientExperienceModel;
  label: string;
  description: string;
  previewTitle: string;
  previewSupport: string;
  previewBlocks: readonly string[];
  accent: string;
};

type VisualStyleOption = {
  value: ClientAppVisualStyle;
  label: string;
  description: string;
  previewTitle: string;
  previewSupport: string;
  accent: string;
};

type HomeEmphasisOption = {
  value: ClientHomeEmphasis;
  label: string;
  description: string;
};

type PremiumSettingOption<T extends string> = {
  value: T;
  label: string;
  description: string;
};

type HomeModuleOption = {
  value: ClientAppHomeModule;
  label: string;
  description: string;
};

type ClientAppCampaignPriorityOption = {
  value: ClientAppCampaignPriority;
  label: string;
  description: string;
};

type ClientAppCampaignTargetOption = {
  value: ClientAppCampaignTarget;
  label: string;
  description: string;
};

type ClientAppCampaignAudienceOption = {
  value: ClientAppCampaignAudience;
  label: string;
  description: string;
};

export const CLIENT_EXPERIENCE_MODEL_OPTIONS: readonly ExperienceModelOption[] =
  [
    {
      value: "auto",
      label: "Automático por segmento",
      description:
        "A plataforma escolhe o modelo ideal com base no tipo de salão cadastrado.",
      previewTitle:
        "O app assume a arquitetura mais forte para o segmento do salão",
      previewSupport:
        "Bom para começar com um produto mais organizado sem decidir tudo manualmente.",
      previewBlocks: [
        "Hero principal",
        "Atalhos curtos",
        "Próximo passo",
        "Bloco-chave do segmento",
      ],
      accent: "#8D6CCF",
    },
    {
      value: "beauty_signature",
      label: "Beauty Signature",
      description:
        "Vitrine elegante para salão de beleza, com serviços e transformação como foco.",
      previewTitle: "Serviços em destaque com visual premium e conversão limpa",
      previewSupport:
        "Bom para salões que querem parecer sofisticados sem lotar a home de informação.",
      previewBlocks: [
        "Serviços em destaque",
        "Próximo agendamento",
        "Últimos trabalhos",
        "Retorno inteligente",
      ],
      accent: "#8D6CCF",
    },
    {
      value: "nail_gallery",
      label: "Nail Gallery",
      description:
        "Home guiada por galeria, coleção e manutenção para studios de unhas.",
      previewTitle:
        "Uma vitrine de desejo primeiro, com agenda limpa logo depois",
      previewSupport:
        "Funciona bem quando o cliente escolhe pelo resultado visual e volta por manutenção.",
      previewBlocks: [
        "Galeria hero",
        "Categorias rápidas",
        "Agenda do retorno",
        "Coleção da semana",
      ],
      accent: "#D8859F",
    },
    {
      value: "barber_house",
      label: "Barber House",
      description:
        "Leitura mais forte, enxuta e direta para barbearias e linhas masculinas.",
      previewTitle: "Agenda rápida, presença de marca e catálogo curto",
      previewSupport:
        "Ideal para operação que vende recorrência, corte e combo sem excesso de texto.",
      previewBlocks: [
        "Hero de barbearia",
        "Atalhos diretos",
        "Janela para voltar",
        "Assinatura da casa",
      ],
      accent: "#7B4A2C",
    },
    {
      value: "brows_atelier",
      label: "Brows Atelier",
      description:
        "Modelo mais refinado para sobrancelhas e cílios, com foco em resultado e retoque.",
      previewTitle: "Portfólio em primeiro plano com retorno organizado no app",
      previewSupport:
        "Bom quando o cliente precisa confiar no resultado e entender o timing do próximo atendimento.",
      previewBlocks: [
        "Hero editorial",
        "Resultados em foco",
        "Plano de retorno",
        "Técnicas do studio",
      ],
      accent: "#A57566",
    },
    {
      value: "aesthetic_clinic",
      label: "Clinical Premium",
      description:
        "Estrutura mais limpa para clínicas e protocolos de maior confiança.",
      previewTitle:
        "Acompanhamento, benefícios e protocolo com leitura premium",
      previewSupport:
        "Melhor para jornadas com recorrência, segurança e menos ruído visual.",
      previewBlocks: [
        "Hero clínico",
        "Próximo cuidado",
        "Seu acompanhamento",
        "Protocolos disponíveis",
      ],
      accent: "#5F98A4",
    },
  ] as const;

export const CLIENT_APP_VISUAL_STYLE_OPTIONS: readonly VisualStyleOption[] = [
  {
    value: "auto",
    label: "Automático por segmento",
    description: "Usa o estilo mais forte para o tipo de salão cadastrado.",
    previewTitle: "O app assume a assinatura visual ideal para o seu segmento",
    previewSupport:
      "Bom para quem quer começar rápido sem decidir tudo manualmente.",
    accent: "#8D6CCF",
  },
  {
    value: "soft_editorial",
    label: "Editorial suave",
    description:
      "Clareza, delicadeza e vitrine mais leve, com leitura acolhedora.",
    previewTitle: "Uma home mais clean, elegante e convidativa",
    previewSupport:
      "Combina com estúdios, beleza feminina e jornadas mais aspiracionais.",
    accent: "#D8859F",
  },
  {
    value: "glow_signature",
    label: "Glow assinatura",
    description:
      "Mais brilho, contraste e impacto visual para destacar desejo e transformação.",
    previewTitle:
      "Uma vitrine de alto impacto para serviços e resultados reais",
    previewSupport:
      "Ideal para salões que vivem de desejo, cor, transformação e prova social.",
    accent: "#8D6CCF",
  },
  {
    value: "heritage_dark",
    label: "Heritage escuro",
    description:
      "Uma atmosfera mais premium e forte, ótima para barbearias e linhas masculinas.",
    previewTitle: "Um app com peso visual, profundidade e presença de marca",
    previewSupport:
      "Funciona muito bem quando o salão quer parecer mais exclusivo e memorável.",
    accent: "#7B4A2C",
  },
  {
    value: "clinical_refined",
    label: "Clínico refinado",
    description:
      "Mais calmo, premium e organizado para protocolos, recorrência e confiança.",
    previewTitle:
      "Clareza premium para clínicas e atendimentos de maior confiança",
    previewSupport:
      "Bom para estética e segmentos que precisam de linguagem mais limpa.",
    accent: "#5F98A4",
  },
] as const;

export const CLIENT_HOME_EMPHASIS_OPTIONS: readonly HomeEmphasisOption[] = [
  {
    value: "auto",
    label: "Automático por segmento",
    description:
      "O app decide o destaque principal com base no tipo de salão e nos dados disponíveis.",
  },
  {
    value: "services",
    label: "Serviços e agendamento",
    description:
      "Puxa serviços, preços e CTA como prioridade para converter mais rápido.",
  },
  {
    value: "portfolio",
    label: "Galeria e inspiração",
    description:
      "Dá mais peso para fotos, últimos trabalhos e prova visual do resultado.",
  },
  {
    value: "schedule",
    label: "Agenda e retorno",
    description:
      "Valoriza próximo horário, agenda viva e recorrência com menos atrito.",
  },
  {
    value: "benefits",
    label: "Benefícios e recorrência",
    description:
      "Puxa fidelidade, cashback, campanhas e motivos para voltar ao salão.",
  },
] as const;

export const CLIENT_APP_THEME_MODE_OPTIONS: readonly PremiumSettingOption<ClientAppThemeMode>[] =
  [
    {
      value: "light",
      label: "Claro premium",
      description:
        "Leitura luminosa, refinada e mais clean para marcas elegantes.",
    },
    {
      value: "dark",
      label: "Escuro premium",
      description:
        "Atmosfera mais densa, sofisticada e de alto contraste para marcas fortes.",
    },
    {
      value: "hybrid",
      label: "Híbrido editorial",
      description:
        "Mistura superfícies claras e profundidade em blocos de destaque.",
    },
  ] as const;

export const CLIENT_APP_BUTTON_STYLE_OPTIONS: readonly PremiumSettingOption<ClientAppButtonStyle>[] =
  [
    {
      value: "capsule",
      label: "Capsule luxury",
      description: "Botões alongados e fluidos, com leitura mais aspiracional.",
    },
    {
      value: "rounded",
      label: "Rounded premium",
      description: "Acabamento arredondado com cara de app pago e moderno.",
    },
    {
      value: "elevated",
      label: "Elevated strong",
      description: "Botões com mais peso visual, sombra e presença de CTA.",
    },
  ] as const;

export const CLIENT_APP_CARD_STYLE_OPTIONS: readonly PremiumSettingOption<ClientAppCardStyle>[] =
  [
    {
      value: "floating",
      label: "Floating card",
      description: "Cards com profundidade sutil e acabamento leve.",
    },
    {
      value: "outlined",
      label: "Outlined editorial",
      description: "Leitura limpa, premium e com contorno mais sofisticado.",
    },
    {
      value: "glass",
      label: "Glass depth",
      description:
        "Superfícies translúcidas com mais atmosfera e presença visual.",
    },
  ] as const;

export const CLIENT_APP_BANNER_STYLE_OPTIONS: readonly PremiumSettingOption<ClientAppBannerStyle>[] =
  [
    {
      value: "immersive",
      label: "Immersive hero",
      description:
        "Banner forte, cinematográfico e com cara de vitrine principal.",
    },
    {
      value: "editorial",
      label: "Editorial hero",
      description:
        "Mais limpo, autoral e voltado para marcas refinadas e fashion.",
    },
    {
      value: "spotlight",
      label: "Spotlight hero",
      description:
        "Foco na imagem e no CTA principal com leitura comercial direta.",
    },
  ] as const;

export const CLIENT_APP_HOME_MODULE_OPTIONS: readonly HomeModuleOption[] = [
  {
    value: "shortcuts",
    label: "Atalhos de serviços",
    description:
      "Categorias curtas e visuais para o cliente achar o que quer rápido.",
  },
  {
    value: "nextBooking",
    label: "Próximo agendamento",
    description:
      "Deixa retorno, horário marcado e recorrência visíveis logo no topo.",
  },
  {
    value: "professionals",
    label: "Profissionais em destaque",
    description: "Mostra especialistas da casa com foto, especialidade e CTA.",
  },
  {
    value: "gallery",
    label: "Galeria e trabalhos",
    description: "Usa imagens e prova social para puxar desejo e conversão.",
  },
  {
    value: "promotions",
    label: "Promoções ativas",
    description: "Expõe campanhas, combos e chamadas comerciais da operação.",
  },
  {
    value: "products",
    label: "Produtos em destaque",
    description: "Abre espaço para vitrine, kits e itens recomendados na home.",
  },
  {
    value: "loyalty",
    label: "Fidelidade e benefícios",
    description:
      "Valoriza cashback, clube VIP e motivos para o cliente voltar.",
  },
] as const;

export const CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS: readonly ClientAppCampaignPriorityOption[] =
  [
    {
      value: "high",
      label: "Alta prioridade",
      description:
        "Aparece primeiro e deve ser usada para recados ou campanhas que pedem ação rápida.",
    },
    {
      value: "medium",
      label: "Prioridade média",
      description:
        "Boa para campanhas da semana, benefícios e chamadas de retorno.",
    },
    {
      value: "low",
      label: "Baixa prioridade",
      description:
        "Funciona como reforço editorial sem tomar a frente da jornada principal.",
    },
  ] as const;

export const CLIENT_APP_CAMPAIGN_TARGET_OPTIONS: readonly ClientAppCampaignTargetOption[] =
  [
    {
      value: "explore",
      label: "Reservar",
      description: "Leva a cliente para catálogo e agendamento dentro do app.",
    },
    {
      value: "appointments",
      label: "Agenda",
      description: "Abre compromissos, confirmações e horários já reservados.",
    },
    {
      value: "feed",
      label: "Central",
      description:
        "Abre a central viva do salão com posts, sinais e campanhas.",
    },
    {
      value: "profile",
      label: "Perfil e benefícios",
      description:
        "Leva para pontos, recompensas, políticas e canais do salão.",
    },
    {
      value: "notifications",
      label: "Avisos",
      description:
        "Abre a central de notificações e recados publicados pelo salão.",
    },
    {
      value: "support",
      label: "Canal do salão",
      description:
        "Leva a cliente para o canal oficial de suporte publicado pelo salão.",
    },
  ] as const;

export const CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS: readonly ClientAppCampaignAudienceOption[] =
  [
    {
      value: "all",
      label: "Toda a base",
      description:
        "A publicação pode aparecer para qualquer cliente que abrir o app.",
    },
    {
      value: "with_upcoming_appointment",
      label: "Quem já tem agenda",
      description:
        "Mostra a peça apenas para clientes com próximo horário marcado.",
    },
    {
      value: "without_upcoming_appointment",
      label: "Quem está sem agenda",
      description:
        "Usa a publicação para puxar reserva ou retorno de quem ainda não tem horário.",
    },
    {
      value: "with_active_benefits",
      label: "Quem já tem benefícios",
      description:
        "Aparece para clientes com pontos, indicações, ofertas ou membership ativa.",
    },
    {
      value: "without_active_benefits",
      label: "Quem ainda não tem benefícios",
      description:
        "Serve para apresentar clube, cashback ou programa de relacionamento para quem ainda não entrou nessa camada.",
    },
  ] as const;

const DEFAULT_CLIENT_APP_CONFIG: SalonClientAppConfig = {
  experienceModel: "auto",
  visualStyle: "auto",
  homeEmphasis: "auto",
  heroHeadline: null,
  heroSupportLine: null,
  primaryCtaLabel: null,
  themeMode: null,
  buttonStyle: null,
  cardStyle: null,
  bannerStyle: null,
  secondaryColor: null,
  accentColor: null,
  welcomeHeadline: null,
  welcomeMessage: null,
  promotionHeadline: null,
  heroImageUrl: null,
  heroImageVariantUrl: null,
  heroImageTabletVariantUrl: null,
  heroImageShareVariantUrl: null,
  galleryCoverImageUrl: null,
  galleryCoverImageVariantUrl: null,
  galleryCoverImageTabletVariantUrl: null,
  galleryCoverImageShareVariantUrl: null,
  profileCoverImageUrl: null,
  profileCoverImageVariantUrl: null,
  profileCoverImageTabletVariantUrl: null,
  profileCoverImageShareVariantUrl: null,
  heroImageFocusX: 50,
  heroImageFocusY: 50,
  heroImageZoom: 1,
  galleryCoverImageFocusX: 50,
  galleryCoverImageFocusY: 50,
  galleryCoverImageZoom: 1,
  profileCoverImageFocusX: 50,
  profileCoverImageFocusY: 50,
  profileCoverImageZoom: 1,
  instagramUrl: null,
  addressLabel: null,
  mapUrl: null,
  privacyPolicyUrl: null,
  termsOfUseUrl: null,
  supportUrl: null,
  supportEmail: null,
  ratingValue: null,
  ratingCount: null,
  visibleHomeModules: [],
  centralCampaigns: [],
  rawConfig: {},
};

export function normalizeSalonClientAppConfig(
  value: Json | null | undefined,
): SalonClientAppConfig {
  const raw = normalizeRawConfig(value);

  return {
    experienceModel: isClientExperienceModel(raw.experienceModel)
      ? raw.experienceModel
      : DEFAULT_CLIENT_APP_CONFIG.experienceModel,
    visualStyle: isClientAppVisualStyle(raw.visualStyle)
      ? raw.visualStyle
      : DEFAULT_CLIENT_APP_CONFIG.visualStyle,
    homeEmphasis: isClientHomeEmphasis(raw.homeEmphasis)
      ? raw.homeEmphasis
      : DEFAULT_CLIENT_APP_CONFIG.homeEmphasis,
    heroHeadline: normalizeNullableText(raw.heroHeadline),
    heroSupportLine: normalizeNullableText(raw.heroSupportLine),
    primaryCtaLabel: normalizeNullableText(raw.primaryCtaLabel),
    themeMode: isClientAppThemeMode(raw.themeMode) ? raw.themeMode : null,
    buttonStyle: isClientAppButtonStyle(raw.buttonStyle)
      ? raw.buttonStyle
      : null,
    cardStyle: isClientAppCardStyle(raw.cardStyle) ? raw.cardStyle : null,
    bannerStyle: isClientAppBannerStyle(raw.bannerStyle)
      ? raw.bannerStyle
      : null,
    secondaryColor: normalizeNullableHexColor(raw.secondaryColor),
    accentColor: normalizeNullableHexColor(raw.accentColor),
    welcomeHeadline: normalizeNullableText(raw.welcomeHeadline),
    welcomeMessage: normalizeNullableText(raw.welcomeMessage),
    promotionHeadline: normalizeNullableText(raw.promotionHeadline),
    heroImageUrl: normalizeNullableText(raw.heroImageUrl),
    heroImageVariantUrl: normalizeNullableText(raw.heroImageVariantUrl),
    heroImageTabletVariantUrl: normalizeNullableText(
      raw.heroImageTabletVariantUrl,
    ),
    heroImageShareVariantUrl: normalizeNullableText(
      raw.heroImageShareVariantUrl,
    ),
    galleryCoverImageUrl: normalizeNullableText(raw.galleryCoverImageUrl),
    galleryCoverImageVariantUrl: normalizeNullableText(
      raw.galleryCoverImageVariantUrl,
    ),
    galleryCoverImageTabletVariantUrl: normalizeNullableText(
      raw.galleryCoverImageTabletVariantUrl,
    ),
    galleryCoverImageShareVariantUrl: normalizeNullableText(
      raw.galleryCoverImageShareVariantUrl,
    ),
    profileCoverImageUrl: normalizeNullableText(raw.profileCoverImageUrl),
    profileCoverImageVariantUrl: normalizeNullableText(
      raw.profileCoverImageVariantUrl,
    ),
    profileCoverImageTabletVariantUrl: normalizeNullableText(
      raw.profileCoverImageTabletVariantUrl,
    ),
    profileCoverImageShareVariantUrl: normalizeNullableText(
      raw.profileCoverImageShareVariantUrl,
    ),
    heroImageFocusX:
      normalizeNullableInteger(raw.heroImageFocusX, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.heroImageFocusX,
    heroImageFocusY:
      normalizeNullableInteger(raw.heroImageFocusY, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.heroImageFocusY,
    heroImageZoom:
      normalizeNullableNumber(raw.heroImageZoom, {
        minimum: 1,
        maximum: 1.8,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.heroImageZoom,
    galleryCoverImageFocusX:
      normalizeNullableInteger(raw.galleryCoverImageFocusX, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.galleryCoverImageFocusX,
    galleryCoverImageFocusY:
      normalizeNullableInteger(raw.galleryCoverImageFocusY, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.galleryCoverImageFocusY,
    galleryCoverImageZoom:
      normalizeNullableNumber(raw.galleryCoverImageZoom, {
        minimum: 1,
        maximum: 1.8,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.galleryCoverImageZoom,
    profileCoverImageFocusX:
      normalizeNullableInteger(raw.profileCoverImageFocusX, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.profileCoverImageFocusX,
    profileCoverImageFocusY:
      normalizeNullableInteger(raw.profileCoverImageFocusY, {
        minimum: 0,
        maximum: 100,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.profileCoverImageFocusY,
    profileCoverImageZoom:
      normalizeNullableNumber(raw.profileCoverImageZoom, {
        minimum: 1,
        maximum: 1.8,
      }) ?? DEFAULT_CLIENT_APP_CONFIG.profileCoverImageZoom,
    instagramUrl: normalizeNullableText(raw.instagramUrl),
    addressLabel: normalizeNullableText(raw.addressLabel),
    mapUrl: normalizeNullableText(raw.mapUrl),
    privacyPolicyUrl: normalizeNullableText(raw.privacyPolicyUrl),
    termsOfUseUrl: normalizeNullableText(raw.termsOfUseUrl),
    supportUrl: normalizeNullableText(raw.supportUrl),
    supportEmail: normalizeNullableText(raw.supportEmail),
    ratingValue: normalizeNullableNumber(raw.ratingValue, {
      minimum: 0,
      maximum: 5,
    }),
    ratingCount: normalizeNullableInteger(raw.ratingCount, {
      minimum: 0,
    }),
    visibleHomeModules: normalizeClientAppHomeModules(raw.visibleHomeModules),
    centralCampaigns: normalizeClientAppCampaigns(raw.centralCampaigns),
    rawConfig: raw,
  };
}

export function serializeSalonClientAppConfig(
  value: SalonClientAppConfig,
): Json {
  const raw = normalizeRawConfig(value.rawConfig);

  raw.experienceModel = value.experienceModel;
  raw.visualStyle = value.visualStyle;
  raw.homeEmphasis = value.homeEmphasis;
  raw.heroHeadline = value.heroHeadline;
  raw.heroSupportLine = value.heroSupportLine;
  raw.primaryCtaLabel = value.primaryCtaLabel;
  setNullableText(raw, "themeMode", value.themeMode);
  setNullableText(raw, "buttonStyle", value.buttonStyle);
  setNullableText(raw, "cardStyle", value.cardStyle);
  setNullableText(raw, "bannerStyle", value.bannerStyle);
  setNullableText(raw, "secondaryColor", value.secondaryColor);
  setNullableText(raw, "accentColor", value.accentColor);
  setNullableText(raw, "welcomeHeadline", value.welcomeHeadline);
  setNullableText(raw, "welcomeMessage", value.welcomeMessage);
  setNullableText(raw, "promotionHeadline", value.promotionHeadline);
  setNullableText(raw, "heroImageUrl", value.heroImageUrl);
  setNullableText(raw, "heroImageVariantUrl", value.heroImageVariantUrl);
  setNullableText(
    raw,
    "heroImageTabletVariantUrl",
    value.heroImageTabletVariantUrl,
  );
  setNullableText(
    raw,
    "heroImageShareVariantUrl",
    value.heroImageShareVariantUrl,
  );
  setNullableText(raw, "galleryCoverImageUrl", value.galleryCoverImageUrl);
  setNullableText(
    raw,
    "galleryCoverImageVariantUrl",
    value.galleryCoverImageVariantUrl,
  );
  setNullableText(
    raw,
    "galleryCoverImageTabletVariantUrl",
    value.galleryCoverImageTabletVariantUrl,
  );
  setNullableText(
    raw,
    "galleryCoverImageShareVariantUrl",
    value.galleryCoverImageShareVariantUrl,
  );
  setNullableText(raw, "profileCoverImageUrl", value.profileCoverImageUrl);
  setNullableText(
    raw,
    "profileCoverImageVariantUrl",
    value.profileCoverImageVariantUrl,
  );
  setNullableText(
    raw,
    "profileCoverImageTabletVariantUrl",
    value.profileCoverImageTabletVariantUrl,
  );
  setNullableText(
    raw,
    "profileCoverImageShareVariantUrl",
    value.profileCoverImageShareVariantUrl,
  );
  setNullableNumber(raw, "heroImageFocusX", value.heroImageFocusX);
  setNullableNumber(raw, "heroImageFocusY", value.heroImageFocusY);
  setNullableNumber(raw, "heroImageZoom", value.heroImageZoom);
  setNullableNumber(
    raw,
    "galleryCoverImageFocusX",
    value.galleryCoverImageFocusX,
  );
  setNullableNumber(
    raw,
    "galleryCoverImageFocusY",
    value.galleryCoverImageFocusY,
  );
  setNullableNumber(raw, "galleryCoverImageZoom", value.galleryCoverImageZoom);
  setNullableNumber(
    raw,
    "profileCoverImageFocusX",
    value.profileCoverImageFocusX,
  );
  setNullableNumber(
    raw,
    "profileCoverImageFocusY",
    value.profileCoverImageFocusY,
  );
  setNullableNumber(raw, "profileCoverImageZoom", value.profileCoverImageZoom);
  setNullableText(
    raw,
    "heroImagePath",
    normalizeNullableText(raw.heroImagePath),
  );
  setNullableText(
    raw,
    "heroImageSourcePath",
    normalizeNullableText(raw.heroImageSourcePath),
  );
  setNullableText(
    raw,
    "heroImageSourceUrl",
    normalizeNullableText(raw.heroImageSourceUrl),
  );
  setNullableText(
    raw,
    "galleryCoverImagePath",
    normalizeNullableText(raw.galleryCoverImagePath),
  );
  setNullableText(
    raw,
    "galleryCoverImageSourcePath",
    normalizeNullableText(raw.galleryCoverImageSourcePath),
  );
  setNullableText(
    raw,
    "galleryCoverImageSourceUrl",
    normalizeNullableText(raw.galleryCoverImageSourceUrl),
  );
  setNullableText(
    raw,
    "profileCoverImagePath",
    normalizeNullableText(raw.profileCoverImagePath),
  );
  setNullableText(
    raw,
    "profileCoverImageSourcePath",
    normalizeNullableText(raw.profileCoverImageSourcePath),
  );
  setNullableText(
    raw,
    "profileCoverImageSourceUrl",
    normalizeNullableText(raw.profileCoverImageSourceUrl),
  );
  setNullableText(raw, "instagramUrl", value.instagramUrl);
  setNullableText(raw, "addressLabel", value.addressLabel);
  setNullableText(raw, "mapUrl", value.mapUrl);
  setNullableText(raw, "privacyPolicyUrl", value.privacyPolicyUrl);
  setNullableText(raw, "termsOfUseUrl", value.termsOfUseUrl);
  setNullableText(raw, "supportUrl", value.supportUrl);
  setNullableText(raw, "supportEmail", value.supportEmail);
  setNullableNumber(raw, "ratingValue", value.ratingValue);
  setNullableNumber(raw, "ratingCount", value.ratingCount);

  if (value.visibleHomeModules.length > 0) {
    raw.visibleHomeModules = [...value.visibleHomeModules];
  } else {
    delete raw.visibleHomeModules;
  }

  if (value.centralCampaigns.length > 0) {
    raw.centralCampaigns = value.centralCampaigns.map((campaign) => ({
      id: campaign.id,
      isActive: campaign.isActive,
      priority: campaign.priority,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      audience: campaign.audience,
      eyebrow: campaign.eyebrow,
      title: campaign.title,
      message: campaign.message,
      campaignLabel: campaign.campaignLabel,
      ctaLabel: campaign.ctaLabel,
      ctaTarget: campaign.ctaTarget,
    }));
  } else {
    delete raw.centralCampaigns;
  }

  return raw;
}

export function resolveClientExperienceModel(
  value: ClientExperienceModel,
  businessSegment: SalonBusinessSegment,
): Exclude<ClientExperienceModel, "auto"> {
  if (value !== "auto") {
    return value;
  }

  switch (businessSegment) {
    case "nail_studio":
      return "nail_gallery";
    case "barbershop":
      return "barber_house";
    case "brows_lashes":
      return "brows_atelier";
    case "aesthetics_clinic":
      return "aesthetic_clinic";
    case "beauty_salon":
    default:
      return "beauty_signature";
  }
}

export function resolveClientAppVisualStyle(
  value: ClientAppVisualStyle,
  businessSegment: SalonBusinessSegment,
  experienceModel: ClientExperienceModel = "auto",
): Exclude<ClientAppVisualStyle, "auto"> {
  if (value !== "auto") {
    return value;
  }

  switch (resolveClientExperienceModel(experienceModel, businessSegment)) {
    case "nail_gallery":
      return "soft_editorial";
    case "barber_house":
      return "heritage_dark";
    case "brows_atelier":
      return "soft_editorial";
    case "aesthetic_clinic":
      return "clinical_refined";
    case "beauty_signature":
    default:
      return "glow_signature";
  }
}

export function resolveClientHomeEmphasis(
  value: ClientHomeEmphasis,
  businessSegment: SalonBusinessSegment,
  experienceModel: ClientExperienceModel = "auto",
): Exclude<ClientHomeEmphasis, "auto"> {
  if (value !== "auto") {
    return value;
  }

  switch (resolveClientExperienceModel(experienceModel, businessSegment)) {
    case "nail_gallery":
      return "portfolio";
    case "barber_house":
      return "schedule";
    case "brows_atelier":
      return "portfolio";
    case "aesthetic_clinic":
      return "benefits";
    case "beauty_signature":
    default:
      return "services";
  }
}

export function getClientExperienceModelOption(value: ClientExperienceModel) {
  return (
    CLIENT_EXPERIENCE_MODEL_OPTIONS.find((option) => option.value === value) ??
    CLIENT_EXPERIENCE_MODEL_OPTIONS[0]
  );
}

export function getClientAppVisualStyleOption(value: ClientAppVisualStyle) {
  return (
    CLIENT_APP_VISUAL_STYLE_OPTIONS.find((option) => option.value === value) ??
    CLIENT_APP_VISUAL_STYLE_OPTIONS[0]
  );
}

export function getClientHomeEmphasisOption(value: ClientHomeEmphasis) {
  return (
    CLIENT_HOME_EMPHASIS_OPTIONS.find((option) => option.value === value) ??
    CLIENT_HOME_EMPHASIS_OPTIONS[0]
  );
}

export function getClientAppCampaignPriorityOption(
  value: ClientAppCampaignPriority,
) {
  return (
    CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS.find(
      (option) => option.value === value,
    ) ?? CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS[1]
  );
}

export function getClientAppCampaignTargetOption(
  value: ClientAppCampaignTarget,
) {
  return (
    CLIENT_APP_CAMPAIGN_TARGET_OPTIONS.find(
      (option) => option.value === value,
    ) ?? CLIENT_APP_CAMPAIGN_TARGET_OPTIONS[0]
  );
}

export function getClientAppCampaignAudienceOption(
  value: ClientAppCampaignAudience,
) {
  return (
    CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS.find(
      (option) => option.value === value,
    ) ?? CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS[0]
  );
}

export function getClientAppThemeModeOption(value: ClientAppThemeMode | null) {
  return (
    CLIENT_APP_THEME_MODE_OPTIONS.find((option) => option.value === value) ??
    null
  );
}

export function getClientAppButtonStyleOption(
  value: ClientAppButtonStyle | null,
) {
  return (
    CLIENT_APP_BUTTON_STYLE_OPTIONS.find((option) => option.value === value) ??
    null
  );
}

export function getClientAppCardStyleOption(value: ClientAppCardStyle | null) {
  return (
    CLIENT_APP_CARD_STYLE_OPTIONS.find((option) => option.value === value) ??
    null
  );
}

export function getClientAppBannerStyleOption(
  value: ClientAppBannerStyle | null,
) {
  return (
    CLIENT_APP_BANNER_STYLE_OPTIONS.find((option) => option.value === value) ??
    null
  );
}

function normalizeRawConfig(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, Json | undefined>;
  const base =
    source.rawConfig &&
    typeof source.rawConfig === "object" &&
    !Array.isArray(source.rawConfig)
      ? { ...(source.rawConfig as Record<string, Json | undefined>) }
      : {};

  for (const [key, entry] of Object.entries(source)) {
    if (key === "rawConfig") {
      continue;
    }

    base[key] = entry;
  }

  return base;
}

function normalizeNullableText(value: Json | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeNullableDateTimeText(value: Json | undefined) {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function normalizeNullableHexColor(value: Json | undefined) {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }

  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function normalizeNullableNumber(
  value: Json | undefined,
  options: { minimum?: number; maximum?: number } = {},
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  if (parsed === null || Number.isNaN(parsed)) {
    return null;
  }

  if (
    (options.minimum !== undefined && parsed < options.minimum) ||
    (options.maximum !== undefined && parsed > options.maximum)
  ) {
    return null;
  }

  return parsed;
}

function normalizeNullableInteger(
  value: Json | undefined,
  options: { minimum?: number; maximum?: number } = {},
) {
  const parsed = normalizeNullableNumber(value, options);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeClientAppHomeModules(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isClientAppHomeModule);
}

function normalizeClientAppCampaigns(value: Json | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => normalizeClientAppCampaign(entry, index))
    .filter((entry): entry is ClientAppCampaign => Boolean(entry));
}

function normalizeClientAppCampaign(
  value: Json | undefined,
  index: number,
): ClientAppCampaign | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, Json | undefined>;
  const title = normalizeNullableText(source.title);
  const message = normalizeNullableText(source.message);
  if (!title || !message) {
    return null;
  }

  return {
    id: normalizeNullableText(source.id) ?? `campaign-${index + 1}`,
    isActive: source.isActive !== false,
    priority: isClientAppCampaignPriority(source.priority)
      ? source.priority
      : "medium",
    startsAt: normalizeNullableDateTimeText(source.startsAt),
    endsAt: normalizeNullableDateTimeText(source.endsAt),
    audience: isClientAppCampaignAudience(source.audience)
      ? source.audience
      : "all",
    eyebrow: normalizeNullableText(source.eyebrow),
    title,
    message,
    campaignLabel: normalizeNullableText(source.campaignLabel),
    ctaLabel: normalizeNullableText(source.ctaLabel),
    ctaTarget: isClientAppCampaignTarget(source.ctaTarget)
      ? source.ctaTarget
      : "explore",
  };
}

function setNullableText(
  target: Record<string, Json | undefined>,
  key: string,
  value: string | null,
) {
  const normalized = value?.trim();

  if (normalized) {
    target[key] = normalized;
    return;
  }

  delete target[key];
}

function setNullableNumber(
  target: Record<string, Json | undefined>,
  key: string,
  value: number | null,
) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    target[key] = value;
    return;
  }

  delete target[key];
}

function isClientExperienceModel(
  value: Json | undefined,
): value is ClientExperienceModel {
  return (
    typeof value === "string" &&
    CLIENT_EXPERIENCE_MODEL_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppVisualStyle(
  value: Json | undefined,
): value is ClientAppVisualStyle {
  return (
    typeof value === "string" &&
    CLIENT_APP_VISUAL_STYLE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientHomeEmphasis(
  value: Json | undefined,
): value is ClientHomeEmphasis {
  return (
    typeof value === "string" &&
    CLIENT_HOME_EMPHASIS_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppThemeMode(
  value: Json | undefined,
): value is ClientAppThemeMode {
  return (
    typeof value === "string" &&
    CLIENT_APP_THEME_MODE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppButtonStyle(
  value: Json | undefined,
): value is ClientAppButtonStyle {
  return (
    typeof value === "string" &&
    CLIENT_APP_BUTTON_STYLE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppCardStyle(
  value: Json | undefined,
): value is ClientAppCardStyle {
  return (
    typeof value === "string" &&
    CLIENT_APP_CARD_STYLE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppBannerStyle(
  value: Json | undefined,
): value is ClientAppBannerStyle {
  return (
    typeof value === "string" &&
    CLIENT_APP_BANNER_STYLE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppHomeModule(
  value: Json | undefined,
): value is ClientAppHomeModule {
  return (
    typeof value === "string" &&
    CLIENT_APP_HOME_MODULE_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppCampaignPriority(
  value: Json | undefined,
): value is ClientAppCampaignPriority {
  return (
    typeof value === "string" &&
    CLIENT_APP_CAMPAIGN_PRIORITY_OPTIONS.some(
      (option) => option.value === value,
    )
  );
}

function isClientAppCampaignTarget(
  value: Json | undefined,
): value is ClientAppCampaignTarget {
  return (
    typeof value === "string" &&
    CLIENT_APP_CAMPAIGN_TARGET_OPTIONS.some((option) => option.value === value)
  );
}

function isClientAppCampaignAudience(
  value: Json | undefined,
): value is ClientAppCampaignAudience {
  return (
    typeof value === "string" &&
    CLIENT_APP_CAMPAIGN_AUDIENCE_OPTIONS.some(
      (option) => option.value === value,
    )
  );
}
