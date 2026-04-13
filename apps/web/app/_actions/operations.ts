import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwnerSalon } from "@/lib/auth";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import { createClient } from "@/lib/supabase/server";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";
import { dispatchPendingWhatsAppNotifications } from "@/lib/whatsappDispatch";
import { sanitizePhone, sendSalonWhatsAppTextMessage } from "@/lib/whatsapp";

import {
  buildStoreProductNotification,
  buildRedirectNotice,
  COMMERCIAL_AUTOMATIONS_PATH,
  INVENTORY_PATH,
  OPERATIONS_PATH,
  queueCustomerNotification,
  resolveDashboardReturnPath,
} from "./shared";

const PRODUCT_IMAGE_MAX_COUNT = 6;
const INVENTORY_REDIRECT_PATHS = [
  OPERATIONS_PATH,
  INVENTORY_PATH,
  "/dashboard",
] as const;
const PRODUCT_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.product;
const AUTO_PILOT_REDIRECT_PATHS = [
  OPERATIONS_PATH,
  COMMERCIAL_AUTOMATIONS_PATH,
  "/dashboard",
  "/dashboard/client-app",
] as const;
const MONTHLY_TARGETS_REDIRECT_PATHS = [OPERATIONS_PATH, "/dashboard"] as const;

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

function buildInventoryProductUploadPath(salonId: string, extension: string) {
  return `${salonId}/${randomUUID()}.${extension}`;
}

function readMonthReference(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const parsed = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== 1) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function revalidateOperationsPages() {
  revalidatePath(OPERATIONS_PATH);
  revalidatePath(INVENTORY_PATH);
  revalidatePath("/dashboard");
}

export async function saveSalonMonthlyTargetsActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const returnPath = resolveDashboardReturnPath(
    formData,
    OPERATIONS_PATH,
    MONTHLY_TARGETS_REDIRECT_PATHS,
  );

  const referenceMonth = readMonthReference(formData.get("referenceMonth"));
  const revenueGoal = readNonNegativeNumber(formData.get("revenueGoal"));
  const completedAppointmentsGoal = readNonNegativeNumber(
    formData.get("completedAppointmentsGoal"),
  );
  const servedCustomersGoal = readNonNegativeNumber(
    formData.get("servedCustomersGoal"),
  );

  if (
    !referenceMonth ||
    !Number.isFinite(revenueGoal) ||
    !Number.isFinite(completedAppointmentsGoal) ||
    !Number.isFinite(servedCustomersGoal)
  ) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Preencha metas validas para salvar o mes.",
        "error",
      ),
    );
  }

  if (revenueGoal < 0 || completedAppointmentsGoal < 0 || servedCustomersGoal < 0) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "As metas precisam ser maiores ou iguais a zero.",
        "error",
      ),
    );
  }

  if (revenueGoal === 0 && completedAppointmentsGoal === 0 && servedCustomersGoal === 0) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Defina pelo menos uma meta acima de zero para este mes.",
        "error",
      ),
    );
  }

  const { error } = await supabase.from("salon_monthly_targets").upsert(
    {
      salon_id: salon.id,
      reference_month: referenceMonth,
      revenue_goal: revenueGoal,
      completed_appointments_goal: Math.round(completedAppointmentsGoal),
      served_customers_goal: Math.round(servedCustomersGoal),
    },
    {
      onConflict: "salon_id,reference_month",
    },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Nao foi possivel salvar as metas do mes agora.",
        "error",
      ),
    );
  }

  revalidateOperationsPages();
  redirect(
    buildRedirectNotice(
      returnPath,
      "Metas do mes salvas com sucesso.",
      "success",
    ),
  );
}

