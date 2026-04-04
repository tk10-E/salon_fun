import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

function getCanonicalOrigin() {
  const value = process.env.APP_URL?.trim();
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function shouldRedirectToCanonicalOrigin(request: NextRequest) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") {
    return false;
  }

  return request.method === "GET" || request.method === "HEAD";
}

export async function updateSession(request: NextRequest) {
  const canonicalOrigin = getCanonicalOrigin();

  if (canonicalOrigin && shouldRedirectToCanonicalOrigin(request)) {
    const requestUrl = new URL(request.url);
    const canonicalUrl = new URL(canonicalOrigin);

    if (requestUrl.origin !== canonicalUrl.origin) {
      requestUrl.protocol = canonicalUrl.protocol;
      requestUrl.host = canonicalUrl.host;
      return NextResponse.redirect(requestUrl, 307);
    }
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request,
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request,
        });
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
