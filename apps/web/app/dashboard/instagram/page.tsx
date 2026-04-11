/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  approveInstagramMentionAction,
  publishInstagramMentionAction,
  rejectInstagramMentionAction,
  syncInstagramActivityAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { requireOwnerSalon } from "@/lib/auth";
import { cleanFeedCaption } from "@/lib/feedPresentation";
import { formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type InstagramPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type InstagramConnectionRecord = {
  id: string;
  instagram_user_id: string;
  instagram_username: string;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  connection_status: "active" | "inactive" | "error";
  auto_publish_owned_posts: boolean;
  require_mention_approval: boolean;
  import_story_mentions: boolean;
  last_webhook_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

type InstagramMentionRecord = {
  id: string;
  platform: "instagram" | "facebook";
  source_type: "post_mention" | "story_mention" | "owned_post" | "comment_mention";
  media_type: "image" | "video" | "carousel" | "story" | "unknown";
  author_username: string | null;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "published";
  moderation_note: string | null;
  mentioned_at: string | null;
  published_post_id: string | null;
  published_at: string | null;
};

type InstagramConnectionAlert = {
  eyebrow: string;
  detail: string;
  note: string;
  tone: "warning" | "error";
};

function getMentionOriginLabel(platform: InstagramMentionRecord["platform"]) {
  return platform === "facebook" ? "Página do salão" : "Instagram";
}

function getMentionPlatformBadgeLabel(platform: InstagramMentionRecord["platform"]) {
  return platform === "facebook" ? "Página" : "Instagram";
}

function getMentionMediaTypeLabel(mediaType: InstagramMentionRecord["media_type"]) {
  switch (mediaType) {
    case "image":
      return "imagem";
    case "video":
      return "vídeo";
    case "carousel":
      return "carrossel";
    case "story":
      return "story";
    default:
      return null;
  }
}

function getMentionAuthorLabel(mention: Pick<InstagramMentionRecord, "platform" | "author_username">) {
  if (!mention.author_username) {
    return "Autor não identificado";
  }

  if (mention.platform === "instagram" && !mention.author_username.startsWith("@")) {
    return `@${mention.author_username}`;
  }

  return mention.author_username;
}

function getMentionSourceLabel(mention: Pick<InstagramMentionRecord, "platform" | "source_type">) {
  const originLabel = getMentionOriginLabel(mention.platform);

  switch (mention.source_type) {
    case "story_mention":
      return "Story marcando o salão";
    case "owned_post":
      return mention.platform === "facebook"
        ? "Post próprio da página do salão"
        : "Post do próprio salão no Instagram";
    case "comment_mention":
      return mention.platform === "facebook"
        ? "Menção em comentário na página do salão"
        : "Menção em comentário no Instagram";
    default:
      return mention.platform === "facebook"
        ? "Post marcando a página do salão"
        : `Post marcando o salão no ${originLabel}`;
  }
}

function getMentionStatusLabel(status: InstagramMentionRecord["moderation_status"]) {
  switch (status) {
    case "approved":
      return "Aprovada";
    case "rejected":
      return "Rejeitada";
    case "published":
      return "Publicada";
    default:
      return "Pendente";
  }
}

function getEffectiveMentionStatus(mention: Pick<InstagramMentionRecord, "moderation_status" | "published_post_id">) {
  return mention.published_post_id ? "published" : mention.moderation_status;
}

function getConnectionStatusLabel(status: InstagramConnectionRecord["connection_status"]) {
  switch (status) {
    case "error":
      return "Com erro";
    case "inactive":
      return "Inativa";
    default:
      return "Ativa";
  }
}

function getConnectionStatusClass(status: InstagramConnectionRecord["connection_status"] | null) {
  switch (status) {
    case "active":
      return "instagram-status-pill instagram-status-pill--active";
    case "error":
      return "instagram-status-pill instagram-status-pill--error";
    default:
      return "instagram-status-pill instagram-status-pill--inactive";
  }
}

function getInstagramConnectionAlert(
  connection: Pick<InstagramConnectionRecord, "last_error" | "connection_status"> | null,
): InstagramConnectionAlert | null {
  const rawError = connection?.last_error?.trim();

  if (!rawError) {
    return null;
  }

  const normalizedError = rawError.toLowerCase();
  const isFacebookPermissionWarning =
    (normalizedError.includes("sincronizar o feed da pagina no facebook") ||
      normalizedError.includes("pagina do facebook esta limitada")) &&
    (normalizedError.includes("pages_read_engagement") ||
      normalizedError.includes("page public content access") ||
      normalizedError.includes("permissao da meta") ||
      normalizedError.includes("instagram segue funcionando normalmente"));

  if (isFacebookPermissionWarning) {
    return {
      eyebrow: "Aviso da conexao",
      detail:
        "O Instagram segue funcionando normalmente. So a leitura das publicacoes da pagina do salao esta limitada neste momento.",
      note:
        "Se voce quiser trazer tambem o conteudo da pagina do salão, vale revisar a conexao dessa conta.",
      tone: "warning",
    };
  }

  if (normalizedError.includes("assinatura automatica das menções")) {
    return {
      eyebrow: "Aviso da conexao",
      detail: "A conta foi conectada, mas novas marcações podem demorar um pouco para aparecer.",
      note: "Se esse aviso continuar, vale revisar a conexão da conta.",
      tone: "warning",
    };
  }

  if (normalizedError.includes("page access token")) {
    return {
      eyebrow: "Aviso da conexao",
      detail: "A conta foi conectada, mas a página do salão ainda não liberou tudo o que o painel precisa.",
      note: "Você pode seguir usando o Instagram enquanto a conexão da página é revisada.",
      tone: "warning",
    };
  }

  if (normalizedError.includes("sincronizacao inicial do instagram falhou")) {
    return {
      eyebrow: "Aviso da conexao",
      detail: "A conta foi conectada, mas a primeira atualização não terminou agora.",
      note: "Toque em Atualizar agora para tentar novamente.",
      tone: "warning",
    };
  }

  return {
    eyebrow: "Ultimo alerta",
    detail: "A conexão precisa de atenção para continuar trazendo novidades.",
    note: "Se necessário, revise a conexão da conta e tente atualizar novamente.",
    tone: connection?.connection_status === "active" ? "warning" : "error",
  };
}

export default async function InstagramPage({ searchParams }: InstagramPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const canUseAutomaticMetaConnect = Boolean(
    process.env.INSTAGRAM_META_APP_ID?.trim() &&
      process.env.INSTAGRAM_META_APP_SECRET?.trim(),
  );

  const [{ data: connection }, { data: mentions }] = await Promise.all([
    supabase
      .from("instagram_connections")
      .select(
        "id,instagram_user_id,instagram_username,facebook_page_id,facebook_page_name,connection_status,auto_publish_owned_posts,require_mention_approval,import_story_mentions,last_webhook_at,last_sync_at,last_error",
      )
      .eq("salon_id", salon.id)
      .maybeSingle(),
    supabase
      .from("instagram_mentions")
      .select(
        "id,platform,source_type,media_type,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,moderation_note,mentioned_at,published_post_id,published_at",
      )
      .eq("salon_id", salon.id)
      .order("mentioned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const safeConnection = (connection ?? null) as InstagramConnectionRecord | null;
  const safeMentions = ((mentions ?? []) as InstagramMentionRecord[]);
  const pendingCount = safeMentions.filter((item) => getEffectiveMentionStatus(item) === "pending").length;
  const approvedCount = safeMentions.filter((item) => getEffectiveMentionStatus(item) === "approved").length;
  const publishedCount = safeMentions.filter((item) => getEffectiveMentionStatus(item) === "published").length;
  const reviewQueueCount = pendingCount + approvedCount;
  const latestMention = safeMentions[0] ?? null;
  const connectionAlert = getInstagramConnectionAlert(safeConnection);

  return (
    <div className="page-grid workspace-page instagram-page">
      <DashboardWorkspaceHero
        id="instagram-status"
        eyebrow="Instagram do salão"
        title="Marcação e publicações do salão"
        description="Posts próprios e marcações entram aqui para revisão e publicação no app."
        highlight={{
          label: "Conta conectada",
          value: safeConnection ? `@${safeConnection.instagram_username}` : "Instagram não conectado",
          note: safeConnection
            ? `${safeConnection.facebook_page_name ? `Página conectada: ${safeConnection.facebook_page_name}. ` : ""}${safeConnection.last_sync_at ? `Atualizado em ${formatDateTime(safeConnection.last_sync_at)}.` : "Aguardando atualização."}`
            : "Conecte a conta profissional para receber menções reais.",
        }}
        signals={[
          {
            label: "Status",
            value: safeConnection ? getConnectionStatusLabel(safeConnection.connection_status) : "Não conectada",
            tone:
              safeConnection?.connection_status === "error"
                ? "danger"
                : safeConnection?.connection_status === "active"
                ? "success"
                : "soft",
          },
          {
            label: "Stories",
            value: safeConnection?.import_story_mentions ? "Ativos" : "Desligados",
            tone: safeConnection?.import_story_mentions ? "accent" : "soft",
          },
          {
            label: "Revisão",
            value: safeConnection?.require_mention_approval ? "Obrigatória" : "Livre",
            tone: safeConnection?.require_mention_approval ? "warm" : "success",
          },
        ]}
        stats={[
          {
            label: "Pendentes",
            value: pendingCount,
            note: "Aguardando revisão.",
            tone: "warm",
          },
          {
            label: "Aprovadas",
            value: approvedCount,
            note: "Prontas para publicar.",
            tone: "soft",
          },
          {
            label: "Publicadas",
            value: publishedCount,
            note: "Já viraram feed no app.",
            tone: "accent",
          },
          {
            label: "Fila total",
            value: safeMentions.length,
            note: "Itens recentes da integração.",
            tone: "success",
          },
        ]}
        actions={
          safeConnection ? (
            <div className="row-actions">
              <form action={syncInstagramActivityAction}>
                <button type="submit" className="secondary-button">
                  Atualizar agora
                </button>
              </form>
              {canUseAutomaticMetaConnect ? (
                <Link href="/dashboard/instagram/connect" className="primary-button">
                  Revisar conexão
                </Link>
              ) : null}
            </div>
          ) : canUseAutomaticMetaConnect ? (
            <Link href="/dashboard/instagram/connect" className="primary-button">
              Conectar Instagram
            </Link>
          ) : (
            <p className="muted">
              A conexão automática não está disponível no momento. Fale com o suporte do painel.
            </p>
          )
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Resumo da conexão atual</span>
            <h3>
              {safeConnection
                ? "Conta profissional conectada"
                : "Conexão oficial do Instagram"}
            </h3>
            {safeConnection?.facebook_page_name ? (
              <span className="instagram-info-pill">Página: {safeConnection.facebook_page_name}</span>
            ) : null}
            <p>
              {safeConnection
                ? `${safeConnection.last_webhook_at ? `Última atividade em ${formatDateTime(safeConnection.last_webhook_at)}.` : "Aguardando novas marcações."}`
                : "Conecte a conta para começar a moderar menções reais."}
            </p>
          </>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <WorkspaceSectionNav
        label="Ir para uma área"
        items={[
          {
            href: "#instagram-status",
            label: "Conexão",
            meta: "status e atualização",
          },
          {
            href: "#instagram-queue",
            label: "Fila",
            meta: "revisão e publicação",
          },
        ]}
      />

      {connectionAlert ? (
        <article className={`instagram-alert-card instagram-alert-card--${connectionAlert.tone}`}>
          <span className="feed-post-meta-card__eyebrow">{connectionAlert.eyebrow}</span>
          <strong>{connectionAlert.detail}</strong>
          <p className="muted">{connectionAlert.note}</p>
        </article>
      ) : null}

      <div className="workspace-subgrid">
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Fluxo</span>
          <h3>Conecte, revise e publique.</h3>
          <ul className="feed-composer-tip-list">
            <li>Conecte a conta profissional uma vez.</li>
            <li>As menções chegam aqui para revisão.</li>
            <li>Publique no app só o que fortalece a marca.</li>
          </ul>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Última atividade</span>
          <h3>
            {latestMention
              ? `${getMentionAuthorLabel(latestMention)} foi a última movimentação.`
              : "A fila aparece assim que a conexão começar a receber mídia."}
          </h3>
          <p>
            {latestMention
              ? `${getMentionSourceLabel(latestMention)} ${latestMention.mentioned_at ? `em ${formatDateTime(latestMention.mentioned_at)}.` : "sem data."}`
              : "Quando a mídia chegar, esta área vira sua fila de curadoria."}
          </p>
        </article>
      </div>

      <section id="instagram-queue" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Fila de menções</h2>
            <p className="muted">Aprove, rejeite ou publique no feed.</p>
          </div>
        </div>

        <div className="workspace-signal-strip" style={{ marginTop: 18 }}>
          <div className="workspace-signal-pill workspace-hero__stat--warm">
            <span>Para revisar</span>
            <strong>{reviewQueueCount}</strong>
          </div>
          <div className="workspace-signal-pill workspace-hero__stat--soft">
            <span>Prontas para publicar</span>
            <strong>{approvedCount}</strong>
          </div>
          <div className="workspace-signal-pill workspace-hero__stat--accent">
            <span>Já publicadas</span>
            <strong>{publishedCount}</strong>
          </div>
        </div>

        <div className="row-list" style={{ marginTop: 18 }}>
          {safeMentions.length === 0 ? (
            <EmptyStateCard
              eyebrow={safeConnection ? "Nenhuma menção por enquanto" : "Conecte sua conta para começar"}
              title={
                safeConnection
                  ? "A fila ainda está vazia"
                  : "A fila começa depois da conexão"
              }
              description={
                safeConnection
                  ? "Novas menções entram aqui assim que chegarem."
                  : "Conecte o Instagram profissional para começar."
              }
            />
          ) : (
            safeMentions.map((mention) => {
              const previewUrl = mention.thumbnail_url ?? mention.media_url;
              const effectiveStatus = getEffectiveMentionStatus(mention);
              const alreadyPublished = effectiveStatus === "published";
              const canPublish = effectiveStatus === "approved" || alreadyPublished;

              return (
                <article
                  key={mention.id}
                  className={`feed-post-card${previewUrl ? "" : " feed-post-card--compact"}`}
                >
                  {previewUrl ? (
                    <div className="feed-post-visual">
                      <div className="feed-post-media feed-post-media--fit">
                        <img
                          src={previewUrl}
                          alt={mention.author_username ? `Menção de ${getMentionAuthorLabel(mention)}` : "Preview da menção"}
                          className="feed-post-media__image"
                          style={{ width: "100%", height: "100%" }}
                        />
                        <span className="feed-gallery-count">{getMentionSourceLabel(mention)}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="feed-post-body">
                    <div className="feed-post-header">
                      <div>
                        <div className="feed-post-kicker">
                          <span className="feed-format-badge">{getMentionStatusLabel(effectiveStatus)}</span>
                          <span className="feed-format-badge">{getMentionPlatformBadgeLabel(mention.platform)}</span>
                          <span className="feed-post-date">
                            {mention.mentioned_at ? formatDateTime(mention.mentioned_at) : "Sem data disponível"}
                          </span>
                        </div>
                        <h3>{getMentionAuthorLabel(mention)}</h3>
                        <p className="feed-post-signature">
                          {getMentionSourceLabel(mention)}
                          {getMentionMediaTypeLabel(mention.media_type)
                            ? ` • ${getMentionMediaTypeLabel(mention.media_type)}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <p className="feed-post-note">
                      {mention.source_type === "story_mention"
                        ? "Story recebida pela conta conectada."
                        : mention.source_type === "owned_post"
                        ? "Publicação do próprio salão."
                        : "Cliente marcou o salão em uma publicação."}
                    </p>

                    {cleanFeedCaption(mention.caption) ? (
                      <p className="feed-post-caption">{cleanFeedCaption(mention.caption)}</p>
                    ) : null}
                    {mention.moderation_note ? <p className="muted">{mention.moderation_note}</p> : null}

                    <div className="row-actions" style={{ marginTop: 14 }}>
                      {!alreadyPublished ? (
                        <>
                          <form action={approveInstagramMentionAction}>
                            <input type="hidden" name="mentionId" value={mention.id} />
                            <button type="submit" className="success-button">
                              Aprovar
                            </button>
                          </form>
                          <form action={rejectInstagramMentionAction}>
                            <input type="hidden" name="mentionId" value={mention.id} />
                            <button type="submit" className="danger-button">
                              Rejeitar
                            </button>
                          </form>
                        </>
                      ) : null}

                      {canPublish ? (
                        <form action={publishInstagramMentionAction}>
                          <input type="hidden" name="mentionId" value={mention.id} />
                          <button
                            type="submit"
                            className="primary-button"
                            disabled={alreadyPublished}
                          >
                            {alreadyPublished ? "Já publicado" : "Publicar no feed do app"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
