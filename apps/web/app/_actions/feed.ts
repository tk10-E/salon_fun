import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  buildFeedPostNotification,
  buildRedirectNotice,
  queueCustomerNotification,
} from "./shared";

const FEED_PATH = "/dashboard/feed";

function readUploadedFiles(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function createSalonPostActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawCaption = String(formData.get("caption") ?? "").trim();
  const rawServiceId = String(formData.get("serviceId") ?? "").trim();
  const imageFiles = readUploadedFiles(formData, "images");

  if (!rawTitle) {
    redirect(buildRedirectNotice(FEED_PATH, "Informe um título para a foto.", "error"));
  }

  if (rawCaption.length > 500) {
    redirect(buildRedirectNotice(FEED_PATH, "A legenda pode ter no máximo 500 caracteres.", "error"));
  }

  if (!imageFiles.length) {
    redirect(buildRedirectNotice(FEED_PATH, "Selecione pelo menos uma imagem para publicar.", "error"));
  }

  if (imageFiles.length > 5) {
    redirect(buildRedirectNotice(FEED_PATH, "Envie no máximo 5 imagens por publicação.", "error"));
  }

  for (const imageFile of imageFiles) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(FEED_PATH, "Envie apenas imagens válidas para o feed.", "error"));
    }

    if (imageFile.size > 4 * 1024 * 1024) {
      redirect(buildRedirectNotice(FEED_PATH, "Cada imagem deve ter no máximo 4 MB.", "error"));
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
      redirect(buildRedirectNotice(FEED_PATH, "Selecione um serviço válido para vincular ao post.", "error"));
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
      redirect(buildRedirectNotice(FEED_PATH, "Não foi possível enviar as imagens do post.", "error"));
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
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível criar a publicação.", "error"));
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
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível salvar a galeria do post.", "error"));
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

  revalidatePath(FEED_PATH);
  redirect(buildRedirectNotice(FEED_PATH, "Publicação criada com sucesso.", "success"));
}

export async function deleteSalonPostActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const postId = String(formData.get("postId") ?? "");

  if (!postId) {
    redirect(buildRedirectNotice(FEED_PATH, "Publicação inválida.", "error"));
  }

  const { data: post, error: loadError } = await supabase
    .from("salon_posts")
    .select("id, image_path, salon_post_images(image_path)")
    .eq("id", postId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (loadError || !post) {
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível localizar a publicação.", "error"));
  }

  const { error } = await supabase
    .from("salon_posts")
    .delete()
    .eq("id", postId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível excluir a publicação.", "error"));
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

  revalidatePath(FEED_PATH);
  redirect(buildRedirectNotice(FEED_PATH, "Publicação removida com sucesso.", "success"));
}

export async function deleteSalonPostCommentActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const commentId = String(formData.get("commentId") ?? "");

  if (!commentId) {
    redirect(buildRedirectNotice(FEED_PATH, "Comentário inválido.", "error"));
  }

  const { data: comment, error: loadError } = await supabase
    .from("salon_post_comments")
    .select("id, post_id, salon_posts!inner(salon_id)")
    .eq("id", commentId)
    .eq("salon_posts.salon_id", salon.id)
    .maybeSingle();

  if (loadError || !comment) {
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível localizar o comentário.", "error"));
  }

  const { error } = await supabase.from("salon_post_comments").delete().eq("id", commentId);

  if (error) {
    redirect(buildRedirectNotice(FEED_PATH, "Não foi possível excluir o comentário.", "error"));
  }

  revalidatePath(FEED_PATH);
  redirect(buildRedirectNotice(FEED_PATH, "Comentário removido com sucesso.", "success"));
}
