import { updateSalonBrandingActionImpl } from "@/app/_actions/settings";
import { guardApiRequest } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_branding_upload",
    blockSeconds: 900,
    limit: 15,
    windowSeconds: 600,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const formData = await request.formData();

  await updateSalonBrandingActionImpl(formData);

  return new Response(null, { status: 204 });
}
