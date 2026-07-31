import { NextResponse } from "next/server";

import {
  cancelMembershipPlanAppointment,
  listResolvedAppointmentPlanReservations,
  scheduleMembershipPlanAppointments,
} from "@/lib/appointmentPlanReservations";
import {
  getClientIp,
  guardApiRequest,
  hashSecurityIdentifier,
} from "@/lib/security";
import { resolveAuthenticatedCustomerContext } from "@/lib/appointmentReviews";

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

function parseAppointmentIds(request: Request) {
  const rawValue =
    new URL(request.url).searchParams.get("appointment_ids")?.trim() ?? "";

  if (!rawValue) {
    return [];
  }

  return [
    ...new Set(
      rawValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function buildRateLimitKey(request: Request) {
  const clientIp = getClientIp(request.headers) ?? "unknown";
  return hashSecurityIdentifier(`${clientIp}:appointment-plan-reservation`);
}

function normalizeRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  const normalized = message.toLowerCase();

  switch (normalized) {
    case "unauthenticated":
      return { error: normalized, status: 401 };
    case "membership_plan_not_found":
    case "membership_plan_reservation_not_found":
      return { error: normalized, status: 404 };
    case "membership_plan_no_sessions_remaining":
    case "membership_plan_outside_period":
    case "membership_plan_series_already_fixed":
      return { error: normalized, status: 409 };
    case "membership_plan_invalid_slot":
      return { error: normalized, status: 400 };
    default:
      return { error: "membership_plan_unavailable", status: 500 };
  }
}

export async function GET(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_get_appointment_plan_reservations",
    allowMissingOrigin: true,
    blockSeconds: 120,
    limit: 60,
    rateLimitKey: buildRateLimitKey(request) ?? undefined,
    windowSeconds: 60,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return buildUnauthorizedResponse();
  }

  const appointmentIds = parseAppointmentIds(request);
  if (!appointmentIds.length) {
    return NextResponse.json(
      { ok: true, reservations: [] },
      { headers: NO_STORE_HEADERS },
    );
  }

  if (appointmentIds.length > 100) {
    return NextResponse.json(
      { error: "too_many_appointment_ids", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const context = await resolveAuthenticatedCustomerContext(accessToken);
    const reservations = await listResolvedAppointmentPlanReservations({
      appointmentIds,
      customerId: context.customerId,
      salonId: context.salonId,
    });

    return NextResponse.json(
      {
        ok: true,
        reservations: reservations.map((reservation) => ({
          appointmentId: reservation.appointmentId,
          membershipExpiresAt: reservation.membershipExpiresAt,
          membershipId: reservation.membershipId,
          membershipStartedAt: reservation.membershipStartedAt,
          membershipTitle: reservation.membershipTitle,
          reservationStatus: reservation.reservationStatus,
          serviceId: reservation.serviceId,
          sessionIndex: reservation.sessionIndex,
          sessionsIncluded: reservation.sessionsIncluded,
          source: reservation.source,
        })),
      },
      { headers: NO_STORE_HEADERS },
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

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_mutate_appointment_plan_reservations",
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

  const action =
    typeof payload.action === "string" ? payload.action.trim() : "";

  try {
    if (action === "schedule_membership_plan") {
      const result = await scheduleMembershipPlanAppointments({
        accessToken,
        membershipId:
          typeof payload.membershipId === "string"
            ? payload.membershipId.trim()
            : null,
        preferredStaffMemberId:
          typeof payload.preferredStaffMemberId === "string"
            ? payload.preferredStaffMemberId.trim()
            : "",
        preferredStartAt:
          typeof payload.preferredStartAt === "string"
            ? payload.preferredStartAt.trim()
            : "",
        requestPath: new URL(request.url).pathname,
        serviceId:
          typeof payload.serviceId === "string" ? payload.serviceId.trim() : "",
        userAgent: request.headers.get("user-agent"),
      });

      return NextResponse.json(
        {
          ok: true,
          result: {
            createdAppointments: result.createdAppointments,
            membershipExpiresAt: result.membershipExpiresAt,
            membershipId: result.membershipId,
            membershipTitle: result.membershipTitle,
            scheduledCount: result.scheduledCount,
            sessionsIncluded: result.sessionsIncluded,
            skippedCount: result.skippedCount,
          },
        },
        { headers: NO_STORE_HEADERS },
      );
    }

    if (action === "cancel_membership_plan_appointment") {
      const appointmentId =
        typeof payload.appointmentId === "string"
          ? payload.appointmentId.trim()
          : "";
      const cancellationReason =
        typeof payload.cancellationReason === "string"
          ? payload.cancellationReason.trim()
          : "";

      if (!appointmentId || !cancellationReason) {
        return NextResponse.json(
          { error: "appointment_id_and_reason_required", ok: false },
          {
            headers: NO_STORE_HEADERS,
            status: 400,
          },
        );
      }

      await cancelMembershipPlanAppointment({
        accessToken,
        appointmentId,
        cancellationReason,
        requestPath: new URL(request.url).pathname,
      });

      return NextResponse.json(
        { ok: true },
        { headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { error: "invalid_action", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
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
