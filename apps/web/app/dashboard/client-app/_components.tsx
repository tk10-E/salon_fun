import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import {
  getFeedPostEditorialNote,
  getFeedPostTypeLabel,
  getFeedVisualCategory,
  getFeedVisualCategoryLabel,
} from "@/lib/feedPresentation";
import { formatDateTime } from "@/lib/formatters";

import {
  badgeClassForCategory,
  formatAudienceLabel,
  formatCategoryLabel,
  formatNotificationType,
} from "../notifications/shared";
import type { ClientAppHubData } from "./_lib";

type ClientAppPageContentProps = {
  data: ClientAppHubData;
};

type CentralCampaignStatus = "active_now" | "scheduled" | "expired" | "paused";

const SETTINGS_BRAND_IDENTITY_HREF = "/dashboard/settings#brand-identity";
const PROMOTIONS_COMPOSE_HREF = "/dashboard/benefits/promotions?compose=1";

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

function getLinkTargetProps(href: string) {
  return isExternalHref(href)
    ? { rel: "noreferrer", target: "_blank" as const }
    : {};
}

function formatCentralCampaignPriority(value: "high" | "medium" | "low") {
  switch (value) {
    case "high":
      return "Alta prioridade";
    case "low":
      return "Baixa prioridade";
    default:
      return "Prioridade média";
  }
}

function formatCentralCampaignTarget(
  value:
    | "explore"
    | "appointments"
    | "feed"
    | "profile"
    | "notifications"
    | "support",
) {
  switch (value) {
    case "appointments":
      return "Abre agenda";
    case "feed":
      return "Abre a central";
    case "profile":
      return "Abre perfil";
    case "notifications":
      return "Abre avisos";
    case "support":
      return "Abre suporte";
    case "explore":
    default:
      return "Abre reservar";
  }
}

function formatCentralCampaignAudience(
  value:
    | "all"
    | "with_upcoming_appointment"
    | "without_upcoming_appointment"
    | "with_active_benefits"
    | "without_active_benefits",
) {
  switch (value) {
    case "with_upcoming_appointment":
      return "Quem já tem agenda";
    case "without_upcoming_appointment":
      return "Quem está sem agenda";
    case "with_active_benefits":
      return "Quem já tem benefícios";
    case "without_active_benefits":
      return "Quem ainda não tem benefícios";
    case "all":
    default:
      return "Toda a base";
  }
}

function resolveCentralCampaignStatus(campaign: {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}) {
  if (!campaign.isActive) {
    return "paused" as const;
  }

  const now = Date.now();
  const startsAt = campaign.startsAt ? Date.parse(campaign.startsAt) : null;
  const endsAt = campaign.endsAt ? Date.parse(campaign.endsAt) : null;

  if (startsAt !== null && !Number.isNaN(startsAt) && startsAt > now) {
    return "scheduled" as const;
  }

  if (endsAt !== null && !Number.isNaN(endsAt) && endsAt < now) {
    return "expired" as const;
  }

  return "active_now" as const;
}

function formatCentralCampaignStatus(value: CentralCampaignStatus) {
  switch (value) {
    case "scheduled":
      return "Programada";
    case "expired":
      return "Encerrada";
    case "paused":
      return "Pausada";
    case "active_now":
    default:
      return "No ar agora";
  }
}

function formatCentralCampaignWindow(campaign: {
  startsAt: string | null;
  endsAt: string | null;
}) {
  if (campaign.startsAt && campaign.endsAt) {
    return `${formatDateTime(campaign.startsAt)} até ${formatDateTime(campaign.endsAt)}`;
  }

  if (campaign.startsAt) {
    return `Entra em ${formatDateTime(campaign.startsAt)}`;
  }

  if (campaign.endsAt) {
    return `Sai em ${formatDateTime(campaign.endsAt)}`;
  }

  return "Sem janela programada";
}

