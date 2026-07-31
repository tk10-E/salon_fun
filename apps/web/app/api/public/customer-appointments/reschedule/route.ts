import { NextResponse } from "next/server";

import { rescheduleCustomerAppointment } from "@/lib/customerAppointments";
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
  return hashSecurityIdentifier(`${clientIp}:customer-appointment-reschedule`);
}

function normalizeRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  switch (message) {
    case "customer_has_active_appointment_on_selected_day":
    case "appointment_reschedule_invalid_slot":
    case "appointment_reschedule_time_slot_unavailable":
      return { error: message, status: 409 };
    case "appointment_reschedule_not_allowed":
    case "appointment_reschedule_service_mismatch":
    case "membership_plan_staff_locked":
    case "membership_plan_outside_period":
      return { error: message, status: 403 };
    case "service_not_found":
      return { error: message, status: 400 };
    case "unauthenticated":
      return { error: message, status: 401 };
    default:
      return { error: "appointment_reschedule_unavailable", status: 500 };
  }
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_reschedule_customer_appointment",
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
  const serviceId =
    typeof payload.serviceId === "string" ? payload.serviceId.trim() : "";
  const requestedDate =
    typeof payload.requestedDate === "string" ? payload.requestedDate.trim() : "";
  const preferredStaffMemberId =
    typeof payload.preferredStaffMemberId === "string"
      ? payload.preferredStaffMemberId.trim()
      : "";

  if (
    !appointmentId ||
    !serviceId ||
    !requestedDate ||
    !preferredStaffMemberId
  ) {
    return NextResponse.json(
      { error: "appointment_reschedule_payload_required", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const appointment = await rescheduleCustomerAppointment({
      accessToken,
      appointmentId,
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
