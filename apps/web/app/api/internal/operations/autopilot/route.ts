import { NextResponse } from "next/server";

import { runOperationsAutopilot } from "@/lib/operationsAutopilot";
import { getCronSecret } from "@/lib/serverEnv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = getCronSecret();

  if (!cronSecret) {
    return {
      ok: false as const,
      status: 503,
      error: "cron_secret_missing",
    };
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return {
      ok: false as const,
      status: 401,
      error: "unauthorized",
    };
  }

  return {
    ok: true as const,
  };
}

async function handleAutopilotRequest(request: Request) {
  const authorization = isAuthorized(request);

  if (!authorization.ok) {
    return NextResponse.json(
      {
        error: authorization.error,
        ok: false,
      },
      { status: authorization.status },
    );
  }

  try {
    const summary = await runOperationsAutopilot();

    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    console.error("[operations-autopilot] run_failed", {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "run_failed",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "run_failed",
        ok: false,
      },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  return handleAutopilotRequest(request);
}

export async function POST(request: Request) {
  return handleAutopilotRequest(request);
}