export async function runSalonAutoPilotActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const returnPath = resolveDashboardReturnPath(
    formData,
    OPERATIONS_PATH,
    AUTO_PILOT_REDIRECT_PATHS,
  );
  const runAt = new Date().toISOString();

  const [
    appointmentAutomationResult,
    growthAutomationResult,
    haircutRebookAutomationResult,
  ] =
    await Promise.all([
      supabase.rpc("queue_due_appointment_customer_notifications", {
        run_at: runAt,
      }),
      supabase.rpc("queue_due_customer_growth_notifications", {
        run_at: runAt,
      }),
      supabase.rpc("queue_due_haircut_rebook_notifications", {
        run_at: runAt,
      }),
    ]);

  if (
    appointmentAutomationResult.error ||
    growthAutomationResult.error ||
    haircutRebookAutomationResult.error
  ) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Nao foi possivel rodar o modo automatico agora.",
        "error",
      ),
    );
  }

  const dispatchResult = await dispatchPendingWhatsAppNotifications({
    limit: 25,
    salonId: salon.id,
  });

  if (!dispatchResult.ok) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "As automacoes foram geradas, mas nao consegui processar os envios do WhatsApp.",
        "error",
      ),
    );
  }

  revalidateOperationsPages();
  revalidatePath(COMMERCIAL_AUTOMATIONS_PATH);
  revalidatePath("/dashboard/client-app");

  if (dispatchResult.missingConfigSalons.length > 0) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "As automacoes foram geradas, mas o canal tecnico do WhatsApp deste salao ainda nao esta configurado.",
        "error",
      ),
    );
  }

  if (dispatchResult.processed === 0) {
    redirect(
      buildRedirectNotice(
        returnPath,
        "Modo automatico rodou agora e nao encontrou mensagens vencidas para disparar.",
        "success",
      ),
    );
  }

  const summary = [
    `${dispatchResult.sent} WhatsApp enviado${dispatchResult.sent === 1 ? "" : "s"}`,
    dispatchResult.missingPhone > 0
      ? `${dispatchResult.missingPhone} cliente${dispatchResult.missingPhone === 1 ? "" : "s"} sem telefone valido`
      : null,
    dispatchResult.failed > 0
      ? `${dispatchResult.failed} envio${dispatchResult.failed === 1 ? "" : "s"} com falha`
      : null,
  ]
    .filter(Boolean)
    .join(" • ");

  redirect(
    buildRedirectNotice(
      returnPath,
      `Modo automatico executado. ${summary}.`,
      "success",
    ),
  );
}

export async function sendCustomerReactivationActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const rawPhone = String(formData.get("customerPhone") ?? "").trim();
  const returnPath = String(formData.get("returnPath") ?? OPERATIONS_PATH);

  const sanitizedPhone = sanitizePhone(rawPhone);

  if (!sanitizedPhone) {
    redirect(buildRedirectNotice(returnPath, "Esse cliente não tem WhatsApp/telefone válido.", "error"));
  }

  const message = `Oi ${customerName || "cliente"}, aqui é do salão ${salon.name}. Faz um tempo que você não vem (temos horário livre esta semana). Quer agendar agora?`;

  const result = await sendSalonWhatsAppTextMessage(
    salon.id,
    sanitizedPhone,
    message,
  );

  if (!result.ok) {
    redirect(
      buildRedirectNotice(
        returnPath,
        result.reason === "missing_config"
          ? "Configure o canal tecnico do WhatsApp para enviar mensagens automáticas."
          : "Não foi possível enviar o WhatsApp agora.",
        "error",
      ),
    );
  }

  revalidateOperationsPages();
  redirect(buildRedirectNotice(returnPath, "Mensagem de reativação enviada no WhatsApp.", "success"));
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
  const redirectPath = resolveDashboardReturnPath(
    formData,
    OPERATIONS_PATH,
    INVENTORY_REDIRECT_PATHS,
  );

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
    redirect(buildRedirectNotice(redirectPath, "Preencha nome e estoque do produto corretamente.", "error"));
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
    redirect(buildRedirectNotice(redirectPath, "Os números do produto não podem ser negativos.", "error"));
  }

  if (description.length > 1200) {
    redirect(buildRedirectNotice(redirectPath, "A descrição do produto pode ter no máximo 1200 caracteres.", "error"));
  }

  if (productImages.length > PRODUCT_IMAGE_MAX_COUNT) {
    redirect(buildRedirectNotice(redirectPath, "Envie no máximo 6 fotos por produto.", "error"));
  }

  for (const imageFile of productImages) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(buildRedirectNotice(redirectPath, "Envie apenas imagens válidas para a loja do salão.", "error"));
    }

    if (imageFile.size > PRODUCT_IMAGE_PRESET.maxInputBytes) {
      redirect(
        buildRedirectNotice(
          redirectPath,
          `Cada foto do produto deve ter no maximo ${formatPresetMegabytes(
            PRODUCT_IMAGE_PRESET.maxInputBytes,
          )} MB.`,
          "error",
        ),
      );
    }
  }

  const uploadedPaths: string[] = [];
  async function uploadProductImages() {
    for (const imageFile of productImages) {
      let optimizedImage;

      try {
        optimizedImage = await optimizeUploadedImage(imageFile, "product");
      } catch {
        redirect(
          buildRedirectNotice(
            redirectPath,
            "Nao foi possivel processar uma das fotos do produto.",
            "error",
          ),
        );
      }

      const uploadPath = buildInventoryProductUploadPath(
        salon.id,
        optimizedImage.extension,
      );
      const { error: uploadError } = await supabase.storage
        .from("inventory-products")
        .upload(uploadPath, optimizedImage.buffer, {
          contentType: optimizedImage.contentType,
          upsert: false,
        });

      if (uploadError) {
        if (uploadedPaths.length) {
          await supabase.storage.from("inventory-products").remove(uploadedPaths);
        }
        redirect(buildRedirectNotice(redirectPath, "Não foi possível enviar as fotos do produto agora.", "error"));
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
      .select("id, name, brand, image_paths, is_active")
      .eq("salon_id", salon.id)
      .eq("id", productId)
      .maybeSingle();

    if (!product?.id) {
      redirect(buildRedirectNotice(redirectPath, "Produto não encontrado para atualização.", "error"));
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
      redirect(buildRedirectNotice(redirectPath, "Não foi possível atualizar o produto agora.", "error"));
    }

    if (uploadedPaths.length && existingImagePaths.length) {
      await supabase.storage.from("inventory-products").remove(existingImagePaths);
    }

    if (isActive) {
      const notification = buildStoreProductNotification({
        action: product.is_active ? "updated" : "published",
        productName: name,
        brand: brand || product.brand,
      });
      await queueCustomerNotification({
        supabase,
        salonId: salon.id,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        payload: notification.payload,
      });
    }

    revalidateOperationsPages();
    redirect(buildRedirectNotice(redirectPath, `${product.name} atualizado com sucesso.`, "success"));
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
    redirect(buildRedirectNotice(redirectPath, "Não foi possível criar o produto no estoque.", "error"));
  }

  if (isActive) {
    const notification = buildStoreProductNotification({
      action: "published",
      productName: name,
      brand,
    });
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
    });
  }

  revalidateOperationsPages();
  redirect(buildRedirectNotice(redirectPath, `${name} adicionado ao estoque.`, "success"));
}

