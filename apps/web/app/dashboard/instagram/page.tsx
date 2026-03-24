/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  approveInstagramMentionAction,
  publishInstagramMentionAction,
  rejectInstagramMentionAction,
} from "@/app/actions";
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

function getMentionSourceLabel(sourceType: InstagramMentionRecord["source_type"]) {
  switch (sourceType) {
    case "story_mention":
      return "Story marcando o salão";
    case "owned_post":
      return "Post do próprio salão";
    case "comment_mention":
      return "Menção em comentário";
    default:
      return "Post marcando o salão";
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
        "id,instagram_user_id,instagram_username,facebook_page_id,connection_status,auto_publish_owned_posts,require_mention_approval,import_story_mentions,last_webhook_at,last_sync_at,last_error",
      )
      .eq("salon_id", salon.id)
      .maybeSingle(),
    supabase
      .from("instagram_mentions")
      .select(
        "id,source_type,media_type,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,moderation_note,mentioned_at,published_post_id,published_at",
      )
      .eq("salon_id", salon.id)
      .order("mentioned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const safeConnection = (connection ?? null) as InstagramConnectionRecord | null;
  const safeMentions = ((mentions ?? []) as InstagramMentionRecord[]);
  const pendingCount = safeMentions.filter((item) => item.moderation_status === "pending").length;
  const approvedCount = safeMentions.filter((item) => item.moderation_status === "approved").length;
  const publishedCount = safeMentions.filter((item) => item.moderation_status === "published").length;

  return (
    <div className="two-column-grid">
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Instagram do salão</h2>
            <p className="muted">
              Conecte a conta profissional do salão e use esta área para revisar menções antes de publicar no app do cliente.
            </p>
          </div>
        </div>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage message={searchParams.message} tone={searchParams.tone} />
          </div>
        ) : null}

        <div className="instagram-connection-card" style={{ marginTop: 18 }}>
          <div className="instagram-connection-card__content">
            <span className="eyebrow">Conexão oficial</span>
            <h3>
              {safeConnection
                ? "Sua conta profissional já está conectada"
                : "Conecte o Instagram profissional do salão"}
            </h3>
            <p className="muted">
              A conexão acontece no fluxo oficial da Meta e a conta fica salva automaticamente no painel, sem expor etapas técnicas para o usuário.
            </p>

            <div className="instagram-connection-card__meta">
              <span className={getConnectionStatusClass(safeConnection?.connection_status ?? null)}>
                {safeConnection ? getConnectionStatusLabel(safeConnection.connection_status) : "Não conectada"}
              </span>
              {safeConnection ? (
                <span className="instagram-info-pill">@{safeConnection.instagram_username}</span>
              ) : (
                <span className="instagram-info-pill instagram-info-pill--muted">
                  Nenhuma conta vinculada
                </span>
              )}
              {safeConnection?.last_sync_at ? (
                <span className="instagram-info-pill">
                  Validada em {formatDateTime(safeConnection.last_sync_at)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="instagram-connection-card__actions">
            {canUseAutomaticMetaConnect ? (
              <Link href="/dashboard/instagram/connect" className="primary-button">
                {safeConnection ? "Reconectar Instagram" : "Conectar Instagram"}
              </Link>
            ) : (
              <p className="muted">
                A conexão automática não está disponível no momento. Fale com o suporte do painel.
              </p>
            )}
            <p className="instagram-connection-card__hint">
              Depois da autorização, as menções entram automaticamente nesta área para revisão e publicação.
            </p>
          </div>
        </div>

        {safeConnection?.last_error ? (
          <article className="instagram-alert-card instagram-alert-card--error" style={{ marginTop: 18 }}>
            <span className="feed-post-meta-card__eyebrow">Último alerta</span>
            <strong>{safeConnection.last_error}</strong>
            <p className="muted">Se necessário, reconecte a conta pelo botão acima.</p>
          </article>
        ) : null}

        <div className="stats-grid" style={{ marginTop: 18 }}>
          <article className="card metric-card metric-card--warm instagram-metric-card">
            <span className="eyebrow">Pendentes</span>
            <strong className="stat-value">{pendingCount}</strong>
            <p className="metric-note">Menções aguardando revisão antes de entrar no feed.</p>
          </article>
          <article className="card metric-card metric-card--soft instagram-metric-card">
            <span className="eyebrow">Aprovadas</span>
            <strong className="stat-value">{approvedCount}</strong>
            <p className="metric-note">Conteúdos prontos para publicar quando você quiser.</p>
          </article>
          <article className="card metric-card metric-card--accent instagram-metric-card">
            <span className="eyebrow">Publicadas</span>
            <strong className="stat-value">{publishedCount}</strong>
            <p className="metric-note">Posts que já viraram prova social no app do cliente.</p>
          </article>
        </div>

        <div className="instagram-guidance-grid" style={{ marginTop: 18 }}>
          <article className="feed-composer-tip-card instagram-guidance-card">
            <strong>Como esse painel funciona</strong>
            <ul className="feed-composer-tip-list">
              <li>Conecte a conta profissional do salão uma única vez.</li>
              <li>As menções chegam nesta área para você revisar com calma.</li>
              <li>Publique no app só o que fortalece a marca e a prova social do salão.</li>
            </ul>
          </article>

          <article className="feed-composer-tip-card instagram-guidance-card">
            <strong>{safeConnection ? "Resumo da conexão atual" : "O que acontece depois da conexão"}</strong>
            <ul className="feed-composer-tip-list">
              {safeConnection ? (
                <>
                  <li>Conta vinculada: @{safeConnection.instagram_username}.</li>
                  <li>
                    {safeConnection.last_webhook_at
                      ? `Última atividade recebida em ${formatDateTime(safeConnection.last_webhook_at)}.`
                      : "Aguarde as próximas marcações aparecerem na caixa de menções."}
                  </li>
                  <li>Se quiser atualizar a autorização, use o botão de reconexão acima.</li>
                </>
              ) : (
                <>
                  <li>Você autoriza a conta em um fluxo seguro e guiado.</li>
                  <li>As novas marcações começam a aparecer automaticamente nesta fila.</li>
                  <li>O restante da moderação continua sendo feito aqui no painel.</li>
                </>
              )}
            </ul>
          </article>
        </div>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Caixa de menções</h2>
            <p className="muted">
              Revise posts e stories marcando o salão, aprove o que faz sentido e publique no mesmo feed que já aparece no app do cliente.
            </p>
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
                  ? "Depois de conectar a conta profissional, as novas marcações entram aqui para revisão e publicação."
                  : "Assim que o Instagram profissional estiver conectado, as marcações aparecem aqui para você revisar com segurança."
              }
            />
          ) : (
            safeMentions.map((mention) => {
              const previewUrl = mention.thumbnail_url ?? mention.media_url;
              const canPublish =
                mention.moderation_status === "approved" ||
                mention.moderation_status === "published";

              return (
                <article
                  key={mention.id}
                  className={`feed-post-card${previewUrl ? "" : " feed-post-card--compact"}`}
                >
                  {previewUrl ? (
                    <div className="feed-post-visual">
                      <div className="feed-post-media">
                        <img
                          src={previewUrl}
                          alt={mention.author_username ? `Menção de @${mention.author_username}` : "Preview da menção"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <span className="feed-gallery-count">{getMentionSourceLabel(mention.source_type)}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="feed-post-body">
                    <div className="feed-post-header">
                      <div>
                        <div className="feed-post-kicker">
                          <span className="feed-format-badge">{getMentionStatusLabel(mention.moderation_status)}</span>
                          <span className="feed-post-date">
                            {mention.mentioned_at ? formatDateTime(mention.mentioned_at) : "Sem data disponível"}
                          </span>
                        </div>
                        <h3>{mention.author_username ? `@${mention.author_username}` : "Autor não identificado"}</h3>
                        <p className="feed-post-signature">
                          {getMentionSourceLabel(mention.source_type)}
                          {mention.media_type !== "unknown" ? ` • ${mention.media_type}` : ""}
                        </p>
                      </div>
                    </div>

                    <p className="feed-post-note">
                      {mention.source_type === "story_mention"
                        ? "Story recebida pela conta conectada. Aprove rápido se fizer sentido para prova social."
                        : mention.source_type === "owned_post"
                        ? "Conteúdo do próprio salão vindo da conexão do Instagram."
                        : "Prova social gerada por cliente marcando o salão no Instagram."}
                    </p>

                    {mention.caption ? <p className="feed-post-caption">{mention.caption}</p> : null}
                    {mention.permalink ? (
                      <p className="muted">
                        <a href={mention.permalink} target="_blank" rel="noreferrer">
                          Ver no Instagram
                        </a>
                      </p>
                    ) : null}
                    {mention.moderation_note ? <p className="muted">{mention.moderation_note}</p> : null}

                    <div className="row-actions" style={{ marginTop: 14 }}>
                      {mention.moderation_status !== "published" ? (
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
                            disabled={mention.moderation_status === "published"}
                          >
                            {mention.moderation_status === "published" ? "Já publicado" : "Publicar no feed do app"}
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
