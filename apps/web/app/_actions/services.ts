import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingEntitlements } from "@/lib/billing";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import { createClient } from "@/lib/supabase/server";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";

import {
  buildRedirectNotice,
  buildServiceCatalogNotification,
  queueCustomerNotification,
} from "./shared";

const SERVICES_PATH = "/dashboard/services";
const DASHBOARD_PATH = "/dashboard";
const TEAM_PATH = "/dashboard/team";
const FEED_PATH = "/dashboard/feed";
const SERVICE_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.service;

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function buildServiceImagePath(salonId: string, fileId: string, extension: string) {
  return `${salonId}/services/${fileId}.${extension}`;
}

async function ensureServiceCategoryId(args: {
  salonId: string;
  categoryName: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const normalizedCategory = args.categoryName.trim();
  const categoriesTable = (args.supabase as any).from("service_categories");
  const existingResult = await categoriesTable
    .select("id")
    .eq("salon_id", args.salonId)
    .ilike("name", normalizedCategory)
    .limit(1)
    .maybeSingle();

  if (existingResult.data?.id) {
    return existingResult.data.id as string;
  }

  const insertResult = await categoriesTable
    .insert({
      salon_id: args.salonId,
      name: normalizedCategory,
      is_active: true,
    })
    .select("id")
    .single();

  if (!insertResult.data?.id) {
    throw new Error("service_category_sync_failed");
  }

  return insertResult.data.id as string;
}

export async function createServiceActionImpl(formData: FormData) {
  const category = String(formData.get("category") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const duration = Number(formData.get("duration"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const imageFile = readUploadedFile(formData, "image");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const billing = await getSalonBillingEntitlements(salon.id);

  if (
    !category ||
    !name ||
    Number.isNaN(price) ||
    Number.isNaN(duration) ||
    Number.isNaN(sortOrder) ||
    sortOrder < 0
  ) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Preencha todos os campos do serviço.", "error"));
  }

  if (billing.maxServices !== null) {
    const { count } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id);

    if ((count ?? 0) >= billing.maxServices) {
      redirect(
        buildRedirectNotice(
          SERVICES_PATH,
          `Seu plano ${billing.currentPlan.displayName} permite até ${billing.maxServices} serviços. Faça upgrade no Billing para continuar.`,
          "error",
        ),
      );
    }
  }

  let imagePath: string | null = null;
  let categoryId = "";

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Envie uma imagem válida para o serviço.", "error"));
    }

    if (imageFile.size > SERVICE_IMAGE_PRESET.maxInputBytes) {
      redirect(
        buildRedirectNotice(
          SERVICES_PATH,
          `A foto do servico deve ter no maximo ${formatPresetMegabytes(
            SERVICE_IMAGE_PRESET.maxInputBytes,
          )} MB.`,
          "error",
        ),
      );
    }

    let optimizedImage;

    try {
      optimizedImage = await optimizeUploadedImage(imageFile, "service");
    } catch {
      redirect(
        buildRedirectNotice(
          SERVICES_PATH,
          "Nao foi possivel processar a foto do servico.",
          "error",
        ),
      );
    }

    imagePath = buildServiceImagePath(
      salon.id,
      randomUUID(),
      optimizedImage.extension,
    );

    const { error: uploadError } = await supabase.storage
      .from("salon-assets")
      .upload(imagePath, optimizedImage.buffer, {
        contentType: optimizedImage.contentType,
        upsert: true,
      });

    if (uploadError) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível enviar a foto do serviço.", "error"));
    }
  }

  try {
    categoryId = await ensureServiceCategoryId({
      salonId: salon.id,
      categoryName: category,
      supabase,
    });
  } catch {
    if (imagePath) {
      await supabase.storage.from("salon-assets").remove([imagePath]).catch(() => undefined);
    }
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível preparar a categoria desse serviço.", "error"));
  }

  const { error } = await (supabase as any).from("services").insert({
    salon_id: salon.id,
    service_category_id: categoryId,
    name,
    description: description || null,
    price,
    duration,
    sort_order: sortOrder,
    image_path: imagePath,
  });

  if (error) {
    if (imagePath) {
      await supabase.storage.from("salon-assets").remove([imagePath]);
    }
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível salvar o serviço.", "error"));
  }

  const notification = buildServiceCatalogNotification({
    action: "published",
    serviceName: name,
    category,
  });
  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
  });

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SERVICES_PATH);
  revalidatePath(TEAM_PATH);
  redirect(buildRedirectNotice(SERVICES_PATH, "Serviço adicionado com sucesso.", "success"));
}

