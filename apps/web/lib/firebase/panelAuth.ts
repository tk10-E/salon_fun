import {
  GoogleAuthProvider,
  getRedirectResult,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebasePanelAuth, getReadyFirebasePanelAuth } from "@/lib/firebase/client";
import { getRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { validatePasswordStrength } from "@/lib/passwordPolicy";

type BridgeCredentials = {
  email: string;
  password: string;
};

export type PanelSessionSnapshot = {
  user: {
    email?: string | null;
    id: string;
  } | null;
};

type SignUpOutcome = {
  requiresEmailConfirmation: boolean;
  email: string;
};

const AUTH_NETWORK_TIMEOUT_MS = 12000;

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
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

function getGoogleAccountConflictMessage(error: unknown) {
  const code =
    typeof error === "object" && error != null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  if (
    code === "auth/account-exists-with-different-credential" &&
    typeof error === "object" &&
    error != null &&
    "customData" in error &&
    (error as { customData?: { email?: string } }).customData?.email
  ) {
    const email =
      (error as { customData?: { email?: string } }).customData?.email ?? "";

    return `Esta conta ja existe com outro metodo. Entre usando ${email}.`;
  }

  return null;
}

function getFirebaseErrorCode(error: unknown) {
  return typeof error === "object" && error != null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

function shouldFallbackGooglePopupToRedirect(error: unknown) {
  const code = getFirebaseErrorCode(error);

  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment"
  );
}

function formatFirebaseError(error: unknown) {
  const errorCode = getFirebaseErrorCode(error);
  const message =
    typeof error === "object" && error != null && "message" in error
      ? String((error as { message?: unknown }).message ?? "").trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  switch (errorCode) {
    case "auth/invalid-api-key":
    case "auth/app-deleted":
    case "auth/auth-domain-config-required":
    case "auth/invalid-app-credential":
    case "auth/project-not-found":
      return "A configuração do Firebase Web do painel precisa ser atualizada no deploy.";
    case "auth/unauthorized-domain":
      return "O domínio do painel ainda não foi autorizado no Firebase. Atualize a configuração do projeto.";
    case "auth/operation-not-allowed":
    case "auth/operation-not-supported-in-this-environment":
      return "O método de autenticação ainda não foi liberado no Firebase.";
    case "auth/configuration-not-found":
      return "O Firebase Web do painel está com chave inválida. Atualize a configuração do deploy.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "E-mail ou senha inválidos.";
    case "auth/email-already-in-use":
      return "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.";
    case "auth/weak-password":
      return "Use uma senha mais forte para criar a conta.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "O login com Google foi cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google. Libere pop-ups e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de rede. Confira sua conexão e tente de novo.";
    default:
      if (
        normalizedMessage.includes("api-key-not-valid") ||
        normalizedMessage.includes("invalid api key")
      ) {
        return "O Firebase Web do painel está com chave inválida. Atualize a configuração do deploy.";
      }

      return message.length > 0
        ? message
        : "Não foi possível autenticar com o Firebase.";
  }
}

async function buildExistingFirebaseAccountSignUpError(args: {
  auth: Awaited<ReturnType<typeof getReadyFirebasePanelAuth>>;
  email: string;
  password: string;
}): Promise<never> {
  const normalizedEmail = normalizeEmailAddress(args.email);
  const existingAccountMessage =
    "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.";

  try {
    const credentials = await withTimeout(
      signInWithEmailAndPassword(args.auth, normalizedEmail, args.password),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para verificar a conta existente.",
    );
    let verificationEmailSent = false;

    if (!credentials.user.emailVerified) {
      try {
        await sendEmailVerification(credentials.user);
        verificationEmailSent = true;
      } catch {
        // best effort
      }

      await signOut(args.auth).catch(() => undefined);
      throw new Error(
        verificationEmailSent
          ? `Esta conta já foi criada para ${normalizedEmail}. Reenviamos a confirmação por e-mail. Confirme o e-mail antes de entrar no painel.`
          : `Esta conta já foi criada para ${normalizedEmail}. Confirme o e-mail antes de entrar no painel.`,
      );
    }

    await signOut(args.auth).catch(() => undefined);
    throw new Error(existingAccountMessage);
  } catch (error) {
    await signOut(args.auth).catch(() => undefined);
    const errorCode = getFirebaseErrorCode(error);

    if (!errorCode && error instanceof Error && error.message.trim().length > 0) {
      throw error;
    }

    if (
      errorCode === "auth/network-request-failed" ||
      errorCode === "auth/too-many-requests"
    ) {
      throw new Error(formatFirebaseError(error));
    }

    throw new Error(existingAccountMessage);
  }
}

function formatBridgeError(errorCode: string | null, detail?: string | null) {
  switch (errorCode) {
    case "bridge_timeout":
      return "A conexão com o painel demorou demais. Tente entrar novamente.";
    case "email_not_verified":
      return "Confirme o e-mail antes de entrar no painel.";
    case "missing_server_secrets":
      return "A bridge de autenticação ainda não foi configurada no Supabase.";
    case "origin_not_allowed":
      return "A origem do painel ainda não foi autorizada na bridge de autenticação.";
    case "missing_firebase_context":
    case "invalid_firebase_context":
    case "invalid_payload":
      return "A configuração atual do painel não conseguiu validar sua conta do Firebase.";
    case "invalid_firebase_session":
    case "firebase_lookup_failed":
      return "O Firebase autenticou a conta, mas o painel não conseguiu sincronizar a sessão com o Supabase.";
    case "email_missing":
      return "A conta autenticada precisa ter um e-mail válido para continuar.";
    case "user_lookup_failed":
    case "user_sync_failed":
      return "Não foi possível preparar sua conta no Supabase.";
    default:
      return detail?.trim().length
        ? detail.trim()
        : "Não foi possível sincronizar o login com o Supabase.";
  }
}

async function requestSupabaseBridgeCredentials(
  firebaseUser: User,
  forceRefresh: boolean,
): Promise<BridgeCredentials> {
  const config = getRuntimeFirebaseWebConfig();
  if (config == null) {
    throw new Error("missing_firebase_web_config");
  }

  const firebaseIdToken = await firebaseUser.getIdToken(forceRefresh);
  if (firebaseIdToken.trim().length === 0) {
    throw new Error("invalid_firebase_session");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/firebase-auth-bridge`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        firebase_api_key: config.apiKey,
        firebase_id_token: firebaseIdToken,
      }),
    },
  ).catch((error) => {
    throw error;
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    throw new Error(
      formatBridgeError(
        typeof payload.error === "string" ? payload.error.toLowerCase() : null,
        typeof payload.detail === "string" ? payload.detail : null,
      ),
    );
  }

  const email =
    typeof payload.email === "string"
      ? payload.email.trim()
      : firebaseUser.email?.trim();
  const password =
    typeof payload.supabase_password === "string"
      ? payload.supabase_password.trim()
      : "";

  if (!email || !password) {
    throw new Error("A bridge respondeu sem credenciais válidas do Supabase.");
  }

  return {
    email,
    password,
  };
}

async function provisionSupabaseBridgeCredentials(
  firebaseUser: User,
): Promise<BridgeCredentials> {
  try {
    return await requestSupabaseBridgeCredentials(firebaseUser, false);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Confirme o e-mail antes de entrar no painel." &&
      firebaseUser.emailVerified
    ) {
      return await requestSupabaseBridgeCredentials(firebaseUser, true);
    }

    throw error;
  }
}

async function signInToSupabaseWithFirebaseIdentity(
  firebaseUser: User,
): Promise<PanelSessionSnapshot> {
  const bridgeCredentials =
    await withTimeout(
      provisionSupabaseBridgeCredentials(firebaseUser),
      AUTH_NETWORK_TIMEOUT_MS,
      "A conexão com o painel demorou demais. Tente entrar novamente.",
    );
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession().catch(() => ({
    data: {
      session: null,
    },
  }));
  const currentSessionEmail = currentSession?.user?.email
    ?.trim()
    .toLowerCase();
  if (
    currentSession?.user &&
    currentSessionEmail !== normalizeEmailAddress(bridgeCredentials.email)
  ) {
    await withTimeout(
      supabase.auth.signOut({ scope: "local" }),
      5000,
      "supabase_signout_timeout",
    ).catch(() => undefined);
  }

  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({
      email: bridgeCredentials.email,
      password: bridgeCredentials.password,
    }),
    AUTH_NETWORK_TIMEOUT_MS,
    "O painel demorou demais para concluir o login.",
  );

  if (error || data.user == null || data.session == null) {
    throw new Error(
      error?.message?.trim() ||
        "O Supabase não retornou uma sessão válida para o painel.",
    );
  }

  return {
    user: {
      email: data.user.email ?? null,
      id: data.user.id,
    },
  };
}

async function ensureEmailVerified(
  firebaseUser: User,
  resendIfNeeded: boolean,
) {
  if (firebaseUser.emailVerified) {
    return firebaseUser;
  }

  await withTimeout(
    firebaseUser.reload(),
    AUTH_NETWORK_TIMEOUT_MS,
    "O Firebase demorou demais para validar sua conta.",
  );
  const auth = getFirebasePanelAuth();
  const refreshedUser = auth.currentUser ?? firebaseUser;

  if (refreshedUser.emailVerified) {
    return refreshedUser;
  }

  if (resendIfNeeded) {
    try {
      await sendEmailVerification(refreshedUser);
    } catch {
      // best effort
    }
  }

  await signOut(auth).catch(() => undefined);
  throw new Error("Confirme o e-mail para liberar o acesso ao painel.");
}

export async function signInWithFirebasePassword(input: {
  email: string;
  password: string;
}): Promise<PanelSessionSnapshot> {
  const auth = await getReadyFirebasePanelAuth();

  try {
    const credentials = await withTimeout(
      signInWithEmailAndPassword(
        auth,
        normalizeEmailAddress(input.email),
        input.password,
      ),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para responder. Tente entrar novamente.",
    );
    const firebaseUser = await ensureEmailVerified(credentials.user, true);
    return await signInToSupabaseWithFirebaseIdentity(firebaseUser);
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function signUpWithFirebasePassword(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
}): Promise<SignUpOutcome> {
  if (input.password !== input.passwordConfirmation) {
    throw new Error("Confirme a mesma senha nos dois campos.");
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const auth = await getReadyFirebasePanelAuth();

  try {
    const credentials = await withTimeout(
      createUserWithEmailAndPassword(
        auth,
        normalizeEmailAddress(input.email),
        input.password,
      ),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para criar a conta.",
    );
    await sendEmailVerification(credentials.user).catch(() => undefined);
    await signOut(auth).catch(() => undefined);

    return {
      email: normalizeEmailAddress(input.email),
      requiresEmailConfirmation: true,
    };
  } catch (error) {
    if (getFirebaseErrorCode(error) === "auth/email-already-in-use") {
      return await buildExistingFirebaseAccountSignUpError({
        auth,
        email: input.email,
        password: input.password,
      });
    }

    throw new Error(formatFirebaseError(error));
  }
}

export async function sendFirebasePasswordResetEmail(email: string) {
  const auth = await getReadyFirebasePanelAuth();

  try {
    await withTimeout(
      sendPasswordResetEmail(auth, normalizeEmailAddress(email)),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para enviar a recuperação.",
    );
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function restorePanelSessionFromFirebaseIfNeeded(): Promise<
  PanelSessionSnapshot | null
> {
  if (getRuntimeFirebaseWebConfig() == null) {
    return null;
  }

  const auth = await getReadyFirebasePanelAuth();

  if ("authStateReady" in auth && typeof auth.authStateReady === "function") {
    await withTimeout(
      auth.authStateReady().catch(() => undefined),
      5000,
      "firebase_auth_state_timeout",
    ).catch(() => undefined);
  }

  const firebaseUser = auth.currentUser;
  if (firebaseUser == null) {
    return null;
  }

  const verifiedUser = await ensureEmailVerified(firebaseUser, false);
  return await signInToSupabaseWithFirebaseIdentity(verifiedUser);
}

export async function signInWithFirebaseGoogle(): Promise<
  PanelSessionSnapshot | null
> {
  const auth = await getReadyFirebasePanelAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
  });

  try {
    const credentials = await withTimeout(
      signInWithPopup(auth, provider),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para concluir o login com Google.",
    );

    if (credentials?.user == null) {
      return null;
    }

    return await signInToSupabaseWithFirebaseIdentity(credentials.user);
  } catch (error) {
    if (shouldFallbackGooglePopupToRedirect(error)) {
      try {
        await signInWithRedirect(auth, provider);
        return null;
      } catch (redirectError) {
        const accountConflictMessage =
          getGoogleAccountConflictMessage(redirectError);
        if (accountConflictMessage) {
          throw new Error(accountConflictMessage);
        }

        throw new Error(formatFirebaseError(redirectError));
      }
    }

    const accountConflictMessage = getGoogleAccountConflictMessage(error);
    if (accountConflictMessage) {
      throw new Error(accountConflictMessage);
    }

    throw new Error(formatFirebaseError(error));
  }
}

export async function completeFirebaseRedirectLoginIfNeeded(): Promise<
  PanelSessionSnapshot | null
> {
  const auth = await getReadyFirebasePanelAuth();

  try {
    const credentials = await withTimeout(
      getRedirectResult(auth),
      AUTH_NETWORK_TIMEOUT_MS,
      "O Firebase demorou demais para concluir o login com Google.",
    );
    if (credentials?.user == null) {
      return null;
    }

    return await signInToSupabaseWithFirebaseIdentity(credentials.user);
  } catch (error) {
    const accountConflictMessage = getGoogleAccountConflictMessage(error);
    if (accountConflictMessage) {
      throw new Error(accountConflictMessage);
    }

    throw new Error(formatFirebaseError(error));
  }
}

export async function signOutPanelFirebaseSession() {
  if (getRuntimeFirebaseWebConfig() == null) {
    return;
  }

  const auth = await getReadyFirebasePanelAuth();
  await signOut(auth).catch(() => undefined);
}
