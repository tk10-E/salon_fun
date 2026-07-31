import {
  createOpenRouterChatCompletion,
  getOpenRouterModel,
  isOpenRouterEnabled,
} from "@/lib/ai/openrouter";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  buildPromotionDraftSystemPrompt,
  buildPromotionDraftUserPrompt,
} from "@/lib/ai/prompts/promotionDraftPrompt";

type PromotionDraftKind = "membership" | "promotion";

type PromotionServiceOption = {
  id: string;
  label: string;
};

type GeneratePromotionDraftArgs = {
  descriptionHint?: string | null;
  goal?: string | null;
  highlightHint?: string | null;
  kind: PromotionDraftKind;
  notes?: string | null;
  priceHint?: number | null;
  requestOrigin?: string | null;
  salonName: string;
  serviceId?: string | null;
  serviceName?: string | null;
  serviceOptions?: PromotionServiceOption[] | null;
  timeZone?: string | null;
  titleHint?: string | null;
};

type PromotionDraftResult = {
  description: string;
  endsOn: string | null;
  highlightText: string;
  model: string;
  priceSuggestion: number | null;
  serviceId: string | null;
  sessionsIncluded: number | null;
  startsOn: string | null;
  title: string;
  validityDays: number | null;
};

const DEFAULT_TIME_ZONE = "America/Sao_Paulo";
const MAX_TITLE_CHARS = 60;
const MAX_HIGHLIGHT_CHARS = 90;
const MAX_DESCRIPTION_CHARS = 260;

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceWordWithAccent(
  value: string,
  pattern: RegExp,
  replacement: string,
) {
  return value.replace(pattern, (match) =>
    match[0] === match[0]?.toUpperCase()
      ? replacement[0]!.toUpperCase() + replacement.slice(1)
      : replacement,
  );
}

function polishMarketingCopy(
  value: string | null | undefined,
  maxLength: number,
  field: "description" | "highlight" | "title",
) {
  let normalized = cleanText(value, maxLength);

  if (!normalized) {
    return "";
  }

  const replacements: Array<[RegExp, string]> = [
    [/\bagendamento rapido\b/gi, "agendamento rápido"],
    [/\bcondicao\b/gi, "condição"],
    [/\bcondicoes\b/gi, "condições"],
    [/\bdescricao\b/gi, "descrição"],
    [/\bmes\b/gi, "mês"],
    [/\bpromocao\b/gi, "promoção"],
    [/\bpromocoes\b/gi, "promoções"],
    [/\bsalao\b/gi, "salão"],
    [/\bservico\b/gi, "serviço"],
    [/\bservicos\b/gi, "serviços"],
    [/\bsessoes\b/gi, "sessões"],
    [/\bvoce\b/gi, "você"],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = replaceWordWithAccent(normalized, pattern, replacement);
  }

  normalized = normalized.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  normalized = normalized[0]!.toUpperCase() + normalized.slice(1);

  if (field !== "title" && !/[.!?]$/.test(normalized)) {
    normalized += ".";
  }

  return normalized.slice(0, maxLength).trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", ".").trim());
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
}

function normalizePositiveInteger(value: unknown) {
  const numeric = normalizeNumber(value);

  if (numeric == null) {
    return null;
  }

  const normalized = Math.floor(numeric);
  return normalized >= 1 ? normalized : null;
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const probe = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(probe.getTime()) ? null : normalized;
}

