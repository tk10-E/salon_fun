/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

import {
  approveInstagramMentionAction,
  disconnectInstagramConnectionAction,
  publishInstagramMentionAction,
  rejectInstagramMentionAction,
  saveInstagramConnectionAction,
  validateInstagramConnectionTokenAction,
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

type InstagramWebhookEventRecord = {
  id: string;
  event_type: string;
  processing_status: string;
  created_at: string;
  processed_at: string | null;
  last_error: string | null;
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

export default async function InstagramPage({ searchParams }: InstagramPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const canUseAutomaticMetaConnect = Boolean(
    process.env.INSTAGRAM_META_APP_ID?.trim() &&
      process.env.INSTAGRAM_META_APP_SECRET?.trim(),
  );

  const [{ data: connection }, { data: mentions }, { data: webhookEvents }] = await Promise.all([
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
    supabase
      .from("instagram_webhook_events")
      .select("id,event_type,processing_status,created_at,processed_at,last_error")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const safeConnection = (connection ?? null) as InstagramConnectionRecord | null;
  const safeMentions = ((mentions ?? []) as InstagramMentionRecord[]);
  const safeEvents = ((webhookEvents ?? []) as InstagramWebhookEventRecord[]);
  const metaRedirectOrigin = process.env.INSTAGRAM_META_REDIRECT_ORIGIN?.trim().replace(/\/+$/, "") ?? "";
  const metaAppDomain = metaRedirectOrigin ? new URL(metaRedirectOrigin).hostname : null;
  const metaCallbackUrl = metaRedirectOrigin
    ? `${metaRedirectOrigin}/dashboard/instagram/connect/callback`
    : null;

  const pendingCount = safeMentions.filter((item) => item.moderation_status === "pending").length;
  const approvedCount = safeMentions.filter((item) => item.moderation_status === "approved").length;
  const publishedCount = safeMentions.filter((item) => item.moderation_status === "published").length;
  const webhookUrlBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const webhookUrl = webhookUrlBase ? `${webhookUrlBase}/functions/v1/instagram-webhook` : "/functions/v1/instagram-webhook";

  return (
    <div className="two-column-grid">
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Instagram do salão</h2>
            <p className="muted">
              Conecte a conta profissional, receba menções via webhook da Meta e publique no feed do app só o que fizer sentido para a marca.
            </p>
          </div>
        </div>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage message={searchParams.message} tone={searchParams.tone} />
          </div>
        ) : null}

        <div className="dashboard-stats-grid" style={{ marginTop: 18 }}>
          <article className="card dashboard-stat-card">
            <span className="dashboard-stat-card__label">Pendentes</span>
            <strong>{pendingCount}</strong>
            <p className="muted">Menções aguardando revisão antes de entrar no feed.</p>
          </article>
          <article className="card dashboard-stat-card">
            <span className="dashboard-stat-card__label">Aprovadas</span>
            <strong>{approvedCount}</strong>
            <p className="muted">Prontas para publicar no app quando você quiser.</p>
          </article>
          <article className="card dashboard-stat-card">
            <span className="dashboard-stat-card__label">Publicadas</span>
            <strong>{publishedCount}</strong>
            <p className="muted">Já transformadas em conteúdo do feed do cliente.</p>
          </article>
        </div>

        <div className="feed-composer-tip-card" style={{ marginTop: 18 }}>
          <strong>Conexao automatica com a Meta</strong>
          <p className="muted" style={{ marginTop: 8 }}>
            Para novos saloes, prefira o fluxo de login da Meta. Ele ja traz pagina, Instagram profissional e token para o painel sem copiar IDs na mao.
          </p>
          {metaAppDomain && metaCallbackUrl ? (
            <div className="muted" style={{ marginTop: 12 }}>
              <p style={{ margin: 0 }}>
                Se a Meta bloquear a URL, cadastre estes valores no app:
              </p>
              <p style={{ margin: "8px 0 0" }}>
                <strong>Dominios do aplicativo:</strong> <code>{metaAppDomain}</code>
              </p>
              <p style={{ margin: "8px 0 0" }}>
                <strong>Redirect URI valido:</strong> <code>{metaCallbackUrl}</code>
              </p>
            </div>
          ) : null}
          <div className="row-actions" style={{ marginTop: 14 }}>
            {canUseAutomaticMetaConnect ? (
              <Link href="/dashboard/instagram/connect" className="primary-button">
                {safeConnection ? "Reconectar com Meta" : "Conectar Instagram com Meta"}
              </Link>
            ) : (
              <p className="muted">
                Configure <code>INSTAGRAM_META_APP_ID</code> e{" "}
                <code>INSTAGRAM_META_APP_SECRET</code> para liberar a conexao automatica.
              </p>
            )}
          </div>
        </div>

        <div className="feed-composer-tip-card" style={{ marginTop: 18 }}>
          <strong>Fluxo recomendado</strong>
          <ul className="feed-composer-tip-list">
            <li>Use conta profissional do Instagram conectada a uma página no ecossistema da Meta.</li>
            <li>Deixe aprovação manual ligada para conteúdo de cliente.</li>
            <li>Publique no app só o que reforça prova social real do salão.</li>
          </ul>
        </div>

        <details
          className="feed-composer-tip-card"
          style={{ marginTop: 18 }}
          open={!canUseAutomaticMetaConnect}
        >
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Configuracao avancada e fallback manual
          </summary>
          <p className="muted" style={{ marginTop: 12 }}>
            Essa area fica como plano B para suporte tecnico. No fluxo normal do salao, prefira o botao da Meta acima e deixe token e IDs fora da etapa principal.
          </p>

          <form action={saveInstagramConnectionAction} className="form-grid" style={{ marginTop: 18 }}>
            <div className="field">
              <label htmlFor="instagram-user-id">Instagram Business/Creator ID</label>
              <input id="instagram-user-id" name="instagramUserId" defaultValue={safeConnection?.instagram_user_id ?? ""} placeholder="17841400000000000" />
            </div>
            <div className="field">
              <label htmlFor="instagram-username">Usuário do Instagram</label>
              <input id="instagram-username" name="instagramUsername" defaultValue={safeConnection?.instagram_username ?? ""} placeholder="docebeleza" />
            </div>
            <div className="field">
              <label htmlFor="facebook-page-id">Facebook Page ID</label>
              <input id="facebook-page-id" name="facebookPageId" defaultValue={safeConnection?.facebook_page_id ?? ""} placeholder="123456789012345" />
            </div>
            <div className="field">
              <label htmlFor="instagram-access-token">Access token da Meta</label>
              <input
                id="instagram-access-token"
                name="accessToken"
                type="password"
                autoComplete="off"
                placeholder={safeConnection ? "Deixe em branco para manter o token salvo" : "Cole o token da conta profissional"}
              />
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                name="requireMentionApproval"
                defaultChecked={safeConnection?.require_mention_approval ?? true}
              />
              <span>Exigir aprovação antes de publicar menções de clientes</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="importStoryMentions"
                defaultChecked={safeConnection?.import_story_mentions ?? true}
              />
              <span>Importar story mentions para a fila do painel</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="autoPublishOwnedPosts"
                defaultChecked={safeConnection?.auto_publish_owned_posts ?? false}
              />
              <span>Marcar posts do próprio salão como aprovados automaticamente</span>
            </label>

            <div className="row-actions">
              <button type="submit" className="primary-button">
                Salvar conexão
              </button>
            </div>
          </form>
        </details>

        {safeConnection ? (
          <div className="row-actions" style={{ marginTop: 12 }}>
            <form action={validateInstagramConnectionTokenAction}>
              <button type="submit" className="secondary-button">
                Validar token
              </button>
            </form>
            <form action={disconnectInstagramConnectionAction}>
              <button type="submit" className="danger-button">
                Desconectar
              </button>
            </form>
          </div>
        ) : null}

        <div className="feed-post-meta-strip" style={{ marginTop: 18 }}>
          <div className="feed-post-meta-card">
            <span className="feed-post-meta-card__eyebrow">Status da conexão</span>
            <strong>{safeConnection ? getConnectionStatusLabel(safeConnection.connection_status) : "Ainda não conectada"}</strong>
          </div>
          <div className="feed-post-meta-card">
            <span className="feed-post-meta-card__eyebrow">Webhook da Meta</span>
            <strong style={{ wordBreak: "break-all" }}>{webhookUrl}</strong>
          </div>
        </div>

        {safeConnection?.last_sync_at || safeConnection?.last_webhook_at || safeConnection?.last_error ? (
          <div className="row-list" style={{ marginTop: 18 }}>
            <article className="feed-comment-item">
              <strong>Saúde da conexão</strong>
              {safeConnection.last_sync_at ? (
                <span>Token validado em {formatDateTime(safeConnection.last_sync_at)}</span>
              ) : null}
              {safeConnection.last_webhook_at ? (
                <span>Último webhook em {formatDateTime(safeConnection.last_webhook_at)}</span>
              ) : null}
              {safeConnection.last_error ? (
                <span>Último erro: {safeConnection.last_error}</span>
              ) : null}
            </article>
          </div>
        ) : null}

        <div className="row-list" style={{ marginTop: 18 }}>
          {safeEvents.length ? (
            safeEvents.map((event) => (
              <article key={event.id} className="feed-comment-item">
                <div className="feed-comment-item__top">
                  <strong>{event.event_type}</strong>
                  <span>{event.processing_status}</span>
                </div>
                <span>Recebido em {formatDateTime(event.created_at)}</span>
                {event.processed_at ? <span>Processado em {formatDateTime(event.processed_at)}</span> : null}
                {event.last_error ? <span>{event.last_error}</span> : null}
              </article>
            ))
          ) : (
            <p className="muted">Quando a Meta começar a mandar webhooks, os eventos recentes aparecem aqui.</p>
          )}
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
              eyebrow="Nenhuma menção por enquanto"
              title="A fila do Instagram ainda está vazia"
              description="Depois de conectar a conta profissional e configurar o webhook na Meta, as marcações entram aqui para moderação."
            />
          ) : (
            safeMentions.map((mention) => {
              const previewUrl = mention.thumbnail_url ?? mention.media_url;
              const canPublish =
                mention.moderation_status === "approved" ||
                mention.moderation_status === "published";

              return (
                <article key={mention.id} className="feed-post-card">
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
                            {mention.mentioned_at ? formatDateTime(mention.mentioned_at) : "Sem data da Meta"}
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
                        ? "Story recebida pelo webhook da Meta. Aprove rápido se fizer sentido para prova social."
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
                            <button type="submit" className="secondary-button">
                              Aprovar
                            </button>
                          </form>
                          <form action={rejectInstagramMentionAction}>
                            <input type="hidden" name="mentionId" value={mention.id} />
                            <button type="submit" className="secondary-button">
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
