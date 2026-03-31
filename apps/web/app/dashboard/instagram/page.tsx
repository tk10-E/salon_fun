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
import { requireOwnerSalon } from "@/lib/auth";
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

function getMentionPlatformLabel(platform: InstagramMentionRecord["platform"]) {
  return platform === "facebook" ? "Facebook" : "Instagram";
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
  const platformLabel = getMentionPlatformLabel(mention.platform);

  switch (mention.source_type) {
    case "story_mention":
      return "Story marcando o salão";
    case "owned_post":
      return `Post do próprio salão no ${platformLabel}`;
    case "comment_mention":
      return `Menção em comentário no ${platformLabel}`;
    default:
      return `Post marcando o salão no ${platformLabel}`;
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

  return (
    <div className="page-grid workspace-page instagram-page">
      <DashboardWorkspaceHero
        eyebrow="Instagram + Facebook"
        title="Instagram e Facebook do salão"
        description="A conexão oficial continua sendo da Meta, mas a leitura operacional ficou mais forte: você sabe o que chegou, o que precisa de aprovação e o que já virou conteúdo no app do cliente."
        highlight={{
          label: "Conta conectada",
          value: safeConnection ? `@${safeConnection.instagram_username}` : "Meta não conectada",
          note: safeConnection
            ? `${safeConnection.facebook_page_name ? `Página: ${safeConnection.facebook_page_name}. ` : ""}${safeConnection.last_sync_at ? `Validada em ${formatDateTime(safeConnection.last_sync_at)}.` : "Aguardando nova sincronização manual ou webhook."}`
            : "Conecte a conta profissional do salão para puxar posts próprios e marcações reais para o app do cliente.",
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
            note: "Menções aguardando revisão antes de entrar no feed.",
            tone: "warm",
          },
          {
            label: "Aprovadas",
            value: approvedCount,
            note: "Conteúdos prontos para publicar quando você quiser.",
            tone: "soft",
          },
          {
            label: "Publicadas",
            value: publishedCount,
            note: "Posts que já viraram prova social no app do cliente.",
            tone: "accent",
          },
          {
            label: "Fila total",
            value: safeMentions.length,
            note: "Itens recentes trazidos da integração oficial da Meta.",
            tone: "success",
          },
        ]}
        actions={
          safeConnection ? (
            <div className="row-actions">
              <form action={syncInstagramActivityAction}>
                <button type="submit" className="secondary-button">
                  Sincronizar agora
                </button>
              </form>
              {canUseAutomaticMetaConnect ? (
                <Link href="/dashboard/instagram/connect" className="primary-button">
                  Reconectar Meta
                </Link>
              ) : null}
            </div>
          ) : canUseAutomaticMetaConnect ? (
            <Link href="/dashboard/instagram/connect" className="primary-button">
              Conectar Meta
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
                ? "Sua conta profissional já está conectada"
                : "O fluxo de conexão oficial entra por aqui."}
            </h3>
            {safeConnection?.facebook_page_name ? (
              <span className="instagram-info-pill">Página: {safeConnection.facebook_page_name}</span>
            ) : null}
            <p>
              {safeConnection
                ? `${safeConnection.last_webhook_at ? `Última atividade recebida em ${formatDateTime(safeConnection.last_webhook_at)}.` : "Aguardando as próximas marcações aparecerem na fila."} Se quiser atualizar a autorização do Instagram ou Facebook, use o botão de reconexão acima.`
                : "Você autoriza a conta em um fluxo seguro da Meta e as novas marcações do Instagram e do Facebook começam a aparecer aqui automaticamente para moderação e publicação."}
            </p>
          </>
        }
      />

      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      {safeConnection?.last_error ? (
        <article className="instagram-alert-card instagram-alert-card--error">
          <span className="feed-post-meta-card__eyebrow">Último alerta</span>
          <strong>{safeConnection.last_error}</strong>
          <p className="muted">Se necessário, reconecte a conta pelo botão acima.</p>
        </article>
      ) : null}

      <div className="workspace-subgrid">
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Como esse painel funciona</span>
          <h3>O conteúdo entra da Meta e sai como prova social no app.</h3>
          <ul className="feed-composer-tip-list">
            <li>Conecte a conta profissional do salão uma única vez.</li>
            <li>As menções do Instagram e do Facebook chegam nesta área para revisão com dados reais.</li>
            <li>Publique no app só o que fortalece marca, desejo e confiança no salão.</li>
          </ul>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Ritmo da operação</span>
          <h3>
            {latestMention
              ? `${getMentionAuthorLabel(latestMention)} foi a última movimentação capturada.`
              : "A fila começa a viver assim que a conexão estiver recebendo mídia."}
          </h3>
          <p>
            {latestMention
              ? `${getMentionSourceLabel(latestMention)} ${latestMention.mentioned_at ? `em ${formatDateTime(latestMention.mentioned_at)}.` : "sem data disponível."}`
              : "Quando a mídia chega pronta, o feed do salão pode publicar sozinho; quando não chega, esta área vira sua fila de fallback e curadoria."}
          </p>
        </article>
      </div>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Caixa de menções</h2>
            <p className="muted">
              Revise posts e stories marcando o salão, aprove o que faz sentido e publique no mesmo feed que já aparece no app do cliente.
            </p>
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
                  ? "A fila do Instagram ainda está vazia"
                  : "A caixa de menções será ativada depois da conexão"
              }
              description={
                safeConnection
                  ? "Depois de conectar a conta profissional, os novos conteúdos entram aqui para acompanhamento e eventual revisão se algo não puder ser publicado automaticamente."
                  : "Assim que o Instagram profissional estiver conectado, os conteúdos aparecem aqui para você acompanhar o que entrou no feed."
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
                          <span className="feed-format-badge">{getMentionPlatformLabel(mention.platform)}</span>
                          <span className="feed-post-date">
                            {mention.mentioned_at ? formatDateTime(mention.mentioned_at) : "Sem data disponível"}
                          </span>
                        </div>
                        <h3>{getMentionAuthorLabel(mention)}</h3>
                        <p className="feed-post-signature">
                          {getMentionSourceLabel(mention)}
                          {mention.media_type !== "unknown" ? ` • ${mention.media_type}` : ""}
                        </p>
                      </div>
                    </div>

                    <p className="feed-post-note">
                      {mention.source_type === "story_mention"
                        ? "Story recebida pela conta conectada. Se a mídia vier completa, ela também pode virar prova social no feed."
                        : mention.source_type === "owned_post"
                        ? `Conteúdo do próprio salão vindo do ${getMentionPlatformLabel(mention.platform)}, já preparado para entrar no feed do app.`
                        : `Prova social gerada por cliente marcando o salão no ${getMentionPlatformLabel(mention.platform)}. Quando a mídia chega correta, o feed publica sozinho.`}
                    </p>

                    {mention.caption ? <p className="feed-post-caption">{mention.caption}</p> : null}
                    {mention.permalink ? (
                      <p className="muted">
                        <a href={mention.permalink} target="_blank" rel="noreferrer">
                          Ver no {getMentionPlatformLabel(mention.platform)}
                        </a>
                      </p>
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
