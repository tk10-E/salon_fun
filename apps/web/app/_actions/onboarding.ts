import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getSalonSegmentPreset, normalizeSalonBusinessSegment } from "@/lib/salonSegments";

import { buildRedirectNotice } from "./shared";

export async function createSalonActionImpl(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const businessSegment = normalizeSalonBusinessSegment(String(formData.get("businessSegment") ?? ""));
  const preset = getSalonSegmentPreset(businessSegment);
  const { supabase, user } = await requireUser();

  if (!name) {
    redirect(buildRedirectNotice("/onboarding", "Informe o nome do salão.", "error"));
  }

  const existingSalon = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: user.id })
    .maybeSingle();
  const existingSalonData = existingSalon.data as { id: string } | null;

  if (existingSalonData?.id) {
    redirect("/dashboard");
  }

  const { error } = await supabase.from("salons").insert({
    name,
    business_segment: businessSegment,
    brand_color: preset.suggestedBrandColor,
    owner_user_id: user.id,
  });

  if (error) {
    redirect(buildRedirectNotice("/onboarding", "Não foi possível criar o salão.", "error"));
  }

  revalidatePath("/dashboard");
  redirect(buildRedirectNotice("/dashboard", "Salão criado com sucesso.", "success"));
}
