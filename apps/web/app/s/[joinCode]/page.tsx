import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicSalonAppCta } from "@/components/PublicSalonAppCta";
import { buildAbsoluteUrl } from "@/lib/requestOrigin";
import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";

type PublicSalonPageProps = {
  params: {
    joinCode: string;
  };
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PublicSalonPageProps): Promise<Metadata> {
  const landingData = await fetchPublicSalonLandingData(params.joinCode);
  const preview = landingData?.preview;
  const canonicalPath = `/s/${params.joinCode.trim().toUpperCase()}`;
  const canonicalUrl = buildAbsoluteUrl(canonicalPath);

  if (!preview) {
    return {
      title: "Salão não encontrado | Salon Fun",
      description: "Não encontramos uma vitrine pública para este código.",
      alternates: {
        canonical: canonicalUrl ?? canonicalPath,
      },
    };
  }

  const title = `${preview.name} | ${preview.segmentLabel}`;
  const description =
    preview.tagline ??
    preview.welcomeMessage ??
    preview.segmentDescription ??
    "Descubra a marca, o código do salão e a experiência premium do app.";

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl ?? canonicalPath,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title,
      description,
      siteName: "Salon Fun",
      images: preview.shareImageUrl
        ? [
            {
              url: preview.shareImageUrl,
              width: 1200,
              height: 630,
              alt: `Capa de ${preview.name}`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: preview.shareImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: preview.shareImageUrl ? [preview.shareImageUrl] : undefined,
    },
  };
}

