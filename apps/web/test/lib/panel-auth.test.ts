import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createUserWithEmailAndPasswordMock,
  createClientMock,
  fetchMock,
  getFirebasePanelAuthMock,
  getReadyFirebasePanelAuthMock,
  signInWithPopupMock,
  signInWithRedirectMock,
  sendEmailVerificationMock,
  signInWithEmailAndPasswordMock,
  signOutMock,
} = vi.hoisted(() => ({
  createUserWithEmailAndPasswordMock: vi.fn(),
  createClientMock: vi.fn(),
  fetchMock: vi.fn(),
  getFirebasePanelAuthMock: vi.fn(),
  getReadyFirebasePanelAuthMock: vi.fn(),
  signInWithPopupMock: vi.fn(),
  signInWithRedirectMock: vi.fn(),
  sendEmailVerificationMock: vi.fn(),
  signInWithEmailAndPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class GoogleAuthProvider {
    setCustomParameters() {
      return undefined;
    }
  },
  getRedirectResult: vi.fn(),
  createUserWithEmailAndPassword: createUserWithEmailAndPasswordMock,
  sendEmailVerification: sendEmailVerificationMock,
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: signInWithEmailAndPasswordMock,
  signInWithPopup: signInWithPopupMock,
  signInWithRedirect: signInWithRedirectMock,
  signOut: signOutMock,
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebasePanelAuth: getFirebasePanelAuthMock,
  getReadyFirebasePanelAuth: getReadyFirebasePanelAuthMock,
}));

vi.mock("@/lib/firebase/runtimeConfig", () => ({
  getRuntimeFirebaseWebConfig: () => ({
    apiKey: "test-key",
  }),
}));

vi.mock("@/lib/env", () => ({
  supabaseAnonKey: "test-anon-key",
  supabaseUrl: "https://project-ref.supabase.co",
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/passwordPolicy", () => ({
  validatePasswordStrength: vi.fn().mockReturnValue(null),
}));

describe("panel auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        email: "owner@salon.fun",
        supabase_password: "bridge-password",
      }),
    });

    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: null,
          },
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "session-token",
            },
            user: {
              email: "owner@salon.fun",
              id: "user-1",
            },
          },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    signOutMock.mockResolvedValue(undefined);
    sendEmailVerificationMock.mockResolvedValue(undefined);
  });

  it("does not reload the firebase user when the email is already verified", async () => {
    const firebaseUser = {
      email: "owner@salon.fun",
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue("firebase-token"),
      reload: vi.fn().mockResolvedValue(undefined),
    };
    const auth = {
      currentUser: firebaseUser,
    };

    getReadyFirebasePanelAuthMock.mockResolvedValue(auth);
    getFirebasePanelAuthMock.mockReturnValue(auth);
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: firebaseUser,
    });

    const { signInWithFirebasePassword } = await import(
      "@/lib/firebase/panelAuth"
    );

    const session = await signInWithFirebasePassword({
      email: "owner@salon.fun",
      password: "Senha123!",
    });

    expect(firebaseUser.reload).not.toHaveBeenCalled();
    expect(firebaseUser.getIdToken).toHaveBeenCalledWith(false);
    expect(session).toEqual({
      user: {
        email: "owner@salon.fun",
        id: "user-1",
      },
    });
  });

  it("uses the Google popup flow and bridges the session immediately when popup login succeeds", async () => {
    const firebaseUser = {
      email: "owner@salon.fun",
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue("firebase-token"),
      reload: vi.fn().mockResolvedValue(undefined),
    };
    const auth = {
      currentUser: firebaseUser,
    };

    getReadyFirebasePanelAuthMock.mockResolvedValue(auth);
    getFirebasePanelAuthMock.mockReturnValue(auth);
    signInWithPopupMock.mockResolvedValue({
      user: firebaseUser,
    });

    const { signInWithFirebaseGoogle } = await import(
      "@/lib/firebase/panelAuth"
    );

    const session = await signInWithFirebaseGoogle();

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(signInWithRedirectMock).not.toHaveBeenCalled();
    expect(firebaseUser.getIdToken).toHaveBeenCalledWith(false);
    expect(session).toEqual({
      user: {
        email: "owner@salon.fun",
        id: "user-1",
      },
    });
  });

  it("falls back to the Google redirect flow when the browser blocks the popup", async () => {
    const auth = {
      currentUser: null,
    };

    getReadyFirebasePanelAuthMock.mockResolvedValue(auth);
    signInWithPopupMock.mockRejectedValue({
      code: "auth/popup-blocked",
      message: "Popup blocked",
    });
    signInWithRedirectMock.mockResolvedValue(undefined);

    const { signInWithFirebaseGoogle } = await import(
      "@/lib/firebase/panelAuth"
    );

    const session = await signInWithFirebaseGoogle();

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(signInWithRedirectMock).toHaveBeenCalledTimes(1);
    expect(session).toBeNull();
  });

  it("explains that the account already exists when Firebase rejects sign up with a verified email", async () => {
    const firebaseUser = {
      email: "owner@salon.fun",
      emailVerified: true,
    };
    const auth = {
      currentUser: null,
    };

    getReadyFirebasePanelAuthMock.mockResolvedValue(auth);
    createUserWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/email-already-in-use",
      message: "email already in use",
    });
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: firebaseUser,
    });

    const { signUpWithFirebasePassword } = await import(
      "@/lib/firebase/panelAuth"
    );

    await expect(
      signUpWithFirebasePassword({
        email: "OWNER@SALON.FUN",
        password: "Senha123!",
        passwordConfirmation: "Senha123!",
      }),
    ).rejects.toThrow(
      "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.",
    );

    expect(signInWithEmailAndPasswordMock).toHaveBeenCalledWith(
      auth,
      "owner@salon.fun",
      "Senha123!",
    );
    expect(signOutMock).toHaveBeenCalled();
  });

  it("re-sends the verification guidance when the account exists but the email is still pending", async () => {
    const firebaseUser = {
      email: "owner@salon.fun",
      emailVerified: false,
    };
    const auth = {
      currentUser: null,
    };

    getReadyFirebasePanelAuthMock.mockResolvedValue(auth);
    createUserWithEmailAndPasswordMock.mockRejectedValue({
      code: "auth/email-already-in-use",
      message: "email already in use",
    });
    signInWithEmailAndPasswordMock.mockResolvedValue({
      user: firebaseUser,
    });

    const { signUpWithFirebasePassword } = await import(
      "@/lib/firebase/panelAuth"
    );

    await expect(
      signUpWithFirebasePassword({
        email: "OWNER@SALON.FUN",
        password: "Senha123!",
        passwordConfirmation: "Senha123!",
      }),
    ).rejects.toThrow(
      "Esta conta já foi criada para owner@salon.fun. Reenviamos a confirmação por e-mail. Confirme o e-mail antes de entrar no painel.",
    );

    expect(sendEmailVerificationMock).toHaveBeenCalledWith(firebaseUser);
    expect(signOutMock).toHaveBeenCalled();
  });
});
