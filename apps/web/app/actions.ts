"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireOwnerSalon, requireUser } from "@/lib/auth";
import { SALON_TIMEZONE_OPTIONS, SLOT_STEP_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/schedule";

type NoticeTone = "success" | "error" | "info";
type CustomerNotificationAudience = "salon_customers" | "single_customer";

function buildRedirectNotice(path: string, message: string, tone: NoticeTone = "info") {
  const params = new URLSearchParams({
    message,
    tone,
  });

  return `${path}?${params.toString()}`;
}

const COMMERCIAL_OVERVIEW_PATH = "/dashboard/benefits";
const COMMERCIAL_PROMOTIONS_PATH = "/dashboard/benefits/promotions";
const COMMERCIAL_LOYALTY_PATH = "/dashboard/benefits/loyalty";
const COMMERCIAL_REFERRALS_PATH = "/dashboard/benefits/referrals";
const COMMERCIAL_AUTOMATIONS_PATH = "/dashboard/benefits/automations";

function revalidateCommercialPaths(...paths: string[]) {
  for (const path of new Set([COMMERCIAL_OVERVIEW_PATH, ...paths])) {
    revalidatePath(path);
  }
}

function readUploadedFiles(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function readStringValues(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

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

function normalizeDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatAppointmentDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function formatPercentLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function truncateNotificationText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

async function queueCustomerNotification(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  notificationType: string;
  title: string;
  body: string;
  audience?: CustomerNotificationAudience;
  customerId?: string | null;
  payload?: Record<string, string | number | boolean | null | undefined>;
}) {
  const {
    supabase,
    salonId,
    notificationType,
    title,
    body,
    audience = "salon_customers",
    customerId = null,
    payload = {},
  } = params;

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const { error } = await supabase.from("salon_customer_notifications").insert({
    salon_id: salonId,
    customer_id: audience === "single_customer" ? customerId : null,
    audience,
    notification_type: notificationType,
    title,
    body,
    payload: cleanPayload,
  });

  if (error) {
    console.error("Failed to queue customer notification", {
      salonId,
      notificationType,
      audience,
      customerId,
      detail: error.message,
    });
  }
}

function buildOfferNotification(args: {
  action: "created" | "updated";
  kind: string;
  title: string;
  highlightText: string;
  startsOn: string | null;
}) {
  const kindLabel = args.kind === "membership" ? "plano mensal" : "promoção";
  const typePrefix = args.kind === "membership" ? "membership" : "promotion";
  const notificationTitle =
    args.action === "created"
      ? args.kind === "membership"
        ? "Novo plano mensal no salão"
        : "Nova promoção no salão"
      : args.kind === "membership"
        ? "Plano mensal atualizado"
        : "Promoção atualizada";

  const defaultBody =
    args.action === "created"
      ? `${args.title} já está disponível no app do salão.`
      : `${args.title} foi atualizada. Confira os detalhes no app.`;

  const startsHint = args.startsOn ? ` Válida a partir de ${formatDateLabel(args.startsOn)}.` : "";

  return {
    title: notificationTitle,
    body: `${args.highlightText || defaultBody}${startsHint}`,
    type: args.action === "created" ? `${typePrefix}_published` : `${typePrefix}_updated`,
  };
}

function buildFeedPostNotification(args: {
  postId: string;
  postTitle: string;
  postCaption: string;
  postImageUrl: string;
  postPublishedAt: string;
  serviceId: string | null;
  serviceName: string | null;
}) {
  const notificationTitle = args.serviceName
    ? `Nova foto de ${args.serviceName} no feed`
    : `Nova foto no feed: ${args.postTitle}`;
  const fallbackBody = args.serviceName
    ? `${args.postTitle} acabou de entrar no feed em ${args.serviceName}. Confira no app.`
    : `${args.postTitle} acabou de entrar no feed do salão. Confira no app.`;

  return {
    title: notificationTitle,
    body: truncateNotificationText(args.postCaption || fallbackBody),
    payload: {
      type: "feed_post_published",
      postId: args.postId,
      postTitle: args.postTitle,
      postCaption: args.postCaption || null,
      postImageUrl: args.postImageUrl,
      postPublishedAt: args.postPublishedAt,
      serviceId: args.serviceId,
      serviceName: args.serviceName,
    },
  };
}

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildRedirectNotice("/login", "Não foi possível entrar. Verifique e-mail e senha.", "error"));
  }

  redirect("/dashboard");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(buildRedirectNotice("/login", "Não foi possível criar a conta.", "error"));
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    buildRedirectNotice(
      "/login",
      "Conta criada. Confira seu e-mail caso a confirmação esteja ativada.",
      "success",
    ),
  );
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createSalonAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
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
    owner_user_id: user.id,
  });

  if (error) {
    redirect(buildRedirectNotice("/onboarding", "Não foi possível criar o salão.", "error"));
  }

  revalidatePath("/dashboard");
  redirect(buildRedirectNotice("/dashboard", "Salão criado com sucesso.", "success"));
}

