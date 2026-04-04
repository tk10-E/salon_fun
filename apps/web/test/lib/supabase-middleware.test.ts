import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/env", () => ({
  supabaseAnonKey: "test-anon-key",
  supabaseUrl: "https://project-ref.supabase.co",
}));

import { updateSession } from "@/lib/supabase/middleware";

const originalAppUrl = process.env.APP_URL;
const originalVercel = process.env.VERCEL;
const originalVercelEnv = process.env.VERCEL_ENV;

describe("supabase middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("redirects GET requests to the configured canonical production origin", async () => {
    process.env.APP_URL = "https://painel.jc7desenvovimento.online";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";

    const request = new NextRequest("https://painel.jc7desenvolvimento.online/login?message=old");

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://painel.jc7desenvovimento.online/login?message=old",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("keeps non-GET requests on the current origin and refreshes auth state", async () => {
    process.env.APP_URL = "https://painel.jc7desenvovimento.online";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";

    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    createServerClientMock.mockReturnValue({
      auth: {
        getUser,
      },
    });

    const request = new NextRequest("https://painel.jc7desenvolvimento.online/login", {
      method: "POST",
    });

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalled();
  });
});
