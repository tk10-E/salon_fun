import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { buildRedirectNotice } from "@/app/_actions/shared";
import { getOwnerSalon } from "@/lib/auth";
import { encryptInstagramAccessToken } from "@/lib/instagram-crypto";
import {
  getInstagramMetaAppId,
  getInstagramMetaAppSecret,
  INSTAGRAM_META_GRAPH_VERSION,
  pickInstagramPageAccount,
  type InstagramMetaPageAccount,
  verifyInstagramOAuthState,
} from "@/lib/instagram-oauth";
import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_PATH = "/dashboard/instagram";

type MetaTokenResponse = {
  access_token?: string;
};

type MetaAccountsResponse = {
  data?: InstagramMetaPageAccount[];
};

function redirectToInstagramDashboard(
  request: NextRequest,
  message: string,
  tone: "success" | "error" | "info" = "info",
) {
  return NextResponse.redirect(
    new URL(buildRedirectNotice(INSTAGRAM_PATH, message, tone), request.url),
  );
}

async function exchangeMetaCodeForToken(code: string, redirectUri: string) {
  const tokenUrl = new URL(
    `https://graph.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}/oauth/access_token`,
  );
  tokenUrl.searchParams.set("client_id", getInstagramMetaAppId());
  tokenUrl.searchParams.set("client_secret", getInstagramMetaAppSecret());
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);

  const tokenResponse = await fetch(tokenUrl);
  if (!tokenResponse.ok) {
    throw new Error(await tokenResponse.text());
  }

  const tokenPayload = (await tokenResponse.json()) as MetaTokenResponse;
  if (!tokenPayload.access_token) {
    throw new Error("A Meta nao devolveu um access token valido.");
  }

  const longLivedUrl = new URL(
    `https://graph.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}/oauth/access_token`,
  );
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", getInstagramMetaAppId());
  longLivedUrl.searchParams.set("client_secret", getInstagramMetaAppSecret());
  longLivedUrl.searchParams.set("fb_exchange_token", tokenPayload.access_token);

  const longLivedResponse = await fetch(longLivedUrl);
  if (!longLivedResponse.ok) {
    return tokenPayload.access_token;
  }

  const longLivedPayload = (await longLivedResponse.json()) as MetaTokenResponse;
  return longLivedPayload.access_token ?? tokenPayload.access_token;
}

async function loadMetaAccounts(accessToken: string) {
  const accountsUrl = new URL(
    `https://graph.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}/me/accounts`,
  );
  accountsUrl.searchParams.set(
    "fields",
    "id,name,instagram_business_account{id,username}",
  );
  accountsUrl.searchParams.set("access_token", accessToken);

  const accountsResponse = await fetch(accountsUrl);
  if (!accountsResponse.ok) {
    throw new Error(await accountsResponse.text());
  }

  const payload = (await accountsResponse.json()) as MetaAccountsResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const errorReason = request.nextUrl.searchParams.get("error_reason");
  const errorDescription = request.nextUrl.searchParams.get("error_description");
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");

  if (errorReason || errorDescription) {
    return redirectToInstagramDashboard(
      request,
      errorDescription ?? "A Meta cancelou a conexao automatica com o Instagram.",
      "error",
    );
  }

  if (!state) {
    return redirectToInstagramDashboard(
      request,
      "A conexao com a Meta voltou sem o estado de seguranca esperado.",
      "error",
    );
  }

  try {
    const verifiedState = verifyInstagramOAuthState(state);

    if (verifiedState.salonId !== salon.id) {
      return redirectToInstagramDashboard(
        request,
        "Essa conexao foi iniciada para outro salao. Tente novamente no painel atual.",
        "error",
      );
    }

    if (!code) {
      return redirectToInstagramDashboard(
        request,
        "A Meta nao devolveu o codigo necessario para concluir a conexao.",
        "error",
      );
    }

    const redirectUri = new URL("/dashboard/instagram/connect/callback", request.url).toString();
    const accessToken = await exchangeMetaCodeForToken(code, redirectUri);
    const metaAccounts = await loadMetaAccounts(accessToken);
    const { data: existingConnection } = await supabase
      .from("instagram_connections")
      .select(
        "id,facebook_page_id,instagram_user_id,instagram_username,auto_publish_owned_posts,require_mention_approval,import_story_mentions",
      )
      .eq("salon_id", salon.id)
      .maybeSingle();

    const selectedAccount = pickInstagramPageAccount(metaAccounts, {
      facebookPageId: existingConnection?.facebook_page_id,
      instagramUserId: existingConnection?.instagram_user_id,
      instagramUsername: existingConnection?.instagram_username,
    });

    if (!selectedAccount?.instagram_business_account?.id || !selectedAccount.instagram_business_account.username) {
      return redirectToInstagramDashboard(
        request,
        "A Meta nao retornou uma pagina com Instagram profissional pronto para esse salao.",
        "error",
      );
    }

    const { error } = await supabase.from("instagram_connections").upsert(
      {
        salon_id: salon.id,
        instagram_user_id: String(selectedAccount.instagram_business_account.id),
        instagram_username: selectedAccount.instagram_business_account.username.replace(/^@/, ""),
        facebook_page_id: selectedAccount.id,
        access_token_ciphertext: encryptInstagramAccessToken(accessToken),
        connection_status: "active",
        auto_publish_owned_posts: existingConnection?.auto_publish_owned_posts ?? false,
        require_mention_approval: existingConnection?.require_mention_approval ?? true,
        import_story_mentions: existingConnection?.import_story_mentions ?? true,
        last_sync_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: "salon_id" },
    );

    if (error) {
      return redirectToInstagramDashboard(
        request,
        "Nao foi possivel salvar a conexao automatica com a Meta no painel.",
        "error",
      );
    }

    revalidatePath(INSTAGRAM_PATH);

    return redirectToInstagramDashboard(
      request,
      "Instagram conectado com a Meta e salvo automaticamente no painel.",
      "success",
    );
  } catch (error) {
    return redirectToInstagramDashboard(
      request,
      error instanceof Error
        ? error.message
        : "Nao foi possivel concluir a conexao automatica com a Meta.",
      "error",
    );
  }
}