export async function createServiceAction(formData: FormData) {
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
    redirect(buildRedirectNotice("/dashboard/services", "Preencha todos os campos do serviço.", "error"));
  }

  let imagePath: string | null = null;

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice("/dashboard/services", "Envie uma imagem válida para o serviço.", "error"));
    }

    if (imageFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice("/dashboard/services", "A foto do serviço deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await imageFile.arrayBuffer());
    imagePath = `${salon.id}/services/${randomUUID()}`;

    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(imagePath, bytes, {
      contentType: imageFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice("/dashboard/services", "Não foi possível enviar a foto do serviço.", "error"));
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
    redirect(buildRedirectNotice("/dashboard/services", "Não foi possível salvar o serviço.", "error"));
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/team");
  redirect(buildRedirectNotice("/dashboard/services", "Serviço adicionado com sucesso.", "success"));
}

export async function updateServiceCatalogAction(formData: FormData) {
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
    redirect(buildRedirectNotice("/dashboard/services", "Dados inválidos para atualizar o serviço.", "error"));
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, image_path")
    .eq("id", serviceId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (serviceError || !service) {
    redirect(buildRedirectNotice("/dashboard/services", "Não foi possível localizar esse serviço.", "error"));
  }

  let imagePath = service.image_path ?? null;

  if (removeImage && imagePath && !imageFile) {
    const { error: removeError } = await supabase.storage.from("salon-assets").remove([imagePath]);

    if (removeError) {
      redirect(buildRedirectNotice("/dashboard/services", "Não foi possível remover a foto do serviço.", "error"));
    }

    imagePath = null;
  }

  if (imageFile) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice("/dashboard/services", "Envie uma imagem válida para o serviço.", "error"));
    }

    if (imageFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice("/dashboard/services", "A foto do serviço deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await imageFile.arrayBuffer());
    const uploadPath = `${salon.id}/services/${service.id}`;
    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(uploadPath, bytes, {
      contentType: imageFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice("/dashboard/services", "Não foi possível atualizar a foto do serviço.", "error"));
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
    redirect(buildRedirectNotice("/dashboard/services", "Não foi possível atualizar o serviço.", "error"));
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/team");
  redirect(buildRedirectNotice("/dashboard/services", "Serviço atualizado com sucesso.", "success"));
}

export async function deleteServiceAction(formData: FormData) {
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!serviceId) {
    redirect(buildRedirectNotice("/dashboard/services", "Serviço inválido.", "error"));
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, image_path")
    .eq("id", serviceId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (serviceError || !service) {
    redirect(buildRedirectNotice("/dashboard/services", "Não foi possível localizar esse serviço.", "error"));
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
        "/dashboard/services",
        `Não foi possível excluir ${service.name}. Esse serviço já está ligado a ${reasons.join(" e ")}.`,
        "error",
      ),
    );
  }

  const { error } = await supabase.from("services").delete().eq("id", service.id).eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice("/dashboard/services", "Não foi possível excluir o serviço.", "error"));
  }

  if (service.image_path) {
    await supabase.storage.from("salon-assets").remove([service.image_path]).catch(() => undefined);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/services");
  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/feed");
  redirect(buildRedirectNotice("/dashboard/services", "Serviço excluído com sucesso.", "success"));
}

export async function createSalonOfferAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const highlightText = String(formData.get("highlightText") ?? "").trim();
  const priceValue = String(formData.get("price") ?? "").trim();
  const startsOnValue = String(formData.get("startsOn") ?? "").trim();
  const endsOnValue = String(formData.get("endsOn") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!["promotion", "membership"].includes(kind) || !title || Number.isNaN(sortOrder) || sortOrder < 0) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Preencha os dados principais da oferta.", "error"));
  }

  const normalizedStartsOn = startsOnValue ? normalizeDateInput(startsOnValue) : null;
  const normalizedEndsOn = endsOnValue ? normalizeDateInput(endsOnValue) : null;
  const price = priceValue ? Number(priceValue) : null;

  if ((startsOnValue && !normalizedStartsOn) || (endsOnValue && !normalizedEndsOn)) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Informe datas válidas para a vigência da oferta.", "error"));
  }

  if (normalizedStartsOn && normalizedEndsOn && normalizedEndsOn < normalizedStartsOn) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "A data final precisa ser igual ou posterior à data inicial.", "error"));
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Informe um valor válido para a oferta.", "error"));
  }

  const { error } = await supabase.from("salon_offers").insert({
    salon_id: salon.id,
    kind,
    title,
    description: description || null,
    highlight_text: highlightText || null,
    price,
    starts_on: normalizedStartsOn,
    ends_on: normalizedEndsOn,
    sort_order: sortOrder,
    is_active: isActive,
  });

  if (error) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Não foi possível salvar a oferta.", "error"));
  }

  if (isActive) {
    const notification = buildOfferNotification({
      action: "created",
      kind,
      title,
      highlightText,
      startsOn: normalizedStartsOn,
    });

    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: {
        type: notification.type,
        offerTitle: title,
        offerKind: kind,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Oferta salva com sucesso.", "success"));
}

export async function updateSalonOfferAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const highlightText = String(formData.get("highlightText") ?? "").trim();
  const priceValue = String(formData.get("price") ?? "").trim();
  const startsOnValue = String(formData.get("startsOn") ?? "").trim();
  const endsOnValue = String(formData.get("endsOn") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!offerId || !["promotion", "membership"].includes(kind) || !title || Number.isNaN(sortOrder) || sortOrder < 0) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Dados inválidos para atualizar a oferta.", "error"));
  }

  const normalizedStartsOn = startsOnValue ? normalizeDateInput(startsOnValue) : null;
  const normalizedEndsOn = endsOnValue ? normalizeDateInput(endsOnValue) : null;
  const price = priceValue ? Number(priceValue) : null;

  if ((startsOnValue && !normalizedStartsOn) || (endsOnValue && !normalizedEndsOn)) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Informe datas válidas para a vigência da oferta.", "error"));
  }

  if (normalizedStartsOn && normalizedEndsOn && normalizedEndsOn < normalizedStartsOn) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "A data final precisa ser igual ou posterior à data inicial.", "error"));
  }

  if (priceValue && (price === null || Number.isNaN(price) || price < 0)) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Informe um valor válido para a oferta.", "error"));
  }

  const { error } = await supabase
    .from("salon_offers")
    .update({
      kind,
      title,
      description: description || null,
      highlight_text: highlightText || null,
      price,
      starts_on: normalizedStartsOn,
      ends_on: normalizedEndsOn,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .eq("id", offerId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Não foi possível atualizar a oferta.", "error"));
  }

  if (isActive) {
    const notification = buildOfferNotification({
      action: "updated",
      kind,
      title,
      highlightText,
      startsOn: normalizedStartsOn,
    });

    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: {
        type: notification.type,
        offerId,
        offerTitle: title,
        offerKind: kind,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Oferta atualizada com sucesso.", "success"));
}

export async function deleteSalonOfferAction(formData: FormData) {
  const offerId = String(formData.get("offerId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!offerId) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Oferta inválida.", "error"));
  }

  const { error } = await supabase.from("salon_offers").delete().eq("id", offerId).eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Não foi possível remover a oferta.", "error"));
  }

  revalidateCommercialPaths(COMMERCIAL_PROMOTIONS_PATH);
  redirect(buildRedirectNotice(COMMERCIAL_PROMOTIONS_PATH, "Oferta removida com sucesso.", "success"));
}

export async function saveSalonReferralProgramAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rewardForReferrer = String(formData.get("rewardForReferrer") ?? "").trim();
  const rewardForInvited = String(formData.get("rewardForInvited") ?? "").trim();
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!title || !rewardForReferrer) {
    redirect(buildRedirectNotice(COMMERCIAL_REFERRALS_PATH, "Preencha o título e o benefício principal da indicação.", "error"));
  }

  const { error } = await supabase.from("salon_referral_programs").upsert(
    {
      salon_id: salon.id,
      title,
      description: description || null,
      reward_for_referrer: rewardForReferrer,
      reward_for_invited: rewardForInvited || null,
      is_active: isActive,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(buildRedirectNotice(COMMERCIAL_REFERRALS_PATH, "Não foi possível salvar o programa de indicação.", "error"));
  }

  if (isActive) {
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: "referral_program_updated",
      title: "Indique amigos e ganhe",
      body: rewardForInvited
        ? `${title}: indique pelo app e aproveite benefícios para quem indica e para quem chega.`
        : `${title}: o salão ativou uma nova campanha de indicação no app.`,
      payload: {
        type: "referral_program_updated",
        referralTitle: title,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_REFERRALS_PATH);
  redirect(buildRedirectNotice(COMMERCIAL_REFERRALS_PATH, "Programa de indicação atualizado com sucesso.", "success"));
}

export async function saveSalonLoyaltyProgramAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsPerVisit = Number(formData.get("pointsPerVisit") ?? 0);
  const cashbackPercent = Number(formData.get("cashbackPercent") ?? 0);
  const tierOneName = String(formData.get("tierOneName") ?? "").trim();
  const tierOneMinVisits = Number(formData.get("tierOneMinVisits") ?? 0);
  const tierOneDiscountPercent = Number(formData.get("tierOneDiscountPercent") ?? 0);
  const tierTwoName = String(formData.get("tierTwoName") ?? "").trim();
  const tierTwoMinVisits = Number(formData.get("tierTwoMinVisits") ?? 0);
  const tierTwoDiscountPercent = Number(formData.get("tierTwoDiscountPercent") ?? 0);
  const vipTierName = String(formData.get("vipTierName") ?? "").trim();
  const vipMinVisits = Number(formData.get("vipMinVisits") ?? 0);
  const vipDiscountPercent = Number(formData.get("vipDiscountPercent") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const integerFields = [pointsPerVisit, tierOneMinVisits, tierTwoMinVisits, vipMinVisits];
  const percentFields = [cashbackPercent, tierOneDiscountPercent, tierTwoDiscountPercent, vipDiscountPercent];

  if (
    !title ||
    !tierOneName ||
    !tierTwoName ||
    !vipTierName ||
    integerFields.some((value) => !Number.isInteger(value) || value < 0) ||
    pointsPerVisit < 1 ||
    tierOneMinVisits < 1 ||
    tierTwoMinVisits < 1 ||
    vipMinVisits < 1
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Preencha título, níveis e quantidades válidas para o programa de fidelidade.",
        "error",
      ),
    );
  }

  if (percentFields.some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Cashback e descontos precisam ficar entre 0% e 100%.",
        "error",
      ),
    );
  }

  if (!(tierOneMinVisits < tierTwoMinVisits && tierTwoMinVisits < vipMinVisits)) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "As visitas mínimas precisam crescer do primeiro nível até o VIP.",
        "error",
      ),
    );
  }

  if (!(tierOneDiscountPercent <= tierTwoDiscountPercent && tierTwoDiscountPercent <= vipDiscountPercent)) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Os descontos progressivos precisam crescer do primeiro nível até o VIP.",
        "error",
      ),
    );
  }

  const { error } = await supabase.from("salon_loyalty_programs").upsert(
    {
      salon_id: salon.id,
      title,
      description: description || null,
      points_per_visit: pointsPerVisit,
      cashback_percent: cashbackPercent,
      tier_one_name: tierOneName,
      tier_one_min_visits: tierOneMinVisits,
      tier_one_discount_percent: tierOneDiscountPercent,
      tier_two_name: tierTwoName,
      tier_two_min_visits: tierTwoMinVisits,
      tier_two_discount_percent: tierTwoDiscountPercent,
      vip_tier_name: vipTierName,
      vip_min_visits: vipMinVisits,
      vip_discount_percent: vipDiscountPercent,
      is_active: isActive,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_LOYALTY_PATH,
        "Não foi possível salvar o programa de fidelidade.",
        "error",
      ),
    );
  }

  if (isActive) {
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: "loyalty_program_updated",
      title: "Seu clube de fidelidade foi atualizado",
      body: `${title}: cada visita soma ${pointsPerVisit} pontos, gera ${formatPercentLabel(cashbackPercent)}% de cashback e pode chegar até ${formatPercentLabel(vipDiscountPercent)}% de desconto VIP.`,
      payload: {
        type: "loyalty_program_updated",
        loyaltyTitle: title,
      },
    });
  }

  revalidateCommercialPaths(COMMERCIAL_LOYALTY_PATH);
  redirect(buildRedirectNotice(COMMERCIAL_LOYALTY_PATH, "Programa de fidelidade atualizado com sucesso.", "success"));
}

