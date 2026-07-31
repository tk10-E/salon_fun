import Image from "next/image";

import {
  createSalonPostAction,
  deleteSalonPostAction,
  deleteSalonPostCommentAction,
} from "@/app/actions";
import { FeedAiDraftAssistant } from "@/components/FeedAiDraftAssistant";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FeedComposerMediaFieldset } from "@/components/FeedComposerMediaFieldset";
import { formatDateTime } from "@/lib/formatters";

import type { FeedPageData } from "./_lib";

export type FeedComposerPrefill = {
  aiNotes?: string;
  caption?: string;
  postType?: "before_after" | "reel" | "standard" | "story";
  serviceId?: string;
  staffMemberId?: string;
  title?: string;
};

type FeedPageContentProps = {
  aiEnabled: boolean;
  data: FeedPageData;
  prefill: FeedComposerPrefill;
};

export function FeedPageContent({
  aiEnabled,
  data,
  prefill,
}: FeedPageContentProps) {
  return (
    <>
      <FeedHeader header={data.header} />
      <FeedStoriesSection
        hasPostsError={data.hasPostsError}
        stories={data.stories}
      />
      <FeedPostsSection hasPostsError={data.hasPostsError} posts={data.posts} />
      <FeedNewPostSection
        aiEnabled={aiEnabled}
        prefill={prefill}
        services={data.services}
        staffMembers={data.staffMembers}
      />
    </>
  );
}

function FeedHeader({ header }: { header: FeedPageData["header"] }) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Feed</p>
        <h1>Feed e stories</h1>
        <p className="muted">
          Conteúdos que a cliente vê no app do salão.
        </p>
        <div
          className="inline-actions"
          style={{ marginTop: 8, flexWrap: "wrap" }}
        >
          <span className="badge badge--confirmed">
            {header.postsCount} publicações
          </span>
          <span className="badge badge--accent">
            {header.storiesCount} stories ativos
          </span>
          <span className="badge badge--soft">
            {header.transformationsCount} transformações
          </span>
          <span className="badge badge--soft">
            {header.promotionsCount} promoções
          </span>
          <span className="badge badge--soft">
            {header.reelsCount} videos curtos
          </span>
        </div>
      </div>
      <div
        className="simple-row__actions"
        style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
      >
        <a href="#feed-new" className="primary-button">
          Nova publicação
        </a>
      </div>
    </header>
  );
}

