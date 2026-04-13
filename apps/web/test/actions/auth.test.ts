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

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import {
  sendPasswordResetActionImpl,
  signInActionImpl,
  signInWithGoogleActionImpl,
  signOutActionImpl,
  signUpActionImpl,
  updatePasswordActionImpl,
} from "@/app/_actions/auth";

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockReturnValue({
      get(name: string) {
        if (name === "origin") {
          return "https://painel.jc7desenvovimento.online";
        }

        return null;
      },
    });
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
          password: "SenhaForte123!",
          passwordConfirmation: "SenhaForte123!",
        }),
      ),
      redirectMock,
    );

    expect(signUp).toHaveBeenCalledWith({
      email: "new@salon.fun",
      password: "SenhaForte123!",
      options: {
        emailRedirectTo: "https://painel.jc7desenvovimento.online/login",
      },
    });
    expect(location).toBe("/onboarding");
  });

  it("rejects sign up when password confirmation does not match", async () => {
    createClientMock.mockReturnValue({
      auth: {
        signUp: vi.fn(),
      },
    });

    const location = await captureRedirect(
      signUpActionImpl(
        makeFormData({
          email: "new@salon.fun",
          password: "123456",
          passwordConfirmation: "654321",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/login?message=Confirme+a+mesma+senha+nos+dois+campos+para+criar+a+conta.&tone=error",
    );
  });

  it("starts the Google OAuth flow with the panel callback", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: {
        url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=test",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      auth: {
        signInWithOAuth,
      },
    });

    const location = await captureRedirect(
      signInWithGoogleActionImpl(
        makeFormData({
          next: "/dashboard",
        }),
      ),
      redirectMock,
    );

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://painel.jc7desenvovimento.online/auth/callback?next=%2Fdashboard",
        scopes: "https://www.googleapis.com/auth/userinfo.email",
      },
    });
    expect(location).toBe("https://accounts.google.com/o/oauth2/v2/auth?client_id=test");
  });

  it("sends a password reset email with the recovery redirect", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({
      data: {},
      error: null,
    });

    createClientMock.mockReturnValue({
      auth: {
        resetPasswordForEmail,
      },
    });

    const location = await captureRedirect(
      sendPasswordResetActionImpl(
        makeFormData({
          email: "owner@salon.fun",
        }),
      ),
      redirectMock,
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith("owner@salon.fun", {
      redirectTo: "https://painel.jc7desenvovimento.online/auth/recovery",
    });
    expect(location).toBe(
      "/login?message=Enviamos+um+link+de+recupera%C3%A7%C3%A3o+para+seu+e-mail.+Abra+a+mensagem+mais+recente+para+redefinir+a+senha.&tone=success",
    );
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

  it("updates the password and redirects back to login with a success notice", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      auth: {
        updateUser,
      },
    });

    const location = await captureRedirect(
      updatePasswordActionImpl(
        makeFormData({
          password: "SenhaForte123!",
          passwordConfirmation: "SenhaForte123!",
        }),
      ),
      redirectMock,
    );

    expect(updateUser).toHaveBeenCalledWith({
      password: "SenhaForte123!",
    });
    expect(location).toBe(
      "/login?message=Senha+atualizada+com+sucesso.+Entre+com+sua+nova+senha.&tone=success",
    );
  });
});
