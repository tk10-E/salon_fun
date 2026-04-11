// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createSalonPostActionPath,
  deleteSalonPostActionPath,
  deleteSalonPostCommentActionPath,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSalonPostActionPath: "/__test/create-salon-post",
  deleteSalonPostActionPath: "/__test/delete-salon-post",
  deleteSalonPostCommentActionPath: "/__test/delete-salon-post-comment",
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/app/actions", () => ({
  createSalonPostAction: createSalonPostActionPath,
  deleteSalonPostAction: deleteSalonPostActionPath,
  deleteSalonPostCommentAction: deleteSalonPostCommentActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import FeedPage from "@/app/dashboard/feed/page";

function createPostsQuery(data: unknown[]) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };

  return query;
}

function createServicesQuery(data: unknown[]) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };

  return query;
}

describe("feed page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders published posts with gallery stats and a compact composer flow", async () => {
    const postsQuery = createPostsQuery([
      {
        id: "post-1",
        title: "Escova glow",
        caption: "Resultado do dia com brilho intenso.",
        image_path: "cover.jpg",
        post_type: "before_after",
        source_type: null,
        video_path: null,
        created_at: "2026-03-20T15:00:00.000Z",
        services: { id: "service-1", name: "Escova modelada" },
        staff_members: { id: "staff-1", name: "Talita", role: "Colorista" },
        salon_post_images: [
          { id: "img-1", image_path: "cover.jpg", sort_order: 0 },
          { id: "img-2", image_path: "detail.jpg", sort_order: 1 },
        ],
        salon_post_likes: [{ customer_id: "customer-1" }, { customer_id: "customer-2" }],
        salon_post_comments: [
          {
            id: "comment-1",
            customer_name: "Maria",
            body: "Amei o resultado!",
            created_at: "2026-03-20T18:00:00.000Z",
          },
        ],
      },
      {
        id: "post-2",
        title: "Combo gloss com desconto",
        caption: "Oferta da semana com vagas limitadas.",
        image_path: "promo-cover.jpg",
        post_type: "reel",
        source_type: null,
        video_path: "promo-reel.mp4",
        created_at: "2026-03-19T15:00:00.000Z",
        services: { id: "service-2", name: "Gloss express" },
        staff_members: null,
        salon_post_images: [
          { id: "img-3", image_path: "promo-cover.jpg", sort_order: 0 },
        ],
        salon_post_likes: [],
        salon_post_comments: [],
      },
    ]);
    const servicesQuery = createServicesQuery([
      { id: "service-1", name: "Escova modelada" },
      { id: "service-2", name: "Hidratação glow" },
    ]);
    const staffQuery = createServicesQuery([
      { id: "staff-1", name: "Talita", role: "Colorista" },
      { id: "staff-2", name: "Bia", role: "Designer" },
    ]);

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_posts") {
          return {
            select: vi.fn(() => postsQuery),
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => servicesQuery),
          };
        }

        if (table === "staff_members") {
          return {
            select: vi.fn(() => staffQuery),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const ui = await FeedPage({
      searchParams: { message: "Publicação criada com sucesso.", tone: "success" },
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Vitrine simples de posts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Publicação criada com sucesso.")).toBeInTheDocument();
    expect(screen.getByText("2 publicações")).toBeInTheDocument();
    expect(screen.getByText("1 transformações")).toBeInTheDocument();
    expect(screen.getByText("1 promoções")).toBeInTheDocument();
    expect(screen.getByText("1 vídeos curtos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Escova glow" })).toBeInTheDocument();
    expect(screen.getAllByText("Antes e depois").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Transformação para gerar confiança e acelerar reserva\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Profissional: Talita • Colorista/),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 curtidas • 1 comentários/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Combo gloss com desconto" })).toBeInTheDocument();
    expect(screen.getAllByText("Promoção").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /Vídeo curto com leitura promocional para girar agenda, pacote ou oferta\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nova publicação" }),
    ).toHaveAttribute("href", "#feed-new");
    expect(
      screen.getByRole("heading", { name: "Nova publicação", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dicas rápidas")).toBeInTheDocument();
    expect(screen.getByLabelText("Formato do post")).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByLabelText("Serviço")).toBeInTheDocument();
    expect(screen.getByLabelText("Profissional")).toBeInTheDocument();
    expect(screen.getByLabelText("Vídeo curto")).toBeInTheDocument();
    expect(screen.getByText("Capa forte e limpa")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Formato do post"), {
      target: { value: "reel" },
    });
    expect(screen.getByText("1 capa + 1 video")).toBeInTheDocument();
    expect(
      screen.getByText("Vídeo curto pede 1 capa vertical e 1 arquivo de vídeo."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Formato do post"), {
      target: { value: "before_after" },
    });
    expect(screen.getByText("2 imagens em ordem")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Envie exatamente 2 imagens. A primeira fica como Antes e a segunda como Depois.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Publicar no app" })).toBeInTheDocument();
  });
});
