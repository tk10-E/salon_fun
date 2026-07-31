import { NextResponse } from "next/server";

import { resolveAuthenticatedCustomerContext } from "@/lib/appointmentReviews";
import { createConfirmedCustomerAppointment } from "@/lib/customerAppointments";
import {
  getClientIp,
  guardApiRequest,
  hashSecurityIdentifier,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
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
  return hashSecurityIdentifier(`${clientIp}:customer-appointment-create`);
}

function normalizeRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  switch (message) {
    case "customer_has_active_appointment_on_selected_day":
    case "time_slot_unavailable":
      return { error: message, status: 409 };
    case "staff_member_not_available_for_service":
    case "salon_closed_on_selected_day":
    case "outside_business_hours":
    case "slot_step_mismatch":
    case "past_time_not_allowed":
    case "service_not_found":
    case "booking_policy_version_stale":
    case "invalid_payment_preference":
      return { error: message, status: 400 };
    case "customer_not_linked":
    case "unauthenticated":
      return { error: message, status: 401 };
    default:
      return { error: "appointment_create_unavailable", status: 500 };
  }
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_create_customer_appointment",
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

  const serviceId =
    typeof payload.serviceId === "string" ? payload.serviceId.trim() : "";
  const requestedDate =
    typeof payload.requestedDate === "string" ? payload.requestedDate.trim() : "";
  const preferredStaffMemberId =
    typeof payload.preferredStaffMemberId === "string"
      ? payload.preferredStaffMemberId.trim() || null
      : null;
  const paymentPreference =
    typeof payload.paymentPreference === "string"
      ? payload.paymentPreference.trim() || null
      : null;

  if (!serviceId || !requestedDate) {
    return NextResponse.json(
      { error: "service_and_date_required", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const context = await resolveAuthenticatedCustomerContext(accessToken);
    const appointment = await createConfirmedCustomerAppointment({
      accessToken,
      customerId: context.customerId,
      paymentPreference,
      preferredStaffMemberId,
      requestedDate,
      serviceId,
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
