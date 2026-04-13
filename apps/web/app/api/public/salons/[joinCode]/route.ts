import { NextResponse } from "next/server";

import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";
import {
  getClientIp,
  guardApiRequest,
  hashSecurityIdentifier,
} from "@/lib/security";

type PublicSalonRouteProps = {
  params: Promise<{
    joinCode: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params: paramsPromise }: PublicSalonRouteProps,
) {
  const params = await paramsPromise;
  const joinCode = params.joinCode.trim().toUpperCase();

  const guardResponse = await guardApiRequest(request, {
    actionName: "public_salon_preview",
    blockSeconds: 180,
    limit: 90,
    rateLimitKey:
      hashSecurityIdentifier(
        `${getClientIp(request.headers) ?? "unknown"}:${joinCode}`,
      ) ?? undefined,
    windowSeconds: 60,
  });

  if (guardResponse) {
    return guardResponse;
  }

  if (!/^[A-Z0-9]{4,12}$/.test(joinCode)) {
    return NextResponse.json(
      { error: "salon_not_found" },
      { status: 404 },
    );
  }

  const landingData = await fetchPublicSalonLandingData(joinCode);

  if (!landingData) {
    return NextResponse.json(
      { error: "salon_not_found" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      joinCode,
      fetchedAt: new Date().toISOString(),
      preview: landingData.preview,
      featuredServices: landingData.featuredServices,
      activeOffers: landingData.activeOffers,
      recentPosts: landingData.recentPosts,
      centralCampaigns: landingData.centralCampaigns,
      stats: landingData.stats,
      links: {
        whatsappUrl: buildWhatsAppUrl(landingData.preview.whatsappPhone),
        instagramUrl: landingData.preview.instagramUrl,
        mapUrl: landingData.preview.mapUrl,
        supportUrl: landingData.preview.supportUrl,
        supportEmail: landingData.preview.supportEmail,
        privacyPolicyUrl: landingData.preview.privacyPolicyUrl,
        termsOfUseUrl: landingData.preview.termsOfUseUrl,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}

function buildWhatsAppUrl(phone: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