export default async function PublicSalonPage({ params }: PublicSalonPageProps) {
  const landingData = await fetchPublicSalonLandingData(params.joinCode);
  if (!landingData) {
    notFound();
  }
  const { preview, featuredServices, activeOffers, recentPosts, stats } =
    landingData;

  const whatsappUrl = buildWhatsAppUrl(preview.whatsappPhone);
  const deepLinkUrl = buildSalonJoinDeepLink(preview.joinCode);
  const androidStoreUrl = readPublicUrlEnv("NEXT_PUBLIC_SALON_CLIENT_PLAY_STORE_URL");
  const iosStoreUrl = readPublicUrlEnv("NEXT_PUBLIC_SALON_CLIENT_APP_STORE_URL");
  const pageStyle = {
    "--salon-accent": preview.brandColor,
  } as CSSProperties;

  return (
    <main className="public-salon-page" style={pageStyle}>
      <section className="public-salon-shell">
        <div className="public-salon-hero">
          <div className="public-salon-kicker">
            <span className="public-salon-kicker__badge">
              {preview.segmentLabel}
            </span>
            <span>Experiência premium white-label</span>
          </div>

          <div className="public-salon-copy">
            <div className="public-salon-brandline">
              {preview.logoUrl ? (
                <img
                  src={preview.logoUrl}
                  alt={`Logo de ${preview.name}`}
                  className="public-salon-logo"
                />
              ) : (
                <div className="public-salon-logo public-salon-logo--fallback">
                  {preview.name.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div>
                <p className="public-salon-eyebrow">{preview.name}</p>
                <h1>
                  {preview.welcomeHeadline ??
                    preview.tagline ??
                    "Sua marca com presença premium em cada agendamento."}
                </h1>
              </div>
            </div>

            <p className="public-salon-summary">
              {preview.welcomeMessage ??
                preview.tagline ??
                preview.segmentDescription}
            </p>

            <div className="public-salon-actions">
              <PublicSalonAppCta
                joinCode={preview.joinCode}
                deepLinkUrl={deepLinkUrl}
                androidStoreUrl={androidStoreUrl}
                iosStoreUrl={iosStoreUrl}
              />
            </div>

            <div className="public-salon-actions public-salon-actions--supporting">
              <a
                href="#codigo"
                className="public-salon-button public-salon-button--secondary"
              >
                Ver codigo do salao
              </a>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  className="public-salon-button public-salon-button--secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  Falar no WhatsApp
                </a>
              ) : null}
            </div>

            <div className="public-salon-module-strip">
              {preview.moduleLabels.slice(0, 4).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </div>

        <aside className="public-salon-preview-card">
          <div
            className="public-salon-preview-media"
            style={
              preview.heroImageUrl
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(15, 11, 8, 0.08), rgba(15, 11, 8, 0.54)), url(${preview.heroImageUrl})`,
                  }
                : undefined
            }
          />

          <div className="public-salon-preview-body">
            <p className="public-salon-preview-eyebrow">Vitrine da marca</p>
            <h2>{preview.tagline ?? preview.segmentDescription}</h2>
            <p>
              {preview.promotionHeadline ??
                "Compartilhe essa página, mostre a identidade do salão e deixe o cliente entrar no app certo com mais confiança."}
            </p>

            <dl className="public-salon-metrics">
              <div>
                <dt>Código</dt>
                <dd id="codigo">{preview.joinCode}</dd>
              </div>
              {preview.ratingValue != null ? (
                <div>
                  <dt>Avaliação</dt>
                  <dd>
                    {preview.ratingValue.toFixed(1)}
                    {preview.ratingCount == null
                      ? ""
                      : ` • ${preview.ratingCount} avaliações`}
                  </dd>
                </div>
              ) : null}
              {preview.addressLabel ? (
                <div>
                  <dt>Endereço</dt>
                  <dd>{preview.addressLabel}</dd>
                </div>
              ) : null}
            </dl>

            <div className="public-salon-links">
              {preview.instagramUrl ? (
                <a
                  href={preview.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram
                </a>
              ) : null}
              {preview.mapUrl ? (
                <a href={preview.mapUrl} target="_blank" rel="noreferrer">
                  Ver mapa
                </a>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <section className="public-salon-showcase">
        <div className="public-salon-section-heading">
          <span className="public-salon-section-eyebrow">
            Vitrine comercial
          </span>
          <h2>Mais do que uma página bonita: uma entrada premium para a marca.</h2>
          <p>
            A vitrine pública reúne identidade, prova visual e direção comercial
            para o cliente descobrir o salão certo e entrar no app com mais
            confiança.
          </p>
        </div>

        <div className="public-salon-proof-grid">
          <article className="public-salon-proof-card">
            <span>Serviços em destaque</span>
            <strong>{stats.servicesCount}</strong>
            <p>Entram aqui como catálogo curto e mais vendedor.</p>
          </article>
          <article className="public-salon-proof-card">
            <span>Ofertas ativas</span>
            <strong>{stats.activeOffersCount}</strong>
            <p>Promoções e clube da marca quando existirem no salão.</p>
          </article>
          <article className="public-salon-proof-card">
            <span>Trabalhos recentes</span>
            <strong>{stats.recentPostsCount}</strong>
            <p>Conteúdo visual para reforçar desejo e confiança.</p>
          </article>
        </div>

        {featuredServices.length > 0 ? (
          <section className="public-salon-content-section">
            <div className="public-salon-section-heading public-salon-section-heading--compact">
              <span className="public-salon-section-eyebrow">
                Serviços principais
              </span>
              <h3>O que o salão quer vender primeiro.</h3>
              <p>
                Um recorte curto dos atendimentos com maior valor de vitrine.
              </p>
            </div>

            <div className="public-salon-service-grid">
              {featuredServices.map((service) => (
                <article key={service.id} className="public-salon-service-card">
                  <div
                    className="public-salon-service-media"
                    style={
                      service.imageUrl
                        ? {
                            backgroundImage: `linear-gradient(180deg, rgba(15, 11, 8, 0.06), rgba(15, 11, 8, 0.46)), url(${service.imageUrl})`,
                          }
                        : undefined
                    }
                  />
                  <div className="public-salon-service-body">
                    <div className="public-salon-service-meta">
                      <span>{service.category ?? "Serviço premium"}</span>
                      <span>{service.duration} min</span>
                    </div>
                    <h4>{service.name}</h4>
                    <p>
                      {service.description ??
                        "Leitura curta e premium para ajudar a decidir com mais confiança."}
                    </p>
                    <strong>{formatCurrency(service.price)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeOffers.length > 0 ? (
          <section className="public-salon-content-section">
            <div className="public-salon-section-heading public-salon-section-heading--compact">
              <span className="public-salon-section-eyebrow">
                Promoções e clube
              </span>
              <h3>Argumentos comerciais prontos para conversão.</h3>
              <p>
                O salão pode ativar campanhas e essa vitrine já reflete isso no
                compartilhamento.
              </p>
            </div>

            <div className="public-salon-offer-grid">
              {activeOffers.map((offer) => (
                <article key={offer.id} className="public-salon-offer-card">
                  <div className="public-salon-offer-header">
                    <span>{offer.kindLabel}</span>
                    <small>{offer.lifecycleLabel}</small>
                  </div>
                  <h4>{offer.title}</h4>
                  <p>
                    {offer.description ??
                      offer.highlightText ??
                      "Oferta destacada na experiência premium do salão."}
                  </p>
                  <div className="public-salon-offer-footer">
                    <strong>{offer.priceLabel ?? "Consulte condições"}</strong>
                    {offer.highlightText ? (
                      <span>{offer.highlightText}</span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {recentPosts.length > 0 ? (
          <section className="public-salon-content-section">
            <div className="public-salon-section-heading public-salon-section-heading--compact">
              <span className="public-salon-section-eyebrow">
                Prova visual
              </span>
              <h3>Resultados recentes com leitura de social premium.</h3>
              <p>
                Trabalhos reais ajudam o cliente a entender estilo, qualidade e
                atmosfera da marca.
              </p>
            </div>

            <div className="public-salon-gallery-grid">
              {recentPosts.map((post) => (
                <article key={post.id} className="public-salon-gallery-card">
                  <div
                    className="public-salon-gallery-media"
                    style={
                      post.imageUrl
                        ? {
                            backgroundImage: `linear-gradient(180deg, rgba(15, 11, 8, 0.04), rgba(15, 11, 8, 0.38)), url(${post.imageUrl})`,
                          }
                        : undefined
                    }
                  >
                    {post.badge ? (
                      <span className="public-salon-gallery-badge">
                        {post.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="public-salon-gallery-body">
                    <h4>{post.title}</h4>
                    <p>
                      {post.caption ??
                        post.serviceName ??
                        "Conteúdo recente da marca para inspirar a próxima reserva."}
                    </p>
                    <div className="public-salon-gallery-meta">
                      {post.serviceName ? <span>{post.serviceName}</span> : null}
                      {post.staffLabel ? <span>{post.staffLabel}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="public-salon-join-card">
          <div>
            <span className="public-salon-section-eyebrow">Como entrar</span>
            <h3>Use o código do salão e caia direto no app certo.</h3>
            <p>
              Compartilhe esta pagina, toque em abrir no app ou copie o codigo
              para deixar a experiencia do cliente com menos atrito.
            </p>
          </div>

          <ol className="public-salon-step-list">
            <li>Toque em abrir no app ou instale a versao oficial do cliente.</li>
            <li>Entre com o codigo <strong>{preview.joinCode}</strong>.</li>
            <li>Veja agenda, galeria, promocoes e identidade da marca no app.</li>
          </ol>

          <div className="public-salon-actions">
            <a
              href="#codigo"
              className="public-salon-button public-salon-button--primary"
            >
              Ver código novamente
            </a>
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                className="public-salon-button public-salon-button--secondary"
                target="_blank"
                rel="noreferrer"
              >
                Pedir atendimento
              </a>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function buildWhatsAppUrl(phone: string | null) {
  const digits = phone?.replace(/\D/g, "");
  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function buildSalonJoinDeepLink(joinCode: string) {
  return `salonfun://join?code=${encodeURIComponent(joinCode.trim().toUpperCase())}`;
}

function readPublicUrlEnv(name: "NEXT_PUBLIC_SALON_CLIENT_PLAY_STORE_URL" | "NEXT_PUBLIC_SALON_CLIENT_APP_STORE_URL") {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
