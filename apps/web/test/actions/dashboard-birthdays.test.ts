import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeFormData,
  makeImageFile,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  optimizeUploadedImageMock,
  redirectMock,
  requireOwnerSalonMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  optimizeUploadedImageMock: vi.fn(),
  redirectMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/uploadedImageOptimization", () => ({
  optimizeUploadedImage: optimizeUploadedImageMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  deleteSalonBirthdayCampaignAction,
  updateSalonBirthdayCampaignAction,
} from "@/app/_actions/dashboard-birthdays";

describe("dashboard birthday campaign action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Salon Fun",
      },
    });
    optimizeUploadedImageMock.mockResolvedValue({
      buffer: Buffer.from("birthday-image"),
      contentType: "image/jpeg",
      extension: "jpg",
      width: 1200,
      height: 1500,
    });
  });

  it("returns inline validation feedback when the message is blank", async () => {
    const result = await updateSalonBirthdayCampaignAction(
      makeFormData({
        __actionMode: "inline",
        birthdayCampaignTitle: "Parabens",
        birthdayCampaignMessage: "",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message:
        "Escreva a mensagem que vai aparecer no app no aniversário da cliente.",
      tone: "error",
    });
    expect(requireOwnerSalonMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("saves an uploaded image campaign and removes the previous media", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "campaign-1",
        salon_id: "salon-1",
        is_active: true,
        title: "Campanha antiga",
        message: "Mensagem antiga",
        media_kind: "image",
        image_path: "salon-1/birthdays/old.jpg",
        video_path: null,
      },
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_birthday_campaigns") {
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
      storage: {
        from: vi.fn((bucket: string) => {
          expect(bucket).toBe("salon-posts");
          return {
            upload,
            remove,
          };
        }),
      },
    });

    const result = await updateSalonBirthdayCampaignAction(
      makeFormData({
        __actionMode: "inline",
        birthdayCampaignTitle: "Feliz aniversario",
        birthdayCampaignMessage:
          "Hoje o salao preparou uma mensagem especial para voce.",
        birthdayCampaignIsActive: "on",
        birthdayCampaignMedia: makeImageFile("birthday.jpg"),
      }),
    );

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^salon-1\/birthdays\/.+\.jpg$/),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: false,
      }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        is_active: true,
        title: "Feliz aniversario",
        message: "Hoje o salao preparou uma mensagem especial para voce.",
        media_kind: "image",
        image_path: expect.stringMatching(/^salon-1\/birthdays\/.+\.jpg$/),
        video_path: null,
      }),
      { onConflict: "salon_id" },
    );
    expect(remove).toHaveBeenCalledWith(["salon-1/birthdays/old.jpg"]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/birthdays");
    expect(result).toEqual({
      ok: true,
      message:
        "Mensagem de aniversário atualizada e pronta para aparecer no app.",
      tone: "success",
    });
  });

  it("deletes the existing birthday campaign and clears its media", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "campaign-1",
        salon_id: "salon-1",
        is_active: true,
        title: "Campanha antiga",
        message: "Mensagem antiga",
        media_kind: "image",
        image_path: "salon-1/birthdays/old.jpg",
        video_path: null,
      },
      error: null,
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_birthday_campaigns") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
            delete: vi.fn(() => ({
              eq: deleteEq,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn((bucket: string) => {
          expect(bucket).toBe("salon-posts");
          return {
            remove,
          };
        }),
      },
    });

    const result = await deleteSalonBirthdayCampaignAction(
      makeFormData({
        __actionMode: "inline",
        returnPath: "/dashboard/birthdays",
      }),
    );

    expect(deleteEq).toHaveBeenCalledWith("salon_id", "salon-1");
    expect(remove).toHaveBeenCalledWith(["salon-1/birthdays/old.jpg"]);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/birthdays");
    expect(result).toEqual({
      ok: true,
      message: "Mensagem de aniversário excluída do painel e do app.",
      tone: "success",
    });
  });
});
