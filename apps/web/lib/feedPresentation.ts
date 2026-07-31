export function cleanFeedCaption(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

export function isInstagramFeedSource(sourceType: string | null | undefined) {
  void sourceType;
  return false;
}

export function getFeedSourceBadgeLabel(sourceType: string | null | undefined) {
  void sourceType;
  return null;
}

export type FeedPostType = "standard" | "before_after" | "reel";

export type FeedVisualCategory = "portfolio" | "transformation" | "promotion";

type FeedPresentationInput = {
  title?: string | null;
  caption?: string | null;
  postType: FeedPostType;
  serviceName?: string | null;
  sourceType?: string | null;
  imageCount?: number;
  hasVideo?: boolean;
  visualCategory?: FeedVisualCategory;
};

const FEED_PROMOTION_KEYWORDS = [
  "promo",
  "promoc",
  "oferta",
  "desconto",
  "combo",
  "pacote",
  "brinde",
  "especial",
  "imperdivel",
  "agenda aberta",
  "ultimas vagas",
  "ultimas unidades",
  "vagas limitadas",
  "preco",
  "cupom",
  "cashback",
  "leve 2",
  "garanta",
];

const FEED_TRANSFORMATION_KEYWORDS = [
  "transform",
  "antes",
  "depois",
  "mudanca",
  "novo visual",
  "resultado",
  "renovacao",
  "correcao",
  "reconstrucao",
  "recuperacao",
  "glow up",
  "virada",
  "revitalizacao",
  "finalizacao",
];

function normalizeFeedSearchText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function buildFeedSearchText(post: FeedPresentationInput) {
  return [
    normalizeFeedSearchText(post.title),
    normalizeFeedSearchText(cleanFeedCaption(post.caption)),
    normalizeFeedSearchText(post.serviceName),
  ]
    .filter(Boolean)
    .join(" ");
}

function includesAnyKeyword(searchText: string, keywords: string[]) {
  return keywords.some((keyword) => searchText.includes(keyword));
}

function buildFeedSourceContext(sourceType: string | null | undefined) {
  void sourceType;
  return "";
}

export function getFeedPostTypeLabel(postType: FeedPostType) {
  switch (postType) {
    case "before_after":
      return "Antes e depois";
    case "reel":
      return "Vídeo curto";
    default:
      return "Foto";
  }
}

export function getFeedVisualCategory(post: FeedPresentationInput) {
  if (post.visualCategory) {
    return post.visualCategory;
  }

  if (post.postType === "before_after") {
    return "transformation";
  }

  const searchText = buildFeedSearchText(post);

  if (includesAnyKeyword(searchText, FEED_PROMOTION_KEYWORDS)) {
    return "promotion";
  }

  if (includesAnyKeyword(searchText, FEED_TRANSFORMATION_KEYWORDS)) {
    return "transformation";
  }

  return "portfolio";
}

export function getFeedVisualCategoryLabel(category: FeedVisualCategory) {
  switch (category) {
    case "promotion":
      return "Promoção";
    case "transformation":
      return "Transformação";
    default:
      return "Portfólio";
  }
}

export function getFeedCoverHighlight(post: FeedPresentationInput) {
  const visualCategory = getFeedVisualCategory(post);

  if (post.postType === "reel") {
    switch (visualCategory) {
      case "promotion":
        return {
          eyebrow: "Promoção em vídeo",
          title: "Poster com chamada forte",
          detail:
            "A capa precisa vender a oferta antes do play e segurar a atenção no feed.",
        };
      case "transformation":
        return {
          eyebrow: "Transformação em vídeo",
          title: "Poster que entrega resultado",
          detail:
            "O primeiro frame deve mostrar brilho, textura ou virada visual sem depender do play.",
        };
      default:
        return {
          eyebrow: "Reel do salão",
          title: "Poster com assinatura",
          detail:
            "A capa segura o clique com leitura premium e prepara o vídeo para mobile.",
        };
    }
  }

  switch (visualCategory) {
    case "promotion":
      return {
        eyebrow: "Promoção",
        title: "Capa comercial em destaque",
        detail: post.serviceName
          ? `${post.serviceName} aparece com leitura de oferta ou chamada direta.`
          : "Oferta, combo ou chamada curta para girar agenda e descoberta.",
      };
    case "transformation":
      return {
        eyebrow: "Transformação",
        title:
          post.postType === "before_after"
            ? "Comparação de impacto"
            : "Resultado como capa",
        detail:
          post.postType === "before_after"
            ? "A comparação precisa ficar clara no primeiro olhar."
            : "A imagem principal precisa entregar a virada visual logo de cara.",
      };
    default:
      return {
        eyebrow: "Portfólio",
        title:
          post.imageCount && post.imageCount > 1
            ? "Galeria com hero forte"
            : "Capa editorial",
        detail: post.serviceName
          ? `${post.serviceName} entra como vitrine autoral e prova de qualidade.`
          : "Peça de descoberta para mostrar estilo, acabamento e assinatura do salão.",
      };
  }
}

export function getFeedPostEditorialNote(post: FeedPresentationInput) {
  const visualCategory = getFeedVisualCategory(post);
  const sourceContext = buildFeedSourceContext(post.sourceType);

  switch (visualCategory) {
    case "promotion":
      if (post.postType === "reel") {
        return `Vídeo curto com leitura promocional para girar agenda, pacote ou oferta.${sourceContext}`;
      }

      if (post.serviceName) {
        return `${post.serviceName} apareceu com leitura promocional para converter descoberta em reserva.${sourceContext}`;
      }

      return `Peça promocional para colocar oferta, combo ou chamada de agenda na vitrine.${sourceContext}`;
    case "transformation":
      if (post.postType === "reel") {
        return `Vídeo curto de transformação para vender técnica, brilho e acabamento.${sourceContext}`;
      }

      return `Transformação para gerar confiança e acelerar reserva.${sourceContext}`;
    default:
      if (post.postType === "reel") {
        return `Vídeo curto de portfólio para mostrar técnica, movimento e assinatura do salão.${sourceContext}`;
      }

      if (post.serviceName) {
        return `${post.serviceName} já virou peça de portfólio com potencial de descoberta.${sourceContext}`;
      }

      return `Peça de portfólio para manter o salão vivo no app e puxar desejo.${sourceContext}`;
  }
}

export function getFeedPostMediaHighlights(post: FeedPresentationInput) {
  const visualCategory = getFeedVisualCategory(post);
  const imageCount = post.imageCount ?? 1;

  if (post.postType === "before_after") {
    return [
      "2 imagens ordenadas",
      "Comparação imediata",
      "Resultado no primeiro olhar",
    ];
  }

  if (post.postType === "reel") {
    return [
      post.hasVideo ? "Poster + vídeo prontos" : "Poster aguardando vídeo",
      visualCategory === "promotion"
        ? "Capa com chamada comercial"
        : visualCategory === "transformation"
          ? "Capa mostrando resultado"
          : "Capa com assinatura visual",
      "Leitura rápida no mobile",
    ];
  }

  return [
    imageCount === 1 ? "1 imagem hero" : `${imageCount} imagens na galeria`,
    visualCategory === "promotion"
      ? "Primeira imagem vira oferta"
      : visualCategory === "transformation"
        ? "Primeira imagem vira resultado"
        : "Primeira imagem vira capa",
    visualCategory === "promotion"
      ? "Leitura promocional"
      : visualCategory === "transformation"
        ? "Vende transformação"
        : "Descoberta e portfólio",
  ];
}
