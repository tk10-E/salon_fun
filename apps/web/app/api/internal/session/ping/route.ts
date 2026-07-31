import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return new NextResponse(null, {
        headers: NO_STORE_HEADERS,
        status: 204,
      });
    }

    return NextResponse.json(
      {
        error: "unauthorized",
        ok: false,
      },
      {
        headers: NO_STORE_HEADERS,
        status: 401,
      },
    );
  }

  return new NextResponse(null, {
    headers: NO_STORE_HEADERS,
    status: 204,
  });
}
