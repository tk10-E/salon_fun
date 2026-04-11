import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildRedirectNotice } from "./shared";

const COMANDAS_PATH = "/dashboard/operations/comandas";

function readNumber(value: FormDataEntryValue | null, allowZero = false) {
  if (value == null) return NaN;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return NaN;
  if (!allowZero && parsed <= 0) return NaN;
  return parsed;
}

export async function openTabActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();

  const customerId = String(formData.get("customerId") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const { error } = await supabase.from("customer_tabs").insert({
    salon_id: salon.id,
    customer_id: customerId || null,
    opened_by: user.id,
    notes,
  });

  if (error) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Não foi possível abrir a comanda agora.", "error"));
  }

  revalidatePath(COMANDAS_PATH);
  redirect(buildRedirectNotice(COMANDAS_PATH, "Comanda aberta.", "success"));
}

export async function addTabItemActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const tabId = String(formData.get("tabId") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const quantity = readNumber(formData.get("quantity"));
  const unitPrice = readNumber(formData.get("unitPrice"), true);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const productId = String(formData.get("productId") ?? "").trim();

  if (!tabId || !description || !Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Preencha item e valores válidos.", "error"));
  }

  const { error } = await supabase.from("customer_tab_items").insert({
    tab_id: tabId,
    salon_id: salon.id,
    description,
    quantity,
    unit_price: unitPrice,
    service_id: serviceId || null,
    inventory_product_id: productId || null,
  });

  if (error) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Não foi possível adicionar o item.", "error"));
  }

  revalidatePath(COMANDAS_PATH);
  redirect(buildRedirectNotice(COMANDAS_PATH, "Item adicionado.", "success"));
}

export async function addTabPaymentActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const tabId = String(formData.get("tabId") ?? "").trim();
  const amount = readNumber(formData.get("amount"));
  const method = String(formData.get("method") ?? "pix").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!tabId || !Number.isFinite(amount)) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Valor de pagamento inválido.", "error"));
  }

  const { error } = await supabase.from("customer_tab_payments").insert({
    tab_id: tabId,
    salon_id: salon.id,
    amount,
    method,
    note,
  });

  if (error) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Não foi possível registrar o pagamento.", "error"));
  }

  revalidatePath(COMANDAS_PATH);
  redirect(buildRedirectNotice(COMANDAS_PATH, "Pagamento registrado.", "success"));
}

export async function closeTabActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const tabId = String(formData.get("tabId") ?? "").trim();
  const status = String(formData.get("status") ?? "closed").trim();

  if (!tabId) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Comanda não encontrada.", "error"));
  }

  const { error } = await supabase
    .from("customer_tabs")
    .update({ status, closed_at: status === "closed" ? new Date().toISOString() : null })
    .eq("id", tabId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(COMANDAS_PATH, "Não foi possível atualizar a comanda.", "error"));
  }

  revalidatePath(COMANDAS_PATH);
  redirect(buildRedirectNotice(COMANDAS_PATH, status === "closed" ? "Comanda fechada." : "Comanda cancelada.", "success"));
}
