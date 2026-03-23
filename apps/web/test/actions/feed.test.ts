import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  makeImageFile,
  makeVideoFile,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { createClientMock, redirectMock, revalidatePathMock, requireOwnerSalonMock } = vi.hoisted(() => ({
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

import { createSalonPostActionImpl } from "@/app/_actions/feed";

describe("feed actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
      user: { id: "owner-1" },
    });
  });

  it("creates a post with gallery and customer notification", async () => {
    const serviceLookup = vi.fn().mockResolvedValue({
      data: {
        id: "service-1",
        name: "Corte premium",
      },
      error: null,
    });
    const selectService = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: serviceLookup,
        })),
      })),
    }));

    const createdPost = {
      id: "post-1",
      created_at: "2026-03-22T12:00:00.000Z",
    };
    const selectCreatedPost = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: createdPost,
        error: null,
      }),
    }));
    const insertPost = vi.fn(() => ({
      select: selectCreatedPost,
    }));
    const deletePost = vi.fn(() => ({
      eq: vi.fn(),
    }));

    const insertGallery = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const uploadImage = vi.fn().mockResolvedValue({ error: null });
    const removeImages = vi.fn().mockResolvedValue(undefined);
    const getPublicUrl = vi.fn().mockReturnValue({
      data: {
        publicUrl: "https://cdn.example.com/post.jpg",
      },
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return { select: selectService };
        }

        if (table === "salon_posts") {
          return {
            insert: insertPost,
            delete: deletePost,
          };
        }

        if (table === "salon_post_images") {
          return { insert: insertGallery };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn((bucket: string) => {
          if (bucket !== "salon-posts") {
            throw new Error(`Unexpected bucket ${bucket}`);
          }

          return {
            upload: uploadImage,
            remove: removeImages,
            getPublicUrl,
          };
        }),
      },
    });

    const imageFile = makeImageFile("look.jpg");

    const location = await captureRedirect(
      createSalonPostActionImpl(
        makeFormData({
          title: "Antes e depois",
          caption: "Resultado do dia",
          serviceId: "service-1",
          images: [imageFile],
        }),
      ),
      redirectMock,
    );

    const uploadedPath = uploadImage.mock.calls[0]?.[0];

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(insertPost).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        title: "Antes e depois",
        service_id: "service-1",
        created_by_user_id: "owner-1",
      }),
    );
    expect(insertGallery).toHaveBeenCalledWith([
      {
        post_id: "post-1",
        image_path: uploadedPath,
        sort_order: 0,
      },
    ]);
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "feed_post_published",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/feed");
    expect(location).toBe("/dashboard/feed?message=Publica%C3%A7%C3%A3o+criada+com+sucesso.&tone=success");
  });

  it("creates a reel with highlighted professional and video payload", async () => {
    const serviceLookup = vi.fn().mockResolvedValue({
      data: {
        id: "service-1",
        name: "Escova modelada",
      },
      error: null,
    });
    const staffLookup = vi.fn().mockResolvedValue({
      data: {
        id: "staff-1",
        name: "Talita",
      },
      error: null,
    });
    const selectService = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: serviceLookup,
        })),
      })),
    }));
    const selectStaff = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: staffLookup,
        })),
      })),
    }));

    const createdPost = {
      id: "post-reel-1",
      created_at: "2026-03-22T15:00:00.000Z",
    };
    const selectCreatedPost = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: createdPost,
        error: null,
      }),
    }));
    const insertPost = vi.fn(() => ({
      select: selectCreatedPost,
    }));
    const insertGallery = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const uploadAsset = vi.fn().mockResolvedValue({ error: null });
    const removeAssets = vi.fn().mockResolvedValue(undefined);
    const getPublicUrl = vi.fn((path: string) => ({
      data: {
        publicUrl: `https://cdn.example.com/${path}`,
      },
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return { select: selectService };
        }

        if (table === "staff_members") {
          return { select: selectStaff };
        }

        if (table === "salon_posts") {
          return {
            insert: insertPost,
          };
        }

        if (table === "salon_post_images") {
          return { insert: insertGallery };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: uploadAsset,
          remove: removeAssets,
          getPublicUrl,
        })),
      },
    });

    const location = await captureRedirect(
      createSalonPostActionImpl(
        makeFormData({
          postType: "reel",
          title: "Finalização em movimento",
          caption: "Video curto com escova glow.",
          serviceId: "service-1",
          staffMemberId: "staff-1",
          images: [makeImageFile("cover.jpg")],
          video: makeVideoFile("reel.mp4"),
        }),
      ),
      redirectMock,
    );

    expect(uploadAsset).toHaveBeenCalledTimes(2);
    expect(insertPost).toHaveBeenCalledWith(
      expect.objectContaining({
        post_type: "reel",
        staff_member_id: "staff-1",
        video_path: expect.stringMatching(/^salon-1\//),
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          postType: "reel",
          staffMemberName: "Talita",
          postVideoUrl: expect.stringContaining("https://cdn.example.com/"),
        }),
      }),
    );
    expect(location).toBe("/dashboard/feed?message=V%C3%ADdeo+curto+publicado+com+sucesso.&tone=success");
  });
});
