import { FlashMessage } from "@/components/FlashMessage";
import {
  parseAiObservabilityOutcomeFilter,
  getAiObservabilitySnapshot,
  parseAiObservabilityPeriodDays,
} from "@/lib/ai/observability";
import {
  listPanelAssistantHistory,
  type PanelAssistantHistoryItem,
} from "@/lib/ai/panelAssistant";
import { getPanelAssistantIntentLabel } from "@/lib/ai/skills/registry";
import { requireOwnerSalon } from "@/lib/auth";
import { measureServerRender } from "@/lib/serverPerformance";

import { DashboardAiPageContent } from "./_components";

export type DashboardAiPageProps = {
  searchParams?: Promise<{
    debug?: string;
    day?: string;
    feature?: string;
    message?: string;
    model?: string;
    outcome?: string;
    period?: string;
    promptProfile?: string;
    skill?: string;
    tone?: string;
  }>;
};

function formatHistoryMoment(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardAiPage({
  searchParams: searchParamsPromise,
}: DashboardAiPageProps) {
  return measureServerRender("dashboard.ai", async () => {
    const [{ salon, user }, searchParams] = await Promise.all([
      requireOwnerSalon(),
      searchParamsPromise,
    ]);
    const showInternalTools =
      user.canAccessInternalAiObservability &&
      searchParams?.debug === "ai";
    const periodDays = parseAiObservabilityPeriodDays(searchParams?.period);
    const [history, observability] = await Promise.all([
      listPanelAssistantHistory({
        limit: 20,
        salonId: salon.id,
      }),
      showInternalTools
        ? getAiObservabilitySnapshot({
            filters: {
              day: searchParams?.day ?? null,
              feature: searchParams?.feature ?? null,
              model: searchParams?.model ?? null,
              outcome: parseAiObservabilityOutcomeFilter(
                searchParams?.outcome ?? null,
              ),
              periodDays,
              promptProfile: searchParams?.promptProfile ?? null,
              skillId: searchParams?.skill ?? null,
            },
            limit: 1500,
            salonId: salon.id,
          })
        : Promise.resolve(null),
    ]);
    const lastWeekThreshold = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const lastWeekCount = history.filter(
      (item) => new Date(item.createdAt).getTime() >= lastWeekThreshold,
    ).length;
    const topIntent =
      [
        ...history
          .reduce((map, item) => {
            map.set(item.intent, (map.get(item.intent) ?? 0) + 1);
            return map;
          }, new Map<PanelAssistantHistoryItem["intent"], number>())
          .entries(),
      ].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "panel_help";

    return (
      <div className="page-grid dashboard-home dashboard-home--simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <DashboardAiPageContent
          aiEnabled={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
        history={history.map((item) => ({
          ...item,
          createdAtLabel: formatHistoryMoment(item.createdAt),
          intentLabel: getPanelAssistantIntentLabel(item.intent),
        }))}
          metrics={{
            lastUsageLabel: history[0]
              ? `Ultima consulta: ${formatHistoryMoment(history[0].createdAt)}`
              : "Sem histórico ainda",
            lastWeekCount,
            topIntentLabel: getPanelAssistantIntentLabel(topIntent),
            totalCount: history.length,
          }}
          observability={
            observability
              ? {
                  appliedFilters: observability.appliedFilters,
                  breakdowns: observability.breakdowns,
                  entries: observability.entries.map((item) => ({
                    ...item,
                    createdAtLabel: formatHistoryMoment(item.createdAt),
                  })),
                  options: observability.options,
                  totals: observability.totals,
                  trend: observability.trend,
                }
              : undefined
          }
          showInternalTools={showInternalTools}
        />
      </div>
    );
  });
}
