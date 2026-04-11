import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice, FINANCE_PATH } from "./shared";

function normalizeDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

export async function createSalonFinancialTransactionActionImpl(
  formData: FormData,
) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const entryType = String(formData.get("entryType") ?? "").trim().toLowerCase();
  const amountValue = String(formData.get("amount") ?? "").trim();
  const occurredOnValue = String(formData.get("occurredOn") ?? "").trim();
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const amount = Number(amountValue.replace(",", "."));
  const occurredOn =
    normalizeDateInput(occurredOnValue) ??
    new Date().toISOString().slice(0, 10);

  if (
    !title ||
    !category ||
    !["income", "expense"].includes(entryType) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirect(
      buildRedirectNotice(
        FINANCE_PATH,
        "Preencha título, categoria, tipo e valor da transação.",
        "error",
      ),
    );
  }

  const financeTable = (supabase as any).from("salon_financial_transactions");
  const { error } = await financeTable.insert({
    salon_id: salon.id,
    title,
    category,
    entry_type: entryType,
    amount,
    occurred_on: occurredOn,
    payment_method: paymentMethod || null,
    notes: notes || null,
    source: "manual",
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        FINANCE_PATH,
        "Não foi possível salvar a transação agora.",
        "error",
      ),
    );
  }

  revalidatePath(FINANCE_PATH);
  revalidatePath("/dashboard");
  redirect(
    buildRedirectNotice(
      FINANCE_PATH,
      `${entryType === "expense" ? "Despesa" : "Receita"} lançada com sucesso.`,
      "success",
    ),
  );
}
