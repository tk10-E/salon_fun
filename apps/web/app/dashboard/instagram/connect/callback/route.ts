import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { buildRedirectNotice } from "@/app/_actions/shared";
import { getOwnerSalon } from "@/lib/auth";
import { autoPublishInstagramMentions } from "@/lib/instagram-feed-import";
import { encryptInstagramAccessToken } from "@/lib/instagram-crypto";
import {
  loadMetaAccounts,
  loadMetaPageAccessToken,
  subscribeMetaPageToWebhook,
  syncInstagramActivity,
} from "@/lib/instagram-sync";
import {
  buildInstagramMetaRedirectUri,
  getInstagramMetaAppId,
  getInstagramMetaAppSecret,
  INSTAGRAM_OAUTH_STATE_COOKIE,
  INSTAGRAM_META_GRAPH_VERSION,
  pickInstagramPageAccount,
  resolveInstagramOAuthState,
} from "@/lib/instagram-oauth";
import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_PATH = "/dashboard/instagram";
const FEED_PATH = "/dashboard/feed";

type MetaTokenResponse = {
  access_token?: string;
};

function redirectToInstagramDashboard(
  request: NextRequest,
  message: string,
  tone: "success" | "error" | "info" = "info",
) {
  const response = NextResponse.redirect(
    new URL(buildRedirectNotice(INSTAGRAM_PATH, message, tone), request.url),
  );
  response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });

  return response;
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
  const cookieState = request.cookies.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value;
  const code = request.nextUrl.searchParams.get("code");

  if (errorReason || errorDescription) {
    return redirectToInstagramDashboard(
      request,
      errorDescription ?? "A Meta cancelou a conexao automatica com o Instagram.",
      "error",
    );
  }

  try {
    const verifiedState = resolveInstagramOAuthState(state, cookieState);

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

    const redirectUri = buildInstagramMetaRedirectUri(
      "/dashboard/instagram/connect/callback",
      request.url,
    );
    const accessToken = await exchangeMetaCodeForToken(code, redirectUri);
    const metaAccounts = await loadMetaAccounts(accessToken);
    const { data: existingConnection } = await supabase
      .from("instagram_connections")
      .select(
        "id,facebook_page_id,instagram_user_id,instagram_username,facebook_page_access_token_ciphertext,auto_publish_owned_posts,require_mention_approval,import_story_mentions",
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

    const pageAccessToken =
      selectedAccount.access_token ??
      (await loadMetaPageAccessToken({
        userAccessToken: accessToken,
        pageId: selectedAccount.id,
      })) ??
      null;
    const encryptedAccessToken = encryptInstagramAccessToken(accessToken);
    const encryptedPageAccessToken = pageAccessToken
      ? encryptInstagramAccessToken(pageAccessToken)
      : existingConnection?.facebook_page_access_token_ciphertext ?? null;
    const connectionWarnings: string[] = [];

    if (pageAccessToken) {
      try {
        await subscribeMetaPageToWebhook({
          pageId: selectedAccount.id,
          pageAccessToken,
        });
      } catch (error) {
        connectionWarnings.push(
          error instanceof Error
            ? `Nao foi possivel ativar a assinatura automatica das menções na Meta: ${error.message}`
            : "Nao foi possivel ativar a assinatura automatica das menções na Meta.",
        );
      }
    } else if (selectedAccount.id) {
      connectionWarnings.push(
        "A Meta conectou a conta, mas nao devolveu um Page Access Token para a pagina do Facebook. O Instagram segue ativo e o Facebook pode ficar limitado ate uma nova autorizacao.",
      );
    }

    const { data: savedConnection, error } = await supabase.from("instagram_connections").upsert(
      {
        salon_id: salon.id,
        instagram_user_id: String(selectedAccount.instagram_business_account.id),
        instagram_username: selectedAccount.instagram_business_account.username.replace(/^@/, ""),
        facebook_page_id: selectedAccount.id,
        facebook_page_name: selectedAccount.name ?? null,
        facebook_page_access_token_ciphertext: encryptedPageAccessToken,
        access_token_ciphertext: encryptedAccessToken,
        connection_status: "active",
        auto_publish_owned_posts: existingConnection?.auto_publish_owned_posts ?? false,
        require_mention_approval: existingConnection?.require_mention_approval ?? true,
        import_story_mentions: existingConnection?.import_story_mentions ?? true,
        last_sync_at: new Date().toISOString(),
        last_error: connectionWarnings.length ? connectionWarnings.join(" | ").slice(0, 600) : null,
      },
      { onConflict: "salon_id" },
    )
      .select(
        "id,salon_id,instagram_user_id,instagram_username,facebook_page_id,facebook_page_name,facebook_page_access_token_ciphertext,access_token_ciphertext,require_mention_approval,import_story_mentions,auto_publish_owned_posts",
      )
      .single();

    if (error || !savedConnection) {
      return redirectToInstagramDashboard(
        request,
        "Nao foi possivel salvar a conexao automatica com a Meta no painel.",
        "error",
      );
    }

    try {
      let autoPublishedCount = 0;
      const syncResult = await syncInstagramActivity({
        supabase,
        connection: savedConnection,
      });

      if (syncResult.warnings.length) {
        connectionWarnings.push(...syncResult.warnings);
      }

      const autoPublishResult = await autoPublishInstagramMentions({
        supabase,
        salonId: salon.id,
        ownerUserId: user.id,
      });
      autoPublishedCount = autoPublishResult.publishedCount;

      if (autoPublishResult.warnings.length) {
        connectionWarnings.push(...autoPublishResult.warnings);
      }

      await supabase
        .from("instagram_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          last_error: connectionWarnings.length ? connectionWarnings.join(" | ").slice(0, 600) : null,
        })
        .eq("id", savedConnection.id);

      if (autoPublishedCount > 0) {
        revalidatePath(FEED_PATH);
      }
    } catch (error) {
      connectionWarnings.push(
        error instanceof Error
          ? `A sincronizacao inicial do Instagram falhou: ${error.message}`
          : "A sincronizacao inicial do Instagram falhou.",
      );

      await supabase
        .from("instagram_connections")
        .update({
          last_error: connectionWarnings.join(" | ").slice(0, 600),
        })
        .eq("id", savedConnection.id);
    }

    revalidatePath(INSTAGRAM_PATH);

    return redirectToInstagramDashboard(
      request,
      connectionWarnings.length
        ? "Instagram conectado. Se algo ainda nao aparecer, use o botao de sincronizacao no painel."
        : "Instagram conectado com a Meta e salvo automaticamente no painel.",
      connectionWarnings.length ? "info" : "success",
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message === "missing_instagram_oauth_state"
        ? "A conexao com a Meta voltou sem o estado de seguranca esperado."
        : error instanceof Error && error.message === "mismatched_instagram_oauth_state"
          ? "A conexao com a Meta voltou com um estado diferente do esperado. Tente iniciar novamente pelo painel."
          : error instanceof Error && error.message === "expired_instagram_oauth_state"
            ? "A tentativa de conexao com a Meta expirou. Inicie novamente pelo painel."
            : error instanceof Error && error.message === "invalid_instagram_oauth_state"
              ? "A Meta devolveu um estado invalido para a conexao automatica."
              : error instanceof Error
                ? error.message
                : "Nao foi possivel concluir a conexao automatica com a Meta.";

    return redirectToInstagramDashboard(
      request,
      message,
      "error",
    );
  }
}
