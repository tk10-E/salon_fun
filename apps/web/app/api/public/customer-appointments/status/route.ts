import { NextResponse } from "next/server";

import { completeCustomerAppointment } from "@/lib/customerAppointments";
import {
  getClientIp,
  guardApiRequest,
  hashSecurityIdentifier,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  Expires: "0",
  Pragma: "no-cache",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

function buildUnauthorizedResponse() {
  return NextResponse.json(
    { error: "unauthenticated", ok: false },
    {
      headers: NO_STORE_HEADERS,
      status: 401,
    },
  );
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
}

function buildRateLimitKey(request: Request) {
  const clientIp = getClientIp(request.headers) ?? "unknown";
  return hashSecurityIdentifier(`${clientIp}:customer-appointment-status`);
}

function normalizeRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  switch (message) {
    case "appointment_completion_too_early":
      return { error: message, status: 409 };
    case "appointment_completion_not_allowed":
      return { error: message, status: 403 };
    case "unauthenticated":
      return { error: message, status: 401 };
    default:
      return { error: "appointment_complete_unavailable", status: 500 };
  }
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_complete_customer_appointment",
    allowMissingOrigin: true,
    blockSeconds: 300,
    limit: 20,
    rateLimitKey: buildRateLimitKey(request) ?? undefined,
    windowSeconds: 120,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return buildUnauthorizedResponse();
  }

  let payload: Record<string, unknown>;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json_body", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  const appointmentId =
    typeof payload.appointmentId === "string"
      ? payload.appointmentId.trim()
      : "";

  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointment_id_required", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const appointment = await completeCustomerAppointment({
      accessToken,
      appointmentId,
    });

    return NextResponse.json(
      {
        appointment,
        ok: true,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const normalized = normalizeRouteError(error);
    return NextResponse.json(
      {
        error: normalized.error,
        ok: false,
      },
      {
        headers: NO_STORE_HEADERS,
        status: normalized.status,
      },
    );
  }
}
