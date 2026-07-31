import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { PublicSalonAppCta } from "@/components/PublicSalonAppCta";
import { buildAbsoluteUrl } from "@/lib/requestOrigin";
import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";

type PublicSalonPageProps = {
  params: Promise<{
    joinCode: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params: paramsPromise,
}: PublicSalonPageProps): Promise<Metadata> {
  const params = await paramsPromise;
  const landingData = await fetchPublicSalonLandingData(params.joinCode);
  const preview = landingData?.preview;
  const canonicalPath = `/s/${params.joinCode.trim().toUpperCase()}`;
  const canonicalUrl = await buildAbsoluteUrl(canonicalPath);

  if (!preview) {
    return {
      title: "Salão não encontrado | Salon Fun",
      description: "Não encontramos uma página pública para este código.",
      alternates: {
        canonical: canonicalUrl ?? canonicalPath,
      },
    };
  }

  const title = `${preview.name} | ${preview.segmentLabel}`;
  const description =
    preview.heroHeadline ??
    preview.tagline ??
    preview.welcomeMessage ??
    preview.segmentDescription ??
    "Veja a marca do salão, o código de acesso e como entrar no app.";

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

export default async function PublicSalonPage({
  params: paramsPromise,
}: PublicSalonPageProps) {
  const params = await paramsPromise;
  const landingData = await fetchPublicSalonLandingData(params.joinCode);
  if (!landingData) {
    notFound();
  }
  const { preview, featuredServices, activeOffers, recentPosts, stats } =
    landingData;
  const deepLinkUrl = buildSalonJoinDeepLink(preview.joinCode);
  const androidStoreUrl = readPublicUrlEnv(
    "NEXT_PUBLIC_SALON_CLIENT_PLAY_STORE_URL",
  );
  const iosStoreUrl = readPublicUrlEnv(
    "NEXT_PUBLIC_SALON_CLIENT_APP_STORE_URL",
  );
  const whatsappUrl = buildWhatsAppUrl(preview.whatsappPhone);
  const pageStyle = {
    "--salon-accent": preview.brandColor,
  } as CSSProperties;
  const signatureCards = [
    {
      label: "Código de entrada",
      value: preview.joinCode,
      note: "A cliente entra direto no app certo, sem confusão.",
    },
    {
      label:
        preview.ratingValue != null ? "Confiança percebida" : "Recursos no app",
      value:
        preview.ratingValue != null
          ? `${preview.ratingValue.toFixed(1)} estrelas`
          : `${preview.moduleLabels.length} recursos`,
      note:
        preview.ratingCount != null
          ? `${preview.ratingCount} avaliações reforçam a confiança.`
          : `${preview.moduleLabels.slice(0, 2).join(" e ")} ajudam a vender a jornada logo de cara.`,
    },
    {
      label: activeOffers.length > 0 ? "Campanhas no ar" : "Vitrine viva",
      value:
        activeOffers.length > 0
          ? `${activeOffers.length} ofertas`
          : `${recentPosts.length} destaques`,
      note:
        activeOffers.length > 0
          ? "Campanhas e ofertas aparecem aqui com a identidade do salão."
          : "A página acompanha o que o salão publica e destaca no app.",
    },
  ];
  const brandJourney = [
    {
      step: "01",
      title: "Marca primeiro",
      description:
        preview.tagline ??
        preview.welcomeMessage ??
        "A cliente entende atmosfera, posicionamento e promessa antes de reservar.",
    },
    {
      step: "02",
      title: "Entrada simples",
      description: `Compartilhe o código ${preview.joinCode} e leve a cliente direto ao app correto.`,
    },
    {
      step: "03",
      title: "Reserva com contexto",
      description:
        preview.moduleLabels.length > 0
          ? `${preview.moduleLabels.slice(0, 3).join(", ")} e mais camadas aparecem dentro do app com a mesma identidade.`
          : "Agenda, benefícios e identidade da marca aparecem no mesmo fluxo.",
    },
  ];
  const leadService = featuredServices[0] ?? null;
  const leadOffer = activeOffers[0] ?? null;

  return (
    <main className="public-salon-page" style={pageStyle}>
      <section className="public-salon-shell">
        <div className="public-salon-hero">
          <div className="public-salon-kicker">
            <span className="public-salon-kicker__badge">
              {preview.segmentLabel}
            </span>
            <span>Seu salão no app com a sua marca</span>
          </div>

          <div className="public-salon-copy">
            <div className="public-salon-brandline">
              {preview.logoUrl ? (
                <Image
                  src={preview.logoUrl}
                  alt={`Logo de ${preview.name}`}
                  width={74}
                  height={74}
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
                  {preview.heroHeadline ??
                    preview.welcomeHeadline ??
                    preview.tagline ??
                    "Sua marca presente em cada agendamento."}
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
                Ver código do salão
              </a>
            </div>

            <div className="public-salon-module-strip">
              {preview.moduleLabels.slice(0, 4).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="public-salon-presence-grid">
              {signatureCards.map((card) => (
                <article
                  key={card.label}
                  className="public-salon-presence-card"
                >
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <p>{card.note}</p>
                </article>
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
                "Compartilhe esta página para a cliente conhecer o salão e abrir o app certo."}
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
              {whatsappUrl ? (
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  Falar no WhatsApp
                </a>
              ) : null}
              {preview.mapUrl ? (
                <a href={preview.mapUrl} target="_blank" rel="noreferrer">
                  Ver mapa
                </a>
              ) : null}
            </div>

            <div className="public-salon-preview-story">
              <span>Como o salão aparece no app</span>
              <strong>
                {leadService || leadOffer
                  ? "Uma entrada pensada para converter melhor"
                  : "A marca chega mais forte no celular"}
              </strong>
              <p>
                {leadOffer?.highlightText ??
                  leadOffer?.description ??
                  leadService?.description ??
                  "A página pública, o código do salão e o app passam a falar a mesma linguagem."}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="public-salon-showcase">
        <div className="public-salon-section-heading">
          <span className="public-salon-section-eyebrow">
            Vitrine comercial
          </span>
          <h2>
            Mais do que uma página bonita: uma entrada clara para a marca.
          </h2>
          <p>
            A página pública reúne identidade, prova visual e informações
            úteis para a cliente conhecer o salão e entrar no app com confiança.
          </p>
        </div>

        <div className="public-salon-experience-grid">
          <article className="public-salon-story-card">
            <span className="public-salon-section-eyebrow">
              Como isso chega no celular
            </span>
            <h3>Uma página que já mostra como a cliente vai encontrar o salão.</h3>
            <p>
              A marca ganha uma entrada mais forte: prova visual, argumentos
              comerciais e o caminho para abrir o app certo ficam alinhados em
              uma mesma narrativa.
            </p>

            <div className="public-salon-story-modules">
              {preview.moduleLabels.slice(0, 6).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="public-salon-story-spotlight">
              <strong>
                {leadService
                  ? "Serviço em destaque"
                  : "Presença do salão no app"}
              </strong>
              <p>
                {leadService?.description ??
                  leadOffer?.description ??
                  "A cliente sente mais clareza sobre o que reservar e por que voltar."}
              </p>
            </div>
          </article>

          <article className="public-salon-story-card public-salon-story-card--journey">
            <span className="public-salon-section-eyebrow">
              Jornada em 3 movimentos
            </span>
            <h3>Descobrir, entrar e reservar com menos atrito.</h3>
            <div className="public-salon-story-step-list">
              {brandJourney.map((item) => (
                <div key={item.step} className="public-salon-story-step">
                  <strong>{item.step}</strong>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="public-salon-proof-grid">
          <article className="public-salon-proof-card">
            <span>Serviços em destaque</span>
            <strong>{stats.servicesCount}</strong>
            <p>Entram aqui como um catálogo curto e fácil de entender.</p>
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
              <h3>O que o salão quer mostrar primeiro.</h3>
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
                      <span>{service.category ?? "Serviço em destaque"}</span>
                      <span>{service.duration} min</span>
                    </div>
                    <h4>{service.name}</h4>
                    <p>
                      {service.description ??
                        "Descrição curta para ajudar a cliente a decidir com mais confiança."}
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
              <h3>Ofertas prontas para chamar atenção.</h3>
              <p>
                O salão pode ativar campanhas e esta página já reflete isso no
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
                      "Oferta destacada para aparecer no app do salão."}
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
              <span className="public-salon-section-eyebrow">Prova visual</span>
              <h3>Resultados recentes do salão.</h3>
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
                      {post.serviceName ? (
                        <span>{post.serviceName}</span>
                      ) : null}
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
            <h3>Use o código do salão e entre direto no app certo.</h3>
            <p>
              Compartilhe esta página, toque em abrir no app ou copie o código
              para facilitar a entrada da cliente.
            </p>
          </div>

          <ol className="public-salon-step-list">
            <li>
              Toque em abrir no app ou instale a versão oficial.
            </li>
            <li>
              Entre com o código <strong>{preview.joinCode}</strong>.
            </li>
            <li>
              Veja agenda, galeria, promoções e a identidade da marca no app.
            </li>
          </ol>

          <div className="public-salon-actions">
            <a
              href="#codigo"
              className="public-salon-button public-salon-button--primary"
            >
              Ver código novamente
            </a>
          </div>
        </section>
      </section>
    </main>
  );
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

function buildWhatsAppUrl(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D+/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function readPublicUrlEnv(
  name:
    | "NEXT_PUBLIC_SALON_CLIENT_PLAY_STORE_URL"
    | "NEXT_PUBLIC_SALON_CLIENT_APP_STORE_URL",
) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
