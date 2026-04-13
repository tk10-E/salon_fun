// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { fetchPublicSalonLandingDataMock } = vi.hoisted(() => ({
  fetchPublicSalonLandingDataMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/lib/requestOrigin", () => ({
  buildAbsoluteUrl: vi.fn((path: string) => `https://example.com${path}`),
}));

vi.mock("@/lib/publicSalonShare", () => ({
  fetchPublicSalonLandingData: fetchPublicSalonLandingDataMock,
}));

import PublicSalonPage from "@/app/s/[joinCode]/page";

describe("public salon page", () => {
  it("renders premium showcase blocks for services, offers and gallery", async () => {
    fetchPublicSalonLandingDataMock.mockResolvedValue({
      preview: {
        salonId: "salon-1",
        joinCode: "ABCD1234",
        name: "Studio Centro",
        tagline: "Beleza premium com leitura comercial forte.",
        brandColor: "#C56B43",
        businessSegment: "beauty_salon",
        whatsappPhone: "5511999999999",
        heroHeadline: "Entre no salão certo com uma experiência premium.",
        logoUrl: null,
        heroImageUrl: "https://cdn.example.com/hero.jpg",
        shareImageUrl: "https://cdn.example.com/share.jpg",
        welcomeHeadline: "Studio Centro no seu bolso.",
        welcomeMessage:
          "Serviços, promoções e prova visual organizados para converter melhor.",
        promotionHeadline: "Pacotes ativos com linguagem de marca.",
        instagramUrl: "https://instagram.com/studiocentro",
        addressLabel: "Rua Augusta, 500",
        mapUrl: "https://maps.example.com/studio-centro",
        ratingValue: 4.9,
        ratingCount: 186,
        moduleLabels: ["Atalhos premium", "Galeria", "Produtos"],
        segmentLabel: "Salão feminino",
        segmentDescription: "Transformação, agenda e benefícios.",
      },
      featuredServices: [
        {
          id: "svc-1",
          name: "Corte assinatura",
          category: "Cabelo",
          description: "Corte com finalização premium.",
          duration: 60,
          price: 120,
          imageUrl: "https://cdn.example.com/service.jpg",
        },
      ],
      activeOffers: [
        {
          id: "offer-1",
          kind: "promotion",
          title: "Combo glow da semana",
          description: "Pacote com acabamento editorial.",
          highlightText: "Vagas limitadas",
          kindLabel: "Oferta ativa",
          priceLabel: "R$ 199,00",
          lifecycleLabel: "Ativo agora",
        },
      ],
      recentPosts: [
        {
          id: "post-1",
          title: "Resultado real",
          caption: "Transformação com prova visual.",
          imageUrl: "https://cdn.example.com/post.jpg",
          badge: "Antes e depois",
          serviceName: "Coloração",
          staffLabel: "Camila • Colorista",
        },
      ],
      stats: {
        servicesCount: 1,
        activeOffersCount: 1,
        recentPostsCount: 1,
      },
    });

    const ui = await PublicSalonPage({
      params: { joinCode: "ABCD1234" },
    });

    render(ui);

    expect(
      screen.getByRole("heading", {
        name: "Entre no salão certo com uma experiência premium.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir no app" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copiar codigo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Serviços principais")).toBeInTheDocument();
    expect(screen.getByText("Corte assinatura")).toBeInTheDocument();
    expect(screen.getByText("Promoções e clube")).toBeInTheDocument();
    expect(screen.getByText("Combo glow da semana")).toBeInTheDocument();
    expect(screen.getByText("Prova visual")).toBeInTheDocument();
    expect(screen.getByText("Resultado real")).toBeInTheDocument();
    expect(screen.getAllByText("ABCD1234").length).toBeGreaterThan(1);
  });
});
