// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireOwnerSalonMock,
  saveInstagramConnectionActionMock,
  disconnectInstagramConnectionActionMock,
  validateInstagramConnectionTokenActionMock,
  approveInstagramMentionActionMock,
  rejectInstagramMentionActionMock,
  publishInstagramMentionActionMock,
  syncInstagramActivityActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  saveInstagramConnectionActionMock: vi.fn(),
  disconnectInstagramConnectionActionMock: vi.fn(),
  validateInstagramConnectionTokenActionMock: vi.fn(),
  approveInstagramMentionActionMock: vi.fn(),
  rejectInstagramMentionActionMock: vi.fn(),
  publishInstagramMentionActionMock: vi.fn(),
  syncInstagramActivityActionMock: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  saveInstagramConnectionAction: saveInstagramConnectionActionMock,
  disconnectInstagramConnectionAction: disconnectInstagramConnectionActionMock,
  validateInstagramConnectionTokenAction: validateInstagramConnectionTokenActionMock,
  approveInstagramMentionAction: approveInstagramMentionActionMock,
  rejectInstagramMentionAction: rejectInstagramMentionActionMock,
  publishInstagramMentionAction: publishInstagramMentionActionMock,
  syncInstagramActivityAction: syncInstagramActivityActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import InstagramPage from "@/app/dashboard/instagram/page";

function createQuery(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve({ data, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error: null })),
  };

  return query;
}

