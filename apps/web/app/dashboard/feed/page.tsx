import Image from "next/image";

import { createSalonPostAction, deleteSalonPostAction, deleteSalonPostCommentAction } from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type FeedPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type FeedPostRecord = {
  id: string;
  title: string;
  caption: string | null;
  image_path: string;
  created_at: string;
  services:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
  salon_post_images:
    | {
        id: string;
        image_path: string;
        sort_order: number;
      }[]
    | null;
  salon_post_likes: { customer_id: string }[] | null;
  salon_post_comments:
    | {
        id: string;
        customer_name: string;
        body: string;
        created_at: string;
      }[]
    | null;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [{ data, error }, { data: services }] = await Promise.all([
    supabase
      .from("salon_posts")
      .select(
        "id,title,caption,image_path,created_at,services(id,name),salon_post_images(id,image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_name,body,created_at)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id, name").eq("salon_id", salon.id).order("name"),
  ]);

  const posts = ((data ?? []) as FeedPostRecord[]).map((post) => {
    const service = Array.isArray(post.services) ? post.services[0] : post.services;
    const gallerySource = post.salon_post_images?.length
      ? [...(post.salon_post_images ?? [])].sort((left, right) => left.sort_order - right.sort_order)
      : [{ id: `${post.id}-cover`, image_path: post.image_path, sort_order: 0 }];

    return {
      ...post,
      service,
      comments: [...(post.salon_post_comments ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at)),
      images: gallerySource.map((image) => ({
        ...image,
        publicUrl: supabase.storage.from("salon-posts").getPublicUrl(image.image_path).data.publicUrl,
      })),
      likesCount: post.salon_post_likes?.length ?? 0,
      commentsCount: post.salon_post_comments?.length ?? 0,
    };
  });

  return (
    <div className="two-column-grid">
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Feed do salão</h2>
            <p className="muted">Publique resultados, vincule um serviço e acompanhe curtidas e comentários dos clientes no app.</p>
          </div>
        </div>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage message={searchParams.message} tone={searchParams.tone} />
          </div>
        ) : null}

        <div className="row-list" style={{ marginTop: 16 }}>
          {error ? (
            <EmptyStateCard
              eyebrow="Feed indisponível"
              title="Não foi possível carregar as publicações"
              description="Confirme se a migration mais recente do feed foi aplicada no Supabase e tente novamente."
            />
          ) : posts.length === 0 ? (
            <EmptyStateCard
              eyebrow="Seu feed começa aqui"
              title="Nenhuma foto publicada"
              description="As publicações aparecem no app do cliente com curtidas, comentários e CTA de agendamento quando vinculadas a um serviço."
            />
          ) : (
            posts.map((post) => (
              <article key={post.id} className="feed-post-card">
                <div className="feed-post-visual">
                  <div className="feed-post-media">
                    <Image src={post.images[0].publicUrl} alt={post.title} fill sizes="(max-width: 960px) 100vw, 420px" />
                    {post.images.length > 1 ? <span className="feed-gallery-count">{post.images.length} fotos</span> : null}
                  </div>

                  {post.images.length > 1 ? (
                    <div className="feed-post-thumbs">
                      {post.images.slice(0, 4).map((image) => (
                        <div key={image.id} className="feed-post-thumb">
                          <Image src={image.publicUrl} alt={post.title} fill sizes="80px" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="feed-post-body">
                  <div className="feed-post-header">
                    <div>
                      <h3>{post.title}</h3>
                      <p className="muted">{formatDateTime(post.created_at)}</p>
                    </div>

                    <form action={deleteSalonPostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button type="submit" className="danger-button">
                        Excluir
                      </button>
                    </form>
                  </div>

                  {post.service ? <span className="feed-stat-pill">Serviço vinculado: {post.service.name}</span> : null}
                  {post.caption ? <p className="feed-post-caption">{post.caption}</p> : null}

                  <div className="feed-post-stats">
                    <span className="feed-stat-pill">{post.likesCount} curtidas</span>
                    <span className="feed-stat-pill">{post.commentsCount} comentários</span>
                  </div>

                  {post.comments.length ? (
                    <div className="feed-comment-list">
                      {post.comments.map((comment) => (
                        <div key={comment.id} className="feed-comment-item">
                          <div className="feed-comment-item__top">
                            <strong>{comment.customer_name}</strong>
                            <form action={deleteSalonPostCommentAction}>
                              <input type="hidden" name="commentId" value={comment.id} />
                              <button type="submit" className="comment-delete-button">
                                Remover
                              </button>
                            </form>
                          </div>
                          <span>{comment.body}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Seus clientes ainda não comentaram esta foto.</p>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="card content-card form-panel feed-composer-card">
        <div className="section-heading">
          <div>
            <h2>Nova publicação</h2>
            <p className="muted">Suba uma galeria, ligue a postagem a um serviço e transforme o feed em mais um ponto de agendamento.</p>
          </div>
        </div>

        <form action={createSalonPostAction} className="form-grid" encType="multipart/form-data" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="feed-title">Título da foto</label>
            <input id="feed-title" name="title" placeholder="Ex.: Escova glow do dia" required />
          </div>

          <div className="field">
            <label htmlFor="feed-service">Serviço vinculado</label>
            <select id="feed-service" name="serviceId" defaultValue="">
              <option value="">Sem vínculo direto</option>
              {(services ?? []).map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="feed-caption">Legenda</label>
            <textarea
              id="feed-caption"
              name="caption"
              rows={5}
              placeholder="Conte o que foi feito, destaque o resultado e convide o cliente a agendar."
            />
          </div>

          <div className="field">
            <label htmlFor="feed-images">Imagens</label>
            <input
              id="feed-images"
              name="images"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              multiple
              required
            />
            <small className="muted">PNG, JPG, WEBP ou SVG com até 4 MB cada. Até 5 imagens por publicação.</small>
          </div>

          <button type="submit" className="primary-button">
            Publicar no app
          </button>
        </form>
      </section>
    </div>
  );
}
