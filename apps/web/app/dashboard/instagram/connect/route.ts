import { NextRequest, NextResponse } from "next/server";

import { buildRedirectNotice } from "@/app/_actions/shared";
import { getOwnerSalon } from "@/lib/auth";
import {
  buildInstagramMetaRedirectUri,
  buildInstagramMetaAuthorizeUrl,
  createInstagramOAuthState,
  INSTAGRAM_OAUTH_STATE_COOKIE,
} from "@/lib/instagram-oauth";
import { createClient } from "@/lib/supabase/server";

const INSTAGRAM_PATH = "/dashboard/instagram";

function redirectToInstagramDashboard(
  request: NextRequest,
  message: string,
  tone: "success" | "error" | "info" = "info",
) {
  return NextResponse.redirect(
    new URL(buildRedirectNotice(INSTAGRAM_PATH, message, tone), request.url),
  );
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

  try {
    const redirectUri = buildInstagramMetaRedirectUri(
      "/dashboard/instagram/connect/callback",
      request.url,
    );
    const state = createInstagramOAuthState(salon.id);
    const authorizationUrl = buildInstagramMetaAuthorizeUrl({
      redirectUri,
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(INSTAGRAM_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });

    return response;
  } catch (error) {
    return redirectToInstagramDashboard(
      request,
      error instanceof Error && error.message.trim().length > 0
        ? "Nao foi possivel abrir a conexao do Instagram agora."
        : "Nao foi possivel abrir a conexao do Instagram agora.",
      "error",
    );
  }
}
