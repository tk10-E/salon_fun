import { NextRequest, NextResponse } from "next/server";

import { getOwnerSalon, hasInternalAiObservabilityAccess } from "@/lib/auth";
import {
  formatAiObservabilityCsv,
  getAiObservabilityExportFilename,
  getAiObservabilitySnapshot,
  parseAiObservabilityDayFilter,
  parseAiObservabilityOutcomeFilter,
  parseAiObservabilityPeriodDays,
} from "@/lib/ai/observability";
import {
  getClientIp,
  getUserAgent,
  guardApiRequest,
  hashSecurityIdentifier,
  recordSecurityAuditEvent,
} from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const debugMode = request.nextUrl.searchParams.get("debug") === "ai";

  if (!debugMode) {
    return new NextResponse("Not Found", {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
      status: 404,
    });
  }

  const guardResponse = await guardApiRequest(request, {
    actionName: "ai_observability_export",
    allowMissingOrigin: true,
    blockSeconds: 900,
    limit: 8,
    rateLimitKey:
      hashSecurityIdentifier(
        `${getClientIp(request.headers) ?? "unknown"}:${request.nextUrl.search}`,
      ) ?? undefined,
    windowSeconds: 600,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!hasInternalAiObservabilityAccess(user)) {
    return new NextResponse("Not Found", {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
      status: 404,
    });
  }

  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const periodDays = parseAiObservabilityPeriodDays(
    request.nextUrl.searchParams.get("period"),
  );
  const day = parseAiObservabilityDayFilter(
    request.nextUrl.searchParams.get("day"),
  );
  const feature = request.nextUrl.searchParams.get("feature")?.trim() ?? null;
  const model = request.nextUrl.searchParams.get("model")?.trim() ?? null;
  const outcome = parseAiObservabilityOutcomeFilter(
    request.nextUrl.searchParams.get("outcome"),
  );
  const promptProfile =
    request.nextUrl.searchParams.get("promptProfile")?.trim() ?? null;
  const skillId = request.nextUrl.searchParams.get("skill")?.trim() ?? null;

  const snapshot = await getAiObservabilitySnapshot({
    entryLimit: 5000,
    filters: {
      day,
      feature,
      model,
      outcome,
      periodDays,
      promptProfile,
      skillId,
    },
    limit: 5000,
    salonId: salon.id,
  });
  const csvContent = formatAiObservabilityCsv(snapshot.entries);

  await recordSecurityAuditEvent({
    actorUserId: user.id,
    eventType: "ai_observability_export.generated",
    ipAddress: getClientIp(request.headers),
    metadata: {
      day,
      exportedRows: snapshot.entries.length,
      feature,
      filteredCount: snapshot.totals.filteredCount,
      model,
      outcome,
      periodDays,
      promptProfile,
      skillId,
      truncated: snapshot.totals.truncated,
    },
    requestPath: request.nextUrl.pathname,
    salonId: salon.id,
    severity: "info",
    userAgent: getUserAgent(request.headers),
  });

  return new NextResponse(csvContent, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${getAiObservabilityExportFilename({
        day,
        periodDays,
        salonId: salon.id,
      })}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
    status: 200,
  });
}
