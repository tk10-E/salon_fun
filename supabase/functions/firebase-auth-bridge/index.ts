import { createClient } from "npm:@supabase/supabase-js@2";

const firebaseLookupEndpoint =
  "https://identitytoolkit.googleapis.com/v1/accounts:lookup";

type FirebaseLookupUser = {
  email?: string;
  emailVerified?: boolean;
  localId?: string;
  providerUserInfo?: Array<{
    providerId?: string;
  }>;
};

type FirebaseLookupResponse = {
  users?: FirebaseLookupUser[];
  error?: {
    message?: string;
  };
};

type BridgeRequest = {
  firebase_api_key?: unknown;
  firebase_id_token?: unknown;
};

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin")?.trim();

  return {
    "Access-Control-Allow-Origin": origin && origin.length > 0 ? origin : "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    },
  });
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value != "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function detailMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return String(error);
}

function randomPassword(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function lookupFirebaseUser(
  apiKey: string,
  idToken: string,
): Promise<FirebaseLookupUser> {
  const response = await fetch(
    `${firebaseLookupEndpoint}?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  const payload = await response.json().catch(() => ({})) as FirebaseLookupResponse;

  if (!response.ok) {
    const message = normalizeNonEmptyString(payload.error?.message) ??
      "firebase_lookup_failed";
    throw new Error(message);
  }

  const user = payload.users?.[0];
  if (user == null) {
    throw new Error("firebase_user_not_found");
  }

  return user;
}

async function findSupabaseUserByEmail(
  adminClient: any,
  email: string,
) {
  const targetEmail = email.trim().toLowerCase();
  var page = 1;

  while (page <= 50) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error != null) {
      throw error;
    }

    const users = data.users ?? [];
    const matchedUser = users.find(
      (user: { email?: string | null }) =>
        (user.email ?? "").trim().toLowerCase() == targetEmail,
    );
    if (matchedUser != null) {
      return matchedUser;
    }

    if (users.length < 200) {
      break;
    }

    page += 1;
  }

  return null;
}

Deno.serve(async (request) => {
  try {
    if (request.method == "OPTIONS") {
      return new Response("ok", {
        headers: corsHeaders(request),
      });
    }

    if (request.method != "POST") {
      return jsonResponse(request, { error: "method_not_allowed" }, 405);
    }

    const payload = await request.json().catch(() => null) as BridgeRequest | null;
    const firebaseApiKey = normalizeNonEmptyString(payload?.firebase_api_key);
    const firebaseIdToken = normalizeNonEmptyString(payload?.firebase_id_token);

    if (firebaseApiKey == null || firebaseIdToken == null) {
      return jsonResponse(request, { error: "missing_firebase_context" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (
      supabaseUrl == null ||
      supabaseUrl.length == 0 ||
      serviceRoleKey == null ||
      serviceRoleKey.length == 0
    ) {
      return jsonResponse(request, { error: "missing_server_secrets" }, 500);
    }

    const firebaseUser = await lookupFirebaseUser(firebaseApiKey, firebaseIdToken)
      .catch((error) => {
        throw new Error(`firebase_lookup_failed:${detailMessage(error)}`);
      });
    const email = normalizeNonEmptyString(firebaseUser.email)?.toLowerCase();
    if (email == null) {
      return jsonResponse(request, { error: "email_missing" }, 409);
    }

    if (firebaseUser.emailVerified != true) {
      return jsonResponse(request, { error: "email_not_verified" }, 409);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ephemeralPassword = randomPassword();
    const providerIds = (firebaseUser.providerUserInfo ?? [])
      .map((provider) => normalizeNonEmptyString(provider.providerId))
      .filter((providerId): providerId is string => providerId !== null);

    const existingUser = await findSupabaseUserByEmail(adminClient, email).catch((
      error,
    ) => {
      throw new Error(`user_lookup_failed:${detailMessage(error)}`);
    });

    if (existingUser != null) {
      const { error } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        {
          email,
          password: ephemeralPassword,
          email_confirm: true,
          user_metadata: {
            firebase_uid: firebaseUser.localId ?? null,
            firebase_provider_ids: providerIds,
          },
        },
      );
      if (error != null) {
        return jsonResponse(request, {
          error: "user_sync_failed",
          detail: error.message,
        }, 500);
      }
    } else {
      const { error } = await adminClient.auth.admin.createUser({
        email,
        password: ephemeralPassword,
        email_confirm: true,
        user_metadata: {
          firebase_uid: firebaseUser.localId ?? null,
          firebase_provider_ids: providerIds,
        },
      });
      if (error != null) {
        return jsonResponse(request, {
          error: "user_sync_failed",
          detail: error.message,
        }, 500);
      }
    }

    return jsonResponse(request, {
      email,
      supabase_password: ephemeralPassword,
    });
  } catch (error) {
    const detail = detailMessage(error);
    const [errorCode, errorDetail] = detail.split(":", 2);

    return jsonResponse(request, {
      error: errorCode.length == 0 ? "unexpected_error" : errorCode,
      detail: errorDetail != null && errorDetail.length > 0 ? errorDetail : detail,
    }, 500);
  }
});