function buildRecommendations(data: ClientAppHubData) {
  const automationLive =
    data.commercialDataHealth.growthAutomationDashboardReady &&
    (data.growthAutomationSettings.is_active ||
      data.growthAutomationSettings.smart_rebook_is_active);
  const hasActiveCampaigns = data.centralCampaigns.some(
    (campaign) => campaign.isActive,
  );
  const commercialWarningHref = !data.commercialDataHealth.growthAutomationDashboardReady
    ? "/dashboard/benefits/automations"
    : !data.commercialDataHealth.loyaltyDashboardReady
      ? "/dashboard/benefits/loyalty"
      : PROMOTIONS_COMPOSE_HREF;

  return [
    data.commercialDataHealth.hasFallbackData
      ? {
          ctaLabel: "Revisar dados",
          description:
            "Alguns números do app ainda estão sendo atualizados. Revise os blocos com alerta antes de decidir a próxima ação.",
          eyebrow: "Atualização",
          href: commercialWarningHref,
          title: "Revisar números do app",
        }
      : null,
    data.brandCoverageCount < 4
      ? {
          ctaLabel: "Ajustar vitrine",
          description:
            "Logo, capa, galeria e perfil ainda não estão completos.",
          eyebrow: "Vitrine",
          href: SETTINGS_BRAND_IDENTITY_HREF,
          title: "Completar a presença visual do app",
        }
      : null,
    data.postsCount === 0
      ? {
          ctaLabel: "Abrir feed",
          description: "Sem feed, o app perde desejo e confiança.",
          eyebrow: "Prova social",
          href: "/dashboard/feed",
          title: "Publicar a primeira transformação",
        }
      : null,
    data.activeOffersCount === 0
      ? {
          ctaLabel: "Abrir promoções",
          description: "Sem oferta ativa, o app fica mais passivo.",
          eyebrow: "Campanhas",
          href: PROMOTIONS_COMPOSE_HREF,
          title: "Subir campanha, clube ou pacote",
        }
      : null,
    !hasActiveCampaigns
      ? {
          ctaLabel: "Abrir ajustes do app",
          description:
            "A central fica mais forte com mensagem clara e CTA.",
          eyebrow: "Publicação",
          href: SETTINGS_BRAND_IDENTITY_HREF,
          title: "Publicar o primeiro destaque da home",
        }
      : null,
    !data.commercialDataHealth.growthAutomationDashboardReady
      ? null
      : !automationLive
      ? {
          ctaLabel: "Abrir automações",
          description: "Sem automações, o retorno depende mais de ação manual.",
          eyebrow: "Retenção",
          href: "/dashboard/benefits/automations",
          title: "Ligar retornos automáticos",
        }
      : null,
    data.activePushTokensCount === 0
      ? {
          ctaLabel: "Abrir avisos",
          description:
            "Sem clientes com app ativo, os avisos perdem alcance.",
          eyebrow: "Entrega",
          href: "/dashboard/notifications",
          title: "Recuperar alcance dos avisos",
        }
      : null,
  ].filter(
    (
      recommendation,
    ): recommendation is {
      ctaLabel: string;
      description: string;
      eyebrow: string;
      href: string;
      title: string;
    } => Boolean(recommendation),
  );
}