function parseDraftJson(raw: string) {
  const candidates = [
    raw.trim(),
    raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/```([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        description?: unknown;
        endsOn?: unknown;
        highlightText?: unknown;
        priceSuggestion?: unknown;
        serviceId?: unknown;
        sessionsIncluded?: unknown;
        startsOn?: unknown;
        title?: unknown;
        validityDays?: unknown;
      };

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // keep trying
    }
  }

  return null;
}

function getTodayInTimeZone(timeZone?: string | null) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timeZone?.trim() || DEFAULT_TIME_ZONE,
    year: "numeric",
  });

  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(
    parts.find((part) => part.type === "month")?.value ?? "1",
  );
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");

  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNextWeekday(date: Date, targetWeekday: number) {
  const diff = (targetWeekday - date.getUTCDay() + 7) % 7;
  return addDays(date, diff);
}

function resolveServiceNameFromOptions(
  serviceOptions: PromotionServiceOption[],
  serviceId: string | null,
) {
  if (!serviceId) {
    return null;
  }

  return (
    serviceOptions.find((option) => option.id === serviceId)?.label?.trim() ??
    null
  );
}

function pickSuggestedServiceId(args: GeneratePromotionDraftArgs) {
  const serviceOptions = args.serviceOptions ?? [];

  if (args.kind !== "membership" || !serviceOptions.length) {
    return null;
  }

  if (args.serviceId && serviceOptions.some((option) => option.id === args.serviceId)) {
    return args.serviceId;
  }

  if (serviceOptions.length === 1) {
    return serviceOptions[0]!.id;
  }

  const lookup = normalizeLookupText(
    [
      args.titleHint,
      args.highlightHint,
      args.descriptionHint,
      args.goal,
      args.notes,
      args.serviceName,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (!lookup) {
    return null;
  }

  for (const option of serviceOptions) {
    const label = normalizeLookupText(option.label);

    if (!label) {
      continue;
    }

    if (lookup.includes(label)) {
      return option.id;
    }

    const labelParts = label
      .split(/\s{2,}| • | \/ | - |, /)
      .map((part) => part.trim())
      .filter((part) => part.length >= 4);

    if (labelParts.some((part) => lookup.includes(part))) {
      return option.id;
    }
  }

  return null;
}

function normalizeSuggestedServiceId(
  value: unknown,
  serviceOptions: PromotionServiceOption[],
) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return serviceOptions.some((option) => option.id === normalized)
    ? normalized
    : null;
}

function resolveOfferWindow(
  args: GeneratePromotionDraftArgs,
  validityDays: number | null,
) {
  const today = getTodayInTimeZone(args.timeZone);
  const goal = normalizeLookupText(args.goal);

  if (args.kind === "membership") {
    const suggestedWindowDays = Math.max(14, Math.min(validityDays ?? 30, 45));
    return {
      endsOn: toIsoDate(addDays(today, suggestedWindowDays - 1)),
      startsOn: toIsoDate(today),
    };
  }

  if (goal.includes("sexta")) {
    const friday = getNextWeekday(today, 5);
    return {
      endsOn: toIsoDate(friday),
      startsOn: toIsoDate(friday),
    };
  }

  if (goal.includes("reativar")) {
    return {
      endsOn: toIsoDate(addDays(today, 9)),
      startsOn: toIsoDate(today),
    };
  }

  if (goal.includes("semana")) {
    return {
      endsOn: toIsoDate(addDays(today, 6)),
      startsOn: toIsoDate(today),
    };
  }

  return {
    endsOn: toIsoDate(addDays(today, 6)),
    startsOn: toIsoDate(today),
  };
}

function buildFallbackDraft(
  args: GeneratePromotionDraftArgs,
): PromotionDraftResult {
  const serviceOptions = args.serviceOptions ?? [];
  const serviceId = pickSuggestedServiceId(args);
  const resolvedServiceName =
    resolveServiceNameFromOptions(serviceOptions, serviceId) ??
    cleanText(args.serviceName, 80) ??
    "";
  const serviceName = resolvedServiceName || "serviço especial";
  const lowerServiceName =
    serviceName[0]?.toLowerCase() + serviceName.slice(1);
  const suggestedSessions = args.kind === "membership" ? 4 : null;
  const suggestedValidityDays = args.kind === "membership" ? 30 : null;
  const period = resolveOfferWindow(args, suggestedValidityDays);

  const title =
    polishMarketingCopy(args.titleHint, MAX_TITLE_CHARS, "title") ||
    polishMarketingCopy(
      args.kind === "membership"
        ? `Plano mensal de ${serviceName}`
        : `${serviceName} da semana`,
      MAX_TITLE_CHARS,
      "title",
    ) ||
    "Oferta do salão";

  const highlightText =
    polishMarketingCopy(args.highlightHint, MAX_HIGHLIGHT_CHARS, "highlight") ||
    polishMarketingCopy(
      args.kind === "membership"
        ? `Valor fixo para manter ${lowerServiceName} em dia com mais facilidade para agendar`
        : `Condição especial para ${lowerServiceName} com vagas limitadas e agendamento rápido`,
      MAX_HIGHLIGHT_CHARS,
      "highlight",
    ) ||
    "Oferta pronta para o app do salão.";

  const description =
    polishMarketingCopy(args.descriptionHint, MAX_DESCRIPTION_CHARS, "description") ||
    polishMarketingCopy(
      args.kind === "membership"
        ? `Plano criado para manter a frequência de ${lowerServiceName} em dia, com valor previsível, sessões definidas e retorno recorrente ao salão`
        : `Campanha criada para vender ${lowerServiceName} com comunicação clara, boa percepção de valor e chamada objetiva para o app`,
      MAX_DESCRIPTION_CHARS,
      "description",
    ) ||
    "Oferta pronta para publicar no app do salão.";

  return {
    description,
    endsOn: period.endsOn,
    highlightText,
    model: `${getOpenRouterModel()} (fallback)`,
    priceSuggestion: args.priceHint ?? null,
    serviceId,
    sessionsIncluded: suggestedSessions,
    startsOn: period.startsOn,
    title,
    validityDays: suggestedValidityDays,
  };
}

export function isPromotionDraftAiEnabled() {
  return isOpenRouterEnabled();
}

export async function generatePromotionDraftWithAi(
  args: GeneratePromotionDraftArgs,
): Promise<PromotionDraftResult> {
  const fallbackDraft = buildFallbackDraft(args);
  const goal = cleanText(args.goal, 120);
  const notes = cleanText(args.notes, 220);
  const titleHint = cleanText(args.titleHint, 80);
  const highlightHint = cleanText(args.highlightHint, 120);
  const descriptionHint = cleanText(args.descriptionHint, 320);
  const serviceName =
    cleanText(args.serviceName, 80) ||
    resolveServiceNameFromOptions(args.serviceOptions ?? [], fallbackDraft.serviceId) ||
    "serviço especial";
  const serviceOptions = (args.serviceOptions ?? []).slice(0, 40);
  const todayLabel = fallbackDraft.startsOn ?? toIsoDate(getTodayInTimeZone(args.timeZone));
  const systemPrompt = buildPromotionDraftSystemPrompt({
    kind: args.kind,
  });
  const userPrompt = buildPromotionDraftUserPrompt({
    descriptionHint,
    goal,
    highlightHint,
    kind: args.kind,
    notes,
    preferredServiceId: fallbackDraft.serviceId,
    priceHint: args.priceHint ?? null,
    salonName: cleanText(args.salonName, 80) || "Salao parceiro",
    serviceName,
    serviceOptions: serviceOptions.length
      ? serviceOptions.map(
          (option) => `${option.id} = ${cleanText(option.label, 120)}`,
        )
      : undefined,
    titleHint,
    todayLabel,
  });

  let model: string;
  let text: string;

  try {
    const result = await createOpenRouterChatCompletion({
      feature: AI_FEATURE_REGISTRY.promotionDraft.feature,
      maxTokens: 320,
      requestOrigin: args.requestOrigin,
      temperature: 0.8,
      timeoutMs: 8_000,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    model = result.model;
    text = result.text;
  } catch {
    return fallbackDraft;
  }

  const parsed = parseDraftJson(text);

  if (!parsed) {
    return fallbackDraft;
  }

  const title = polishMarketingCopy(
    typeof parsed.title === "string" ? parsed.title : fallbackDraft.title,
    MAX_TITLE_CHARS,
    "title",
  );
  const highlightText = polishMarketingCopy(
    typeof parsed.highlightText === "string"
      ? parsed.highlightText
      : fallbackDraft.highlightText,
    MAX_HIGHLIGHT_CHARS,
    "highlight",
  );
  const description = polishMarketingCopy(
    typeof parsed.description === "string"
      ? parsed.description
      : fallbackDraft.description,
    MAX_DESCRIPTION_CHARS,
    "description",
  );

  if (!title || !highlightText || !description) {
    return fallbackDraft;
  }

  const serviceId =
    args.kind === "membership"
      ? normalizeSuggestedServiceId(parsed.serviceId, serviceOptions) ??
        fallbackDraft.serviceId
      : null;
  const sessionsIncluded =
    args.kind === "membership"
      ? normalizePositiveInteger(parsed.sessionsIncluded) ??
        fallbackDraft.sessionsIncluded
      : null;
  const validityDays =
    args.kind === "membership"
      ? normalizePositiveInteger(parsed.validityDays) ??
        fallbackDraft.validityDays
      : null;
  const fallbackPeriod = resolveOfferWindow(args, validityDays);
  const startsOn = normalizeIsoDate(parsed.startsOn) ?? fallbackPeriod.startsOn;
  let endsOn = normalizeIsoDate(parsed.endsOn) ?? fallbackPeriod.endsOn;

  if (startsOn && endsOn && endsOn < startsOn) {
    endsOn = fallbackPeriod.endsOn;
  }

  return {
    description,
    endsOn,
    highlightText,
    model,
    priceSuggestion: normalizeNumber(parsed.priceSuggestion) ?? args.priceHint ?? null,
    serviceId,
    sessionsIncluded,
    startsOn,
    title,
    validityDays,
  };
}
