import { NextResponse } from "next/server";

import { getWhatsAppDispatchSecret } from "@/lib/serverEnv";
import { dispatchPendingWhatsAppNotifications } from "@/lib/whatsappDispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = getWhatsAppDispatchSecret();

  if (!secret) {
    return {
      ok: false as const,
      status: 503,
      message:
        "WhatsApp dispatch secret is missing. Configure WHATSAPP_DISPATCH_SECRET or CRON_SECRET.",
    };
  }

  const authorization = request.headers.get("authorization")?.trim() ?? "";

  if (authorization !== `Bearer ${secret}`) {
    return {
      ok: false as const,
      status: 401,
      message: "Unauthorized dispatch request.",
    };
  }

  return {
    ok: true as const,
  };
}

async function handleDispatch(request: Request) {
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.message },
      { status: authorization.status },
    );
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(250, Math.round(requestedLimit)))
    : 100;

  const result = await dispatchPendingWhatsAppNotifications({ limit });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        reason: result.reason,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    failed: result.failed,
    missingConfigSalons: result.missingConfigSalons.length,
    missingPhone: result.missingPhone,
    processed: result.processed,
    sent: result.sent,
  });
}

export async function GET(request: Request) {
  return handleDispatch(request);
}

export async function POST(request: Request) {
  return handleDispatch(request);
}
