export type SalonBusinessSegment =
  | "beauty_salon"
  | "nail_studio"
  | "barbershop"
  | "brows_lashes"
  | "aesthetics_clinic";

export type SalonSegmentPreset = {
  value: SalonBusinessSegment;
  label: string;
  description: string;
  shortDescription: string;
  suggestedBrandColor: string;
  mobileHeadline: string;
  mobileSupport: string;
  focusAreas: [string, string, string];
  previewCards: [
    { eyebrow: string; title: string; description: string },
    { eyebrow: string; title: string; description: string },
  ];
};

export const SALON_SEGMENT_PRESETS: readonly SalonSegmentPreset[] = [
  {
    value: "beauty_salon",
    label: "Salão feminino",
    description:
      "Traz uma experiência mais voltada a transformação, pacotes, benefícios e inspiração visual.",
    shortDescription: "Transformação, agenda e benefícios com apelo mais aspiracional.",
    suggestedBrandColor: "#C56B43",
    mobileHeadline: "Transformação, agenda e benefícios com cara do seu salão",
    mobileSupport:
      "A home valoriza desejo, vitrine, pacotes e retorno com uma linguagem mais acolhedora.",
    focusAreas: ["Transformações", "Pacotes", "Retenção"],
    previewCards: [
      {
        eyebrow: "Home",
        title: "Cuidado, desejo e retorno no mesmo fluxo",
        description: "A vitrine ajuda a decidir, a agenda reduz atrito e a carteira puxa recorrência.",
      },
      {
        eyebrow: "Feed",
        title: "Antes e depois com mais força comercial",
        description: "O cliente vê resultado real, conversa com o salão e agenda no embalo da inspiração.",
      },
    ],
  },
  {
    value: "nail_studio",
    label: "Nail studio",
    description:
      "Puxa mais vitrine visual, manutenção, combinações e fidelidade para quem volta com frequência.",
    shortDescription: "Inspiração visual, manutenção e fidelidade como centro da experiência.",
    suggestedBrandColor: "#B35D77",
    mobileHeadline: "Inspiração, manutenção e carteira pensadas para o seu studio",
    mobileSupport:
      "O app destaca referência visual, próxima manutenção e motivos para a cliente voltar sempre.",
    focusAreas: ["Inspirações", "Manutenção", "Fidelidade"],
    previewCards: [
      {
        eyebrow: "Home",
        title: "Agenda pronta para o próximo retoque",
        description: "A experiência puxa manutenção, benefícios ativos e o próximo cuidado sem esforço.",
      },
      {
        eyebrow: "Feed",
        title: "Vitrine forte para nail art e acabamento",
        description: "Fotos e vídeos curtos ajudam a cliente a escolher rápido e já pedir a referência certa.",
      },
    ],
  },
  {
    value: "barbershop",
    label: "Barbearia",
    description:
      "Torna o app mais direto, com foco em recorrência, profissional em destaque e corte em dia.",
    shortDescription: "Recorrência rápida, profissionais fortes e linguagem mais direta.",
    suggestedBrandColor: "#6D8B74",
    mobileHeadline: "Corte, barba e recorrência com assinatura da sua barbearia",
    mobileSupport:
      "O app valoriza agenda rápida, profissional em destaque e portfólio de estilos com leitura mais objetiva.",
    focusAreas: ["Recorrência", "Profissionais", "Portfólio"],
    previewCards: [
      {
        eyebrow: "Home",
        title: "Seu cliente entende rápido quando voltar",
        description: "A home enfatiza próximo corte, vaga disponível e contato direto sem enrolação.",
      },
      {
        eyebrow: "Feed",
        title: "Estilos e acabamentos viram agendamento",
        description: "O portfólio puxa desejo pelo resultado e ajuda a descobrir o barbeiro certo.",
      },
    ],
  },
  {
    value: "brows_lashes",
    label: "Sobrancelha e cílios",
    description:
      "Dá mais peso para precisão, manutenção, cuidado e resultados delicados de alto valor percebido.",
    shortDescription: "Precisão, manutenção e resultado delicado como diferencial principal.",
    suggestedBrandColor: "#8A6A5A",
    mobileHeadline: "Retoques, resultados delicados e confiança no mesmo app",
    mobileSupport:
      "A jornada destaca próxima manutenção, cuidado contínuo e uma vitrine mais refinada para conversão.",
    focusAreas: ["Retoques", "Confiança", "Resultado delicado"],
    previewCards: [
      {
        eyebrow: "Home",
        title: "Próximo retoque já aparece com contexto certo",
        description: "O app lembra a cliente do momento ideal de voltar e mostra benefícios sem poluir a tela.",
      },
      {
        eyebrow: "Feed",
        title: "Resultados delicados com mais credibilidade",
        description: "A vitrine reforça técnica, acabamento e confiança antes mesmo do primeiro contato.",
      },
    ],
  },
  {
    value: "aesthetics_clinic",
    label: "Estética",
    description:
      "Organiza a experiência para protocolos, acompanhamento, confiança e ticket maior com percepção premium.",
    shortDescription: "Protocolos, confiança e acompanhamento com leitura mais premium.",
    suggestedBrandColor: "#4E8E94",
    mobileHeadline: "Protocolos, acompanhamento e confiança com cara de clínica",
    mobileSupport:
      "A experiência valoriza sequência de cuidados, linguagem mais premium e clareza de retorno.",
    focusAreas: ["Protocolos", "Acompanhamento", "Premium"],
    previewCards: [
      {
        eyebrow: "Home",
        title: "O cliente entende a próxima etapa com mais clareza",
        description: "A home puxa retorno, benefícios e agenda como continuação natural do tratamento.",
      },
      {
        eyebrow: "Feed",
        title: "Resultados ganham contexto e credibilidade",
        description: "O feed reforça confiança e ajuda o cliente a enxergar valor antes de reservar.",
      },
    ],
  },
] as const;

export const SALON_SEGMENT_OPTIONS = SALON_SEGMENT_PRESETS.map((preset) => ({
  value: preset.value,
  label: preset.label,
  description: preset.shortDescription,
}));

export function isSalonBusinessSegment(value: string): value is SalonBusinessSegment {
  return SALON_SEGMENT_PRESETS.some((preset) => preset.value === value);
}

export function normalizeSalonBusinessSegment(value: string | null | undefined): SalonBusinessSegment {
  const normalized = value?.trim();
  return normalized && isSalonBusinessSegment(normalized) ? normalized : "beauty_salon";
}

export function getSalonSegmentPreset(value: string | null | undefined): SalonSegmentPreset {
  const normalized = normalizeSalonBusinessSegment(value);
  return SALON_SEGMENT_PRESETS.find((preset) => preset.value === normalized) ?? SALON_SEGMENT_PRESETS[0];
}
