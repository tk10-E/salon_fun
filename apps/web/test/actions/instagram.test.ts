import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
  autoPublishInstagramMentionsMock,
  importInstagramMentionIntoFeedMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  autoPublishInstagramMentionsMock: vi.fn(),
  importInstagramMentionIntoFeedMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/instagram-feed-import", () => ({
  autoPublishInstagramMentions: autoPublishInstagramMentionsMock,
  importInstagramMentionIntoFeed: importInstagramMentionIntoFeedMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  approveInstagramMentionActionImpl,
  publishInstagramMentionActionImpl,
  rejectInstagramMentionActionImpl,
  saveInstagramConnectionActionImpl,
  syncInstagramActivityActionImpl,
  validateInstagramConnectionTokenActionImpl,
} from "@/app/_actions/instagram";
import { encryptInstagramAccessToken } from "@/lib/instagram-crypto";

describe("instagram actions", () => {
  const originalSecret = process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET = "test-instagram-secret";
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
      user: { id: "owner-1" },
    });
    autoPublishInstagramMentionsMock.mockResolvedValue({
      publishedCount: 0,
      warnings: [],
    });
    importInstagramMentionIntoFeedMock.mockResolvedValue({
      postId: "post-1",
      created: true,
    });
  });

  afterEach(() => {
    process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET = originalSecret;
    global.fetch = originalFetch;
  });

  it("saves an instagram connection with encrypted token", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            upsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      saveInstagramConnectionActionImpl(
        makeFormData({
          instagramUserId: "17841400000000000",
          instagramUsername: "docebeleza",
          facebookPageId: "1234567890",
          accessToken: "EAAB-test-token",
          requireMentionApproval: "on",
          importStoryMentions: "on",
        }),
      ),
      redirectMock,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        instagram_user_id: "17841400000000000",
        instagram_username: "docebeleza",
        access_token_ciphertext: expect.not.stringContaining("EAAB-test-token"),
      }),
      { onConflict: "salon_id" },
    );
    expect(location).toBe("/dashboard/instagram?message=Conex%C3%A3o+do+Instagram+atualizada+com+sucesso.&tone=success");
  });

  it("publishes an approved instagram mention into the feed", async () => {
    const maybeSingleMention = vi.fn().mockResolvedValue({
      data: {
        id: "mention-1",
        salon_id: "salon-1",
        platform: "instagram",
        source_type: "post_mention",
        media_type: "image",
        author_username: "cliente_real",
        caption: "Amei esse resultado",
        permalink: "https://instagram.com/p/abc",
        media_url: "https://cdn.instagram.example/mention.jpg",
        thumbnail_url: null,
        moderation_status: "approved",
        published_post_id: null,
      },
      error: null,
    });
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: maybeSingleMention,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      publishInstagramMentionActionImpl(
        makeFormData({
          mentionId: "mention-1",
        }),
      ),
      redirectMock,
    );

    expect(importInstagramMentionIntoFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "salon-1",
        ownerUserId: "owner-1",
        mention: expect.objectContaining({
          id: "mention-1",
          author_username: "cliente_real",
        }),
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/instagram");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/feed");
    expect(location).toBe("/dashboard/instagram?message=Men%C3%A7%C3%A3o+publicada+no+feed+do+app+com+sucesso.&tone=success");
  });

  it("does not allow approving a mention that is already published", async () => {
    const maybeSingleMention = vi.fn().mockResolvedValue({
      data: {
        id: "mention-1",
        salon_id: "salon-1",
        platform: "instagram",
        source_type: "post_mention",
        media_type: "image",
        author_username: "cliente_real",
        caption: "Amei esse resultado",
        permalink: "https://instagram.com/p/abc",
        media_url: "https://cdn.instagram.example/mention.jpg",
        thumbnail_url: null,
        moderation_status: "approved",
        published_post_id: "post-1",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: maybeSingleMention,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      approveInstagramMentionActionImpl(
        makeFormData({
          mentionId: "mention-1",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe("/dashboard/instagram?message=Essa+men%C3%A7%C3%A3o+j%C3%A1+foi+publicada+no+feed+do+app.&tone=info");
  });

  it("does not allow rejecting a mention that is already published", async () => {
    const maybeSingleMention = vi.fn().mockResolvedValue({
      data: {
        id: "mention-1",
        salon_id: "salon-1",
        platform: "instagram",
        source_type: "post_mention",
        media_type: "image",
        author_username: "cliente_real",
        caption: "Amei esse resultado",
        permalink: "https://instagram.com/p/abc",
        media_url: "https://cdn.instagram.example/mention.jpg",
        thumbnail_url: null,
        moderation_status: "approved",
        published_post_id: "post-1",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: maybeSingleMention,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      rejectInstagramMentionActionImpl(
        makeFormData({
          mentionId: "mention-1",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe("/dashboard/instagram?message=Essa+men%C3%A7%C3%A3o+j%C3%A1+foi+publicada+no+feed+do+app.&tone=info");
  });

  it("validates a facebook-login instagram token through the connected page", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "connection-1",
        access_token_ciphertext: encryptInstagramAccessToken("EAAB-test-token"),
        facebook_page_id: "1120032767849275",
        instagram_user_id: "17841442717327141",
        instagram_username: "jctecnologi07",
      },
      error: null,
    });
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            update,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          instagram_business_account: {
            id: "17841442717327141",
            username: "jctecnologi07",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as typeof fetch;

    const location = await captureRedirect(
      validateInstagramConnectionTokenActionImpl(new FormData()),
      redirectMock,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://graph.facebook.com/v23.0/1120032767849275?fields=instagram_business_account{id,username}",
      ),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        connection_status: "active",
        last_error: null,
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/instagram");
    expect(location).toBe("/dashboard/instagram?message=Token+validado+com+sucesso+na+API+da+Meta.&tone=success");
  });

  it("syncs recent instagram media and mentions into the moderation inbox", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "connection-1",
        salon_id: "salon-1",
        instagram_user_id: "17841442717327141",
        instagram_username: "jctecnologi07",
        access_token_ciphertext: encryptInstagramAccessToken("EAAB-test-token"),
        require_mention_approval: true,
        import_story_mentions: true,
        auto_publish_owned_posts: false,
      },
      error: null,
    });
    const mentionsUpsert = vi.fn().mockResolvedValue({ error: null });
    const selectExistingMentions = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            update,
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: selectExistingMentions,
            upsert: mentionsUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "media-1",
                caption: "Novo post do salão",
                media_type: "IMAGE",
                media_url: "https://cdn.instagram.example/media-1.jpg",
                permalink: "https://instagram.com/p/media-1",
                timestamp: "2026-03-24T10:00:00.000Z",
                username: "jctecnologi07",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "tag-1",
                caption: "Marcando o salão",
                media_type: "IMAGE",
                media_url: "https://cdn.instagram.example/tag-1.jpg",
                permalink: "https://instagram.com/p/tag-1",
                timestamp: "2026-03-24T11:00:00.000Z",
                username: "cliente_real",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as typeof fetch;
    autoPublishInstagramMentionsMock.mockResolvedValue({
      publishedCount: 2,
      warnings: [],
    });

    const location = await captureRedirect(syncInstagramActivityActionImpl(), redirectMock);

    expect(mentionsUpsert).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          salon_id: "salon-1",
          source_type: "owned_post",
          external_media_id: "media-1",
        }),
      ],
      { onConflict: "dedupe_key" },
    );
    expect(mentionsUpsert).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          salon_id: "salon-1",
          source_type: "post_mention",
          external_media_id: "tag-1",
          moderation_status: "pending",
        }),
      ],
      { onConflict: "dedupe_key" },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_error: null,
      }),
    );
    expect(autoPublishInstagramMentionsMock).toHaveBeenCalledWith({
      supabase: expect.anything(),
      salonId: "salon-1",
      ownerUserId: "owner-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/instagram");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/feed");
    expect(location).toBe(
      "/dashboard/instagram?message=Sincronizacao+concluida.+2+item%28ns%29+da+Meta+foram+atualizados+e+2+publicado%28s%29+no+feed.&tone=success",
    );
  });

  it("syncs facebook page posts and tagged mentions into the moderation inbox", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "connection-1",
        salon_id: "salon-1",
        instagram_user_id: "17841442717327141",
        instagram_username: "jctecnologi07",
        facebook_page_id: "1120032767849275",
        facebook_page_name: "Salon Fun",
        facebook_page_access_token_ciphertext: encryptInstagramAccessToken("EAAB-page-token"),
        access_token_ciphertext: encryptInstagramAccessToken("EAAB-test-token"),
        require_mention_approval: true,
        import_story_mentions: true,
        auto_publish_owned_posts: false,
      },
      error: null,
    });
    const mentionsUpsert = vi.fn().mockResolvedValue({ error: null });
    const selectExistingMentions = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            update,
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: selectExistingMentions,
            upsert: mentionsUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "fb-post-1",
                message: "Post da página",
                permalink_url: "https://facebook.com/page/posts/fb-post-1",
                created_time: "2026-03-24T12:00:00.000Z",
                from: {
                  id: "1120032767849275",
                  name: "Salon Fun",
                },
                full_picture: "https://cdn.facebook.example/page-post.jpg",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "fb-tag-1",
                message: "Cliente marcando a página",
                permalink_url: "https://facebook.com/page/posts/fb-tag-1",
                created_time: "2026-03-24T13:00:00.000Z",
                from: {
                  id: "user-99",
                  name: "Cliente Real",
                },
                full_picture: "https://cdn.facebook.example/tagged-post.jpg",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ) as typeof fetch;

    autoPublishInstagramMentionsMock.mockResolvedValue({
      publishedCount: 2,
      warnings: [],
    });

    const location = await captureRedirect(
      syncInstagramActivityActionImpl(),
      redirectMock,
    );

    expect(mentionsUpsert).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          salon_id: "salon-1",
          platform: "facebook",
          source_type: "owned_post",
          external_media_id: "fb-post-1",
          author_username: "Salon Fun",
        }),
      ],
      { onConflict: "dedupe_key" },
    );
    expect(mentionsUpsert).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          salon_id: "salon-1",
          platform: "facebook",
          source_type: "post_mention",
          external_media_id: "fb-tag-1",
          author_username: "Cliente Real",
          moderation_status: "pending",
        }),
      ],
      { onConflict: "dedupe_key" },
    );
    expect(location).toBe(
      "/dashboard/instagram?message=Sincronizacao+concluida.+2+item%28ns%29+da+Meta+foram+atualizados+e+2+publicado%28s%29+no+feed.&tone=success",
    );
  });

  it("refreshes the facebook page token before syncing when the saved connection only has a user token", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "connection-1",
        salon_id: "salon-1",
        instagram_user_id: "17841442717327141",
        instagram_username: "jctecnologi07",
        facebook_page_id: "1120032767849275",
        facebook_page_name: "Salon Fun",
        facebook_page_access_token_ciphertext: null,
        access_token_ciphertext: encryptInstagramAccessToken("EAAB-user-token"),
        require_mention_approval: true,
        import_story_mentions: true,
        auto_publish_owned_posts: false,
      },
      error: null,
    });
    const mentionsUpsert = vi.fn().mockResolvedValue({ error: null });
    const selectExistingMentions = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    }));
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({
      eq: updateEq,
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            update,
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: selectExistingMentions,
            upsert: mentionsUpsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "1120032767849275",
                name: "Salon Fun",
                access_token: "EAAB-page-token",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ) as typeof fetch;

    const location = await captureRedirect(
      syncInstagramActivityActionImpl(),
      redirectMock,
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        href: expect.stringContaining("/me/accounts?"),
      }),
      { method: "GET" },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        facebook_page_access_token_ciphertext: expect.any(String),
        last_error: null,
      }),
    );
    expect(location).toBe(
      "/dashboard/instagram?message=Sincronizacao+concluida.+Nenhum+conteudo+novo+da+Meta+foi+encontrado+agora.&tone=success",
    );
  });
});
