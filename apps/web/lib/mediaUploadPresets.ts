export type MediaUploadContext =
  | "service"
  | "product"
  | "feed"
  | "story"
  | "offer";

export type MediaUploadPreset = {
  previewAspectRatio: number;
  previewFit: "cover" | "contain";
  maxWidth: number;
  maxHeight: number;
  maxInputBytes: number;
  maxFiles: number;
  browserQuality: number;
  serverQuality: number;
  badges: string[];
  helperText: string;
  emptyTitle: string;
  emptyDescription: string;
};

export const MEDIA_UPLOAD_PRESETS: Record<
  MediaUploadContext,
  MediaUploadPreset
> = {
  service: {
    previewAspectRatio: 4 / 3,
    previewFit: "cover",
    maxWidth: 1800,
    maxHeight: 1350,
    maxInputBytes: 8 * 1024 * 1024,
    maxFiles: 1,
    browserQuality: 0.88,
    serverQuality: 88,
    badges: [
      "Proporcao sugerida 4:3",
      "Ate 1800x1350",
      "Resultado ou ambiente em destaque",
    ],
    helperText:
      "Fotos de servico ficam melhores quando mostram o resultado, a area atendida ou a experiencia do salao.",
    emptyTitle: "Foto do servico",
    emptyDescription:
      "Escolha uma imagem que explique o atendimento em um unico olhar.",
  },
  product: {
    previewAspectRatio: 1,
    previewFit: "contain",
    maxWidth: 2200,
    maxHeight: 2200,
    maxInputBytes: 12 * 1024 * 1024,
    maxFiles: 6,
    browserQuality: 0.9,
    serverQuality: 90,
    badges: [
      "Proporcao sugerida 1:1",
      "Ate 2200x2200",
      "A primeira imagem vira capa",
    ],
    helperText:
      "Produtos performam melhor com o item inteiro visivel, fundo limpo e rotulo legivel.",
    emptyTitle: "Galeria da loja",
    emptyDescription:
      "Monte uma vitrine com fotos claras, sem cortes agressivos e com boa leitura do produto.",
  },
  feed: {
    previewAspectRatio: 4 / 5,
    previewFit: "cover",
    maxWidth: 1800,
    maxHeight: 2250,
    maxInputBytes: 10 * 1024 * 1024,
    maxFiles: 5,
    browserQuality: 0.88,
    serverQuality: 88,
    badges: [
      "Proporcao sugerida 4:5",
      "Ate 1800x2250",
      "Antes e depois usa 2 imagens",
    ],
    helperText:
      "Para feed, priorize enquadramento vertical, rosto ou resultado principal bem visivel e fundo sem excesso de ruido.",
    emptyTitle: "Imagens da publicacao",
    emptyDescription:
      "Suba imagens com foco no resultado final para o feed nascer com cara de conteudo premium.",
  },
  story: {
    previewAspectRatio: 9 / 16,
    previewFit: "cover",
    maxWidth: 1080,
    maxHeight: 1920,
    maxInputBytes: 10 * 1024 * 1024,
    maxFiles: 1,
    browserQuality: 0.9,
    serverQuality: 90,
    badges: [
      "Proporcao sugerida 9:16",
      "Ate 1080x1920",
      "Story vertical no topo do feed",
    ],
    helperText:
      "Stories performam melhor com foto vertical, leitura rapida e foco no rosto, resultado ou vaga do dia.",
    emptyTitle: "Foto do story",
    emptyDescription:
      "Escolha uma foto vertical para o story abrir com cara de Instagram no app cliente.",
  },
  offer: {
    previewAspectRatio: 4 / 3,
    previewFit: "cover",
    maxWidth: 1800,
    maxHeight: 1350,
    maxInputBytes: 8 * 1024 * 1024,
    maxFiles: 1,
    browserQuality: 0.88,
    serverQuality: 88,
    badges: [
      "Proporcao sugerida 4:3",
      "Ate 1800x1350",
      "Aparece na home do app",
    ],
    helperText:
      "A imagem da oferta funciona melhor quando destaca o beneficio principal da assinatura ou promocao.",
    emptyTitle: "Foto da oferta",
    emptyDescription:
      "Escolha uma imagem clara para reforcar a oferta que aparece na home do app.",
  },
};

export function formatPresetMegabytes(bytes: number) {
  const value = bytes / (1024 * 1024);
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
