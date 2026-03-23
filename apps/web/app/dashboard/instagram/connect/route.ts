import { NextRequest, NextResponse } from "next/server";

import { buildRedirectNotice } from "@/app/_actions/shared";
import { getOwnerSalon } from "@/lib/auth";
import {
  buildInstagramMetaAuthorizeUrl,
  createInstagramOAuthState,
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
    const redirectUri = new URL("/dashboard/instagram/connect/callback", request.url).toString();
    const state = createInstagramOAuthState(salon.id);
    const authorizationUrl = buildInstagramMetaAuthorizeUrl({
      redirectUri,
      state,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return redirectToInstagramDashboard(
      request,
      error instanceof Error
        ? error.message
        : "Nao foi possivel iniciar a conexao automatica com a Meta.",
      "error",
    );
  }
}
