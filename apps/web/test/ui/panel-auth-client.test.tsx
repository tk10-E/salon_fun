// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeFirebaseRedirectLoginIfNeededMock,
  createClientMock,
  fetchMock,
  prefetchMock,
  replaceMock,
  resetPasswordForEmailMock,
  restorePanelSessionFromFirebaseIfNeededMock,
  setRuntimeFirebaseWebConfigMock,
  signInWithFirebaseGoogleMock,
  signInWithFirebasePasswordMock,
  signOutPanelFirebaseSessionMock,
  signInWithOAuthMock,
  signInWithPasswordMock,
  signUpWithFirebasePasswordMock,
  signUpMock,
} = vi.hoisted(() => ({
  completeFirebaseRedirectLoginIfNeededMock: vi.fn(),
  createClientMock: vi.fn(),
  fetchMock: vi.fn(),
  prefetchMock: vi.fn(),
  replaceMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  restorePanelSessionFromFirebaseIfNeededMock: vi.fn(),
  setRuntimeFirebaseWebConfigMock: vi.fn(),
  signInWithFirebaseGoogleMock: vi.fn(),
  signInWithFirebasePasswordMock: vi.fn(),
  signOutPanelFirebaseSessionMock: vi.fn(),
  signInWithOAuthMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpWithFirebasePasswordMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock("@/components/FlashMessage", () => ({
  FlashMessage: (props: { message: string }) => <div>{props.message}</div>,
}));

vi.mock("@/lib/firebase/panelAuth", () => ({
  completeFirebaseRedirectLoginIfNeeded:
    completeFirebaseRedirectLoginIfNeededMock,
  restorePanelSessionFromFirebaseIfNeeded:
    restorePanelSessionFromFirebaseIfNeededMock,
  sendFirebasePasswordResetEmail: vi.fn(),
  signInWithFirebaseGoogle: signInWithFirebaseGoogleMock,
  signInWithFirebasePassword: signInWithFirebasePasswordMock,
  signOutPanelFirebaseSession: signOutPanelFirebaseSessionMock,
  signUpWithFirebasePassword: signUpWithFirebasePasswordMock,
}));

vi.mock("@/lib/firebase/runtimeConfig", () => ({
  setRuntimeFirebaseWebConfig: setRuntimeFirebaseWebConfigMock,
}));

vi.mock("@/lib/passwordPolicy", () => ({
  validatePasswordStrength: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: createClientMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    prefetch: prefetchMock,
    replace: replaceMock,
  }),
}));

import { PanelAuthClient } from "@/components/auth/PanelAuthClient";

function createSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signInWithOAuth: signInWithOAuthMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      mfa: {
        getAuthenticatorAssuranceLevel: vi
          .fn()
          .mockResolvedValue({ data: { currentLevel: "aal1" } }),
        listFactors: vi.fn().mockResolvedValue({ data: { all: [] } }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  };
}

describe("panel auth client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.NEXT_PUBLIC_ENABLE_SUPABASE_GOOGLE_FALLBACK;
    completeFirebaseRedirectLoginIfNeededMock.mockResolvedValue(false);
    restorePanelSessionFromFirebaseIfNeededMock.mockResolvedValue(false);
    signOutPanelFirebaseSessionMock.mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({
      status: 204,
    });
    prefetchMock.mockReset();
    replaceMock.mockReset();
    createClientMock.mockImplementation(() => createSupabaseClient());
    signInWithPasswordMock.mockResolvedValue({
      data: {
        session: { user: { id: "user-1" } },
        user: { id: "user-1" },
      },
      error: null,
    });
  });

  it("does not force the MFA step when the salon policy is enabled but no verified factor exists", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "user-1",
                email: "owner@salon.fun",
              },
            },
          },
        }),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        mfa: {
          getAuthenticatorAssuranceLevel: vi
            .fn()
            .mockResolvedValue({ data: { currentLevel: "aal1" } }),
          listFactors: vi.fn().mockResolvedValue({
            data: {
              all: [
                {
                  id: "factor-1",
                  factor_type: "totp",
                  status: "unverified",
                  friendly_name: "Painel do salão",
                },
              ],
            },
          }),
        },
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                table === "salons"
                  ? {
                      id: "salon-1",
                      salon_security_settings: {
                        mfa_totp_enabled: true,
                      },
                    }
                  : null,
              error: null,
            }),
          })),
        })),
      })),
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.queryByText("Confirmar acesso")).not.toBeInTheDocument();
  });

  it("waits for the authenticated session before redirecting to dashboard", async () => {
    const user = userEvent.setup();
    let authStateChangeHandler:
      | ((event: string, session: { user: { email?: string | null; id: string } } | null) => void)
      | null = null;

    signInWithFirebasePasswordMock.mockResolvedValue(undefined);
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn((callback) => {
          authStateChangeHandler = callback;

          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          };
        }),
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        mfa: {
          getAuthenticatorAssuranceLevel: vi
            .fn()
            .mockResolvedValue({ data: { currentLevel: "aal1" } }),
          listFactors: vi.fn().mockResolvedValue({ data: { all: [] } }),
        },
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                table === "salons"
                  ? {
                      id: "salon-1",
                      salon_security_settings: {
                        mfa_totp_enabled: false,
                      },
                    }
                  : null,
              error: null,
            }),
          })),
        })),
      })),
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signin-email" }),
      "tecnologijc@gmail.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signin-password" }),
      "Senha123!",
    );
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(signInWithFirebasePasswordMock).toHaveBeenCalled();
    });
    expect(replaceMock).not.toHaveBeenCalled();
    expect(authStateChangeHandler).not.toBeNull();

    await act(async () => {
      authStateChangeHandler?.("SIGNED_IN", {
        user: {
          id: "user-1",
          email: "owner@salon.fun",
        },
      });
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("waits for the server session confirmation before redirecting to the panel", async () => {
    const user = userEvent.setup();
    let serverChecks = 0;
    signInWithFirebasePasswordMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "owner@salon.fun",
      },
    });
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        mfa: {
          getAuthenticatorAssuranceLevel: vi
            .fn()
            .mockResolvedValue({ data: { currentLevel: "aal1" } }),
          listFactors: vi.fn().mockResolvedValue({ data: { all: [] } }),
        },
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                table === "salons"
                  ? {
                      id: "salon-1",
                      salon_security_settings: {
                        mfa_totp_enabled: false,
                      },
                    }
                  : null,
              error: null,
            }),
          })),
        })),
      })),
    });
    fetchMock.mockImplementation(async () => {
      serverChecks += 1;

      return {
        status: serverChecks === 1 ? 401 : 204,
      };
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signin-email" }),
      "tecnologijc@gmail.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signin-password" }),
      "Senha123!",
    );
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(
      () => {
        expect(replaceMock).toHaveBeenCalledWith("/dashboard");
      },
      {
        timeout: 4000,
      },
    );
    expect(serverChecks).toBeGreaterThanOrEqual(2);
  });

  it("uses the session returned by the Firebase bridge without waiting for an auth event", async () => {
    const user = userEvent.setup();
    signInWithFirebasePasswordMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "owner@salon.fun",
      },
    });
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
        signInWithOAuth: signInWithOAuthMock,
        signInWithPassword: signInWithPasswordMock,
        signUp: signUpMock,
        resetPasswordForEmail: resetPasswordForEmailMock,
        mfa: {
          getAuthenticatorAssuranceLevel: vi
            .fn()
            .mockResolvedValue({ data: { currentLevel: "aal1" } }),
          listFactors: vi.fn().mockResolvedValue({ data: { all: [] } }),
        },
      },
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data:
                table === "salons"
                  ? {
                      id: "salon-1",
                      salon_security_settings: {
                        mfa_totp_enabled: false,
                      },
                    }
                  : null,
              error: null,
            }),
          })),
        })),
      })),
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signin-email" }),
      "tecnologijc@gmail.com",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signin-password" }),
      "Senha123!",
    );
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("uses Firebase for Google instead of the Supabase OAuth client when Firebase is enabled", async () => {
    const user = userEvent.setup();
    signInWithFirebaseGoogleMock.mockResolvedValue(undefined);

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /continuar com google/i }),
    );

    await waitFor(() => {
      expect(signInWithFirebaseGoogleMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
  });

  it("falls back to Supabase password login when Firebase auth is unavailable", async () => {
    const user = userEvent.setup();
    signInWithFirebasePasswordMock.mockRejectedValue(
      new Error(
        "A configuração do Firebase Web do painel precisa ser atualizada no deploy.",
      ),
    );

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signin-email" }),
      "OWNER@SALON.FUN",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signin-password" }),
      "Senha123!",
    );
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(signInWithFirebasePasswordMock).toHaveBeenCalledWith({
        email: "OWNER@SALON.FUN",
        password: "Senha123!",
      });
    });

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "owner@salon.fun",
      password: "Senha123!",
    });
    expect(signOutPanelFirebaseSessionMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("falls back to Supabase password login when Firebase cannot sync the session", async () => {
    const user = userEvent.setup();
    signInWithFirebasePasswordMock.mockRejectedValue(
      new Error(
        "A configuração atual do painel não conseguiu validar sua conta do Firebase.",
      ),
    );

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signin-email" }),
      "OWNER@SALON.FUN",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signin-password" }),
      "Senha123!",
    );
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "owner@salon.fun",
        password: "Senha123!",
      });
    });

    expect(signOutPanelFirebaseSessionMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/onboarding");
    });
  });

  it("shows the Firebase recovery error when Supabase Google fallback is disabled", async () => {
    completeFirebaseRedirectLoginIfNeededMock.mockRejectedValue(
      new Error(
        "A configuração atual do painel não conseguiu validar sua conta do Firebase.",
      ),
    );
    signInWithOAuthMock.mockResolvedValue({
      data: {
        url: null,
      },
      error: {
        message: "oauth_failed",
      },
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "A configuração atual do painel não conseguiu validar sua conta do Firebase.",
        ),
      ).toBeInTheDocument();
    });
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    expect(signOutPanelFirebaseSessionMock).not.toHaveBeenCalled();
  });

  it("falls back to Supabase Google when explicitly enabled and Firebase cannot start the social flow", async () => {
    const user = userEvent.setup();
    process.env.NEXT_PUBLIC_ENABLE_SUPABASE_GOOGLE_FALLBACK = "true";

    signInWithFirebaseGoogleMock.mockRejectedValue(
      new Error(
        "A configuração atual do painel não conseguiu validar sua conta do Firebase.",
      ),
    );
    signInWithOAuthMock.mockResolvedValue({
      data: {
        url: null,
      },
      error: {
        message: "oauth_failed",
      },
    });

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /continuar com google/i }),
    );
    await waitFor(() => {
      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: "google",
        options: expect.objectContaining({
          scopes: "https://www.googleapis.com/auth/userinfo.email",
        }),
      });
    });
    expect(signOutPanelFirebaseSessionMock).toHaveBeenCalledTimes(1);
  });

  it("shows the explicit existing-account message when sign up hits an email that is already registered", async () => {
    const user = userEvent.setup();
    signUpWithFirebasePasswordMock.mockRejectedValue(
      new Error(
        "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.",
      ),
    );

    render(
      <PanelAuthClient
        firebaseConfig={{
          apiKey: "test-key",
          authDomain: "panel.example.com",
          appId: "app-1",
          messagingSenderId: "sender-1",
          projectId: "project-1",
        }}
      />,
    );

    await user.type(
      screen.getByLabelText("E-mail", { selector: "#signup-email" }),
      "owner@salon.fun",
    );
    await user.type(
      screen.getByLabelText("Senha", { selector: "#signup-password" }),
      "Senha123!",
    );
    await user.type(
      screen.getByLabelText("Confirmar senha", {
        selector: "#signup-password-confirmation",
      }),
      "Senha123!",
    );
    await user.click(
      screen.getByRole("button", { name: /criar conta com e-mail/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.",
        ),
      ).toBeInTheDocument();
    });
  });
});