function FeedStoriesSection({
  hasPostsError,
  stories,
}: {
  hasPostsError: boolean;
  stories: FeedPageData["stories"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Stories ativos</h2>
          <p className="muted">
            Faixa do topo do app neste momento.
          </p>
        </div>
      </div>

      {hasPostsError ? (
        <EmptyStateCard
          eyebrow="Stories indisponíveis"
          title="Não foi possível carregar os stories"
          description="Confira a configuração do feed e tente novamente."
        />
      ) : stories.length === 0 ? (
        <EmptyStateCard
          eyebrow="Sem stories no ar"
          title="Nenhum story ativo agora"
          description="Publique um story com foto para ocupar a faixa superior do app."
        />
      ) : (
        <div className="simple-list">
          {stories.map((story) => (
            <article key={story.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span className="badge badge--accent">Story</span>
                <span className="badge badge--soft">
                  Publicado em {formatDateTime(story.createdAt)}
                </span>
                <span className="badge badge--soft">
                  Sai em {formatDateTime(story.expiresAt)}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "120px 1fr",
                }}
              >
                <div className="feed-simple-thumb">
                  <Image
                    src={story.imageUrl}
                    alt={story.title}
                    width={120}
                    height={120}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                  />
                </div>
                <div>
                  <h3>{story.title}</h3>
                  <p className="muted">
                    {story.caption?.trim()
                      ? story.caption
                      : "Story rápido para levar a cliente ao feed ou à agenda."}
                  </p>
                  <small className="list-meta">
                    {story.serviceName
                      ? `Serviço: ${story.serviceName}`
                      : "Sem serviço"}{" "}
                    -{" "}
                    {story.staffMemberName
                      ? `Profissional: ${story.staffMemberName}${story.staffMemberRole ? ` - ${story.staffMemberRole}` : ""}`
                      : "Sem destaque"}
                  </small>
                </div>
              </div>

              <div className="simple-row__actions" style={{ marginTop: 8 }}>
                <form action={deleteSalonPostAction}>
                  <input type="hidden" name="postId" value={story.id} />
                  <button type="submit" className="danger-button">
                    Encerrar story
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FeedPostsSection({
  hasPostsError,
  posts,
}: {
  hasPostsError: boolean;
  posts: FeedPageData["posts"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Publicações do feed</h2>
          <p className="muted">
            Posts publicados com serviço, origem e resposta do público.
          </p>
        </div>
      </div>

      {hasPostsError ? (
        <EmptyStateCard
          eyebrow="Feed indisponível"
          title="Não foi possível carregar as publicações"
          description="Confira a configuração do feed e tente novamente."
        />
      ) : posts.length === 0 ? (
        <EmptyStateCard
          eyebrow="Seu feed começa aqui"
          title="Nenhuma publicação ainda"
          description="Quando você publicar, o conteúdo aparece aqui e no app do cliente."
        />
      ) : (
        <div className="simple-list">
          {posts.map((post) => (
            <article key={post.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span className="badge badge--soft">{post.formatLabel}</span>
                <span className="badge badge--soft">
                  {post.visualCategoryLabel}
                </span>
                {post.sourceBadgeLabel ? (
                  <span
                    className={`badge badge--soft${post.isInstagramSource ? " badge--accent" : ""}`}
                  >
                    {post.sourceBadgeLabel}
                  </span>
                ) : null}
                <span className="badge badge--soft">
                  {formatDateTime(post.createdAt)}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "120px 1fr",
                }}
              >
                <div className="feed-simple-thumb">
                  <Image
                    src={post.imageUrl}
                    alt={post.title}
                    width={120}
                    height={90}
                    style={{ objectFit: "cover", borderRadius: 10 }}
                  />
                </div>
                <div>
                  <h3>{post.title}</h3>
                  <p className="muted">
                    {post.editorialNote}
                    {post.cleanCaption ? ` - ${post.cleanCaption}` : ""}
                  </p>
                  <small className="list-meta">
                    {post.serviceName
                      ? `Serviço: ${post.serviceName}`
                      : "Sem serviço"}{" "}
                    -{" "}
                    {post.staffMemberName
                      ? `Profissional: ${post.staffMemberName}${post.staffMemberRole ? ` - ${post.staffMemberRole}` : ""}`
                      : "Sem destaque"}{" "}
                    - {post.likesCount} curtidas - {post.commentsCount}{" "}
                    comentários
                  </small>
                </div>
              </div>

              <div className="simple-row__actions" style={{ marginTop: 8 }}>
                <form action={deleteSalonPostAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button type="submit" className="danger-button">
                    Excluir post
                  </button>
                </form>
              </div>

              {post.comments.length ? (
                <div className="simple-list" style={{ marginTop: 8 }}>
                  {post.comments.slice(0, 3).map((comment) => (
                    <div
                      key={comment.id}
                      className="simple-row"
                      style={{ padding: 10 }}
                    >
                      <div
                        className="inline-actions"
                        style={{ justifyContent: "space-between" }}
                      >
                        <strong>{comment.customerName}</strong>
                        <form action={deleteSalonPostCommentAction}>
                          <input
                            type="hidden"
                            name="commentId"
                            value={comment.id}
                          />
                          <button type="submit" className="danger-button">
                            Remover
                          </button>
                        </form>
                      </div>
                      <p className="muted" style={{ margin: 4 }}>
                        {comment.body}
                      </p>
                    </div>
                  ))}
                  {post.comments.length > 3 ? (
                    <small className="list-meta">
                      +{post.comments.length - 3} comentários ocultos
                    </small>
                  ) : null}
                </div>
              ) : (
                <p className="muted">Sem comentários.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FeedNewPostSection({
  aiEnabled,
  prefill,
  services,
  staffMembers,
}: {
  aiEnabled: boolean;
  prefill: FeedComposerPrefill;
  services: FeedPageData["services"];
  staffMembers: FeedPageData["staffMembers"];
}) {
  return (
    <section id="feed-new" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Nova publicação</h2>
          <p className="muted">
            Feed permanente, antes e depois, vídeo curto e story com foto.
          </p>
        </div>
      </div>

      <div className="simple-list" style={{ marginBottom: 12 }}>
        <article className="simple-row">
          <strong>Dicas rápidas</strong>
          <p className="muted">
            Antes e depois vende transformação, vídeo curto mostra movimento e
            story serve para vaga do dia, bastidor ou resultado fresco.
          </p>
        </article>
      </div>

      <FeedAiDraftAssistant
        aiEnabled={aiEnabled}
        initialNotes={prefill.aiNotes}
      />

      <form
        action={createSalonPostAction}
        className="simple-form"
        encType="multipart/form-data"
      >
        <FeedComposerMediaFieldset
          initialPostType={prefill.postType ?? "standard"}
        />

        <div className="field">
          <label htmlFor="feed-title">Título</label>
          <input
            id="feed-title"
            name="title"
            defaultValue={prefill.title ?? ""}
            placeholder="Ex.: Escova glow do dia"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="feed-service">Serviço</label>
          <select
            id="feed-service"
            name="serviceId"
            defaultValue={prefill.serviceId ?? ""}
          >
            <option value="">Sem vínculo</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="feed-staff-member">Profissional</label>
          <select
            id="feed-staff-member"
            name="staffMemberId"
            defaultValue={prefill.staffMemberId ?? ""}
          >
            <option value="">Sem destaque</option>
            {staffMembers.map((staffMember) => (
              <option key={staffMember.id} value={staffMember.id}>
                {staffMember.name}
                {staffMember.role ? ` - ${staffMember.role}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="feed-caption">Legenda</label>
          <textarea
            id="feed-caption"
            name="caption"
            rows={3}
            defaultValue={prefill.caption ?? ""}
            placeholder="Conte o que foi feito e convide a agendar."
          />
        </div>

        <button type="submit" className="primary-button">
          Publicar no app
        </button>
      </form>
    </section>
  );
}
