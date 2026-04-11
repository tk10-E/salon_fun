import { NextResponse } from "next/server";

import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";

type PublicSalonRouteProps = {
  params: {
    joinCode: string;
  };
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: PublicSalonRouteProps,
) {
  const joinCode = params.joinCode.trim().toUpperCase();

  if (!joinCode) {
    return NextResponse.json(
      { error: "join_code_required" },
      { status: 400 },
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
        "Cache-Control": "no-store, max-age=0",
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
