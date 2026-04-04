import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import { getFirebaseWebConfig } from "@/lib/firebase/config";
import { getFirebasePanelAuth } from "@/lib/firebase/client";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

type BridgeCredentials = {
  email: string;
  password: string;
};

type SignUpOutcome = {
  requiresEmailConfirmation: boolean;
  email: string;
};

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function formatFirebaseError(error: unknown) {
  const errorCode = typeof error === "object" && error != null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  const message = typeof error === "object" && error != null && "message" in error
    ? String((error as { message?: unknown }).message ?? "").trim()
    : "";

  switch (errorCode) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "E-mail ou senha inválidos.";
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
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
      return message.length > 0 ? message : "Não foi possível autenticar com o Firebase.";
  }
}

function formatBridgeError(errorCode: string | null, detail?: string | null) {
  switch (errorCode) {
    case "email_not_verified":
      return "Confirme o e-mail antes de entrar no painel.";
    case "missing_server_secrets":
      return "A bridge de autenticação ainda não foi configurada no Supabase.";
    case "missing_firebase_context":
    case "invalid_payload":
      return "A configuração atual do painel não conseguiu validar sua conta do Firebase.";
    case "invalid_firebase_session":
    case "firebase_lookup_failed":
      return detail?.trim().length
        ? detail.trim()
        : "O Firebase autenticou a conta, mas o painel não conseguiu sincronizar a sessão com o Supabase.";
    case "email_missing":
      return "A conta autenticada precisa ter um e-mail válido para continuar.";
    case "user_lookup_failed":
    case "user_sync_failed":
      return detail?.trim().length
        ? detail.trim()
        : "Não foi possível preparar sua conta no Supabase.";
    default:
      return detail?.trim().length
        ? detail.trim()
        : "Não foi possível sincronizar o login com o Supabase.";
  }
}

async function provisionSupabaseBridgeCredentials(firebaseUser: User): Promise<BridgeCredentials> {
  const config = getFirebaseWebConfig();
  if (config == null) {
    throw new Error("missing_firebase_web_config");
  }

  const firebaseIdToken = await firebaseUser.getIdToken(true);
  if (firebaseIdToken.trim().length === 0) {
    throw new Error("invalid_firebase_session");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/firebase-auth-bridge`, {
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
  });

  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      formatBridgeError(
        typeof payload.error === "string" ? payload.error.toLowerCase() : null,
        typeof payload.detail === "string" ? payload.detail : null,
      ),
    );
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : firebaseUser.email?.trim();
  const password = typeof payload.supabase_password === "string" ? payload.supabase_password.trim() : "";

  if (!email || !password) {
    throw new Error("A bridge respondeu sem credenciais válidas do Supabase.");
  }

  return {
    email,
    password,
  };
}

async function signInToSupabaseWithFirebaseIdentity(firebaseUser: User) {
  const bridgeCredentials = await provisionSupabaseBridgeCredentials(firebaseUser);
  const supabase = createSupabaseBrowserClient();

  await supabase.auth.signOut();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: bridgeCredentials.email,
    password: bridgeCredentials.password,
  });

  if (error || data.user == null || data.session == null) {
    throw new Error(error?.message?.trim() || "O Supabase não retornou uma sessão válida para o painel.");
  }
}

async function ensureEmailVerified(firebaseUser: User, resendIfNeeded: boolean) {
  await firebaseUser.reload();
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

export async function signInWithFirebasePassword(input: { email: string; password: string }) {
  const auth = getFirebasePanelAuth();

  try {
    const credentials = await signInWithEmailAndPassword(
      auth,
      normalizeEmailAddress(input.email),
      input.password,
    );
    const firebaseUser = await ensureEmailVerified(credentials.user, true);
    await signInToSupabaseWithFirebaseIdentity(firebaseUser);
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

  const auth = getFirebasePanelAuth();

  try {
    const credentials = await createUserWithEmailAndPassword(
      auth,
      normalizeEmailAddress(input.email),
      input.password,
    );
    await sendEmailVerification(credentials.user).catch(() => undefined);
    await signOut(auth).catch(() => undefined);

    return {
      email: normalizeEmailAddress(input.email),
      requiresEmailConfirmation: true,
    };
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function sendFirebasePasswordResetEmail(email: string) {
  const auth = getFirebasePanelAuth();

  try {
    await sendPasswordResetEmail(auth, normalizeEmailAddress(email));
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function signInWithFirebaseGoogle() {
  const auth = getFirebasePanelAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: "select_account",
  });

  try {
    let firebaseUser: User | null = null;

    try {
      const credentials = await signInWithPopup(auth, provider);
      firebaseUser = credentials.user;
    } catch (error) {
      const code = typeof error === "object" && error != null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

      if (code === "auth/popup-blocked" || code === "auth/web-storage-unsupported") {
        throw new Error("O navegador bloqueou a janela do Google. Libere os pop-ups para continuar.");
      }

      if (
        code === "auth/account-exists-with-different-credential" &&
        typeof error === "object" &&
        error != null &&
        "customData" in error &&
        (error as { customData?: { email?: string } }).customData?.email
      ) {
        const email = (error as { customData?: { email?: string } }).customData?.email ?? "";
        throw new Error(`Esta conta já existe com outro método. Entre usando ${email}.`);
      }

      throw error;
    }

    if (firebaseUser == null) {
      throw new Error("O login com Google foi cancelado.");
    }

    await signInToSupabaseWithFirebaseIdentity(firebaseUser);
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function completeFirebaseRedirectLoginIfNeeded() {
  const auth = getFirebasePanelAuth();
  const { getRedirectResult } = await import("firebase/auth");

  try {
    const credentials = await getRedirectResult(auth);
    if (credentials?.user == null) {
      return false;
    }

    await signInToSupabaseWithFirebaseIdentity(credentials.user);
    return true;
  } catch (error) {
    throw new Error(formatFirebaseError(error));
  }
}

export async function signOutPanelFirebaseSession() {
  if (getFirebaseWebConfig() == null) {
    return;
  }

  const auth = getFirebasePanelAuth();
  await signOut(auth).catch(() => undefined);
}
