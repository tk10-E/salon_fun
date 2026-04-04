import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice, OPERATIONS_PATH } from "./shared";

const PRODUCT_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const PRODUCT_IMAGE_MAX_COUNT = 6;

function readNonNegativeNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function readUploadedFiles(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function buildInventoryProductUploadPath(salonId: string, file: File, fallbackExtension: string) {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase() ?? fallbackExtension
    : fallbackExtension;

  return `${salonId}/${randomUUID()}.${extension}`;
}

function revalidateOperationsPages() {
  revalidatePath(OPERATIONS_PATH);
  revalidatePath("/dashboard");
}

export async function saveStaffCommissionSettingsActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const commissionRatePercent = readNonNegativeNumber(formData.get("commissionRatePercent"));
  const commissionFlatFee = readNonNegativeNumber(formData.get("commissionFlatFee"));

  if (!staffMemberId || !Number.isFinite(commissionRatePercent) || !Number.isFinite(commissionFlatFee)) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Preencha uma comissão válida para o profissional.", "error"));
  }

  if (commissionRatePercent < 0 || commissionRatePercent > 100 || commissionFlatFee < 0) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "A comissão precisa ficar entre 0% e 100% e o fixo não pode ser negativo.", "error"));
  }

  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("id, name")
    .eq("salon_id", salon.id)
    .eq("id", staffMemberId)
    .maybeSingle();

  if (!staffMember?.id) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Profissional não encontrado para atualizar a comissão.", "error"));
  }

  const { error } = await supabase
    .from("staff_members")
    .update({
      commission_rate_percent: commissionRatePercent,
      commission_flat_fee: commissionFlatFee,
    })
    .eq("salon_id", salon.id)
    .eq("id", staffMemberId);

  if (error) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível salvar a comissão automática agora.", "error"));
  }

  revalidateOperationsPages();
  redirect(
    buildRedirectNotice(
      OPERATIONS_PATH,
      `Comissão automática de ${staffMember.name} atualizada com sucesso.`,
      "success",
    ),
  );
}

export async function saveInventoryProductActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const productId = String(formData.get("productId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const currentStock = readNonNegativeNumber(formData.get("currentStock"));
  const minimumStock = readNonNegativeNumber(formData.get("minimumStock"));
  const costPrice = readNonNegativeNumber(formData.get("costPrice"), Number.NaN);
  const retailPrice = readNonNegativeNumber(formData.get("retailPrice"), Number.NaN);
  const maxPurchaseQuantity = readNonNegativeNumber(formData.get("maxPurchaseQuantity"), 6);
  const isActive = formData.get("isActive") === "on";
  const productImages = readUploadedFiles(formData, "productImages");

  if (
    !name ||
    !Number.isFinite(currentStock) ||
    !Number.isFinite(minimumStock) ||
    !Number.isFinite(maxPurchaseQuantity)
  ) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Preencha nome e estoque do produto corretamente.", "error"));
  }

  if (
    currentStock < 0 ||
    minimumStock < 0 ||
    !Number.isInteger(maxPurchaseQuantity) ||
    maxPurchaseQuantity < 1 ||
    maxPurchaseQuantity > 99 ||
    (Number.isFinite(costPrice) && costPrice < 0) ||
    (Number.isFinite(retailPrice) && retailPrice < 0)
  ) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Os números do produto não podem ser negativos.", "error"));
  }

  if (description.length > 1200) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "A descrição do produto pode ter no máximo 1200 caracteres.", "error"));
  }

  if (productImages.length > PRODUCT_IMAGE_MAX_COUNT) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Envie no máximo 6 fotos por produto.", "error"));
  }

  for (const imageFile of productImages) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Envie apenas imagens válidas para a loja do salão.", "error"));
    }

    if (imageFile.size > PRODUCT_IMAGE_MAX_BYTES) {
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Cada foto do produto deve ter no máximo 4 MB.", "error"));
    }
  }

  const uploadedPaths: string[] = [];
  async function uploadProductImages() {
    for (const imageFile of productImages) {
      const uploadPath = buildInventoryProductUploadPath(salon.id, imageFile, "jpg");
      const bytes = Buffer.from(await imageFile.arrayBuffer());
      const { error: uploadError } = await supabase.storage.from("inventory-products").upload(uploadPath, bytes, {
        contentType: imageFile.type,
        upsert: false,
      });

      if (uploadError) {
        if (uploadedPaths.length) {
          await supabase.storage.from("inventory-products").remove(uploadedPaths);
        }
        redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível enviar as fotos do produto agora.", "error"));
      }

      uploadedPaths.push(uploadPath);
    }
  }

  const payload = {
    salon_id: salon.id,
    name,
    brand: brand || null,
    description: description || null,
    sku: sku || null,
    unit,
    current_stock: currentStock,
    minimum_stock: minimumStock,
    cost_price: Number.isFinite(costPrice) ? costPrice : null,
    retail_price: Number.isFinite(retailPrice) ? retailPrice : null,
    max_purchase_quantity: Math.trunc(maxPurchaseQuantity),
    is_active: isActive,
  };

  if (productId) {
    const { data: product } = await supabase
      .from("inventory_products")
      .select("id, name, image_paths")
      .eq("salon_id", salon.id)
      .eq("id", productId)
      .maybeSingle();

    if (!product?.id) {
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Produto não encontrado para atualização.", "error"));
    }

    const existingImagePaths = Array.isArray(product.image_paths)
      ? product.image_paths.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [];

    if (productImages.length) {
      await uploadProductImages();
    }

    const { error } = await supabase
      .from("inventory_products")
      .update({
        ...payload,
        image_paths: productImages.length ? uploadedPaths : existingImagePaths,
      })
      .eq("salon_id", salon.id)
      .eq("id", productId);

    if (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from("inventory-products").remove(uploadedPaths);
      }
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível atualizar o produto agora.", "error"));
    }

    if (uploadedPaths.length && existingImagePaths.length) {
      await supabase.storage.from("inventory-products").remove(existingImagePaths);
    }

    revalidateOperationsPages();
    redirect(buildRedirectNotice(OPERATIONS_PATH, `${product.name} atualizado com sucesso.`, "success"));
  }

  if (productImages.length) {
    await uploadProductImages();
  }

  const { error } = await supabase.from("inventory_products").insert({
    ...payload,
    image_paths: uploadedPaths,
  });

  if (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from("inventory-products").remove(uploadedPaths);
    }
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível criar o produto no estoque.", "error"));
  }

  revalidateOperationsPages();
  redirect(buildRedirectNotice(OPERATIONS_PATH, `${name} adicionado ao estoque.`, "success"));
}