export async function updateServiceCatalogActionImpl(formData: FormData) {
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const duration = Number(formData.get("duration"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const removeImage = formData.get("removeImage") === "on";
  const imageFile = readUploadedFile(formData, "image");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !serviceId ||
    !category ||
    !name ||
    Number.isNaN(price) ||
    Number.isNaN(duration) ||
    Number.isNaN(sortOrder) ||
    sortOrder < 0
  ) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Dados inválidos para atualizar o serviço.", "error"));
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, image_path")
    .eq("id", serviceId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (serviceError || !service) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível localizar esse serviço.", "error"));
  }

  let imagePath = service.image_path ?? null;
  let categoryId = "";

  if (removeImage && imagePath && !imageFile) {
    const { error: removeError } = await supabase.storage.from("salon-assets").remove([imagePath]);

    if (removeError) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível remover a foto do serviço.", "error"));
    }

    imagePath = null;
  }

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Envie uma imagem válida para o serviço.", "error"));
    }

    if (imageFile.size > SERVICE_IMAGE_PRESET.maxInputBytes) {
      redirect(
        buildRedirectNotice(
          SERVICES_PATH,
          `A foto do servico deve ter no maximo ${formatPresetMegabytes(
            SERVICE_IMAGE_PRESET.maxInputBytes,
          )} MB.`,
          "error",
        ),
      );
    }

    let optimizedImage;

    try {
      optimizedImage = await optimizeUploadedImage(imageFile, "service");
    } catch {
      redirect(
        buildRedirectNotice(
          SERVICES_PATH,
          "Nao foi possivel processar a foto do servico.",
          "error",
        ),
      );
    }

    const uploadPath = buildServiceImagePath(
      salon.id,
      service.id,
      optimizedImage.extension,
    );
    const { error: uploadError } = await supabase.storage
      .from("salon-assets")
      .upload(uploadPath, optimizedImage.buffer, {
        contentType: optimizedImage.contentType,
        upsert: true,
      });

    if (uploadError) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível atualizar a foto do serviço.", "error"));
    }

    imagePath = uploadPath;
  }

  try {
    categoryId = await ensureServiceCategoryId({
      salonId: salon.id,
      categoryName: category,
      supabase,
    });
  } catch {
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível preparar a categoria desse serviço.", "error"));
  }

  const { error } = await (supabase as any)
    .from("services")
    .update({
      service_category_id: categoryId,
      name,
      description: description || null,
      price,
      duration,
      sort_order: sortOrder,
      image_path: imagePath,
    })
    .eq("id", service.id)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível atualizar o serviço.", "error"));
  }

  const notification = buildServiceCatalogNotification({
    action: "updated",
    serviceId: service.id,
    serviceName: name,
    category,
  });
  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
  });

  if (imageFile && service.image_path && service.image_path !== imagePath) {
    await supabase.storage.from("salon-assets").remove([service.image_path]);
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SERVICES_PATH);
  revalidatePath(TEAM_PATH);
  redirect(buildRedirectNotice(SERVICES_PATH, "Serviço atualizado com sucesso.", "success"));
}

export async function deleteServiceActionImpl(formData: FormData) {
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!serviceId) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Serviço inválido.", "error"));
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, image_path")
    .eq("id", serviceId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (serviceError || !service) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível localizar esse serviço.", "error"));
  }

  const [{ count: appointmentsCount }, { count: linkedPostsCount }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("service_id", service.id),
    supabase
      .from("salon_posts")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("service_id", service.id),
  ]);

  if ((appointmentsCount ?? 0) > 0 || (linkedPostsCount ?? 0) > 0) {
    const reasons = [
      (appointmentsCount ?? 0) > 0 ? `${appointmentsCount} agendamento(s)` : null,
      (linkedPostsCount ?? 0) > 0 ? `${linkedPostsCount} post(s) do feed` : null,
    ].filter(Boolean);

    redirect(
      buildRedirectNotice(
        SERVICES_PATH,
        `Não foi possível excluir ${service.name}. Esse serviço já está ligado a ${reasons.join(" e ")}.`,
        "error",
      ),
    );
  }

  const { error } = await supabase.from("services").delete().eq("id", service.id).eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível excluir o serviço.", "error"));
  }

  if (service.image_path) {
    await supabase.storage.from("salon-assets").remove([service.image_path]).catch(() => undefined);
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SERVICES_PATH);
  revalidatePath(TEAM_PATH);
  revalidatePath(FEED_PATH);
  redirect(buildRedirectNotice(SERVICES_PATH, "Serviço excluído com sucesso.", "success"));
}
