import type { Json } from "@/lib/database.types";
import type { SalonBusinessSegment } from "@/lib/salonSegments";

export type ClientAppVisualStyle =
  | "auto"
  | "soft_editorial"
  | "glow_signature"
  | "heritage_dark"
  | "clinical_refined";

export type ClientHomeEmphasis =
  | "auto"
  | "services"
  | "portfolio"
  | "schedule"
  | "benefits";

export type SalonClientAppConfig = {
  visualStyle: ClientAppVisualStyle;
  homeEmphasis: ClientHomeEmphasis;
  heroHeadline: string | null;
  heroSupportLine: string | null;
  primaryCtaLabel: string | null;
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

const DEFAULT_CLIENT_APP_CONFIG: SalonClientAppConfig = {
  visualStyle: "auto",
  homeEmphasis: "auto",
  heroHeadline: null,
  heroSupportLine: null,
  primaryCtaLabel: null,
};

export function normalizeSalonClientAppConfig(
  value: Json | null | undefined,
): SalonClientAppConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const visualStyle = isClientAppVisualStyle(raw.visualStyle)
    ? raw.visualStyle
    : DEFAULT_CLIENT_APP_CONFIG.visualStyle;
  const homeEmphasis = isClientHomeEmphasis(raw.homeEmphasis)
    ? raw.homeEmphasis
    : DEFAULT_CLIENT_APP_CONFIG.homeEmphasis;

  return {
    visualStyle,
    homeEmphasis,
    heroHeadline: normalizeNullableText(raw.heroHeadline),
    heroSupportLine: normalizeNullableText(raw.heroSupportLine),
    primaryCtaLabel: normalizeNullableText(raw.primaryCtaLabel),
  };
}

export function serializeSalonClientAppConfig(
  value: SalonClientAppConfig,
): Json {
  return {
    visualStyle: value.visualStyle,
    homeEmphasis: value.homeEmphasis,
    heroHeadline: value.heroHeadline,
    heroSupportLine: value.heroSupportLine,
    primaryCtaLabel: value.primaryCtaLabel,
  };
}

export function resolveClientAppVisualStyle(
  value: ClientAppVisualStyle,
  businessSegment: SalonBusinessSegment,
): Exclude<ClientAppVisualStyle, "auto"> {
  if (value !== "auto") {
    return value;
  }

  switch (businessSegment) {
    case "nail_studio":
      return "soft_editorial";
    case "barbershop":
      return "heritage_dark";
    case "brows_lashes":
      return "soft_editorial";
    case "aesthetics_clinic":
      return "clinical_refined";
    case "beauty_salon":
    default:
      return "glow_signature";
  }
}

export function resolveClientHomeEmphasis(
  value: ClientHomeEmphasis,
  businessSegment: SalonBusinessSegment,
): Exclude<ClientHomeEmphasis, "auto"> {
  if (value !== "auto") {
    return value;
  }

  switch (businessSegment) {
    case "nail_studio":
      return "portfolio";
    case "barbershop":
      return "schedule";
    case "brows_lashes":
      return "portfolio";
    case "aesthetics_clinic":
      return "benefits";
    case "beauty_salon":
    default:
      return "services";
  }
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

function normalizeNullableText(value: Json | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
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
