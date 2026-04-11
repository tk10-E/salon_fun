export type FeedComposerPostType = "standard" | "before_after" | "reel";

export const FEED_STANDARD_MAX_IMAGES = 5;

export type FeedComposerSpec = {
  title: string;
  summary: string;
  imageFieldLabel: string;
  imageHelper: string;
  imageRules: string[];
  videoHelper: string;
  videoRequired: boolean;
  videoEnabled: boolean;
  visualNotes: string[];
};

export const FEED_COMPOSER_SPECS: Record<
  FeedComposerPostType,
  FeedComposerSpec
> = {
  standard: {
    title: "Foto ou galeria",
    summary:
      "Use quando quiser mostrar ambiente, resultado final ou uma pequena sequencia do atendimento.",
    imageFieldLabel: "Imagens da galeria",
    imageHelper: "Envie de 1 a 5 imagens. A primeira vira a capa do post.",
    imageRules: [
      "A primeira imagem precisa segurar o clique sozinha.",
      "Galeria funciona bem para mostrar processo, detalhes e produto final.",
      "Fotos verticais ou levemente fechadas performam melhor no app.",
    ],
    videoHelper:
      "Video nao e obrigatorio nesse formato. Use esse campo apenas em video curto.",
    videoRequired: false,
    videoEnabled: false,
    visualNotes: [
      "Capa forte e limpa",
      "Ate 5 imagens",
      "Descoberta e inspiracao",
    ],
  },
  before_after: {
    title: "Antes e depois",
    summary:
      "Formato para vender transformacao. A ordem das duas imagens define claramente o antes e o depois.",
    imageFieldLabel: "Imagens do antes e depois",
    imageHelper:
      "Envie exatamente 2 imagens. A primeira fica como Antes e a segunda como Depois.",
    imageRules: [
      "Mantenha enquadramento parecido entre as duas imagens.",
      "Resultado principal deve aparecer logo de cara.",
      "Evite fundos muito diferentes para a comparacao ficar mais forte.",
    ],
    videoHelper:
      "Video nao faz parte desse formato. Use apenas as duas imagens comparativas.",
    videoRequired: false,
    videoEnabled: false,
    visualNotes: [
      "2 imagens em ordem",
      "Antes a esquerda",
      "Transformacao clara",
    ],
  },
  reel: {
    title: "Vídeo curto",
    summary:
      "Formato rapido para mostrar movimento, brilho, acabamento e tecnica com mais impacto visual.",
    imageFieldLabel: "Capa do vídeo curto",
    imageHelper:
      "Envie 1 imagem de capa. Ela aparece como poster do vídeo e segura a vitrine antes do play.",
    imageRules: [
      "A capa deve funcionar mesmo sem o vídeo rodando.",
      "Escolha um frame ou foto com resultado forte e leitura imediata.",
      "Use vídeo vertical ou com assunto centralizado para mobile.",
    ],
    videoHelper:
      "Vídeo curto pede 1 capa vertical e 1 arquivo de vídeo.",
    videoRequired: true,
    videoEnabled: true,
    visualNotes: [
      "1 capa + 1 video",
      "Poster forte",
      "Movimento e acabamento",
    ],
  },
};

export function isFeedComposerPostType(
  value: string,
): value is FeedComposerPostType {
  return value === "standard" || value === "before_after" || value === "reel";
}