export async function updateCustomerProductOrderStatusActionImpl(formData: FormData) {
  await requireOwnerSalon();
  const supabase = createClient();
  const redirectPath = resolveDashboardReturnPath(
    formData,
    OPERATIONS_PATH,
    INVENTORY_REDIRECT_PATHS,
  );

  const orderId = String(formData.get("orderId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toLowerCase();
  const cancellationReason = String(formData.get("cancellationReason") ?? "").trim();

  if (!orderId || !status) {
    redirect(buildRedirectNotice(redirectPath, "Selecione um pedido válido para atualizar.", "error"));
  }

  if (status === "cancelled" && !cancellationReason) {
    redirect(buildRedirectNotice(redirectPath, "Informe o motivo para cancelar o pedido da loja.", "error"));
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
    redirect(buildRedirectNotice(redirectPath, message, "error"));
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
  redirect(buildRedirectNotice(redirectPath, successMessage, "success"));
}

export async function registerInventoryMovementActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const redirectPath = resolveDashboardReturnPath(
    formData,
    OPERATIONS_PATH,
    INVENTORY_REDIRECT_PATHS,
  );

  const productId = String(formData.get("productId") ?? "").trim();
  const movementType = String(formData.get("movementType") ?? "").trim().toLowerCase();
  const quantity = readNonNegativeNumber(formData.get("quantity"));
  const reason = String(formData.get("reason") ?? "").trim();
  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();

  if (!productId || !movementType || !Number.isFinite(quantity)) {
    redirect(buildRedirectNotice(redirectPath, "Preencha o movimento de estoque corretamente.", "error"));
  }

  const { data: product } = await supabase
    .from("inventory_products")
    .select("id, name")
    .eq("salon_id", salon.id)
    .eq("id", productId)
    .maybeSingle();

  if (!product?.id) {
    redirect(buildRedirectNotice(redirectPath, "Produto não encontrado para lançar o movimento.", "error"));
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
    redirect(buildRedirectNotice(redirectPath, message, "error"));
  }

  const successMessage =
    movementType === "adjustment"
      ? `Estoque de ${product.name} ajustado com sucesso.`
      : movementType === "out"
      ? `Saída de ${product.name} registrada com sucesso.`
      : `Entrada de ${product.name} registrada com sucesso.`;

  revalidateOperationsPages();
  redirect(buildRedirectNotice(redirectPath, successMessage, "success"));
}
