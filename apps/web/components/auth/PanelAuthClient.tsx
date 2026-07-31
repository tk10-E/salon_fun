"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { FlashMessage } from "@/components/FlashMessage";
import {
  completeFirebaseRedirectLoginIfNeeded,
  restorePanelSessionFromFirebaseIfNeeded,
  sendFirebasePasswordResetEmail,
  signInWithFirebaseGoogle,
  signInWithFirebasePassword,
  signOutPanelFirebaseSession,
  signUpWithFirebasePassword,
} from "@/lib/firebase/panelAuth";
import { validatePasswordStrength } from "@/lib/passwordPolicy";
import { setRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FirebaseWebConfig } from "@/lib/firebase/config";

type PanelAuthClientProps = {
  emailConfirmationPath?: string;
  initialMessage?: string;
  initialTone?: string;
  firebaseConfig: FirebaseWebConfig | null;
  mode?: "sign-in" | "sign-up";
  onboardingPath?: string;
};

type Notice = {
  message: string;
  tone: "success" | "error" | "info";
};
type TotpFactor = {
  friendlyName: string | null;
  id: string;
  status: string | null;
};
type PendingEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};
type SocialProvider = "google";

const emptyFormState = {
  signInEmail: "",
  signInPassword: "",
  resetEmail: "",
  signUpEmail: "",
  signUpPassword: "",
  signUpPasswordConfirmation: "",
};
const PANEL_SESSION_READY_ENDPOINT = "/api/internal/session/ping";
const SESSION_SYNC_TIMEOUT_MS = 6000;
const SESSION_VISIBILITY_POLL_INTERVAL_MS = 250;

type SessionSnapshot = {
  user: {
    email?: string | null;
    id: string;
  } | null;
};

function normalizeNotice(message?: string, tone?: string): Notice | null {
  if (!message || message.trim().length === 0) {
    return null;
  }

  if (tone === "success" || tone === "error" || tone === "info") {
    return { message, tone };
  }

  return { message, tone: "info" };
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallbackMessage;
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function buildSessionSyncErrorNotice(): Notice {
  return {
    message:
      "O login foi confirmado, mas a sessão segura do painel não ficou pronta a tempo. Tente entrar novamente.",
    tone: "error",
  };
}

function waitForDelay(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function waitForPanelServerSession(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(PANEL_SESSION_READY_ENDPOINT, {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "x-panel-session-ready": "1",
      },
    }).catch(() => null);

    if (response?.status === 204) {
      return true;
    }

    await waitForDelay(
      Math.min(
        SESSION_VISIBILITY_POLL_INTERVAL_MS,
        Math.max(1, deadline - Date.now()),
      ),
    );
  }

  return false;
}

const supabaseEmailFlowFallbackMessages = new Set([
  "A configuração do Firebase Web do painel precisa ser atualizada no deploy.",
  "O Firebase Web do painel está com chave inválida. Atualize a configuração do deploy.",
  "O domínio do painel ainda não foi autorizado no Firebase. Atualize a configuração do projeto.",
  "O método de autenticação ainda não foi liberado no Firebase.",
]);
const firebaseBridgeFallbackMessages = new Set([
  "A bridge de autenticação ainda não foi configurada no Supabase.",
  "A origem do painel ainda não foi autorizada na bridge de autenticação.",
  "A configuração atual do painel não conseguiu validar sua conta do Firebase.",
  "O Firebase autenticou a conta, mas o painel não conseguiu sincronizar a sessão com o Supabase.",
  "Não foi possível preparar sua conta no Supabase.",
  "Não foi possível sincronizar o login com o Supabase.",
  "A bridge respondeu sem credenciais válidas do Supabase.",
]);

function shouldFallbackToSupabaseEmailSignIn(message: string) {
  return (
    message === "E-mail ou senha inválidos." ||
    supabaseEmailFlowFallbackMessages.has(message) ||
    firebaseBridgeFallbackMessages.has(message)
  );
}

function shouldFallbackToSupabaseEmailSignUp(message: string) {
  return supabaseEmailFlowFallbackMessages.has(message);
}

function shouldFallbackToSupabasePasswordReset(message: string) {
  return supabaseEmailFlowFallbackMessages.has(message);
}

function isSupabaseGoogleFallbackEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_SUPABASE_GOOGLE_FALLBACK === "true";
}

