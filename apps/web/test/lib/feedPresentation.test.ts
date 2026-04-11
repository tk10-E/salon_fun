import { describe, expect, it } from "vitest";

import {
  getFeedCoverHighlight,
  getFeedPostEditorialNote,
  getFeedVisualCategory,
} from "@/lib/feedPresentation";

describe("feedPresentation", () => {
  it("classifies promotional copy before generic portfolio signals", () => {
    expect(
      getFeedVisualCategory({
        title: "Combo glow com desconto",
        caption: "Oferta da semana com vagas limitadas.",
        postType: "standard",
        serviceName: "Gloss express",
      }),
    ).toBe("promotion");
  });

  it("keeps before and after content in the transformation bucket", () => {
    expect(
      getFeedVisualCategory({
        title: "Morena iluminada",
        caption: "Resultado final com brilho intenso.",
        postType: "before_after",
        serviceName: "Morena iluminada",
      }),
    ).toBe("transformation");
  });

  it("builds a reel poster highlight for promotional video content", () => {
    expect(
      getFeedCoverHighlight({
        title: "Combo gloss com desconto",
        caption: "Oferta relâmpago da semana.",
        postType: "reel",
      }),
    ).toMatchObject({
      eyebrow: "Promoção em vídeo",
      title: "Poster com chamada forte",
    });
  });

  it("adds Instagram context to editorial notes when the post comes from a mention", () => {
    expect(
      getFeedPostEditorialNote({
        title: "Escova glow",
        caption: "Resultado final com brilho intenso.",
        postType: "standard",
        sourceType: "instagram_mention",
        serviceName: "Escova modelada",
      }),
    ).toContain("Instagram");
  });
});
