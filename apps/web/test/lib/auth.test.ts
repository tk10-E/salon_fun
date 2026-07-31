import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`);
    });
  });

  it("accepts the validated user from getUser even when the session snapshot is empty", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              email: "owner@salon.fun",
            },
          },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: null,
          },
        }),
      },
    });

    const { requireUser } = await import("@/lib/auth");
    const result = await requireUser();

    expect(result.user).toMatchObject({
      id: "user-1",
      email: "owner@salon.fun",
    });
    expect(createClientMock).toHaveBeenCalled();
  });

  it("falls back to the session snapshot only when getUser fails", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-2",
            email: "fallback@salon.fun",
          },
        },
      },
    });

    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
          error: {
            message: "temporary_auth_error",
          },
        }),
        getSession,
      },
    });

    const { requireUser } = await import("@/lib/auth");
    const result = await requireUser();

    expect(getSession).toHaveBeenCalled();
    expect(result.user).toMatchObject({
      id: "user-2",
      email: "fallback@salon.fun",
    });
  });

  it("redirects to login when there is no authenticated user", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
          error: null,
        }),
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: null,
          },
        }),
      },
    });

    const { requireUser } = await import("@/lib/auth");

    await expect(requireUser()).rejects.toThrow(
      "REDIRECT:/login?message=Sess%C3%A3o+expirada.+Entre+novamente+para+continuar.&tone=info",
    );
  });

  it("grants internal ai observability access only for explicit internal metadata", async () => {
    const { hasInternalAiObservabilityAccess } = await import("@/lib/auth");

    expect(
      hasInternalAiObservabilityAccess({
        app_metadata: {
          permissions: ["ai_observability.read"],
        },
        email: "ops@salon.fun",
        user_metadata: {},
      } as never),
    ).toBe(true);

    expect(
      hasInternalAiObservabilityAccess({
        app_metadata: {
          internal_role: "internal_admin",
        },
        email: "ops@salon.fun",
        user_metadata: {},
      } as never),
    ).toBe(true);

    expect(
      hasInternalAiObservabilityAccess({
        app_metadata: {},
        email: "owner@salon.fun",
        user_metadata: {
          role: "admin",
        },
      } as never),
    ).toBe(false);
  });
});