function buildClientAppViewData(data: ClientAppHubData) {
  const centralCampaigns = data.centralCampaigns.map((campaign) => ({
    ...campaign,
    status: resolveCentralCampaignStatus(campaign),
  }));
  const liveCentralCampaigns = centralCampaigns.filter(
    (campaign) => campaign.status === "active_now",
  );
  const scheduledCentralCampaigns = centralCampaigns.filter(
    (campaign) => campaign.status === "scheduled",
  );
  const automationDataReady =
    data.commercialDataHealth.growthAutomationDashboardReady;
  const automationLive =
    automationDataReady &&
    (data.growthAutomationSettings.is_active ||
      data.growthAutomationSettings.smart_rebook_is_active);
  const customersOnRadar = automationDataReady
    ? (data.growthAutomationOverview.due_now_customers ?? 0) +
      (data.growthAutomationOverview.smart_rebook_due_customers ?? 0)
    : null;

  const commandCards = [
    {
      ctaLabel: "Abrir promoções",
      description: "Campanhas e ofertas do app.",
      eyebrow: "Campanhas",
      highlight: `${data.activeOffersCount} no ar`,
      href: PROMOTIONS_COMPOSE_HREF,
      support:
        data.activeMembershipsCount > 0
          ? `${data.activeMembershipsCount} clube(s) ou pacote(s) já ativos.`
          : "Suba pelo menos uma campanha.",
      title: "Clubes, pacotes e promoções",
    },
    {
      ctaLabel: "Abrir automações",
      description: "Ações automáticas para trazer a cliente de volta.",
      eyebrow: "Retenção",
      highlight:
        customersOnRadar == null
          ? "Dados indisponíveis"
          : `${customersOnRadar} em atenção`,
      href: "/dashboard/benefits/automations",
      support: !automationDataReady
        ? "Os números de retorno estão sendo atualizados agora."
        : automationLive
          ? `${data.growthAutomationOverview.winbacks_sent_last_30d ?? 0} reativações e ${data.growthAutomationOverview.smart_rebooks_sent_last_30d ?? 0} lembrete(s) de retorno nos últimos 30 dias.`
          : "A automação ainda está pausada.",
      title: "Retorno automático",
    },
    {
      ctaLabel: "Abrir feed",
      description: "Antes e depois, vídeos curtos e referências do salão.",
      eyebrow: "Prova social",
      highlight: `${data.postsCount} publicações`,
      href: "/dashboard/feed",
      support:
        data.postsCount > 0
          ? "A cliente já encontra conteúdo vivo."
          : "Sem feed publicado, o app perde força visual.",
      title: "Feed do salão",
    },
    {
      ctaLabel: "Abrir avisos",
      description: "Avisos enviados e alcance do app.",
      eyebrow: "Entrega",
      highlight: `${data.recentNotificationsCount} avisos`,
      href: "/dashboard/notifications",
      support:
        data.activePushTokensCount > 0
          ? `${data.activePushTokensCount} clientes com app ativo e ${data.recentPushTokensCount} com uso recente.`
          : "Ainda não há clientes com app ativo para receber avisos.",
      title: "Avisos e comunicação",
    },
    {
      ctaLabel: "Abrir ajustes do app",
      description: "Visual, textos, links e presença da vitrine.",
      eyebrow: "Vitrine",
      highlight: `${data.brandCoverageCount}/${data.brandSignals.length} itens`,
      href: SETTINGS_BRAND_IDENTITY_HREF,
      support: data.customDomain
        ? `Endereço ativo: ${data.customDomain}.`
        : data.welcomeHeadline ??
          data.heroHeadline ??
          "A primeira frase da home ainda pode ficar mais forte.",
      title: data.appDisplayName
        ? `${data.appDisplayName} na vitrine do salão`
        : "Visual e textos do app",
    },
  ];

  const touchpoints = [
    ...data.recentNotifications.map((notification) => ({
      badgeClass: badgeClassForCategory(notification.category),
      badgeLabel: formatCategoryLabel(notification.category),
      ctaLabel: "Ver aviso",
      createdAt: notification.createdAt,
      description: notification.body,
      href: "/dashboard/notifications",
      id: `notification-${notification.id}`,
        meta: `${formatNotificationType(notification.notificationType)} - ${formatAudienceLabel(notification.audience)}`,
      title: notification.title,
    })),
    ...data.recentPosts.map((post) => {
      const visualCategory = getFeedVisualCategory({
        caption: post.caption,
        postType: post.postType,
        serviceName: post.serviceName,
        title: post.title,
      });

      return {
        badgeClass:
          visualCategory === "promotion"
            ? "badge badge--pending"
            : visualCategory === "transformation"
              ? "badge badge--confirmed"
              : "badge badge--soft",
        badgeLabel: getFeedVisualCategoryLabel(visualCategory),
        ctaLabel: "Ver conteúdo",
        createdAt: post.createdAt,
        description: getFeedPostEditorialNote({
          caption: post.caption,
          postType: post.postType,
          serviceName: post.serviceName,
          title: post.title,
          visualCategory,
        }),
        href: "/dashboard/feed",
        id: `post-${post.id}`,
        meta: `${getFeedPostTypeLabel(post.postType)}${post.serviceName ? ` - ligado a ${post.serviceName}` : ""} - ${post.likesCount} curtidas - ${post.commentsCount} comentários`,
        title: post.title,
      };
    }),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6);

  return {
    centralCampaigns,
    commandCards,
    liveCentralCampaigns,
    recommendations: buildRecommendations(data),
    scheduledCentralCampaigns,
    touchpoints,
  };
}

