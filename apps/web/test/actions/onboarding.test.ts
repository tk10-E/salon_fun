import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { redirectMock, revalidatePathMock, requireUserMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireUserMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

import { createSalonActionImpl } from "@/app/_actions/onboarding";

describe("onboarding actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("creates the salon and redirects to the dashboard", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const match = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ match }));
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn(() => ({
        select,
        insert,
      })),
    };

    requireUserMock.mockResolvedValue({
      supabase,
      user: { id: "owner-1" },
    });

    const location = await captureRedirect(
      createSalonActionImpl(
        makeFormData({
          name: "Studio Centro",
        }),
      ),
      redirectMock,
    );

    expect(insert).toHaveBeenCalledWith({
      name: "Studio Centro",
      owner_user_id: "owner-1",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(location).toBe("/dashboard?message=Sal%C3%A3o+criado+com+sucesso.&tone=success");
  });

  it("sends existing owners straight to the dashboard", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "salon-1" } });
    const match = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ match }));
    const insert = vi.fn();
    const supabase = {
      from: vi.fn(() => ({
        select,
        insert,
      })),
    };

    requireUserMock.mockResolvedValue({
      supabase,
      user: { id: "owner-1" },
    });

    const location = await captureRedirect(
      createSalonActionImpl(
        makeFormData({
          name: "Studio Centro",
        }),
      ),
      redirectMock,
    );

    expect(insert).not.toHaveBeenCalled();
    expect(location).toBe("/dashboard");
  });
});
