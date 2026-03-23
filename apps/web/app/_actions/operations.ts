import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice, OPERATIONS_PATH } from "./shared";

function readNonNegativeNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value == null || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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
  const sku = String(formData.get("sku") ?? "").trim();
  const unit = String(formData.get("unit") ?? "un").trim() || "un";
  const currentStock = readNonNegativeNumber(formData.get("currentStock"));
  const minimumStock = readNonNegativeNumber(formData.get("minimumStock"));
  const costPrice = readNonNegativeNumber(formData.get("costPrice"), Number.NaN);
  const retailPrice = readNonNegativeNumber(formData.get("retailPrice"), Number.NaN);
  const isActive = formData.get("isActive") === "on";

  if (!name || !Number.isFinite(currentStock) || !Number.isFinite(minimumStock)) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Preencha nome e estoque do produto corretamente.", "error"));
  }

  if (
    currentStock < 0 ||
    minimumStock < 0 ||
    (Number.isFinite(costPrice) && costPrice < 0) ||
    (Number.isFinite(retailPrice) && retailPrice < 0)
  ) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Os números do produto não podem ser negativos.", "error"));
  }

  const payload = {
    salon_id: salon.id,
    name,
    brand: brand || null,
    sku: sku || null,
    unit,
    current_stock: currentStock,
    minimum_stock: minimumStock,
    cost_price: Number.isFinite(costPrice) ? costPrice : null,
    retail_price: Number.isFinite(retailPrice) ? retailPrice : null,
    is_active: isActive,
  };

  if (productId) {
    const { data: product } = await supabase
      .from("inventory_products")
      .select("id, name")
      .eq("salon_id", salon.id)
      .eq("id", productId)
      .maybeSingle();

    if (!product?.id) {
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Produto não encontrado para atualização.", "error"));
    }

    const { error } = await supabase
      .from("inventory_products")
      .update(payload)
      .eq("salon_id", salon.id)
      .eq("id", productId);

    if (error) {
      redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível atualizar o produto agora.", "error"));
    }

    revalidateOperationsPages();
    redirect(buildRedirectNotice(OPERATIONS_PATH, `${product.name} atualizado com sucesso.`, "success"));
  }

  const { error } = await supabase.from("inventory_products").insert(payload);

  if (error) {
    redirect(buildRedirectNotice(OPERATIONS_PATH, "Não foi possível criar o produto no estoque.", "error"));
  }

  revalidateOperationsPages();
  redirect(buildRedirectNotice(OPERATIONS_PATH, `${name} adicionado ao estoque.`, "success"));
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
