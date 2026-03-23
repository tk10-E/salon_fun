import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { signInActionImpl, signOutActionImpl, signUpActionImpl } from "@/app/_actions/auth";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("redirects to dashboard after successful sign in", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      auth: {
        signInWithPassword,
      },
    });

    const location = await captureRedirect(
      signInActionImpl(
        makeFormData({
          email: "owner@salon.fun",
          password: "123456",
        }),
      ),
      redirectMock,
    );

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "owner@salon.fun",
      password: "123456",
    });
    expect(location).toBe("/dashboard");
  });

  it("redirects new accounts with a session to onboarding", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-1",
          },
        },
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      auth: {
        signUp,
      },
    });

    const location = await captureRedirect(
      signUpActionImpl(
        makeFormData({
          email: "new@salon.fun",
          password: "123456",
        }),
      ),
      redirectMock,
    );

    expect(signUp).toHaveBeenCalledWith({
      email: "new@salon.fun",
      password: "123456",
    });
    expect(location).toBe("/onboarding");
  });

  it("signs out and redirects back to login", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);

    createClientMock.mockReturnValue({
      auth: {
        signOut,
      },
    });

    const location = await captureRedirect(signOutActionImpl(), redirectMock);

    expect(signOut).toHaveBeenCalled();
    expect(location).toBe("/login");
  });
});