export async function updateCustomerProductOrderStatusActionImpl(formData: FormData) {
  await requireOwnerSalon();
  const supabase = createClient();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toLowerCase();
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim();

  if (!orderId || !status) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Selecione um pedido válido para atualizar.", "error"));
  }

  if (status === "cancelled" && !cancellationReason) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Informe o motivo para cancelar o pedido da loja.", "error"));
  }

  const { data, error } = await supabase.rpc("update_customer_product_order_status", {
    order_id_input: orderId,
    status_input: status,
    cancellation_reason_input: cancellationReason || null,
  });

  if (error) {
    const rawMessage = error.message.toLowerCase();
    const message = rawMessage.includes("product_order_not_found")
      ? "Pedido da loja não encontrado."
      : rawMessage.includes("product_order_cancellation_reason_required")
      ? "Informe o motivo antes de cancelar o pedido da loja."
      : rawMessage.includes("completed_product_order_cannot_change_status")
      ? "Pedidos já concluídos não podem mudar de status."
      : rawMessage.includes("cancelled_product_order_cannot_change_status")
      ? "Pedidos cancelados não podem voltar para o fluxo."
      : rawMessage.includes("invalid_product_order_status")
      ? "Escolha um status válido para o pedido da loja."
      : "Não foi possível atualizar o pedido da loja agora.";
    redirect(buildRedirectNotice(OPERATIONS_PATH, message, "error"));
  }

  const orderResult = Array.isArray(data) ? data[0] : null;
  const orderLabel = orderResult?.order_number ? `Pedido #${orderResult.order_number}` : "Pedido da loja";
  const successMessage =
    status === "confirmed"
      ? `${orderLabel} confirmado com sucesso.`
      : status === "ready"
      ? `${orderLabel} marcado como pronto.`
      : status === "completed"
      ? `${orderLabel} concluído com sucesso.`
      : status === "cancelled"
      ? `${orderLabel} cancelado e estoque recomposto.`
      : `${orderLabel} atualizado com sucesso.`;

  revalidateOperationsPages();
  redirect(buildRedirectNotice(OPERATIONS_PATH, successMessage, "success"));
}

export async function registerInventoryMovementActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const productId = String(formData.get("productId") ?? "").trim();
  const movementType = String(formData.get("movementType") ?? "").trim().toLowerCase();
  const quantity = readNonNegativeNumber(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim();
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();

  if (!productId || !movementType || !Number.isFinite(quantity)) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Preencha o movimento de estoque corretamente.", "error"));
  }

  const { data: product } = await supabase
    .from("inventory_products")
    .select("id, name")
    .eq("salon_id", salon.id)
    .eq("id", productId)
    .maybeSingle();

  if (!product?.id) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Produto não encontrado para lançar o movimento.", "error"));
  }

  const { error } = await supabase.rpc("register_inventory_movement", {
    product_id_input: productId,
    movement_type_input: movementType,
    quantity_input: quantity,
    reason_input: reason || null,
    staff_member_id_input: staffMemberId || null,
  });

  if (error) {
    const rawMessage = error.message.toLowerCase();
    const message = rawMessage.includes("insufficient_inventory_stock")
      ? `O estoque de ${product.name} não cobre essa saída.`
      : rawMessage.includes("invalid_inventory_movement_type")
      ? "Escolha um tipo de movimento válido."
      : "Não foi possível registrar o movimento de estoque agora.";
    redirect(buildRedirectNotice(OPERATIONS_PATH, message, "error"));
  }

  const successMessage =
    movementType === "adjustment"
      ? `Estoque de ${product.name} ajustado com sucesso.`
      : movementType === "out"
      ? `Saída de ${product.name} registrada com sucesso.`
      : `Entrada de ${product.name} registrada com sucesso.`;

  revalidateOperationsPages();
  redirect(buildRedirectNotice(OPERATIONS_PATH, successMessage, "success"));
}
