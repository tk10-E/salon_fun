import { updateSalonBrandingActionImpl } from "@/app/_actions/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();

  await updateSalonBrandingActionImpl(formData);

  return new Response(null, { status: 204 });
}
