import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice, queueCustomerNotification } from "./shared";

const SERVICES_PATH = "/dashboard/services";
const DASHBOARD_PATH = "/dashboard";
const TEAM_PATH = "/dashboard/team";
const FEED_PATH = "/dashboard/feed";

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
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

  let imagePath: string | null = null;

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Envie uma imagem válida para o serviço.", "error"));
    }

    if (imageFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice(SERVICES_PATH, "A foto do serviço deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await imageFile.arrayBuffer());
    imagePath = `${salon.id}/services/${randomUUID()}`;

    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(imagePath, bytes, {
      contentType: imageFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível enviar a foto do serviço.", "error"));
    }
  }

  const { error } = await supabase.from("services").insert({
    salon_id: salon.id,
    category,
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

  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: "service_published",
    title: "Novo serviço disponível no app",
    body: `${name} agora aparece no app do salão para novos agendamentos.`,
    payload: {
      type: "service_published",
      serviceName: name,
      category,
    },
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

    if (imageFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice(SERVICES_PATH, "A foto do serviço deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await imageFile.arrayBuffer());
    const uploadPath = `${salon.id}/services/${service.id}`;
    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(uploadPath, bytes, {
      contentType: imageFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice(SERVICES_PATH, "Não foi possível atualizar a foto do serviço.", "error"));
    }

    imagePath = uploadPath;
  }

  const { error } = await supabase
    .from("services")
    .update({
      category,
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

  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: "service_updated",
    title: "Serviço atualizado no app",
    body: `${name} foi ajustado pelo salão. Confira preço, duração e detalhes atualizados.`,
    payload: {
      type: "service_updated",
      serviceId: service.id,
      serviceName: name,
      category,
    },
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
