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
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  publishInstagramMentionActionImpl,
  saveInstagramConnectionActionImpl,
} from "@/app/_actions/instagram";

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
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue(undefined);
    const insertPost = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: "post-1" },
          error: null,
        }),
      })),
    }));
    const insertGallery = vi.fn().mockResolvedValue({ error: null });
    const updateMention = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

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
            update: updateMention,
          };
        }

        if (table === "salon_posts") {
          return {
            insert: insertPost,
          };
        }

        if (table === "salon_post_images") {
          return {
            insert: insertGallery,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload,
          remove,
        })),
      },
    });

    global.fetch = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      }),
    ) as typeof fetch;

    const location = await captureRedirect(
      publishInstagramMentionActionImpl(
        makeFormData({
          mentionId: "mention-1",
        }),
      ),
      redirectMock,
    );

    expect(upload).toHaveBeenCalledTimes(1);
    expect(insertPost).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        source_type: "instagram_mention",
        instagram_mention_id: "mention-1",
        external_author_username: "cliente_real",
      }),
    );
    expect(insertGallery).toHaveBeenCalledWith([
      expect.objectContaining({
        post_id: "post-1",
        sort_order: 0,
      }),
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/instagram");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/feed");
    expect(location).toBe("/dashboard/instagram?message=Men%C3%A7%C3%A3o+publicada+no+feed+do+app+com+sucesso.&tone=success");
  });
});