export async function saveSalonGrowthAutomationAction(formData: FormData) {
  const isActive = formData.get("isActive") === "on";
  const smartRebookIsActive = formData.get("smartRebookIsActive") === "on";
  const winbackInactiveDays = Number(formData.get("winbackInactiveDays") ?? 0);
  const winbackDiscountPercent = Number(formData.get("winbackDiscountPercent") ?? 0);
  const winbackTitle = String(formData.get("winbackTitle") ?? "").trim();
  const winbackBodyTemplate = String(formData.get("winbackBodyTemplate") ?? "").trim();
  const smartRebookWindowDays = Number(formData.get("smartRebookWindowDays") ?? 0);
  const smartRebookTitle = String(formData.get("smartRebookTitle") ?? "").trim();
  const smartRebookBodyTemplate = String(formData.get("smartRebookBodyTemplate") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (
    !Number.isInteger(winbackInactiveDays) ||
    winbackInactiveDays < 7 ||
    winbackInactiveDays > 365
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um prazo de inatividade entre 7 e 365 dias para a recuperação automática.",
        "error",
      ),
    );
  }

  if (
    !Number.isInteger(winbackDiscountPercent) ||
    winbackDiscountPercent < 0 ||
    winbackDiscountPercent > 100
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "O desconto de recuperação precisa ser um número inteiro entre 0% e 100%.",
        "error",
      ),
    );
  }

  if (!winbackTitle || winbackTitle.length > 120) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um título de até 120 caracteres para a campanha de recuperação.",
        "error",
      ),
    );
  }

  if (!winbackBodyTemplate || winbackBodyTemplate.length > 220) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Use um texto de até 220 caracteres para a mensagem automática de recuperação.",
        "error",
      ),
    );
  }

  if (
    !Number.isInteger(smartRebookWindowDays) ||
    smartRebookWindowDays < 1 ||
    smartRebookWindowDays > 14
  ) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "A janela do rebook inteligente precisa ficar entre 1 e 14 dias.",
        "error",
      ),
    );
  }

  if (!smartRebookTitle || smartRebookTitle.length > 120) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Informe um título de até 120 caracteres para o rebook inteligente.",
        "error",
      ),
    );
  }

  if (!smartRebookBodyTemplate || smartRebookBodyTemplate.length > 220) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Use um texto de até 220 caracteres para a mensagem de rebook inteligente.",
        "error",
      ),
    );
  }

  const { error } = await supabase.from("salon_growth_automation_settings").upsert(
    {
      salon_id: salon.id,
      is_active: isActive,
      winback_inactive_days: winbackInactiveDays,
      winback_discount_percent: winbackDiscountPercent,
      winback_title: winbackTitle,
      winback_body_template: winbackBodyTemplate,
      smart_rebook_is_active: smartRebookIsActive,
      smart_rebook_window_days: smartRebookWindowDays,
      smart_rebook_title: smartRebookTitle,
      smart_rebook_body_template: smartRebookBodyTemplate,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        COMMERCIAL_AUTOMATIONS_PATH,
        "Não foi possível salvar a automação de recuperação de clientes.",
        "error",
      ),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  revalidateCommercialPaths(COMMERCIAL_AUTOMATIONS_PATH);
  redirect(
    buildRedirectNotice(
      COMMERCIAL_AUTOMATIONS_PATH,
      isActive
        ? `Automação comercial salva: winback em ${winbackInactiveDays} dias com ${formatPercentLabel(winbackDiscountPercent)}% e rebook inteligente ${smartRebookIsActive ? `ativo até ${smartRebookWindowDays} dias antes da janela ideal` : "pausado"}.`
        : "Automação comercial salva, mas o winback está pausado.",
      "success",
    ),
  );
}

