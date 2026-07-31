import { NextResponse } from "next/server";

import {
  createCustomerFeedStory,
  normalizeCustomerFeedStoryRouteError,
} from "@/lib/customerFeedStories";
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
  return hashSecurityIdentifier(`${clientIp}:customer-feed-story`);
}

function mapRouteErrorStatus(errorCode: string) {
  switch (errorCode) {
    case "customer_story_image_required":
    case "customer_story_invalid_image":
      return 400;
    case "unauthenticated":
      return 401;
    default:
      return 500;
  }
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "public_create_customer_feed_story",
    allowMissingOrigin: true,
    blockSeconds: 300,
    limit: 10,
    rateLimitKey: buildRateLimitKey(request) ?? undefined,
    windowSeconds: 300,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const accessToken = readBearerToken(request);
  if (!accessToken) {
    return buildUnauthorizedResponse();
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "invalid_multipart_body", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  const image = formData.get("image");
  const captionEntry = formData.get("caption");
  const caption =
    typeof captionEntry === "string" && captionEntry.trim().length > 0
      ? captionEntry.trim()
      : null;

  if (!(image instanceof File) || image.size <= 0) {
    return NextResponse.json(
      { error: "customer_story_image_required", ok: false },
      {
        headers: NO_STORE_HEADERS,
        status: 400,
      },
    );
  }

  try {
    const story = await createCustomerFeedStory({
      accessToken,
      caption,
      imageFile: image,
    });

    return NextResponse.json(
      {
        ok: true,
        story,
      },
      {
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const errorCode = normalizeCustomerFeedStoryRouteError(error);
    return NextResponse.json(
      {
        error: errorCode,
        ok: false,
      },
      {
        headers: NO_STORE_HEADERS,
        status: mapRouteErrorStatus(errorCode),
      },
    );
  }
}
