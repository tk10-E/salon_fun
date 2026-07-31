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

  it("renders stories, published posts and the real composer flow", async () => {
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
        expires_at: null,
        services: { id: "service-1", name: "Escova modelada" },
        staff_members: { id: "staff-1", name: "Talita", role: "Colorista" },
        salon_post_images: [
          { id: "img-1", image_path: "cover.jpg", sort_order: 0 },
          { id: "img-2", image_path: "detail.jpg", sort_order: 1 },
        ],
        salon_post_likes: [
          { customer_id: "customer-1" },
          { customer_id: "customer-2" },
        ],
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
        id: "story-1",
        title: "Vaga de hoje",
        caption: "Ultimo encaixe da tarde.",
        image_path: "story-cover.jpg",
        post_type: "story",
        source_type: null,
        video_path: null,
        created_at: "2026-03-21T15:00:00.000Z",
        expires_at: "2099-03-21T23:00:00.000Z",
        services: { id: "service-1", name: "Escova modelada" },
        staff_members: { id: "staff-1", name: "Talita", role: "Colorista" },
        salon_post_images: [
          { id: "img-story-1", image_path: "story-cover.jpg", sort_order: 0 },
        ],
        salon_post_likes: [],
        salon_post_comments: [],
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
        expires_at: null,
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
      { id: "service-2", name: "Hidratacao glow" },
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
      searchParams: Promise.resolve({
        message: "Publicacao criada com sucesso.",
        tone: "success",
      }),
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Feed e stories" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Publicacao criada com sucesso."),
    ).toBeInTheDocument();
    expect(screen.getByText("2 publicações")).toBeInTheDocument();
    expect(screen.getByText("1 stories ativos")).toBeInTheDocument();
    expect(screen.getByText("1 transformações")).toBeInTheDocument();
    expect(screen.getByText("1 promoções")).toBeInTheDocument();
    expect(screen.getByText("1 videos curtos")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Stories ativos", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Vaga de hoje" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Sai em/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Encerrar story" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Escova glow" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Antes e depois").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Transforma.*acelerar reserva\./),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Profissional: Talita .* Colorista/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/2 curtidas .* 1 comentários/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Combo gloss com desconto" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Promo/).length).toBeGreaterThan(0);
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
    expect(screen.getByText("Assistente de IA")).toBeInTheDocument();
    expect(screen.getByLabelText("Orientação para a IA")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar título e legenda com IA" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Formato do post"), {
      target: { value: "reel" },
    });
    expect(screen.getByText("1 capa + 1 video")).toBeInTheDocument();
    expect(screen.getByText(/1 capa vertical/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Formato do post"), {
      target: { value: "before_after" },
    });
    expect(screen.getByText("2 imagens em ordem")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Envie exatamente 2 imagens. A primeira fica como Antes e a segunda como Depois.",
      ).length,
    ).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Formato do post"), {
      target: { value: "story" },
    });
    expect(screen.getByLabelText("Tempo de story")).toBeInTheDocument();
    expect(screen.getByText("Proporcao sugerida 9:16")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Depois desse prazo, o story sai sozinho do app do cliente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar no app" }),
    ).toBeInTheDocument();
  });

  it("opens the feed composer with AI prefill from the panel assistant", async () => {
    const postsQuery = createPostsQuery([]);
    const servicesQuery = createServicesQuery([
      { id: "service-1", name: "Escova modelada" },
    ]);
    const staffQuery = createServicesQuery([
      { id: "staff-1", name: "Talita", role: "Colorista" },
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
      searchParams: Promise.resolve({
        aiNotes: "Use urgencia simples e convide para reservar agora.",
        prefillCaption: "Ultima vaga de hoje. Reserve pelo app antes de fechar.",
        prefillPostType: "story",
        prefillServiceId: "service-1",
        prefillStaffMemberId: "staff-1",
        prefillTitle: "Story de encaixe",
      }),
    });

    render(ui);

    expect(
      (screen.getByLabelText("Formato do post") as HTMLSelectElement).value,
    ).toBe("story");
    expect(screen.getByLabelText("Tempo de story")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Story de encaixe")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Ultima vaga de hoje. Reserve pelo app antes de fechar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Use urgencia simples e convide para reservar agora.",
      ),
    ).toBeInTheDocument();
    expect((screen.getByLabelText(/servi.o/i) as HTMLSelectElement).value).toBe(
      "service-1",
    );
    expect(
      (screen.getByLabelText("Profissional") as HTMLSelectElement).value,
    ).toBe("staff-1");
  });
});
