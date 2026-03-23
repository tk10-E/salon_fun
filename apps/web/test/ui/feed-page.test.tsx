// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createSalonPostActionMock,
  deleteSalonPostActionMock,
  deleteSalonPostCommentActionMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSalonPostActionMock: vi.fn(),
  deleteSalonPostActionMock: vi.fn(),
  deleteSalonPostCommentActionMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/app/actions", () => ({
  createSalonPostAction: createSalonPostActionMock,
  deleteSalonPostAction: deleteSalonPostActionMock,
  deleteSalonPostCommentAction: deleteSalonPostCommentActionMock,
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

  it("renders published posts with gallery/comment stats and the composer form", async () => {
    const postsQuery = createPostsQuery([
      {
        id: "post-1",
        title: "Escova glow",
        caption: "Resultado do dia com brilho intenso.",
        image_path: "cover.jpg",
        post_type: "before_after",
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

    expect(screen.getByRole("heading", { name: "Feed do salão" })).toBeInTheDocument();
    expect(screen.getByText("Publicação criada com sucesso.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Escova glow" })).toBeInTheDocument();
    expect(screen.getByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("Depois")).toBeInTheDocument();
    expect(screen.getAllByText("Antes e depois").length).toBeGreaterThan(0);
    expect(screen.getByText(/Assinado por/i)).toBeInTheDocument();
    expect(screen.getByText("Talita")).toBeInTheDocument();
    expect(screen.getAllByText("Escova modelada").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Transformação que ajuda a cliente a imaginar o próprio resultado com mais confiança.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("2 curtidas")).toBeInTheDocument();
    expect(screen.getByText("1 comentários")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova publicação" })).toBeInTheDocument();
    expect(
      screen.getByText("O que mais faz a cliente salvar e agendar"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Formato do post")).toBeInTheDocument();
    expect(screen.getByLabelText("Título da publicação")).toBeInTheDocument();
    expect(screen.getByLabelText("Serviço vinculado")).toBeInTheDocument();
    expect(screen.getByLabelText("Profissional em destaque")).toBeInTheDocument();
    expect(screen.getByLabelText("Vídeo curto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar no app" })).toBeInTheDocument();
  });
});
