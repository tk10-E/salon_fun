import { Buffer } from "node:buffer";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { SALON_TIMEZONE_OPTIONS, SLOT_STEP_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

const SETTINGS_PATH = "/dashboard/settings";
const DASHBOARD_PATH = "/dashboard";

function normalizeBusinessTimeInput(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${value}:00`;
}

export async function regenerateSalonCodeActionImpl() {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const generated = await supabase.rpc("generate_join_code");

  if (generated.error || !generated.data) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível gerar um novo código.", "error"));
  }

  const { error } = await supabase
    .from("salons")
    .update({ join_code: generated.data })
    .eq("id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível atualizar o código.", "error"));
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(buildRedirectNotice(SETTINGS_PATH, "Novo código gerado com sucesso.", "success"));
}

export async function updateSalonBrandingActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const rawName = String(formData.get("name") ?? "").trim();
  const rawTagline = String(formData.get("tagline") ?? "").trim();
  const rawBrandColor = String(formData.get("brandColor") ?? "").trim().toUpperCase();
  const rawWhatsapp = String(formData.get("whatsappPhone") ?? "").trim();
  const shouldRemoveLogo = formData.get("removeLogo") === "on";
  const logoInput = formData.get("logo");
  const logoFile = logoInput instanceof File && logoInput.size > 0 ? logoInput : null;

  if (!rawName) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Informe o nome do salão.", "error"));
  }

  const brandColor = /^#[0-9A-F]{6}$/.test(rawBrandColor) ? rawBrandColor : "#C56B43";
  const whatsappDigits = rawWhatsapp.replace(/\D/g, "");

  if (rawWhatsapp && (whatsappDigits.length < 10 || whatsappDigits.length > 15)) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Informe um WhatsApp válido com DDD e código do país, se necessário.",
        "error",
      ),
    );
  }

  let logoPath = shouldRemoveLogo ? null : salon.logo_path ?? null;

  if (shouldRemoveLogo && salon.logo_path && !logoFile) {
    const { error: removeError } = await supabase.storage.from("salon-assets").remove([salon.logo_path]);

    if (removeError) {
      redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível remover a logo atual.", "error"));
    }
  }

  if (logoFile) {
    if (!logoFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(SETTINGS_PATH, "Envie uma imagem válida para a logo.", "error"));
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice(SETTINGS_PATH, "A logo deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await logoFile.arrayBuffer());
    const uploadPath = `${salon.id}/logo`;

    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(uploadPath, bytes, {
      contentType: logoFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível enviar a logo do salão.", "error"));
    }

    logoPath = uploadPath;
  }

  const { error } = await supabase
    .from("salons")
    .update({
      name: rawName,
      tagline: rawTagline || null,
      brand_color: brandColor,
      whatsapp_phone: whatsappDigits || null,
      logo_path: logoPath,
    })
    .eq("id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível atualizar a identidade do salão.", "error"));
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(buildRedirectNotice(SETTINGS_PATH, "Identidade do salão atualizada com sucesso.", "success"));
}

export async function updateSalonScheduleActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const timezone = String(formData.get("timezone") ?? "").trim();
  const slotStepMinutes = Number(formData.get("slotStepMinutes"));

  if (!SALON_TIMEZONE_OPTIONS.some((option) => option.value === timezone)) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Selecione um fuso horário válido para o salão.", "error"));
  }

  if (!SLOT_STEP_OPTIONS.some((option) => option.value === slotStepMinutes)) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Escolha um intervalo válido para a agenda online.", "error"));
  }

  const businessHours = WEEKDAY_OPTIONS.map((weekday) => {
    const isOpen = formData.get(`isOpen_${weekday.value}`) === "on";
    const opensAt = String(formData.get(`opensAt_${weekday.value}`) ?? "").trim();
    const closesAt = String(formData.get(`closesAt_${weekday.value}`) ?? "").trim();

    if (!isOpen) {
      return {
        salon_id: salon.id,
        weekday: weekday.value,
        is_open: false,
        opens_at: null,
        closes_at: null,
      };
    }

    const normalizedOpen = normalizeBusinessTimeInput(opensAt);
    const normalizedClose = normalizeBusinessTimeInput(closesAt);

    if (!normalizedOpen || !normalizedClose) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          `Preencha um horário válido para ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    if (normalizedOpen >= normalizedClose) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          `O horário de abertura precisa ser antes do fechamento em ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    return {
      salon_id: salon.id,
      weekday: weekday.value,
      is_open: true,
      opens_at: normalizedOpen,
      closes_at: normalizedClose,
    };
  });

  const { error: salonError } = await supabase
    .from("salons")
    .update({
      timezone,
      slot_step_minutes: slotStepMinutes,
    })
    .eq("id", salon.id);

  if (salonError) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível atualizar os dados da agenda.", "error"));
  }

  const { error: businessHoursError } = await supabase.from("salon_business_hours").upsert(businessHours, {
    onConflict: "salon_id,weekday",
  });

  if (businessHoursError) {
    redirect(buildRedirectNotice(SETTINGS_PATH, "Não foi possível salvar os horários do salão.", "error"));
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(buildRedirectNotice(SETTINGS_PATH, "Agenda online atualizada com sucesso.", "success"));
}
