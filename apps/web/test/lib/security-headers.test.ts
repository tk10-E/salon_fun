import { afterEach, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { applySecurityHeaders } from "@/lib/securityHeaders";

const originalFirebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

afterEach(() => {
  if (originalFirebaseAuthDomain === undefined) {
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  } else {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = originalFirebaseAuthDomain;
  }
});

describe("security headers", () => {
  it("allows the configured Firebase auth domain in the CSP frame and connect directives", () => {
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "salon-fun-73373.firebaseapp.com";

    const request = new NextRequest("https://painel.jc7desenvovimento.online/login");
    const response = applySecurityHeaders(
      NextResponse.next({
        request,
      }),
      request,
    );

    const contentSecurityPolicy = response.headers.get("Content-Security-Policy");

    expect(contentSecurityPolicy).toContain(
      "frame-src 'self' https://accounts.google.com https://salon-fun-73373.firebaseapp.com",
    );
    expect(contentSecurityPolicy).toContain(
      "connect-src 'self' https://test.supabase.co wss://test.supabase.co https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com https://www.googleapis.com https://apis.google.com https://accounts.google.com https://salon-fun-73373.firebaseapp.com",
    );
  });
});
