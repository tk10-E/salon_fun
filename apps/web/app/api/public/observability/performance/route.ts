import { NextResponse } from "next/server";

import { parsePublicPerformanceEvent } from "@/lib/publicPerformanceEvent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = parsePublicPerformanceEvent({
    payload,
    userAgent: request.headers.get("user-agent"),
  });

  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const requestId = request.headers.get("x-vercel-id");
  const log = {
    cache_status: event.cacheStatus,
    duration_ms: event.durationMs,
    join_code: event.joinCode,
    level: event.severity === "critical" ? "warn" : "info",
    outcome: event.outcome,
    operation: event.operation,
    request_id: requestId,
    route: event.route,
    severity: event.severity,
    source: event.source,
    surface: event.surface,
    type: "client_performance",
    user_agent: event.userAgent,
  };

  if (event.severity === "critical") {
    console.warn(JSON.stringify(log));
  } else {
    console.info(JSON.stringify(log));
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
