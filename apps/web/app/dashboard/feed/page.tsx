import Image from "next/image";

import { createSalonPostAction, deleteSalonPostAction, deleteSalonPostCommentAction } from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
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
  post_type: "standard" | "before_after" | "reel" | null;
  video_path: string | null;
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
  staff_members:
    | {
        id: string;
        name: string;
        role: string | null;
      }
    | {
        id: string;
        name: string;
        role: string | null;
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

type FeedStaffMember = {
  id: string;
  name: string;
  role: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getFeedPostTypeLabel(postType: FeedPostRecord["post_type"]) {
  switch (postType) {
    case "before_after":
      return "Antes e depois";
    case "reel":
      return "Vídeo curto";
    default:
      return "Foto";
  }
}

function getFeedPostEditorialNote(post: {
  postType: "standard" | "before_after" | "reel";
  service?: { name: string } | null;
}) {
  if (post.postType === "before_after") {
    return "Transformação que ajuda a cliente a imaginar o próprio resultado com mais confiança.";
  }

  if (post.postType === "reel") {
    return "Vídeo curto para vender brilho, movimento e acabamento em poucos segundos.";
  }

  if (post.service?.name) {
    return `Resultado que pode puxar reserva direta para ${post.service.name}.`;
  }

  return "Publicação de inspiração para gerar conversa, desejo e descoberta do salão.";
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [{ data, error }, { data: services }, { data: staffMembers }] = await Promise.all([
    supabase
      .from("salon_posts")
      .select(
        "id,title,caption,image_path,post_type,video_path,created_at,services(id,name),staff_members(id,name,role),salon_post_images(id,image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_name,body,created_at)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id, name").eq("salon_id", salon.id).order("name"),
    supabase.from("staff_members").select("id, name, role").eq("salon_id", salon.id).eq("is_active", true).order("name"),
  ]);

  const posts = ((data ?? []) as FeedPostRecord[]).map((post) => {
    const service = firstRelation(post.services);
    const staffMember = firstRelation(post.staff_members);
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
      postType: post.post_type ?? "standard",
      videoUrl: post.video_path
        ? supabase.storage.from("salon-posts").getPublicUrl(post.video_path).data.publicUrl
        : null,
      staffMember,
      likesCount: post.salon_post_likes?.length ?? 0,
      commentsCount: post.salon_post_comments?.length ?? 0,
    };
  });
  const safeStaffMembers = (staffMembers ?? []) as FeedStaffMember[];
  const beforeAfterCount = posts.filter((post) => post.postType === "before_after").length;
  const reelCount = posts.filter((post) => post.postType === "reel").length;
  const totalEngagement = posts.reduce(
    (sum, post) => sum + post.likesCount + post.commentsCount,
    0,
  );
  const latestPost = posts[0];

  return (
    <div className="page-grid workspace-page feed-page">
      <DashboardWorkspaceHero
        eyebrow="Vitrine do app"
        title="O feed do salão agora trabalha como desejo, prova social e agenda."
        description="Publicações boas não servem só para enfeitar. Elas ajudam o cliente a imaginar resultado, descobrir o profissional certo e converter curiosidade em horário marcado."
        highlight={{
          label: "Último destaque publicado",
          value: latestPost?.title ?? "Nenhuma publicação ainda",
          note: latestPost
            ? `${formatDateTime(latestPost.created_at)}${latestPost.service ? ` • ligado a ${latestPost.service.name}` : ""}`
            : "Assim que o salão publicar a primeira peça, o painel começa a mostrar a linha editorial em tempo real.",
        }}
        signals={[
          {
            label: "Serviço em vitrine",
            value: latestPost?.service?.name ?? "Sem vínculo",
            tone: "soft",
          },
          {
            label: "Profissional em foco",
            value: latestPost?.staffMember
              ? `${latestPost.staffMember.name}${latestPost.staffMember.role ? ` • ${latestPost.staffMember.role}` : ""}`
              : "Sem destaque",
            tone: "accent",
          },
          {
            label: "Engajamento total",
            value: totalEngagement,
            tone: "warm",
          },
        ]}
        stats={[
          {
            label: "Publicações",
            value: posts.length,
            note: "Peças reais disponíveis no app do cliente.",
            tone: "warm",
          },
          {
            label: "Antes e depois",
            value: beforeAfterCount,
            note: "Transformações com maior poder de conversão visual.",
            tone: "accent",
          },
          {
            label: "Vídeos curtos",
            value: reelCount,
            note: "Conteúdos de movimento e acabamento para descoberta rápida.",
            tone: "soft",
          },
          {
            label: "Interações",
            value: totalEngagement,
            note: "Curtidas e comentários acumulados nas publicações atuais.",
            tone: "success",
          },
        ]}
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura editorial</span>
            <h3>
              {latestPost
                ? `${getFeedPostTypeLabel(latestPost.postType)} em destaque agora.`
                : "Seu feed começa quando o primeiro resultado entrar no ar."}
            </h3>
            <p>
              {latestPost
                ? latestPost.postType === "before_after"
                  ? "Antes e depois continuam sendo a peça mais fácil de vender porque mostram transformação imediata."
                  : latestPost.postType === "reel"
                  ? "Vídeos curtos puxam atenção rápida e ajudam a dar sensação de técnica, brilho e movimento."
                  : latestPost.service
                  ? `${latestPost.service.name} está virando conteúdo de descoberta para puxar agendamento direto.`
                  : "A peça mais recente está funcionando como vitrine aspiracional para manter o salão vivo no app."
                : "Quando o salão publica fotos, vídeos curtos ou antes e depois, o app do cliente ganha a sensação de marca viva e não de catálogo parado."}
            </p>
          </>
        }
      />

      <div className="two-column-grid">
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Feed do salão</h2>
            <p className="muted">
              Publique fotos, antes e depois e vídeos curtos com cara de vitrine premium, destaque o profissional
              responsável e acompanhe curtidas e comentários dos clientes no app.
            </p>
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
              description="As publicações aparecem no app do cliente com curtidas, comentários, descoberta de profissional e CTA de agendamento quando vinculadas a um serviço."
            />
          ) : (
            posts.map((post) => (
              <article key={post.id} className="feed-post-card">
                <div className="feed-post-visual">
                  {post.postType === "before_after" && post.images.length >= 2 ? (
                    <div className="feed-before-after-grid">
                      {post.images.slice(0, 2).map((image, index) => (
                        <div key={image.id} className="feed-before-after-frame feed-before-after-frame--fit">
                          <span className="feed-before-after-label">{index === 0 ? "Antes" : "Depois"}</span>
                          <Image
                            src={image.publicUrl}
                            alt={`${post.title} ${index === 0 ? "antes" : "depois"}`}
                            className="feed-post-media__image"
                            fill
                            sizes="(max-width: 960px) 50vw, 200px"
                          />
                        </div>
                      ))}
                    </div>
                  ) : post.postType === "reel" && post.videoUrl ? (
                    <div className="feed-post-media">
                      <video className="feed-post-video" controls preload="metadata" poster={post.images[0]?.publicUrl}>
                        <source src={post.videoUrl} />
                      </video>
                      <span className="feed-gallery-count">Vídeo curto</span>
                    </div>
                  ) : (
                    <div className="feed-post-media feed-post-media--fit">
                      <Image
                        src={post.images[0].publicUrl}
                        alt={post.title}
                        className="feed-post-media__image"
                        fill
                        sizes="(max-width: 960px) 100vw, 420px"
                      />
                      {post.images.length > 1 ? <span className="feed-gallery-count">{post.images.length} fotos</span> : null}
                    </div>
                  )}

                  {post.postType !== "before_after" && post.images.length > 1 ? (
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
                      <div className="feed-post-kicker">
                        <span className="feed-format-badge">{getFeedPostTypeLabel(post.postType)}</span>
                        <span className="feed-post-date">{formatDateTime(post.created_at)}</span>
                      </div>
                      <h3>{post.title}</h3>
                      {post.staffMember ? (
                        <p className="feed-post-signature">
                          Assinado por <strong>{post.staffMember.name}</strong>
                          {post.staffMember.role ? ` • ${post.staffMember.role}` : ""}
                        </p>
                      ) : null}
                    </div>

                    <form action={deleteSalonPostAction}>
                      <input type="hidden" name="postId" value={post.id} />
                      <button type="submit" className="danger-button">
                        Excluir
                      </button>
                    </form>
                  </div>

                  <div className="feed-post-meta-strip">
                    {post.service ? (
                      <div className="feed-post-meta-card">
                        <span className="feed-post-meta-card__eyebrow">Serviço ligado ao post</span>
                        <strong>{post.service.name}</strong>
                      </div>
                    ) : null}
                    {post.staffMember ? (
                      <div className="feed-post-meta-card">
                        <span className="feed-post-meta-card__eyebrow">Profissional em destaque</span>
                        <strong>
                          {post.staffMember.name}
                          {post.staffMember.role ? ` • ${post.staffMember.role}` : ""}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                  <p className="feed-post-note">{getFeedPostEditorialNote(post)}</p>
                  {post.caption ? <p className="feed-post-caption">{post.caption}</p> : null}

                  <div className="feed-post-engagement">
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
            <p className="muted">
              Publique galeria, antes e depois ou vídeo curto, ligue o conteúdo a um serviço e transforme o feed em mais
              um ponto de descoberta e agendamento.
            </p>
          </div>
        </div>

        <div className="feed-composer-tip-card" style={{ marginTop: 18 }}>
          <strong>O que mais faz a cliente salvar e agendar</strong>
          <ul className="feed-composer-tip-list">
            <li>Antes e depois vende transformação real.</li>
            <li>Vídeo curto mostra brilho, movimento e acabamento.</li>
            <li>Profissional destacado aumenta confiança e descoberta.</li>
          </ul>
        </div>

        <form action={createSalonPostAction} className="form-grid" encType="multipart/form-data" style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="feed-type">Formato do post</label>
            <select id="feed-type" name="postType" defaultValue="standard">
              <option value="standard">Foto ou galeria</option>
              <option value="before_after">Antes e depois</option>
              <option value="reel">Vídeo curto</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="feed-title">Título da publicação</label>
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
            <label htmlFor="feed-staff-member">Profissional em destaque</label>
            <select id="feed-staff-member" name="staffMemberId" defaultValue="">
              <option value="">Sem destaque direto</option>
              {safeStaffMembers.map((staffMember) => (
                <option key={staffMember.id} value={staffMember.id}>
                  {staffMember.name}
                  {staffMember.role ? ` • ${staffMember.role}` : ""}
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
            <small className="muted">
              Galeria: 1 a 5 imagens. Antes e depois: exatamente 2 imagens. Vídeo curto: 1 imagem de capa. Até 4 MB por
              imagem.
            </small>
          </div>

          <div className="field">
            <label htmlFor="feed-video">Vídeo curto</label>
            <input id="feed-video" name="video" type="file" accept="video/mp4,video/webm,video/quicktime" />
            <small className="muted">Obrigatório apenas para o formato vídeo curto. Até 25 MB.</small>
          </div>

          <button type="submit" className="primary-button">
            Publicar no app
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
