import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { buildRedirectNotice } from "@/app/_actions/shared";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function resolveRequestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();

  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const origin = resolveRequestOrigin(request);

  if (code) {
    const successResponse = NextResponse.redirect(`${origin}${nextPath}`);
    const supabase = createRouteHandlerClient(request, successResponse);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return successResponse;
    }
  }

  return NextResponse.redirect(
    `${origin}${buildRedirectNotice("/login", "Não foi possível concluir o login com Google.", "error")}`,
  );
}