export function ClientAppPageContent({ data }: ClientAppPageContentProps) {
  const viewData = buildClientAppViewData(data);

  return (
    <>
      <ClientAppHeader data={data} />
      {data.commercialDataHealth.hasFallbackData ? (
        <ClientAppDataHealthNotice warnings={data.commercialDataHealth.warnings} />
      ) : null}
      <ClientAppActionsSection commandCards={viewData.commandCards} />
      <ClientAppLiveCenterSection touchpoints={viewData.touchpoints} />
      <ClientAppStatusSection
        brandCoverageCount={data.brandCoverageCount}
        brandSignals={data.brandSignals}
        centralCampaigns={viewData.centralCampaigns}
        liveCentralCampaignsCount={viewData.liveCentralCampaigns.length}
        scheduledCentralCampaignsCount={
          viewData.scheduledCentralCampaigns.length
        }
      />
      <ClientAppRecommendationsSection
        recommendations={viewData.recommendations}
      />
    </>
  );
}

function ClientAppDataHealthNotice({ warnings }: { warnings: string[] }) {
  return (
    <div className="flash flash--error" role="status" aria-live="polite">
      <span className="flash__icon" aria-hidden="true">
        !
      </span>
      <div className="flash__content">
        <strong>Alguns dados do app estão sendo atualizados</strong>
        <p>
          Alguns números ainda estão sincronizando. Revise os itens abaixo antes
          de decidir a próxima ação.
        </p>
        <ul className="simple-list" style={{ marginTop: 8 }}>
          {warnings.map((warning) => (
            <li key={warning} className="muted" style={{ listStyle: "disc", marginLeft: 18 }}>
              {warning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ClientAppHeader({ data }: { data: ClientAppHubData }) {
  const totalBrandSignals = data.brandSignals.length;

  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">App do cliente</p>
        <h1>App do cliente</h1>
        <p className="muted">Veja o que a cliente enxerga e ajuste rápido sem se perder.</p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {data.brandCoverageCount}/{totalBrandSignals} marca pronta
          </span>
          <span className="badge badge--soft">{data.postsCount} posts</span>
          <span className="badge badge--soft">
            {data.activeOffersCount} ofertas
          </span>
          <span className="badge badge--soft">
            {data.activePushTokensCount} clientes com app
          </span>
          {data.commercialDataHealth.hasFallbackData ? (
            <span className="badge badge--pending">Dados em atualização</span>
          ) : null}
        </div>
      </div>
      <div
        className="inline-actions"
        style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
      >
        <Link
          href={data.publicSalonPath}
          className="primary-button"
          {...getLinkTargetProps(data.publicSalonPath)}
        >
          Ver app público
        </Link>
        <Link href={PROMOTIONS_COMPOSE_HREF} className="secondary-button">
          Criar promoção
        </Link>
      </div>
    </header>
  );
}

function ClientAppActionsSection({
  commandCards,
}: {
  commandCards: ReturnType<typeof buildClientAppViewData>["commandCards"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>O que mexer agora</h2>
          <p className="muted">Só o essencial para vender e manter o app vivo.</p>
        </div>
      </div>

      <div className="simple-list">
        {commandCards.map((card) => (
          <article key={card.title} className="simple-row">
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <span className="badge badge--soft">{card.eyebrow}</span>
              <span className="badge badge--confirmed">{card.highlight}</span>
            </div>
            <h3>{card.title}</h3>
            <p className="muted">{card.description}</p>
            <small className="list-meta">{card.support}</small>
            <div className="simple-row__actions" style={{ marginTop: 10 }}>
              <Link href={card.href} className="primary-button">
                {card.ctaLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientAppLiveCenterSection({
  touchpoints,
}: {
  touchpoints: ReturnType<typeof buildClientAppViewData>["touchpoints"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>O que a cliente vê</h2>
          <p className="muted">Últimos avisos e posts publicados.</p>
        </div>
        <span className="badge badge--soft">{touchpoints.length} itens recentes</span>
      </div>

      {touchpoints.length ? (
        <div className="simple-list">
          {touchpoints.map((touchpoint) => (
            <article key={touchpoint.id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6 }}>
                <span className={touchpoint.badgeClass}>
                  {touchpoint.badgeLabel}
                </span>
                <span className="badge badge--soft">
                  {formatDateTime(touchpoint.createdAt)}
                </span>
              </div>
              <h3>{touchpoint.title}</h3>
              <p className="muted">{touchpoint.description}</p>
              <small className="list-meta">{touchpoint.meta}</small>
              <div className="simple-row__actions" style={{ marginTop: 8 }}>
                <Link href={touchpoint.href} className="secondary-button">
                  {touchpoint.ctaLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Central vazia"
          title="Nada ao vivo ainda"
          description="Publique um post ou aviso rápido para a cliente ver."
        />
      )}
    </section>
  );
}

function ClientAppStatusSection({
  brandCoverageCount,
  brandSignals,
  centralCampaigns,
  liveCentralCampaignsCount,
  scheduledCentralCampaignsCount,
}: {
  brandCoverageCount: number;
  brandSignals: ClientAppHubData["brandSignals"];
  centralCampaigns: ReturnType<typeof buildClientAppViewData>["centralCampaigns"];
  liveCentralCampaignsCount: number;
  scheduledCentralCampaignsCount: number;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Base do app</h2>
          <p className="muted">Marca, campanhas e itens que deixam a vitrine pronta.</p>
        </div>
        <div className="inline-actions" style={{ flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {brandCoverageCount}/{brandSignals.length} marca
          </span>
          <span className="badge badge--soft">
            {liveCentralCampaignsCount} no ar
          </span>
          <span className="badge badge--soft">
            {scheduledCentralCampaignsCount} programadas
          </span>
        </div>
      </div>

      <div className="simple-list">
        {brandSignals.map((signal) => (
          <article key={signal.label} className="simple-row">
            <div className="inline-actions" style={{ marginBottom: 4 }}>
              <span
                className={
                  signal.ready ? "badge badge--confirmed" : "badge badge--soft"
                }
              >
                {signal.ready ? "Pronto" : "Pendente"}
              </span>
              <span className="badge badge--soft">{signal.label}</span>
            </div>
            <p>{signal.summary}</p>
          </article>
        ))}
      </div>

      <div className="simple-list" style={{ marginTop: 12 }}>
        {centralCampaigns.map((campaign) => (
          <article key={campaign.id} className="simple-row">
            <div className="inline-actions" style={{ marginBottom: 6 }}>
              <span className="badge badge--soft">
                {formatCentralCampaignStatus(campaign.status)}
              </span>
              <span className="badge badge--soft">
                {formatCentralCampaignPriority(campaign.priority)}
              </span>
            </div>
            <h3>{campaign.title}</h3>
            <p className="muted">{campaign.message}</p>
            <small className="list-meta">
              {formatCentralCampaignAudience(campaign.audience)} -{" "}
              {formatCentralCampaignWindow(campaign)} -{" "}
              {formatCentralCampaignTarget(campaign.ctaTarget)}
            </small>
          </article>
        ))}
        {!centralCampaigns.length ? (
          <EmptyStateCard
            eyebrow="Sem publicações"
            title="A central ainda não tem peças"
            description="Publique uma campanha simples para a cliente ver."
          />
        ) : null}
      </div>

      <div className="simple-row__actions" style={{ marginTop: 12 }}>
        <Link
          href={SETTINGS_BRAND_IDENTITY_HREF}
          className="secondary-button"
        >
          Ajustar vitrine
        </Link>
        <Link href="/dashboard/notifications" className="secondary-button">
          Enviar aviso
        </Link>
      </div>
    </section>
  );
}

function ClientAppRecommendationsSection({
  recommendations,
}: {
  recommendations: ReturnType<typeof buildClientAppViewData>["recommendations"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Próximos passos</h2>
          <p className="muted">Ajustes simples para fazer o app vender mais.</p>
        </div>
      </div>

      {recommendations.length ? (
        <div className="simple-list">
          {recommendations.slice(0, 4).map((recommendation) => (
            <article key={recommendation.title} className="simple-row">
              <span className="badge badge--pending" style={{ marginBottom: 6 }}>
                {recommendation.eyebrow}
              </span>
              <h3>{recommendation.title}</h3>
              <p className="muted">{recommendation.description}</p>
              <div className="simple-row__actions" style={{ marginTop: 8 }}>
                <Link href={recommendation.href} className="primary-button">
                  {recommendation.ctaLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Base forte"
          title="A estrutura principal do app já está pronta"
          description="O próximo passo é manter publicações regulares."
        />
      )}
    </section>
  );
}