function shouldFallbackToSupabaseGoogleSignIn(message: string) {
  if (!isSupabaseGoogleFallbackEnabled()) {
    return false;
  }

  return (
    supabaseEmailFlowFallbackMessages.has(message) ||
    firebaseBridgeFallbackMessages.has(message)
  );
}

async function clearFirebaseSessionForFallback() {
  await signOutPanelFirebaseSession().catch(() => undefined);
}

function buildBrowserUrl(pathname: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}${pathname}`;
}

function mapTotpFactors(rawFactors: unknown) {
  if (!Array.isArray(rawFactors)) {
    return [] as TotpFactor[];
  }

  return rawFactors
    .filter(
      (factor) =>
        factor &&
        typeof factor === "object" &&
        "factor_type" in factor &&
        (factor as { factor_type?: unknown }).factor_type === "totp",
    )
    .map((factor) => {
      const value = factor as Record<string, unknown>;

      return {
        friendlyName:
          typeof value.friendly_name === "string" && value.friendly_name.trim()
            ? value.friendly_name.trim()
            : null,
        id: String(value.id ?? ""),
        status: typeof value.status === "string" ? value.status : null,
      } satisfies TotpFactor;
    })
    .filter((factor) => factor.id.length > 0);
}

async function getOwnerMfaRequirement(userId: string) {
  const supabase = createSupabaseBrowserClient() as any;
  const salonResult = await supabase
    .from("salons")
    .select("id, salon_security_settings(mfa_totp_enabled)")
    .eq("owner_user_id", userId)
    .maybeSingle();

  if (salonResult.error || !salonResult.data?.id) {
    return {
      hasSalon: false,
      mfaTotpEnabled: false,
    };
  }

  const rawPolicy = Array.isArray(salonResult.data.salon_security_settings)
    ? salonResult.data.salon_security_settings[0]
    : salonResult.data.salon_security_settings;

  return {
    hasSalon: true,
    mfaTotpEnabled:
      rawPolicy != null &&
      typeof rawPolicy === "object" &&
      "mfa_totp_enabled" in rawPolicy &&
      rawPolicy.mfa_totp_enabled === true,
  };
}

function formatSupabaseAuthError(error: unknown, fallbackMessage: string) {
  const code =
    typeof error === "object" && error != null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    typeof error === "object" && error != null && "message" in error
      ? String((error as { message?: unknown }).message ?? "").trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha inválidos.";
    case "email_not_confirmed":
      return "Confirme o e-mail antes de entrar no painel.";
    case "email_exists":
    case "user_already_exists":
      return "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.";
    case "over_email_send_rate_limit":
      return "Muitos pedidos foram feitos em sequência. Aguarde alguns minutos e tente de novo.";
    default:
      if (
        normalizedMessage.includes("invalid login credentials") ||
        normalizedMessage.includes("email not confirmed")
      ) {
        return "E-mail ou senha inválidos.";
      }

      return message.length > 0 ? message : fallbackMessage;
  }
}

async function signInWithSupabasePassword(input: {
  email: string;
  password: string;
}): Promise<SessionSnapshot> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmailAddress(input.email),
    password: input.password,
  });

  if (error || data.user == null || data.session == null) {
    throw new Error(
      formatSupabaseAuthError(error, "Não foi possível entrar agora."),
    );
  }

  return {
    user: {
      email: data.user.email ?? null,
      id: data.user.id,
    },
  };
}

async function signUpWithSupabasePassword(input: {
  email: string;
  emailRedirectPath?: string;
  password: string;
  passwordConfirmation: string;
}) {
  if (input.password !== input.passwordConfirmation) {
    throw new Error("Confirme a mesma senha nos dois campos.");
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const supabase = createSupabaseBrowserClient();
  const email = normalizeEmailAddress(input.email);
  const emailRedirectTo = buildBrowserUrl(input.emailRedirectPath ?? "/login");
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: emailRedirectTo
      ? {
          emailRedirectTo,
        }
      : undefined,
  });

  if (error) {
    throw new Error(
      formatSupabaseAuthError(error, "Não foi possível criar a conta."),
    );
  }

  return {
    email,
    requiresEmailConfirmation: data.session == null,
  };
}

async function sendSupabasePasswordResetEmail(email: string) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = buildBrowserUrl("/auth/recovery");
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmailAddress(email),
    redirectTo
      ? {
          redirectTo,
        }
      : undefined,
  );

  if (error) {
    throw new Error(
      formatSupabaseAuthError(
        error,
        "Não foi possível enviar o e-mail de recuperação agora.",
      ),
    );
  }
}

function getSocialProviderLabel(provider: SocialProvider) {
  return "Google";
}

async function signInWithSupabaseSocialProvider(provider: SocialProvider) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = buildBrowserUrl("/auth/callback?next=/dashboard");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      ...(provider === "google"
        ? {
            scopes: "https://www.googleapis.com/auth/userinfo.email",
          }
        : {}),
    },
  });

  if (error || !data?.url) {
    throw new Error(
      `Não foi possível iniciar o login com ${getSocialProviderLabel(provider)}.`,
    );
  }

  window.location.assign(data.url);
}

export function PanelAuthClient({
  emailConfirmationPath = "/login",
  initialMessage,
  initialTone,
  firebaseConfig,
  mode = "sign-in",
  onboardingPath = "/onboarding",
}: PanelAuthClientProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(() =>
    normalizeNotice(initialMessage, initialTone),
  );
  const [loadingIntent, setLoadingIntent] = useState<string | null>(null);
  const [formState, setFormState] = useState(emptyFormState);
  const [authStage, setAuthStage] = useState<"forms" | "mfa">("forms");
  const [mfaFactors, setMfaFactors] = useState<TotpFactor[]>([]);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaPendingEnrollment, setMfaPendingEnrollment] =
    useState<PendingEnrollment | null>(null);
  const [mfaSessionEmail, setMfaSessionEmail] = useState<string | null>(null);
  const sessionSyncPromiseRef = useRef<{
    hasSession: boolean;
    promise: Promise<boolean>;
  } | null>(null);
  const isSignUpMode = mode === "sign-up";
  const firebaseEnabled = firebaseConfig != null;
  const verifiedMfaFactors = mfaFactors.filter(
    (factor) => factor.status === "verified",
  );
  const socialButtonMetaLabel =
    loadingIntent === "google"
      ? "Abrindo..."
      : isSignUpMode
        ? "Criar conta ou continuar"
        : "Entrar ou criar";
  const primaryCardEyebrow = isSignUpMode ? "Ativação" : "Acesso";
  const primaryCardTitle = isSignUpMode
    ? "Criar conta do salão"
    : "Entrar no painel";
  const primaryCardDescription = isSignUpMode
    ? "Use Google ou o e-mail principal para começar a ativação."
    : "Use Google ou o e-mail principal do salão.";
  const inlineSecurityNote = isSignUpMode
    ? "Depois do cadastro, a confirmação extra aparece só se o salão exigir autenticador."
    : "Se esta conta usar autenticador, o código aparece só no próximo passo.";
  const signUpHint = isSignUpMode
    ? "Depois de confirmar o e-mail, você volta para concluir a ativação do salão."
    : "Depois de confirmar o e-mail, você segue para o onboarding do salão.";
  const utilityCardTitle = isSignUpMode ? "Já tem conta ou perdeu a senha?" : "Outras opções";
  const utilityCardDescription = isSignUpMode
    ? "Abra só se precisar entrar com uma conta existente ou recuperar o acesso."
    : "Abra só se precisar recuperar a senha ou criar o primeiro acesso.";

  function openPanelWorkspace(pathname = "/dashboard") {
    router.replace(pathname);
  }

  async function resolveSessionSnapshot(args?: {
    session?: SessionSnapshot | null;
    waitForSessionMs?: number;
  }) {
    if (args?.session?.user) {
      return args.session;
    }

    const supabase = createSupabaseBrowserClient();
    const readSession = async () => {
      const {
        data: { session },
      } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));
      return session as SessionSnapshot | null;
    };

    const initialSession = await readSession();
    if (initialSession?.user || !args?.waitForSessionMs) {
      return initialSession;
    }

    const deadline = Date.now() + args.waitForSessionMs;

    while (Date.now() < deadline) {
      await waitForDelay(
        Math.min(
          SESSION_VISIBILITY_POLL_INTERVAL_MS,
          Math.max(1, deadline - Date.now()),
        ),
      );

      const nextSession = await readSession();
      if (nextSession?.user) {
        return nextSession;
      }
    }

    return null;
  }

  async function performSessionSync(args?: {
    session?: SessionSnapshot | null;
    waitForSessionMs?: number;
  }) {
    const supabase = createSupabaseBrowserClient();
    const session = await resolveSessionSnapshot(args);
    const serverSessionTimeoutMs =
      args?.waitForSessionMs ?? SESSION_SYNC_TIMEOUT_MS;

    if (!session?.user) {
      setAuthStage("forms");
      setMfaFactors([]);
      setMfaPendingEnrollment(null);
      setMfaSessionEmail(null);
      return false;
    }

    setMfaSessionEmail(session.user.email ?? null);
    const serverSessionReadyPromise =
      waitForPanelServerSession(serverSessionTimeoutMs);

    try {
      let nextWorkspacePath = "/dashboard";
      const [{ data: aalData }, { data: factorData }, mfaRequirement] =
        await withTimeout(
          Promise.all([
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            supabase.auth.mfa.listFactors(),
            getOwnerMfaRequirement(session.user.id),
          ]),
          SESSION_SYNC_TIMEOUT_MS,
          "session_sync_timeout",
        );

      const totpFactors = mapTotpFactors(factorData?.all);
      const hasVerifiedMfaFactor = totpFactors.some(
        (factor) => factor.status === "verified",
      );
      setMfaFactors(totpFactors);

      if (
        mfaRequirement.mfaTotpEnabled &&
        hasVerifiedMfaFactor &&
        aalData?.currentLevel !== "aal2"
      ) {
        setAuthStage("mfa");
        return true;
      }

      nextWorkspacePath = mfaRequirement.hasSalon
        ? "/dashboard"
        : onboardingPath;
      setAuthStage("forms");
      if (!(await serverSessionReadyPromise)) {
        return false;
      }

      openPanelWorkspace(nextWorkspacePath);
      return true;
    } catch {
      setAuthStage("forms");
      if (!(await serverSessionReadyPromise)) {
        return false;
      }

      openPanelWorkspace("/dashboard");
      return true;
    }
  }

  async function syncAuthenticatedSession(args?: {
    session?: SessionSnapshot | null;
    waitForSessionMs?: number;
  }) {
    const hasSession = Boolean(args?.session?.user);
    const currentSync = sessionSyncPromiseRef.current;

    if (currentSync && (currentSync.hasSession || !hasSession)) {
      return await currentSync.promise;
    }

    const syncPromise = performSessionSync(args).finally(() => {
      if (sessionSyncPromiseRef.current?.promise === syncPromise) {
        sessionSyncPromiseRef.current = null;
      }
    });

    sessionSyncPromiseRef.current = {
      hasSession,
      promise: syncPromise,
    };
    return await syncPromise;
  }

  useEffect(() => {
    setRuntimeFirebaseWebConfig(firebaseConfig);
  }, [firebaseConfig]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function recoverExistingPanelSession() {
      const {
        data: { session },
      } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));

      if (cancelled) {
        return;
      }

      if (session?.user) {
        const handled = await syncAuthenticatedSession({ session });
        if (handled || cancelled) {
          return;
        }
        return;
      }

      if (!firebaseEnabled) {
        return;
      }

      try {
        const restoredFromRedirect =
          await completeFirebaseRedirectLoginIfNeeded();
        if (!cancelled && restoredFromRedirect) {
          const synced = await syncAuthenticatedSession({
            session: restoredFromRedirect,
            waitForSessionMs: SESSION_SYNC_TIMEOUT_MS,
          });
          if (!synced && !cancelled) {
            setNotice(buildSessionSyncErrorNotice());
          }
          return;
        }

        const restored = await restorePanelSessionFromFirebaseIfNeeded();
        if (!cancelled && restored) {
          const synced = await syncAuthenticatedSession({
            session: restored,
            waitForSessionMs: SESSION_SYNC_TIMEOUT_MS,
          });
          if (!synced && !cancelled) {
            setNotice(buildSessionSyncErrorNotice());
          }
        }
      } catch (error) {
        const message = getErrorMessage(
          error,
          "Não foi possível concluir o login com Google agora.",
        );

        if (shouldFallbackToSupabaseGoogleSignIn(message)) {
          try {
            await clearFirebaseSessionForFallback();
            await signInWithSupabaseSocialProvider("google");
            return;
          } catch (fallbackError) {
            if (!cancelled) {
              setNotice({
                message: getErrorMessage(
                  fallbackError,
                  "Não foi possível iniciar o login com Google agora.",
                ),
                tone: "error",
              });
            }

            return;
          }
        }

        if (!cancelled) {
          setNotice({
            message,
            tone: "error",
          });
        }
      }
    }

    void recoverExistingPanelSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (!cancelled && session?.user) {
        void syncAuthenticatedSession({
          session: session as SessionSnapshot,
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // This bootstrap flow only needs to restart when Firebase availability changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseEnabled]);

  function updateField(name: keyof typeof emptyFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("sign-in");
    setNotice(null);

    try {
      let sessionSnapshot: SessionSnapshot | null = null;

      if (firebaseEnabled) {
        try {
          sessionSnapshot = await signInWithFirebasePassword({
            email: formState.signInEmail,
            password: formState.signInPassword,
          });
        } catch (firebaseError) {
          const message = getErrorMessage(
            firebaseError,
            "Não foi possível entrar agora.",
          );
          if (shouldFallbackToSupabaseEmailSignIn(message)) {
            await clearFirebaseSessionForFallback();
            sessionSnapshot = await signInWithSupabasePassword({
              email: formState.signInEmail,
              password: formState.signInPassword,
            });
          } else {
            throw firebaseError;
          }
        }
      } else {
        sessionSnapshot = await signInWithSupabasePassword({
          email: formState.signInEmail,
          password: formState.signInPassword,
        });
      }
      const synced = await syncAuthenticatedSession({
        session: sessionSnapshot,
        waitForSessionMs: SESSION_SYNC_TIMEOUT_MS,
      });
      if (!synced) {
        setNotice(buildSessionSyncErrorNotice());
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível entrar agora.";
      setNotice({
        message:
          errorMessage === "E-mail ou senha inválidos."
            ? firebaseEnabled
              ? `${errorMessage} Se essa conta já existia no painel, tente a recuperação do mesmo e-mail para alinhar o acesso.`
              : `${errorMessage} Se essa conta é antiga, use a recuperação para definir uma nova senha do painel.`
            : errorMessage,
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    setLoadingIntent(provider);
    setNotice(null);

    try {
      if (provider === "google" && firebaseEnabled) {
        try {
          const sessionSnapshot = await signInWithFirebaseGoogle();
          if (sessionSnapshot?.user) {
            const synced = await syncAuthenticatedSession({
              session: sessionSnapshot,
              waitForSessionMs: SESSION_SYNC_TIMEOUT_MS,
            });
            if (!synced) {
              setNotice(buildSessionSyncErrorNotice());
              setLoadingIntent(null);
            }
          }
        } catch (firebaseError) {
          const message = getErrorMessage(
            firebaseError,
            "Não foi possível iniciar o login com Google agora.",
          );

          if (!shouldFallbackToSupabaseGoogleSignIn(message)) {
            throw firebaseError;
          }

          await clearFirebaseSessionForFallback();
          await signInWithSupabaseSocialProvider(provider);
        }
      } else {
        await signInWithSupabaseSocialProvider(provider);
      }
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : `Não foi possível iniciar o login com ${getSocialProviderLabel(provider)}.`,
        tone: "error",
      });
      setLoadingIntent(null);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("reset");
    setNotice(null);

    try {
      let usedFirebase = firebaseEnabled;

      if (firebaseEnabled) {
        try {
          await sendFirebasePasswordResetEmail(formState.resetEmail);
        } catch (firebaseError) {
          const message = getErrorMessage(
            firebaseError,
            "Não foi possível enviar o e-mail de recuperação agora.",
          );

          if (!shouldFallbackToSupabasePasswordReset(message)) {
            throw firebaseError;
          }

          await sendSupabasePasswordResetEmail(formState.resetEmail);
          usedFirebase = false;
        }
      } else {
        await sendSupabasePasswordResetEmail(formState.resetEmail);
        usedFirebase = false;
      }
      setNotice({
        message: usedFirebase
          ? "Enviamos um e-mail de redefinição. Abra a mensagem mais recente do Firebase, crie a nova senha e depois volte para entrar no painel."
          : "Enviamos um e-mail de redefinição. Abra a mensagem mais recente para continuar.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o e-mail de recuperação agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("sign-up");
    setNotice(null);

    try {
      const passwordError = validatePasswordStrength(formState.signUpPassword);
      if (passwordError) {
        throw new Error(passwordError);
      }

      let outcome;

      if (firebaseEnabled) {
        try {
          outcome = await signUpWithFirebasePassword({
            email: formState.signUpEmail,
            password: formState.signUpPassword,
            passwordConfirmation: formState.signUpPasswordConfirmation,
          });
        } catch (firebaseError) {
          const message = getErrorMessage(
            firebaseError,
            "Não foi possível criar a conta.",
          );

          if (!shouldFallbackToSupabaseEmailSignUp(message)) {
            throw firebaseError;
          }

          outcome = await signUpWithSupabasePassword({
            email: formState.signUpEmail,
            emailRedirectPath: emailConfirmationPath,
            password: formState.signUpPassword,
            passwordConfirmation: formState.signUpPasswordConfirmation,
          });
        }
      } else {
        outcome = await signUpWithSupabasePassword({
          email: formState.signUpEmail,
          emailRedirectPath: emailConfirmationPath,
          password: formState.signUpPassword,
          passwordConfirmation: formState.signUpPasswordConfirmation,
        });
      }

      if (!outcome.requiresEmailConfirmation) {
        openPanelWorkspace(onboardingPath);
        return;
      }

      setNotice({
        message: outcome.requiresEmailConfirmation
          ? isSignUpMode
            ? `Conta criada. Confirme o e-mail ${outcome.email} e volte para concluir a ativação do salão.`
            : `Conta criada. Confirme o e-mail ${outcome.email} antes de entrar no painel.`
          : "Conta criada com sucesso. Você já pode entrar no painel.",
        tone: "success",
      });
      setFormState((current) => ({
        ...current,
        signUpPassword: "",
        signUpPasswordConfirmation: "",
      }));
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a conta.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleStartMfaEnrollment() {
    setLoadingIntent("mfa-enroll");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: factorData, error: factorError } =
        await supabase.auth.mfa.listFactors();

      if (factorError) {
        throw factorError;
      }

      const staleUnverifiedFactors = mapTotpFactors(factorData?.all).filter(
        (factor) => factor.status !== "verified",
      );

      for (const factor of staleUnverifiedFactors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Painel do salão",
      });

      if (
        error ||
        data?.type !== "totp" ||
        !data.totp?.qr_code ||
        !data.totp?.secret
      ) {
        throw error ?? new Error("totp_enrollment_unavailable");
      }

      setMfaPendingEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setMfaCode("");
      await syncAuthenticatedSession();
      setNotice({
        message:
          "Autenticador gerado. Escaneie o QR code no app autenticador e confirme o código para continuar.",
        tone: "info",
      });
    } catch {
      setNotice({
        message: "Não foi possível gerar o autenticador agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleSubmitMfaCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("mfa-verify");
    setNotice(null);

    try {
      const targetFactorId =
        mfaPendingEnrollment?.factorId ?? verifiedMfaFactors[0]?.id ?? null;

      if (!targetFactorId) {
        throw new Error("mfa_factor_missing");
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: targetFactorId,
        code: mfaCode.trim(),
      });

      if (error) {
        throw error;
      }

      setMfaCode("");
      setMfaPendingEnrollment(null);
      await syncAuthenticatedSession();
    } catch {
      setNotice({
        message:
          "Não foi possível confirmar esse código. Gere o código mais recente no app autenticador e tente de novo.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleLeavePendingMfaSession() {
    setLoadingIntent("mfa-signout");
    setNotice(null);

    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "local" });
      setAuthStage("forms");
      setMfaCode("");
      setMfaPendingEnrollment(null);
      setMfaFactors([]);
      setMfaSessionEmail(null);
      setNotice({
        message: "Sessão encerrada. Entre novamente quando quiser continuar.",
        tone: "info",
      });
    } catch {
      setNotice({
        message: "Não foi possível encerrar a sessão agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  function renderEmailSignInForm(buttonClassName: string, className?: string) {
    return (
      <form
        className={className ? `form-grid ${className}` : "form-grid"}
        onSubmit={handleEmailSignIn}
      >
        <div className="field">
          <label htmlFor="signin-email">E-mail</label>
          <input
            id="signin-email"
            name="email"
            type="email"
            placeholder="contato@seusalao.com.br"
            required
            value={formState.signInEmail}
            onChange={(event) => updateField("signInEmail", event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="signin-password">Senha</label>
          <input
            id="signin-password"
            name="password"
            type="password"
            placeholder="Sua senha"
            required
            value={formState.signInPassword}
            onChange={(event) => updateField("signInPassword", event.target.value)}
          />
        </div>

        <button
          type="submit"
          className={buttonClassName}
          disabled={loadingIntent !== null}
        >
          {loadingIntent === "sign-in" ? "Entrando..." : "Entrar"}
        </button>
      </form>
    );
  }

  function renderPasswordResetForm() {
    return (
      <form
        className="form-grid auth-disclosure__content"
        onSubmit={handlePasswordReset}
      >
        <div className="field">
          <label htmlFor="recovery-email">E-mail da conta</label>
          <input
            id="recovery-email"
            name="email"
            type="email"
            placeholder="contato@seusalao.com.br"
            required
            value={formState.resetEmail}
            onChange={(event) => updateField("resetEmail", event.target.value)}
          />
        </div>

        <button
          type="submit"
          className="secondary-button"
          disabled={loadingIntent !== null}
        >
          {loadingIntent === "reset" ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    );
  }

  function renderEmailSignUpForm(buttonClassName: string, className?: string) {
    return (
      <form
        className={className ? `form-grid ${className}` : "form-grid"}
        onSubmit={handleSignUp}
      >
        <div className="field">
          <label htmlFor="signup-email">E-mail</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            placeholder="novo@email.com"
            required
            value={formState.signUpEmail}
            onChange={(event) => updateField("signUpEmail", event.target.value)}
          />
        </div>

        <div className="auth-signup-password-grid">
          <div className="field">
            <label htmlFor="signup-password">Senha</label>
            <input
              id="signup-password"
              name="password"
              type="password"
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              required
              value={formState.signUpPassword}
              onChange={(event) => updateField("signUpPassword", event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="signup-password-confirmation">
              Confirmar senha
            </label>
            <input
              id="signup-password-confirmation"
              name="passwordConfirmation"
              type="password"
              minLength={6}
              placeholder="Repita a senha"
              required
              value={formState.signUpPasswordConfirmation}
              onChange={(event) =>
                updateField("signUpPasswordConfirmation", event.target.value)
              }
            />
          </div>
        </div>
        <span className="field-hint auth-signup-hint">{signUpHint}</span>

        <button
          type="submit"
          className={buttonClassName}
          disabled={loadingIntent !== null}
        >
          {loadingIntent === "sign-up"
            ? "Criando conta..."
            : "Criar conta com e-mail"}
        </button>
      </form>
    );
  }

  if (authStage === "mfa") {
    return (
      <>
        <div className="auth-form-stack">
          {notice ? (
            <FlashMessage message={notice.message} tone={notice.tone} />
          ) : null}

          <div className="panel-card panel-card--accent auth-form-card">
            <div className="panel-card__header">
              <span className="eyebrow">Verificação</span>
            </div>
            <div className="auth-form-card__meta auth-form-card__meta--compact">
              <h3>Confirmar acesso</h3>
              <p className="muted">
                {verifiedMfaFactors.length > 0
                  ? `Use o autenticador vinculado${mfaSessionEmail ? ` à conta ${mfaSessionEmail}` : " à sua conta"} para continuar.`
                  : "Este painel exige autenticação em duas etapas. Configure o autenticador para continuar."}
              </p>
            </div>

            {verifiedMfaFactors.length > 0 ? (
              <article className="settings-status-card" style={{ marginBottom: 16 }}>
                <strong>
                  {verifiedMfaFactors.length === 1
                    ? "1 autenticador confirmado"
                    : `${verifiedMfaFactors.length} autenticadores confirmados`}
                </strong>
                <p>
                  {verifiedMfaFactors
                    .map((factor) => factor.friendlyName || "Autenticador do painel")
                    .join(" • ")}
                </p>
              </article>
            ) : null}

            {mfaPendingEnrollment ? (
              <div className="form-grid">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mfaPendingEnrollment.qrCode}
                    alt="QR code do autenticador"
                    style={{
                      width: 180,
                      height: 180,
                      maxWidth: "100%",
                      borderRadius: 8,
                      border: "1px solid rgba(15, 23, 42, 0.12)",
                    }}
                  />
                </div>

                <article className="settings-status-card">
                  <strong>Chave manual</strong>
                  <p>{mfaPendingEnrollment.secret}</p>
                </article>
              </div>
            ) : null}

            {verifiedMfaFactors.length > 0 || mfaPendingEnrollment ? (
              <form className="form-grid" onSubmit={handleSubmitMfaCode}>
                <div className="field">
                  <label htmlFor="mfa-code">Código do autenticador</label>
                  <input
                    id="mfa-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(event) =>
                      setMfaCode(event.target.value.replace(/\D+/g, "").slice(0, 6))
                    }
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={loadingIntent !== null}
                >
                  {loadingIntent === "mfa-verify"
                    ? "Confirmando..."
                    : "Confirmar código"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={handleStartMfaEnrollment}
                disabled={loadingIntent !== null}
              >
                {loadingIntent === "mfa-enroll"
                  ? "Gerando..."
                  : "Configurar autenticador"}
              </button>
            )}

            <div className="auth-inline-divider" aria-hidden="true">
              <span />
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={handleLeavePendingMfaSession}
              disabled={loadingIntent !== null}
            >
              {loadingIntent === "mfa-signout"
                ? "Saindo..."
                : "Sair desta sessão"}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="auth-form-stack">
        {notice ? (
          <FlashMessage message={notice.message} tone={notice.tone} />
        ) : null}

        <div className="panel-card panel-card--accent auth-form-card auth-primary-auth-card">
          <div className="panel-card__header">
            <span className="eyebrow">{primaryCardEyebrow}</span>
          </div>
          <div className="auth-form-card__meta auth-form-card__meta--compact">
            <h3>{primaryCardTitle}</h3>
            <p className="muted">{primaryCardDescription}</p>
          </div>
          <div className="auth-social-grid">
            <button
              type="button"
              className="secondary-button auth-social-button"
              onClick={() => {
                void handleSocialSignIn("google");
              }}
              disabled={loadingIntent !== null}
            >
              <span className="auth-social-button__mark" aria-hidden="true">
                <svg viewBox="0 0 18 18" role="presentation" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H1v2.34A9 9 0 0 0 9 18Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.98 10.72A5.41 5.41 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.94H1A9 9 0 0 0 0 9c0 1.45.35 2.82 1 4.06l2.98-2.34Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.46 3.42 1.36l2.56-2.56C13.46.96 11.43 0 9 0A9 9 0 0 0 1 4.94l2.98 2.34c.7-2.12 2.68-3.7 5.02-3.7Z"
                  />
                </svg>
              </span>
              <span className="auth-social-button__meta">
                <strong>Continuar com Google</strong>
                <span>{socialButtonMetaLabel}</span>
              </span>
            </button>
          </div>

          <div className="auth-inline-divider auth-inline-divider--tight" aria-hidden="true">
            <span />
          </div>

          {isSignUpMode ? (
            <>
              <div className="auth-compact-copy auth-login-copy">
                <strong>Criar conta com e-mail</strong>
                <p className="muted">
                  Abra a conta principal que vai ativar o salão.
                </p>
              </div>
              {renderEmailSignUpForm("primary-button")}
            </>
          ) : (
            <>
              <div className="auth-compact-copy auth-login-copy">
                <strong>Entrar com e-mail</strong>
                <p className="muted">Se preferir, use o e-mail cadastrado.</p>
              </div>
              {renderEmailSignInForm("primary-button")}
              <p className="auth-inline-note">{inlineSecurityNote}</p>
            </>
          )}
        </div>

        <div className="panel-card auth-form-card auth-utility-card">
          <div className="auth-utility-intro">
            <strong>{utilityCardTitle}</strong>
            <p className="muted">{utilityCardDescription}</p>
          </div>

          <div className="auth-utility-sections">
            {isSignUpMode ? (
              <>
                <details className="auth-disclosure">
                  <summary className="auth-disclosure__summary">
                    <span>Já tenho conta</span>
                    <span className="auth-disclosure__meta">Entrar</span>
                  </summary>

                  {renderEmailSignInForm(
                    "secondary-button",
                    "auth-disclosure__content",
                  )}
                </details>

                <details className="auth-disclosure">
                  <summary className="auth-disclosure__summary">
                    <span>Recuperar senha</span>
                    <span className="auth-disclosure__meta">Enviar link</span>
                  </summary>

                  {renderPasswordResetForm()}
                </details>
              </>
            ) : (
              <>
                <details className="auth-disclosure">
                  <summary className="auth-disclosure__summary">
                    <span>Recuperar senha</span>
                    <span className="auth-disclosure__meta">Enviar link</span>
                  </summary>

                  {renderPasswordResetForm()}
                </details>

                <details className="auth-disclosure">
                  <summary className="auth-disclosure__summary">
                    <span>Cadastrar com e-mail</span>
                    <span className="auth-disclosure__meta">Primeiro acesso</span>
                  </summary>

                  {renderEmailSignUpForm(
                    "secondary-button",
                    "auth-disclosure__content",
                  )}
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