export async function deleteSalonNotificationAction(formData: FormData) {
  const singleDeleteId = String(formData.get("singleDeleteId") ?? "").trim();
  const selectedNotificationIds = formData
    .getAll("notificationIds")
    .map((entry) => String(entry).trim())
    .filter(Boolean);
  const notificationIds = [...new Set(singleDeleteId ? [singleDeleteId] : selectedNotificationIds)];
  const returnPathCurrent =
    String(formData.get("returnPathCurrent") ?? "").trim() || "/dashboard/notifications";
  const returnPathPrevious = String(formData.get("returnPathPrevious") ?? "").trim();
  const pageItemCount = Number.parseInt(String(formData.get("pageItemCount") ?? "0"), 10);
  const shouldGoPrevious = pageItemCount > 0 && notificationIds.length >= pageItemCount && !!returnPathPrevious;
  const returnPath = shouldGoPrevious ? returnPathPrevious : returnPathCurrent;
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!notificationIds.length) {
    redirect(buildRedirectNotice(returnPathCurrent, "Selecione pelo menos um aviso para excluir.", "error"));
  }

  const { data: existingNotifications, error: notificationError } = await supabase
    .from("salon_customer_notifications")
    .select("id")
    .in("id", notificationIds)
    .eq("salon_id", salon.id)
    .returns<{ id: string }[]>();

  if (notificationError || !(existingNotifications?.length ?? 0)) {
    redirect(buildRedirectNotice(returnPath, "Não foi possível localizar esse aviso.", "error"));
  }

  const existingIds = existingNotifications.map((notification) => notification.id);

  const { data: deletedNotifications, error: deleteError } = await supabase
    .from("salon_customer_notifications")
    .delete()
    .in("id", existingIds)
    .eq("salon_id", salon.id)
    .select("id");

  if (deleteError) {
    redirect(buildRedirectNotice(returnPath, "Não foi possível excluir esse aviso.", "error"));
  }

  const deletedCount = deletedNotifications?.length ?? 0;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notifications");
  redirect(
    buildRedirectNotice(
      returnPath,
      deletedCount > 1
        ? `${deletedCount} avisos excluídos com sucesso.`
        : "Aviso excluído com sucesso.",
      "success",
    ),
  );
}

export async function createStaffMemberAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const requestedServiceIds = readStringValues(formData, "serviceIds");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!name) {
    redirect(buildRedirectNotice("/dashboard/team", "Informe o nome do profissional.", "error"));
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", salon.id);

  if (servicesError) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível carregar os serviços para a equipe.", "error"));
  }

  const salonServiceIds = new Set((services ?? []).map((service) => service.id));
  const selectedServiceIds = requestedServiceIds.length ? requestedServiceIds : [...salonServiceIds];

  if (selectedServiceIds.some((serviceId) => !salonServiceIds.has(serviceId))) {
    redirect(buildRedirectNotice("/dashboard/team", "Selecione apenas serviços do seu salão.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .insert({
      salon_id: salon.id,
      name,
      role: role || null,
      is_active: true,
    })
    .select("id")
    .single();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível cadastrar o profissional.", "error"));
  }

  if (selectedServiceIds.length) {
    const { error: assignmentsError } = await supabase.from("staff_service_assignments").insert(
      selectedServiceIds.map((serviceId) => ({
        staff_member_id: staffMember.id,
        service_id: serviceId,
      })),
    );

    if (assignmentsError) {
      redirect(buildRedirectNotice("/dashboard/team", "O profissional foi criado, mas não foi possível vincular os serviços.", "error"));
    }
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/services");
  redirect(buildRedirectNotice("/dashboard/team", "Profissional adicionado com sucesso.", "success"));
}

export async function updateStaffMemberAssignmentsAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const requestedServiceIds = readStringValues(formData, "serviceIds");
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice("/dashboard/team", "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível localizar esse profissional.", "error"));
  }

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("salon_id", salon.id);

  if (servicesError) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível carregar os serviços do salão.", "error"));
  }

  const validServiceIds = new Set((services ?? []).map((service) => service.id));

  if (requestedServiceIds.some((serviceId) => !validServiceIds.has(serviceId))) {
    redirect(buildRedirectNotice("/dashboard/team", "Selecione apenas serviços válidos para esse profissional.", "error"));
  }

  const { error: deleteError } = await supabase
    .from("staff_service_assignments")
    .delete()
    .eq("staff_member_id", staffMemberId);

  if (deleteError) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível atualizar os serviços do profissional.", "error"));
  }

  if (requestedServiceIds.length) {
    const { error: insertError } = await supabase.from("staff_service_assignments").insert(
      requestedServiceIds.map((serviceId) => ({
        staff_member_id: staffMemberId,
        service_id: serviceId,
      })),
    );

    if (insertError) {
      redirect(buildRedirectNotice("/dashboard/team", "Não foi possível salvar os serviços desse profissional.", "error"));
    }
  }

  revalidatePath("/dashboard/team");
  redirect(buildRedirectNotice("/dashboard/team", "Serviços do profissional atualizados com sucesso.", "success"));
}

export async function updateStaffBusinessHoursAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice("/dashboard/team", "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível localizar esse profissional.", "error"));
  }

  const businessHours = WEEKDAY_OPTIONS.map((weekday) => {
    const isOpen = formData.get(`staffIsOpen_${weekday.value}`) === "on";
    const opensAt = String(formData.get(`staffOpensAt_${weekday.value}`) ?? "").trim();
    const closesAt = String(formData.get(`staffClosesAt_${weekday.value}`) ?? "").trim();

    if (!isOpen) {
      return {
        staff_member_id: staffMemberId,
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
          "/dashboard/team",
          `Preencha um horário válido para ${weekday.label.toLowerCase()} na agenda do profissional.`,
          "error",
        ),
      );
    }

    if (normalizedOpen >= normalizedClose) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          `O horário de abertura precisa ser antes do fechamento em ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    return {
      staff_member_id: staffMemberId,
      weekday: weekday.value,
      is_open: true,
      opens_at: normalizedOpen,
      closes_at: normalizedClose,
    };
  });

  const { error } = await supabase.from("staff_business_hours").upsert(businessHours, {
    onConflict: "staff_member_id,weekday",
  });

  if (error) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível salvar a agenda desse profissional.", "error"));
  }

  revalidatePath("/dashboard/team");
  redirect(buildRedirectNotice("/dashboard/team", "Agenda do profissional atualizada com sucesso.", "success"));
}

export async function toggleStaffMemberStatusAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const nextStatus = String(formData.get("isActive") ?? "") === "true";
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice("/dashboard/team", "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível localizar esse profissional.", "error"));
  }

  const { error: updateError } = await supabase
    .from("staff_members")
    .update({ is_active: nextStatus })
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (updateError) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível atualizar o status do profissional.", "error"));
  }

  if (nextStatus) {
    const { count, error: countError } = await supabase
      .from("staff_service_assignments")
      .select("*", { count: "exact", head: true })
      .eq("staff_member_id", staffMemberId);

    if (!countError && (count ?? 0) === 0) {
      const { data: services } = await supabase.from("services").select("id").eq("salon_id", salon.id);
      if (services?.length) {
        await supabase.from("staff_service_assignments").insert(
          services.map((service) => ({
            staff_member_id: staffMemberId,
            service_id: service.id,
          })),
        );
      }
    }
  }

  revalidatePath("/dashboard/team");
  redirect(
    buildRedirectNotice(
      "/dashboard/team",
      nextStatus ? "Profissional reativado com sucesso." : "Profissional pausado com sucesso.",
      "success",
    ),
  );
}

export async function deleteStaffMemberAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId) {
    redirect(buildRedirectNotice("/dashboard/team", "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, is_default")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível localizar esse profissional.", "error"));
  }

  if (staffMember.is_default) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "O profissional inicial do sistema não pode ser removido. Se ele saiu do salão, use Pausar para preservar o histórico.",
        "error",
      ),
    );
  }

  const { count: appointmentsCount, error: appointmentsError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salon.id)
    .eq("staff_member_id", staffMemberId);

  if (appointmentsError) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "Não foi possível verificar se esse profissional ainda possui atendimentos vinculados.",
        "error",
      ),
    );
  }

  if ((appointmentsCount ?? 0) > 0) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        `${staffMember.name} não pode ser removido porque já possui agendamentos ou histórico vinculados. Use Pausar se ele saiu do salão.`,
        "error",
      ),
    );
  }

  const { error: deleteError } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (deleteError) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível remover esse profissional.", "error"));
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/appointments");
  redirect(buildRedirectNotice("/dashboard/team", `${staffMember.name} foi removido da equipe.`, "success"));
}

export async function offboardStaffMemberAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const replacementStaffMemberId = String(formData.get("replacementStaffMemberId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const now = new Date().toISOString();

  if (!staffMemberId) {
    redirect(buildRedirectNotice("/dashboard/team", "Profissional inválido.", "error"));
  }

  const { data: staffMember, error: staffError } = await supabase
    .from("staff_members")
    .select("id, name, is_default, is_active")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffError || !staffMember) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível localizar esse profissional.", "error"));
  }

  if (staffMember.is_default) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "O profissional inicial do sistema não pode ser desligado. Use Pausar para tirá-lo da agenda sem perder o histórico.",
        "error",
      ),
    );
  }

  const { data: futureAppointments, error: futureAppointmentsError } = await supabase
    .from("appointments")
    .select("id, service_id, customer_id, date, services(name)")
    .eq("salon_id", salon.id)
    .eq("staff_member_id", staffMemberId)
    .gt("date", now)
    .in("status", ["pending", "confirmed"]);

  if (futureAppointmentsError) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "Não foi possível carregar a agenda futura desse profissional.",
        "error",
      ),
    );
  }

  const futureItems = futureAppointments ?? [];

  if (futureItems.length && !replacementStaffMemberId) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        `${staffMember.name} ainda tem agenda futura. Escolha outro profissional para receber esses horários antes de desligar.`,
        "error",
      ),
    );
  }

  let replacementName: string | null = null;

  if (futureItems.length) {
    if (replacementStaffMemberId === staffMemberId) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          "Escolha outro profissional para receber a agenda futura.",
          "error",
        ),
      );
    }

    const { data: replacementStaffMember, error: replacementError } = await supabase
      .from("staff_members")
      .select("id, name, is_active")
      .eq("id", replacementStaffMemberId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (replacementError || !replacementStaffMember || !replacementStaffMember.is_active) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          "O profissional escolhido para receber a agenda não está disponível.",
          "error",
        ),
      );
    }

    replacementName = replacementStaffMember.name;

    const appointmentServiceIds = Array.from(new Set(futureItems.map((item) => item.service_id)));
    const { data: replacementAssignments, error: replacementAssignmentsError } = await supabase
      .from("staff_service_assignments")
      .select("service_id")
      .eq("staff_member_id", replacementStaffMemberId);

    if (replacementAssignmentsError) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          "Não foi possível validar os serviços do profissional que vai receber a agenda.",
          "error",
        ),
      );
    }

    const replacementServiceIds = new Set((replacementAssignments ?? []).map((assignment) => assignment.service_id));

    if (appointmentServiceIds.some((serviceId) => !replacementServiceIds.has(serviceId))) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          `${replacementStaffMember.name} não atende todos os serviços da agenda futura de ${staffMember.name}. Ajuste os serviços antes de desligar.`,
          "error",
        ),
      );
    }

    const { error: reassignError } = await supabase
      .from("appointments")
      .update({ staff_member_id: replacementStaffMemberId })
      .in(
        "id",
        futureItems.map((item) => item.id),
      )
      .eq("salon_id", salon.id)
      .eq("staff_member_id", staffMemberId);

    if (reassignError) {
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          "Não foi possível transferir a agenda futura desse profissional.",
          "error",
        ),
      );
    }

    const notifications = futureItems.map((item) => {
      const serviceRelation =
        item.services && Array.isArray(item.services) ? item.services[0] : item.services;
      const serviceName =
        typeof serviceRelation?.name === "string" && serviceRelation.name.trim().length
          ? serviceRelation.name.trim()
          : "atendimento";

      return {
        salon_id: salon.id,
        customer_id: item.customer_id,
        audience: "single_customer",
        notification_type: "appointment_staff_reassigned",
        title: "Seu horário teve troca de profissional",
        body: `${staffMember.name} não atende mais no salão. Seu ${serviceName} continua no mesmo horário e agora será com ${replacementStaffMember.name}.`,
        payload: {
          type: "appointment_staff_reassigned",
          appointmentId: item.id,
          appointmentAt: item.date,
          serviceName,
          staffMemberName: replacementStaffMember.name,
          previousStaffMemberName: staffMember.name,
          replacementStaffMemberName: replacementStaffMember.name,
        },
      };
    });

    const { error: notificationsError } = await supabase
      .from("salon_customer_notifications")
      .insert(notifications);

    if (notificationsError) {
      revalidatePath("/dashboard/team");
      revalidatePath("/dashboard/appointments");
      redirect(
        buildRedirectNotice(
          "/dashboard/team",
          `${staffMember.name} foi desligado e a agenda futura foi transferida, mas não foi possível avisar os clientes pelo app.`,
          "error",
        ),
      );
    }
  }

  const { error: blocksError } = await supabase
    .from("staff_blocks")
    .delete()
    .eq("staff_member_id", staffMemberId)
    .gte("ends_at", now);

  if (blocksError) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "A agenda futura foi tratada, mas não foi possível limpar os bloqueios desse profissional.",
        "error",
      ),
    );
  }

  const { error: pauseError } = await supabase
    .from("staff_members")
    .update({ is_active: false })
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id);

  if (pauseError) {
    redirect(
      buildRedirectNotice(
        "/dashboard/team",
        "Não foi possível concluir o desligamento desse profissional.",
        "error",
      ),
    );
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/appointments");
  redirect(
    buildRedirectNotice(
      "/dashboard/team",
      futureItems.length
        ? `${staffMember.name} foi desligado do salão. ${futureItems.length} ${futureItems.length === 1 ? "agendamento foi transferido" : "agendamentos foram transferidos"} para ${replacementName}.`
        : `${staffMember.name} foi desligado do salão e saiu da agenda ativa.`,
      "success",
    ),
  );
}

export async function createStaffBlockAction(formData: FormData) {
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  await requireOwnerSalon();
  const supabase = createClient();

  if (!staffMemberId || !startsAt || !endsAt) {
    redirect(buildRedirectNotice("/dashboard/team", "Preencha profissional, início e fim do bloqueio.", "error"));
  }

  const { error } = await supabase.rpc("create_staff_block", {
    staff_member_uuid: staffMemberId,
    local_start: startsAt,
    local_end: endsAt,
    block_reason: reason || null,
  });

  if (error) {
    const message = error.message.includes("staff_block_overlap")
      ? "Já existe um bloqueio nesse intervalo para o profissional."
      : error.message.includes("invalid_block_range")
        ? "O horário final precisa ser depois do horário inicial."
        : "Não foi possível criar o bloqueio manual.";

    redirect(buildRedirectNotice("/dashboard/team", message, "error"));
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  redirect(buildRedirectNotice("/dashboard/team", "Bloqueio manual criado com sucesso.", "success"));
}

export async function deleteStaffBlockAction(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!blockId) {
    redirect(buildRedirectNotice("/dashboard/team", "Bloqueio inválido.", "error"));
  }

  const { error } = await supabase
    .from("staff_blocks")
    .delete()
    .eq("id", blockId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice("/dashboard/team", "Não foi possível remover o bloqueio.", "error"));
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/dashboard/appointments");
  redirect(buildRedirectNotice("/dashboard/team", "Bloqueio removido com sucesso.", "success"));
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!appointmentId || !["confirmed", "cancelled", "completed"].includes(status)) {
    redirect(buildRedirectNotice("/dashboard/appointments", "Ação inválida.", "error"));
  }

  const { data: appointmentContext } = await supabase
    .from("appointments")
    .select("id, customer_id, date, ends_at, status, services(name), staff_members(name)")
    .eq("id", appointmentId)
    .eq("salon_id", salon.id)
    .maybeSingle<{
      id: string;
      customer_id: string;
      date: string;
      ends_at: string;
      status: "pending" | "confirmed" | "cancelled" | "completed";
      services: { name: string | null } | null;
      staff_members: { name: string | null } | null;
    }>();

  let error = null as { message: string } | null;

  if (status === "cancelled") {
    const cancelResult = await supabase.rpc("cancel_appointment", {
      appointment_uuid: appointmentId,
      cancellation_reason_input: cancellationReason || "Cancelado pelo salão.",
    });

    if (cancelResult.error) {
      error = cancelResult.error;
    }
  } else if (status === "completed") {
    const completeResult = await supabase.rpc("mark_appointment_completed", {
      appointment_uuid: appointmentId,
    });

    if (completeResult.error) {
      const completeErrorMessage = completeResult.error.message ?? "";
      const canFallbackComplete =
        appointmentContext != null &&
        appointmentContext.status !== "cancelled" &&
        appointmentContext.status !== "completed" &&
        new Date(appointmentContext.ends_at) <= new Date() &&
        !completeErrorMessage.includes("appointment_not_finished") &&
        !completeErrorMessage.includes("appointment_already_completed") &&
        !completeErrorMessage.includes("cancelled_appointment_cannot_be_completed") &&
        !completeErrorMessage.includes("appointment_not_found") &&
        !completeErrorMessage.includes("unauthorized");

      if (canFallbackComplete) {
        const fallbackUpdate = await supabase
          .from("appointments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            cancelled_at: null,
            cancelled_by: null,
            cancellation_reason: null,
          })
          .eq("id", appointmentId)
          .eq("salon_id", salon.id);

        if (fallbackUpdate.error) {
          error = fallbackUpdate.error;
        } else {
          await supabase
            .from("salon_vacancy_alerts")
            .delete()
            .eq("appointment_id", appointmentId)
            .eq("salon_id", salon.id);
        }
      } else {
        error = completeResult.error;
      }
    }
  } else {
    const updateResult = await supabase
      .from("appointments")
      .update({
        status: "confirmed",
        completed_at: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      })
      .eq("id", appointmentId)
      .eq("salon_id", salon.id);

    if (updateResult.error) {
      error = updateResult.error;
    } else {
      await supabase.from("salon_vacancy_alerts").delete().eq("appointment_id", appointmentId).eq("salon_id", salon.id);
    }
  }

  if (error) {
    const message = error.message.includes("appointment_not_finished")
      ? "Esse atendimento ainda não terminou. Marque como atendido apenas depois do horário final."
      : error.message.includes("appointment_already_completed")
        ? "Esse agendamento já foi marcado como atendido."
        : error.message.includes("cancelled_appointment_cannot_be_completed")
          ? "Um agendamento cancelado não pode ser marcado como atendido."
          : error.message.includes("appointment_not_found")
            ? "Não foi possível localizar esse agendamento."
            : error.message.includes("unauthorized")
              ? "Sua conta não tem permissão para concluir esse atendimento."
            : error.message.includes("past_appointment_cannot_be_cancelled")
              ? "Não é possível cancelar um horário que já passou."
              : `Não foi possível atualizar o agendamento. ${error.message}`;

    redirect(buildRedirectNotice("/dashboard/appointments", message, "error"));
  }

  if (appointmentContext?.customer_id) {
    const appointmentLabel = formatAppointmentDateTimeLabel(appointmentContext.date);
    const serviceName = appointmentContext.services?.name?.trim() || "seu atendimento";
    const staffName = appointmentContext.staff_members?.name?.trim();

    if (status === "confirmed") {
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        customerId: appointmentContext.customer_id,
        audience: "single_customer",
        notificationType: "appointment_confirmed",
        title: "Seu horário foi confirmado",
        body: staffName
          ? `${serviceName} em ${appointmentLabel} com ${staffName} foi confirmado pelo salão.`
          : `${serviceName} em ${appointmentLabel} foi confirmado pelo salão.`,
        payload: {
          type: "appointment_confirmed",
          appointmentId,
        },
      });
    }

    if (status === "cancelled") {
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        customerId: appointmentContext.customer_id,
        audience: "single_customer",
        notificationType: "appointment_cancelled",
        title: "Seu horário foi cancelado pelo salão",
        body: cancellationReason
          ? `${serviceName} em ${appointmentLabel} foi cancelado. Motivo: ${cancellationReason}.`
          : `${serviceName} em ${appointmentLabel} foi cancelado pelo salão.`,
        payload: {
          type: "appointment_cancelled",
          appointmentId,
        },
      });
    }

    if (status === "completed") {
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        customerId: appointmentContext.customer_id,
        audience: "single_customer",
        notificationType: "appointment_completed",
        title: "Atendimento concluído",
        body: staffName
          ? `${serviceName} com ${staffName} foi marcado como concluído pelo salão.`
          : `${serviceName} foi marcado como concluído pelo salão.`,
        payload: {
          type: "appointment_completed",
          appointmentId,
        },
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/appointments");
  revalidateCommercialPaths(COMMERCIAL_LOYALTY_PATH, COMMERCIAL_REFERRALS_PATH, COMMERCIAL_AUTOMATIONS_PATH);
  redirect(
    buildRedirectNotice(
      "/dashboard/appointments",
      status === "confirmed"
        ? "Agendamento confirmado com sucesso."
        : status === "completed"
          ? "Atendimento concluído com sucesso."
          : "Agendamento cancelado com sucesso.",
      "success",
    ),
  );
}

export async function regenerateSalonCodeAction() {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const generated = await supabase.rpc("generate_join_code");

  if (generated.error || !generated.data) {
    redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível gerar um novo código.", "error"));
  }

  const { error } = await supabase
    .from("salons")
    .update({ join_code: generated.data })
    .eq("id", salon.id);

  if (error) {
    redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível atualizar o código.", "error"));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect(buildRedirectNotice("/dashboard/settings", "Novo código gerado com sucesso.", "success"));
}

export async function updateSalonBrandingAction(formData: FormData) {
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
    redirect(buildRedirectNotice("/dashboard/settings", "Informe o nome do salão.", "error"));
  }

  const brandColor = /^#[0-9A-F]{6}$/.test(rawBrandColor) ? rawBrandColor : "#C56B43";
  const whatsappDigits = rawWhatsapp.replace(/\D/g, "");

  if (rawWhatsapp && (whatsappDigits.length < 10 || whatsappDigits.length > 15)) {
    redirect(
      buildRedirectNotice(
        "/dashboard/settings",
        "Informe um WhatsApp válido com DDD e código do país, se necessário.",
        "error",
      ),
    );
  }

  let logoPath = shouldRemoveLogo ? null : salon.logo_path ?? null;

  if (shouldRemoveLogo && salon.logo_path && !logoFile) {
    const { error: removeError } = await supabase.storage.from("salon-assets").remove([salon.logo_path]);

    if (removeError) {
      redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível remover a logo atual.", "error"));
    }
  }

  if (logoFile) {
    if (!logoFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice("/dashboard/settings", "Envie uma imagem válida para a logo.", "error"));
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      redirect(buildRedirectNotice("/dashboard/settings", "A logo deve ter no máximo 2 MB.", "error"));
    }

    const bytes = Buffer.from(await logoFile.arrayBuffer());
    const uploadPath = `${salon.id}/logo`;

    const { error: uploadError } = await supabase.storage.from("salon-assets").upload(uploadPath, bytes, {
      contentType: logoFile.type,
      upsert: true,
    });

    if (uploadError) {
      redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível enviar a logo do salão.", "error"));
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
    redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível atualizar a identidade do salão.", "error"));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect(buildRedirectNotice("/dashboard/settings", "Identidade do salão atualizada com sucesso.", "success"));
}

export async function updateSalonScheduleAction(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const timezone = String(formData.get("timezone") ?? "").trim();
  const slotStepMinutes = Number(formData.get("slotStepMinutes"));

  if (!SALON_TIMEZONE_OPTIONS.some((option) => option.value === timezone)) {
    redirect(buildRedirectNotice("/dashboard/settings", "Selecione um fuso horário válido para o salão.", "error"));
  }

  if (!SLOT_STEP_OPTIONS.some((option) => option.value === slotStepMinutes)) {
    redirect(buildRedirectNotice("/dashboard/settings", "Escolha um intervalo válido para a agenda online.", "error"));
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
          "/dashboard/settings",
          `Preencha um horário válido para ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    if (normalizedOpen >= normalizedClose) {
      redirect(
        buildRedirectNotice(
          "/dashboard/settings",
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
    redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível atualizar os dados da agenda.", "error"));
  }

  const { error: businessHoursError } = await supabase.from("salon_business_hours").upsert(businessHours, {
    onConflict: "salon_id,weekday",
  });

  if (businessHoursError) {
    redirect(buildRedirectNotice("/dashboard/settings", "Não foi possível salvar os horários do salão.", "error"));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  redirect(buildRedirectNotice("/dashboard/settings", "Agenda online atualizada com sucesso.", "success"));
}

export async function createSalonPostAction(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawCaption = String(formData.get("caption") ?? "").trim();
  const rawServiceId = String(formData.get("serviceId") ?? "").trim();
  const imageFiles = readUploadedFiles(formData, "images");

  if (!rawTitle) {
    redirect(buildRedirectNotice("/dashboard/feed", "Informe um título para a foto.", "error"));
  }

  if (rawCaption.length > 500) {
    redirect(buildRedirectNotice("/dashboard/feed", "A legenda pode ter no máximo 500 caracteres.", "error"));
  }

  if (!imageFiles.length) {
    redirect(buildRedirectNotice("/dashboard/feed", "Selecione pelo menos uma imagem para publicar.", "error"));
  }

  if (imageFiles.length > 5) {
    redirect(buildRedirectNotice("/dashboard/feed", "Envie no máximo 5 imagens por publicação.", "error"));
  }

  for (const imageFile of imageFiles) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice("/dashboard/feed", "Envie apenas imagens válidas para o feed.", "error"));
    }

    if (imageFile.size > 4 * 1024 * 1024) {
      redirect(buildRedirectNotice("/dashboard/feed", "Cada imagem deve ter no máximo 4 MB.", "error"));
    }
  }

  let serviceId: string | null = null;
  let serviceName: string | null = null;

  if (rawServiceId) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,name")
      .eq("id", rawServiceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (serviceError || !service) {
      redirect(buildRedirectNotice("/dashboard/feed", "Selecione um serviço válido para vincular ao post.", "error"));
    }

    serviceId = service.id;
    serviceName = service.name;
  }

  const uploadedPaths: string[] = [];

  for (const imageFile of imageFiles) {
    const extension = imageFile.name.includes(".")
      ? imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg"
      : "jpg";
    const uploadPath = `${salon.id}/${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await imageFile.arrayBuffer());

    const { error: uploadError } = await supabase.storage.from("salon-posts").upload(uploadPath, bytes, {
      contentType: imageFile.type,
      upsert: false,
    });

    if (uploadError) {
      if (uploadedPaths.length) {
        await supabase.storage.from("salon-posts").remove(uploadedPaths);
      }
      redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível enviar as imagens do post.", "error"));
    }

    uploadedPaths.push(uploadPath);
  }

  const { data: createdPost, error } = await supabase
    .from("salon_posts")
    .insert({
      salon_id: salon.id,
      title: rawTitle,
      caption: rawCaption || null,
      image_path: uploadedPaths[0],
      service_id: serviceId,
      created_by_user_id: user.id,
    })
    .select("id,created_at")
    .single();

  if (error || !createdPost) {
    await supabase.storage.from("salon-posts").remove(uploadedPaths);
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível criar a publicação.", "error"));
  }

  const galleryRows = uploadedPaths.map((path, index) => ({
    post_id: createdPost.id,
    image_path: path,
    sort_order: index,
  }));

  const { error: galleryError } = await supabase.from("salon_post_images").insert(galleryRows);

  if (galleryError) {
    await supabase.from("salon_posts").delete().eq("id", createdPost.id);
    await supabase.storage.from("salon-posts").remove(uploadedPaths);
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível salvar a galeria do post.", "error"));
  }

  const postImageUrl = supabase.storage
    .from("salon-posts")
    .getPublicUrl(uploadedPaths[0]).data.publicUrl;
  const feedNotification = buildFeedPostNotification({
    postId: createdPost.id,
    postTitle: rawTitle,
    postCaption: rawCaption,
    postImageUrl,
    postPublishedAt: createdPost.created_at ?? new Date().toISOString(),
    serviceId,
    serviceName,
  });

  await queueCustomerNotification({
    supabase,
    salonId: salon.id,
    notificationType: "feed_post_published",
    title: feedNotification.title,
    body: feedNotification.body,
    payload: feedNotification.payload,
  });

  revalidatePath("/dashboard/feed");
    redirect(buildRedirectNotice("/dashboard/feed", "Publicação criada com sucesso.", "success"));
}

export async function deleteSalonPostAction(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const postId = String(formData.get("postId") ?? "");

  if (!postId) {
    redirect(buildRedirectNotice("/dashboard/feed", "Publicação inválida.", "error"));
  }

  const { data: post, error: loadError } = await supabase
    .from("salon_posts")
    .select("id, image_path, salon_post_images(image_path)")
    .eq("id", postId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (loadError || !post) {
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível localizar a publicação.", "error"));
  }

  const { error } = await supabase
    .from("salon_posts")
    .delete()
    .eq("id", postId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível excluir a publicação.", "error"));
  }

  const imagePaths = Array.from(
    new Set([
      post.image_path,
      ...((post.salon_post_images as { image_path: string }[] | null) ?? []).map((image) => image.image_path),
    ].filter(Boolean)),
  );

  if (imagePaths.length) {
    await supabase.storage.from("salon-posts").remove(imagePaths);
  }

  revalidatePath("/dashboard/feed");
  redirect(buildRedirectNotice("/dashboard/feed", "Publicação removida com sucesso.", "success"));
}

export async function deleteSalonPostCommentAction(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const commentId = String(formData.get("commentId") ?? "");

  if (!commentId) {
    redirect(buildRedirectNotice("/dashboard/feed", "Comentário inválido.", "error"));
  }

  const { data: comment, error: loadError } = await supabase
    .from("salon_post_comments")
    .select("id, post_id, salon_posts!inner(salon_id)")
    .eq("id", commentId)
    .eq("salon_posts.salon_id", salon.id)
    .maybeSingle();

  if (loadError || !comment) {
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível localizar o comentário.", "error"));
  }

  const { error } = await supabase.from("salon_post_comments").delete().eq("id", commentId);

  if (error) {
    redirect(buildRedirectNotice("/dashboard/feed", "Não foi possível excluir o comentário.", "error"));
  }

  revalidatePath("/dashboard/feed");
  redirect(buildRedirectNotice("/dashboard/feed", "Comentário removido com sucesso.", "success"));
}