describe("instagram page UI", () => {
  const originalMetaAppId = process.env.INSTAGRAM_META_APP_ID;
  const originalMetaAppSecret = process.env.INSTAGRAM_META_APP_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INSTAGRAM_META_APP_ID = "1490951809405535";
    process.env.INSTAGRAM_META_APP_SECRET = "meta-secret";
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  afterEach(() => {
    process.env.INSTAGRAM_META_APP_ID = originalMetaAppId;
    process.env.INSTAGRAM_META_APP_SECRET = originalMetaAppSecret;
  });

  it("renders connection health and the moderation queue", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() =>
              createQuery({
                id: "connection-1",
                instagram_user_id: "17841400000000000",
                instagram_username: "docebeleza",
                facebook_page_id: "123456789",
                facebook_page_name: "Salon Fun",
                connection_status: "active",
                auto_publish_owned_posts: false,
                require_mention_approval: true,
                import_story_mentions: true,
                last_webhook_at: "2026-03-23T13:00:00.000Z",
                last_sync_at: "2026-03-23T12:00:00.000Z",
                last_error: null,
              }),
            ),
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "mention-1",
                  platform: "facebook",
                  source_type: "post_mention",
                  media_type: "image",
                  author_username: "cliente_real",
                  caption: "Amei o resultado no salão",
                  permalink: "https://instagram.com/p/abc",
                  media_url: "https://cdn.example.com/mention.jpg",
                  thumbnail_url: null,
                  moderation_status: "pending",
                  moderation_note: null,
                  mentioned_at: "2026-03-23T11:00:00.000Z",
                  published_post_id: null,
                  published_at: null,
                },
              ]),
            ),
          };
        }

        if (table === "instagram_webhook_events") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "event-1",
                  event_type: "mention",
                  processing_status: "processed",
                  created_at: "2026-03-23T11:00:00.000Z",
                  processed_at: "2026-03-23T11:00:02.000Z",
                  last_error: null,
                },
              ]),
            ),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await InstagramPage({
      searchParams: { message: "Conexão do Instagram atualizada com sucesso.", tone: "success" },
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Marcação e publicações do salão" })).toBeInTheDocument();
    expect(screen.getByText("Conexão do Instagram atualizada com sucesso.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar conexão" }),
    ).toHaveAttribute("href", "/dashboard/instagram/connect");
    expect(screen.getByRole("button", { name: "Atualizar agora" })).toBeInTheDocument();
    expect(screen.getByText("Conta profissional conectada")).toBeInTheDocument();
    expect(screen.getByText("@docebeleza")).toBeInTheDocument();
    expect(screen.getByText("Pendentes")).toBeInTheDocument();
    expect(screen.getByText("Aprovadas")).toBeInTheDocument();
    expect(screen.getByText("Publicadas")).toBeInTheDocument();
    expect(screen.queryByText("Configuração avançada e fallback manual")).not.toBeInTheDocument();
    expect(screen.queryByText("Webhook da Meta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validar token" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desconectar" })).not.toBeInTheDocument();
    expect(screen.getByText("Fila de menções")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Fila/i }),
    ).toHaveAttribute("href", "#instagram-queue");
    expect(screen.getByText("cliente_real")).toBeInTheDocument();
    expect(screen.getByText("Amei o resultado no salão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeitar" })).toBeInTheDocument();
    expect(screen.getByText("Resumo da conexão atual")).toBeInTheDocument();
    expect(screen.getByText("Página: Salon Fun")).toBeInTheDocument();
    expect(screen.getAllByText("Página").length).toBeGreaterThan(0);
    expect(screen.getByText(/imagem/i)).toBeInTheDocument();
  });

  it("treats already linked mentions as published even if the old status comes back", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() =>
              createQuery({
                id: "connection-1",
                instagram_user_id: "17841400000000000",
                instagram_username: "docebeleza",
                facebook_page_id: "123456789",
                facebook_page_name: "Salon Fun",
                connection_status: "active",
                auto_publish_owned_posts: false,
                require_mention_approval: true,
                import_story_mentions: true,
                last_webhook_at: "2026-03-23T13:00:00.000Z",
                last_sync_at: "2026-03-23T12:00:00.000Z",
                last_error: null,
              }),
            ),
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "mention-1",
                  platform: "instagram",
                  source_type: "post_mention",
                  media_type: "image",
                  author_username: "cliente_real",
                  caption: "Amei o resultado no salão",
                  permalink: "https://instagram.com/p/abc",
                  media_url: "https://cdn.example.com/mention.jpg",
                  thumbnail_url: null,
                  moderation_status: "approved",
                  moderation_note: null,
                  mentioned_at: "2026-03-23T11:00:00.000Z",
                  published_post_id: "post-1",
                  published_at: "2026-03-23T11:10:00.000Z",
                },
              ]),
            ),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await InstagramPage({});

    render(ui);

    expect(screen.getByText("Publicada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Já publicado" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rejeitar" })).not.toBeInTheDocument();
  });

  it("shows a friendly warning when only the Facebook page read is limited", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() =>
              createQuery({
                id: "connection-1",
                instagram_user_id: "17841400000000000",
                instagram_username: "docebeleza",
                facebook_page_id: "123456789",
                facebook_page_name: "Salon Fun",
                connection_status: "active",
                auto_publish_owned_posts: false,
                require_mention_approval: true,
                import_story_mentions: true,
                last_webhook_at: "2026-03-23T13:00:00.000Z",
                last_sync_at: "2026-03-23T12:00:00.000Z",
                last_error:
                  "Nao foi possivel sincronizar o feed da pagina no Facebook: {\"error\":{\"message\":\"(#10) This endpoint requires the 'pages_read_engagement' permission or the 'Page Public Content Access' feature.\",\"type\":\"OAuthException\",\"code\":10}}",
              }),
            ),
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() =>
              createQuery([
                {
                  id: "mention-1",
                  platform: "instagram",
                  source_type: "post_mention",
                  media_type: "image",
                  author_username: "cliente_real",
                  caption: "Amei o resultado no salão",
                  permalink: "https://instagram.com/p/abc",
                  media_url: "https://cdn.example.com/mention.jpg",
                  thumbnail_url: null,
                  moderation_status: "published",
                  moderation_note: null,
                  mentioned_at: "2026-03-23T11:00:00.000Z",
                  published_post_id: "post-1",
                  published_at: "2026-03-23T11:10:00.000Z",
                },
              ]),
            ),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await InstagramPage({});

    render(ui);

    expect(screen.getByText("Aviso da conexao")).toBeInTheDocument();
    expect(
      screen.getByText(
        "O Instagram segue funcionando normalmente. So a leitura das publicacoes da pagina do salao esta limitada neste momento.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pages_read_engagement/i)).not.toBeInTheDocument();
  });
});
