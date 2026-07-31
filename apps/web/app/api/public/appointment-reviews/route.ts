import { NextResponse } from "next/server";

import {
  listResolvedAppointmentReviews,
  resolveAuthenticatedCustomerContext,
  saveAppointmentReview,
} from "@/lib/appointmentReviews";
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

function parseAppointmentIds(request: Request) {
  const rawValue =
    new URL(request.url).searchParams.get("appointment_ids")?.trim() ?? "";

  if (!rawValue) {
    return [];
  }

  return [...new Set(
    rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

function buildRateLimitKey(request: Request) {
  const clientIp = getClientIp(request.headers) ?? "unknown";
  return hashSecurityIdentifier(`${clientIp}:appointment-review`);
}

function normalizeRouteError(error: unknown) {
  const message =
    error instanceof Error ? error.message.trim() : String(error ?? "").trim();

  switch (message) {
    case "appointment_review_not_allowed":
      return { error: message, status: 403 };
    case "appointment_review_staff_required":
    case "invalid_review_rating":
    case "review_comment_too_long":
      return { error: message, status: 400 };
    case "unauthenticated":
      return { error: message, status: 401 };
    default:
      return { error: "appointment_review_unavailable", status: 500 };
  }
}

export async function GET(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_get_appointment_reviews",
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
      { ok: true, reviews: [] },
      {
        headers: NO_STORE_HEADERS,
      },
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
    const reviews = await listResolvedAppointmentReviews({
      appointmentIds,
      customerId: context.customerId,
      salonId: context.salonId,
    });

    return NextResponse.json(
      {
        ok: true,
        reviews: reviews.map((review) => ({
          appointmentId: review.appointmentId,
          comment: review.comment,
          createdAt: review.createdAt,
          rating: review.rating,
          source: review.source,
          staffMemberId: review.staffMemberId,
          updatedAt: review.updatedAt,
        })),
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

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_submit_appointment_review",
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
    typeof payload.appointmentId === "string" ? payload.appointmentId.trim() : "";
  const rating =
    typeof payload.rating === "number"
      ? payload.rating
      : Number(payload.rating ?? Number.NaN);
  const comment =
    typeof payload.comment === "string" ? payload.comment : null;

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
    const review = await saveAppointmentReview({
      accessToken,
      appointmentId,
      comment,
      ipAddress: getClientIp(request.headers),
      rating: Math.trunc(rating),
      requestPath: new URL(request.url).pathname,
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json(
      {
        ok: true,
        review: {
          appointmentId: review.appointmentId,
          comment: review.comment,
          createdAt: review.createdAt,
          rating: review.rating,
          source: review.source,
          staffMemberId: review.staffMemberId,
          updatedAt: review.updatedAt,
        },
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
