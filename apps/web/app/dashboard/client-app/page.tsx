import Link from "next/link";

import { ActionCommandCenter } from "@/components/ActionCommandCenter";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { formatDateTime } from "@/lib/formatters";

import {
  badgeClassForCategory,
  formatAudienceLabel,
  formatCategoryLabel,
  formatNotificationType,
} from "../notifications/shared";
import { loadClientAppHubData } from "./_lib";

type ClientAppPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

function formatFeedPostType(postType: "standard" | "before_after" | "reel") {
  switch (postType) {
    case "before_after":
      return "Antes e depois";
    case "reel":
      return "Vídeo curto";
    default:
      return "Foto";
  }
}

function buildFeedEditorialNote(post: {
  caption: string | null;
  postType: "standard" | "before_after" | "reel";
  serviceName: string | null;
}) {
  if (post.caption?.trim()) {
    return post.caption;
  }

  if (post.postType === "before_after") {
    return "Transformação com potencial alto de gerar confiança e reserva direta.";
  }

  if (post.postType === "reel") {
    return "Vídeo curto para vender técnica, movimento e acabamento em poucos segundos.";
  }

  if (post.serviceName) {
    return `${post.serviceName} já está virando prova social dentro do app da cliente.`;
  }

  return "Peça editorial que mantém o salão vivo no celular da cliente.";
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
      return "Abre central";
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

function formatCentralCampaignStatus(
  value: "active_now" | "scheduled" | "expired" | "paused",
) {
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

function buildRecommendations(
  data: Awaited<ReturnType<typeof loadClientAppHubData>>,
) {
  const automationLive =
    data.growthAutomationSettings.is_active ||
    data.growthAutomationSettings.smart_rebook_is_active;
  const hasActiveCampaigns = data.centralCampaigns.some(
    (campaign) => campaign.isActive,
  );
  const recommendations = [
    data.brandCoverageCount < 4
      ? {
          eyebrow: "Marca do app",
          title: "Completar a presença visual do app",
          description:
            "Logo, hero, capa de galeria e perfil ainda não estão todos prontos. Essa camada muda a percepção de valor antes mesmo da cliente tocar em reservar.",
          href: "/dashboard/settings",
          ctaLabel: "Ajustar branding",
        }
      : null,
    data.postsCount === 0
      ? {
          eyebrow: "Prova social",
          title: "Publicar a primeira transformação",
          description:
            "Sem feed, a central da cliente perde desejo e confiança. Antes e depois ou vídeo curto são os formatos mais rápidos para mudar isso.",
          href: "/dashboard/feed",
          ctaLabel: "Abrir feed",
        }
      : null,
    data.activeOffersCount === 0
      ? {
          eyebrow: "Comercial",
          title: "Subir campanha, clube ou pacote",
          description:
            "Sem oferta ativa, o app fica mais passivo. Um clube ou campanha publicada cria motivo real para a cliente voltar.",
          href: "/dashboard/benefits/promotions",
          ctaLabel: "Abrir promoções",
        }
      : null,
    !hasActiveCampaigns
      ? {
          eyebrow: "Publicação",
          title: "Publicar a primeira peça operacional da central",
          description:
            "A central do cliente fica mais forte quando o salão publica uma mensagem editorial com prioridade e CTA, além do catálogo e das notificações automáticas.",
          href: "/dashboard/settings",
          ctaLabel: "Abrir app cliente",
        }
      : null,
    !automationLive
      ? {
          eyebrow: "Retenção",
          title: "Ligar rebook e winback",
          description:
            "Sem automação, o app depende demais de operação manual. Rebook e winback trazem o salão de volta para a cabeça da cliente sem esforço diário.",
          href: "/dashboard/benefits/automations",
          ctaLabel: "Abrir automações",
        }
      : null,
    data.activePushTokensCount === 0
      ? {
          eyebrow: "Entrega",
          title: "Recuperar alcance de push",
          description:
            "Sem dispositivos ativos, a cliente não recebe avisos nem campanhas. Vale revisar login, base ativa e comunicação para reativar presença.",
          href: "/dashboard/notifications",
          ctaLabel: "Abrir avisos",
        }
      : null,
  ].filter(
    (
      recommendation,
    ): recommendation is {
      eyebrow: string;
      title: string;
      description: string;
      href: string;
      ctaLabel: string;
    } => Boolean(recommendation),
  );

  return recommendations;
}

export default async function ClientAppPage({
  searchParams,
}: ClientAppPageProps) {
  const data = await loadClientAppHubData();
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
  const automationLive =
    data.growthAutomationSettings.is_active ||
    data.growthAutomationSettings.smart_rebook_is_active;
  const customersOnRadar =
    (data.growthAutomationOverview.due_now_customers ?? 0) +
    (data.growthAutomationOverview.smart_rebook_due_customers ?? 0);

  const commandCards = [
    {
      eyebrow: "Campanhas",
      highlight: `${data.activeOffersCount} no ar`,
      title: "Clubes, pacotes e promoções",
      description:
        "Tudo o que o salão quer empurrar comercialmente para a cliente fica aqui.",
      support:
        data.activeMembershipsCount > 0
          ? `${data.activeMembershipsCount} clube(s) ou pacote(s) já ajudam recorrência no app.`
          : "Suba pelo menos uma campanha para o app não parecer catálogo passivo.",
      href: "/dashboard/benefits/promotions",
      ctaLabel: "Abrir promoções",
      tone: "warm" as const,
    },
    {
      eyebrow: "Retenção",
      highlight: `${customersOnRadar} no radar`,
      title: "Rebook e winback",
      description:
        "Automação para trazer a cliente de volta quando a agenda começa a esfriar.",
      support: automationLive
        ? `Motor ligado com ${data.growthAutomationOverview.winbacks_sent_last_30d ?? 0} winback(s) e ${data.growthAutomationOverview.smart_rebooks_sent_last_30d ?? 0} rebook(s) nos últimos 30 dias.`
        : "O motor ainda está pausado e depende de ação manual do salão.",
      href: "/dashboard/benefits/automations",
      ctaLabel: "Abrir automações",
      tone: "accent" as const,
    },
    {
      eyebrow: "Prova social",
      highlight: `${data.postsCount} publicações`,
      title: "Feed que vende resultado",
      description:
        "Antes e depois, vídeos curtos e referências que aumentam confiança e puxam reserva.",
      support:
        data.postsCount > 0
          ? "A cliente já encontra conteúdo vivo quando abre a central."
          : "Sem feed publicado, o app perde desejo e credibilidade visual.",
      href: "/dashboard/feed",
      ctaLabel: "Abrir feed",
      tone: "soft" as const,
    },
    {
      eyebrow: "Entrega",
      highlight: `${data.recentNotificationsCount} avisos`,
      title: "Push e histórico de comunicação",
      description:
        "Acompanhe o que já foi enviado do painel para a base da cliente e como isso está sustentando retorno.",
      support:
        data.activePushTokensCount > 0
          ? `${data.activePushTokensCount} dispositivo(s) ativo(s), sendo ${data.recentPushTokensCount} com atividade recente.`
          : "Ainda não há alcance push ativo para sustentar a central da cliente.",
      href: "/dashboard/notifications",
      ctaLabel: "Abrir avisos",
      tone: "accent" as const,
    },
    {
      eyebrow: "Marca",
      highlight: `${data.brandCoverageCount}/6 sinais`,
      title: "Branding e estrutura do app",
      description:
        "Ajuste visual, headline, CTA e superfícies da marca que aparecem para a cliente.",
      support:
        data.welcomeHeadline ??
        data.heroHeadline ??
        "A primeira frase da home ainda pode ficar mais forte para vender melhor.",
      href: "/dashboard/settings",
      ctaLabel: "Abrir branding",
      tone: "soft" as const,
    },
  ];

  const touchpoints = [
    ...data.recentNotifications.map((notification) => ({
      id: `notification-${notification.id}`,
      title: notification.title,
      description: notification.body,
      createdAt: notification.createdAt,
      badgeLabel: formatCategoryLabel(notification.category),
      badgeClass: badgeClassForCategory(notification.category),
      meta: `${formatNotificationType(notification.notificationType)} • ${formatAudienceLabel(notification.audience)}`,
      href: "/dashboard/notifications",
      ctaLabel: "Ver aviso",
    })),
    ...data.recentPosts.map((post) => ({
      id: `post-${post.id}`,
      title: post.title,
      description: buildFeedEditorialNote(post),
      createdAt: post.createdAt,
      badgeLabel: "Feed",
      badgeClass: "badge badge--pending",
      meta: `${formatFeedPostType(post.postType)}${post.serviceName ? ` • ligado a ${post.serviceName}` : ""} • ${post.likesCount} curtidas • ${post.commentsCount} comentários`,
      href: "/dashboard/feed",
      ctaLabel: "Ver conteúdo",
    })),
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 6);

  const recommendations = buildRecommendations(data);

  return (
    <div className="page-grid workspace-page">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        eyebrow="Cliente app"
        title="O app da cliente agora pode ser orquestrado como um canal vivo do salão."
        description="Aqui o salão acompanha o que está realmente alimentando a experiência mobile: branding, campanhas, avisos, feed e motores de retorno."
        highlight={{
          label: "Prontidão da central",
          value: `${data.brandCoverageCount}/6 sinais de marca • ${data.recentPushTokensCount} aparelhos recentes`,
          note: automationLive
            ? `${customersOnRadar} cliente(s) já estão na janela de rebook ou winback, ${liveCentralCampaigns.length} publicação(ões) estão no ar agora e ${scheduledCentralCampaigns.length} aguardam a janela certa.`
            : "Sem automação ativa, o app depende mais de campanhas e avisos manuais para gerar retorno.",
        }}
        actions={
          <>
            <Link href="/dashboard/feed" className="primary-button">
              Publicar prova social
            </Link>
            <Link href="/dashboard/notifications" className="secondary-button">
              Abrir avisos
            </Link>
          </>
        }
        signals={[
          {
            label: "Ofertas no app",
            value: data.activeOffersCount,
            tone: "warm",
          },
          {
            label: "Avisos 30 dias",
            value: data.recentNotificationsCount,
            tone: "accent",
          },
          {
            label: "Push ativo",
            value: data.activePushTokensCount,
            tone:
              data.activePushTokensCount > 0
                ? ("success" as const)
                : ("danger" as const),
          },
        ]}
        stats={[
          {
            label: "Conteúdo publicado",
            value: data.postsCount,
            note: "Peças reais já sustentando desejo e prova social no app.",
            tone: "warm",
          },
          {
            label: "Clientes no radar",
            value: customersOnRadar,
            note: "Somatório de rebooks e winbacks que já podem ser acionados.",
            tone: "accent",
          },
          {
            label: "VIP na base",
            value: data.loyaltyOverview.vip_customers ?? 0,
            note: "Clientes com maior valor de recorrência no programa atual.",
            tone: "success",
          },
          {
            label: "Instagram conectado",
            value: data.instagramConnectionCount > 0 ? "Sim" : "Não",
            note:
              data.instagramConnectionCount > 0
                ? "A marca já pode puxar repertório externo para dentro do app."
                : "Ainda vale ligar Instagram para enriquecer descoberta e prova social.",
            tone: data.instagramConnectionCount > 0 ? "soft" : "danger",
          },
        ]}
        aside={
          <>
            <span className="workspace-panel__eyebrow">Arquitetura atual</span>
            <h3>{data.experienceModelLabel}</h3>
            <p>
              Estilo {data.visualStyleLabel.toLowerCase()} com foco principal em{" "}
              {data.homeEmphasisLabel.toLowerCase()}.
            </p>
            <p>
              {data.primaryCtaLabel
                ? `CTA principal configurado: "${data.primaryCtaLabel}".`
                : "O CTA principal ainda está usando o comportamento padrão do modelo."}
            </p>
          </>
        }
      />

      <ActionCommandCenter
        title="Orquestrar o que a cliente vê"
        description="Em vez de gerenciar tela por tela, o salão agora pode operar os motores que realmente alimentam a jornada da cliente."
        cards={commandCards}
      />

      <div className="two-column-grid">
        <section className="card content-card">
          <div className="section-heading">
            <div>
              <h2>O que já está chegando para a cliente</h2>
              <p className="muted">
                Avisos, conteúdo e sinais reais do painel que já podem aparecer
                na central do app cliente.
              </p>
            </div>
          </div>

          {touchpoints.length ? (
            <div className="row-list" style={{ marginTop: 18 }}>
              {touchpoints.map((touchpoint) => (
                <article key={touchpoint.id} className="list-row">
                  <div className="list-row__content">
                    <div className="inline-actions">
                      <span className={touchpoint.badgeClass}>
                        {touchpoint.badgeLabel}
                      </span>
                      <span className="badge badge--soft">
                        {formatDateTime(touchpoint.createdAt)}
                      </span>
                    </div>
                    <h3>{touchpoint.title}</h3>
                    <p>{touchpoint.description}</p>
                    <small className="list-meta">{touchpoint.meta}</small>
                  </div>
                  <div className="list-row__aside">
                    <Link href={touchpoint.href} className="secondary-button">
                      {touchpoint.ctaLabel}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 18 }}>
              <EmptyStateCard
                eyebrow="Central vazia"
                title="Ainda não há sinais vivos para a cliente"
                description="O salão ainda não publicou conteúdo nem disparou avisos recentes. O próximo ganho rápido é subir uma campanha, um feed ou ativar automações."
              />
            </div>
          )}
        </section>

        <section className="card content-card">
          <div className="section-heading">
            <div>
              <h2>Estrutura que sustenta o app cliente</h2>
              <p className="muted">
                Marca, copy e superfícies do app que definem se a cliente sente
                o salão vivo ou básico demais.
              </p>
            </div>
          </div>

          <div className="inline-actions" style={{ marginTop: 18 }}>
            <span className="badge badge--confirmed">
              {data.brandCoverageCount}/6 sinais prontos
            </span>
            <span className="badge badge--soft">
              {data.experienceModelLabel}
            </span>
            <span className="badge badge--soft">
              {liveCentralCampaigns.length} publicações no ar
            </span>
          </div>

          <div className="row-list" style={{ marginTop: 18 }}>
            {data.brandSignals.map((signal) => (
              <article key={signal.label} className="list-row">
                <div className="list-row__content">
                  <div className="inline-actions">
                    <span
                      className={
                        signal.ready
                          ? "badge badge--confirmed"
                          : "badge badge--soft"
                      }
                    >
                      {signal.label}
                    </span>
                    <span className="badge badge--soft">
                      {signal.ready ? "Pronto" : "Pendente"}
                    </span>
                  </div>
                  <h3>{signal.label}</h3>
                  <p>{signal.summary}</p>
                </div>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <small className="list-meta">
              {data.welcomeHeadline || data.heroHeadline
                ? `Headline atual: "${data.welcomeHeadline ?? data.heroHeadline}".`
                : "A headline principal ainda pode ficar mais forte para vender melhor no primeiro impacto."}{" "}
              {data.promotionHeadline
                ? `Linha comercial configurada: "${data.promotionHeadline}".`
                : "Ainda não existe uma linha comercial específica para promoções no app."}
            </small>
          </div>

          {centralCampaigns.length ? (
            <div className="row-list" style={{ marginTop: 18 }}>
              {centralCampaigns.map((campaign) => (
                <article key={campaign.id} className="list-row">
                  <div className="list-row__content">
                    <div className="inline-actions">
                      <span
                        className={
                          campaign.status === "active_now"
                            ? "badge badge--confirmed"
                            : "badge badge--soft"
                        }
                      >
                        {campaign.eyebrow ?? "Publicação da central"}
                      </span>
                      <span className="badge badge--soft">
                        {formatCentralCampaignStatus(campaign.status)}
                      </span>
                      <span className="badge badge--soft">
                        {formatCentralCampaignPriority(campaign.priority)}
                      </span>
                    </div>
                    <h3>{campaign.title}</h3>
                    <p>{campaign.message}</p>
                    <small className="list-meta">
                      {campaign.campaignLabel
                        ? `${campaign.campaignLabel} • `
                        : ""}
                      {formatCentralCampaignAudience(campaign.audience)} •{" "}
                      {formatCentralCampaignWindow(campaign)} •{" "}
                      {campaign.ctaLabel ?? "CTA automático"} •{" "}
                      {formatCentralCampaignTarget(campaign.ctaTarget)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="inline-actions" style={{ marginTop: 18 }}>
            <Link href={data.publicSalonPath} className="secondary-button">
              Ver página pública
            </Link>
            <Link href="/dashboard/settings" className="secondary-button">
              Ajustar app cliente
            </Link>
          </div>
        </section>
      </div>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Próximos ganhos de impacto</h2>
            <p className="muted">
              Prioridades práticas para o app cliente parar de parecer básico e
              começar a vender, reter e puxar retorno com mais clareza.
            </p>
          </div>
        </div>

        {recommendations.length ? (
          <div className="row-list" style={{ marginTop: 18 }}>
            {recommendations.map((recommendation) => (
              <article key={recommendation.title} className="list-row">
                <div className="list-row__content">
                  <div className="inline-actions">
                    <span className="badge badge--pending">
                      {recommendation.eyebrow}
                    </span>
                  </div>
                  <h3>{recommendation.title}</h3>
                  <p>{recommendation.description}</p>
                </div>
                <div className="list-row__aside">
                  <Link href={recommendation.href} className="secondary-button">
                    {recommendation.ctaLabel}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <EmptyStateCard
              eyebrow="Base forte"
              title="A estrutura principal do app já está pronta"
              description="Marca, conteúdo, comunicação e automação já formam uma base boa. O próximo passo é refinar campanhas, copy e frequência com leitura de resultado."
            />
          </div>
        )}
      </section>
    </div>
  );
}
