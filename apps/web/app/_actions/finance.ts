import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { isNativeFinanceSource } from "@/lib/financeSources";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice, FINANCE_PATH } from "./shared";

type RecurringCadence = "weekly" | "monthly" | "yearly";

function normalizeDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function parseAmountInput(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .trim()
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeCadenceInput(value: FormDataEntryValue | null): RecurringCadence | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "weekly" || normalized === "monthly" || normalized === "yearly") {
    return normalized;
  }

  return null;
}

function currentDateKey(timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildFinanceError(message: string) {
  redirect(buildRedirectNotice(FINANCE_PATH, message, "error"));
}

function revalidateFinancePaths() {
  revalidatePath(FINANCE_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/gestao/comissoes");
  revalidatePath("/dashboard/operations");
}

function advanceRecurringDueDate(currentDueOn: string, cadence: RecurringCadence) {
  const [year, month, day] = currentDueOn.split("-").map((value) => Number(value));
  const dueDate = new Date(Date.UTC(year, month - 1, day, 12));

  if (cadence === "weekly") {
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);
  } else if (cadence === "monthly") {
    dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
  } else {
    dueDate.setUTCFullYear(dueDate.getUTCFullYear() + 1);
  }

  return dueDate.toISOString().slice(0, 10);
}

function addDaysToDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function loadCashSessionMovementSummary(args: {
  openingAmount: number;
  salonId: string;
  sessionDate: string;
  supabase: any;
  timeZone: string;
}) {
  const rangeStartIso = `${addDaysToDateKey(args.sessionDate, -1)}T00:00:00.000Z`;
  const rangeEndIso = `${addDaysToDateKey(args.sessionDate, 2)}T00:00:00.000Z`;
  const financeTable = args.supabase.from("salon_financial_transactions");

  const [
    appointmentPaymentsResult,
    storeOrdersResult,
    tabPaymentsResult,
    manualEntriesResult,
  ] = await Promise.all([
    args.supabase
      .from("appointment_payments")
      .select("amount, paid_at")
      .eq("salon_id", args.salonId)
      .gte("paid_at", rangeStartIso)
      .lt("paid_at", rangeEndIso),
    args.supabase
      .from("customer_product_orders")
      .select("subtotal_amount, completed_at")
      .eq("salon_id", args.salonId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", rangeStartIso)
      .lt("completed_at", rangeEndIso),
    args.supabase
      .from("customer_tab_payments")
      .select("amount, created_at")
      .eq("salon_id", args.salonId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso),
    financeTable
      .select("entry_type, amount, occurred_on, source")
      .eq("salon_id", args.salonId)
      .eq("occurred_on", args.sessionDate),
  ]);

  if (
    appointmentPaymentsResult.error ||
    storeOrdersResult.error ||
    tabPaymentsResult.error ||
    manualEntriesResult.error
  ) {
    buildFinanceError("Não foi possível calcular o fechamento do caixa agora.");
  }

  const appointmentPayments = (appointmentPaymentsResult.data ?? []) as Array<{
    amount: number | string;
    paid_at: string;
  }>;
  const storeOrders = (storeOrdersResult.data ?? []) as Array<{
    completed_at: string | null;
    subtotal_amount: number | string;
  }>;
  const tabPayments = (tabPaymentsResult.data ?? []) as Array<{
    amount: number | string;
    created_at: string;
  }>;
  const manualEntries = (manualEntriesResult.data ?? []) as Array<{
    amount: number | string;
    entry_type: "income" | "expense";
    occurred_on: string;
    source:
      | "manual"
      | "appointment"
      | "store_order"
      | "customer_tab"
      | "team_payout"
      | "recurring_expense"
      | "payable";
  }>;
  const supplementalEntries = manualEntries.filter(
    (item) => !isNativeFinanceSource(item.source),
  );

  const appointmentIncome = appointmentPayments
    .filter((item) => dateKeyInTimeZone(item.paid_at, args.timeZone) === args.sessionDate)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const storeIncome = storeOrders
    .filter(
      (item) =>
        item.completed_at &&
        dateKeyInTimeZone(item.completed_at, args.timeZone) === args.sessionDate,
    )
    .reduce((sum, item) => sum + Number(item.subtotal_amount ?? 0), 0);
  const tabIncome = tabPayments
    .filter((item) => dateKeyInTimeZone(item.created_at, args.timeZone) === args.sessionDate)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const manualIncome = supplementalEntries
    .filter((item) => item.entry_type === "income" && item.occurred_on === args.sessionDate)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const manualExpense = supplementalEntries
    .filter((item) => item.entry_type === "expense" && item.occurred_on === args.sessionDate)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  const incomeAmount = Number(
    (appointmentIncome + storeIncome + tabIncome + manualIncome).toFixed(2),
  );
  const expenseAmount = Number(manualExpense.toFixed(2));
  const expectedBalance = Number(
    (args.openingAmount + incomeAmount - expenseAmount).toFixed(2),
  );

  return {
    expectedBalance,
    expenseAmount,
    incomeAmount,
  };
}

export async function createSalonFinancialTransactionActionImpl(
  formData: FormData,
) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const entryType = String(formData.get("entryType") ?? "").trim().toLowerCase();
  const amount = parseAmountInput(formData.get("amount"));
  const occurredOn =
    normalizeDateInput(String(formData.get("occurredOn") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (
    !title ||
    !category ||
    !["income", "expense"].includes(entryType) ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    buildFinanceError("Preencha título, categoria, tipo e valor da transação.");
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
    buildFinanceError("Não foi possível salvar a transação agora.");
  }

  revalidateFinancePaths();
  redirect(
    buildRedirectNotice(
      FINANCE_PATH,
      `${entryType === "expense" ? "Despesa" : "Receita"} lançada com sucesso.`,
      "success",
    ),
  );
}

export async function createTeamPayoutActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const staffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const amount = parseAmountInput(formData.get("amount"));
  const paidOn =
    normalizeDateInput(String(formData.get("paidOn") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!staffMemberId || !Number.isFinite(amount) || amount <= 0) {
    buildFinanceError("Selecione o profissional e informe um valor válido para o repasse.");
  }

  const staffResult = await supabase
    .from("staff_members")
    .select("id, name")
    .eq("id", staffMemberId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (staffResult.error || !staffResult.data?.id) {
    buildFinanceError("Não foi possível localizar esse profissional para registrar o repasse.");
  }

  const financeTable = supabase.from("salon_financial_transactions");
  const { error } = await financeTable.insert({
    salon_id: salon.id,
    staff_member_id: staffResult.data.id,
    title: `Repasse - ${staffResult.data.name}`,
    category: "equipe",
    entry_type: "expense",
    amount,
    occurred_on: paidOn,
    payment_method: paymentMethod || null,
    notes: notes || null,
    source: "team_payout",
  });

  if (error) {
    buildFinanceError("Não foi possível registrar o repasse da equipe agora.");
  }

  revalidateFinancePaths();
  redirect(
    buildRedirectNotice(FINANCE_PATH, "Repasse da equipe registrado com sucesso.", "success"),
  );
}

export async function openCashSessionActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const sessionDate =
    normalizeDateInput(String(formData.get("sessionDate") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");
  const rawOpeningAmount = String(formData.get("openingAmount") ?? "").trim();
  const openingAmount = rawOpeningAmount ? parseAmountInput(rawOpeningAmount) : 0;
  const openingNote = String(formData.get("openingNote") ?? "").trim();

  if (!Number.isFinite(openingAmount) || openingAmount < 0) {
    buildFinanceError("Informe um saldo inicial válido para abrir o caixa.");
  }

  const existingSessionResult = await supabase
    .from("salon_cash_sessions")
    .select("id, status")
    .eq("salon_id", salon.id)
    .eq("session_date", sessionDate)
    .maybeSingle();

  if (existingSessionResult.error) {
    buildFinanceError("Não foi possível validar o caixa desse dia agora.");
  }

  if (existingSessionResult.data?.id) {
    buildFinanceError("Esse dia já possui um caixa aberto ou fechado.");
  }

  const { error } = await supabase.from("salon_cash_sessions").insert({
    salon_id: salon.id,
    session_date: sessionDate,
    opened_by: user.id,
    opening_amount: openingAmount,
    opening_note: openingNote || null,
  });

  if (error) {
    buildFinanceError("Não foi possível abrir o caixa agora.");
  }

  revalidateFinancePaths();
  redirect(buildRedirectNotice(FINANCE_PATH, "Caixa aberto com sucesso.", "success"));
}

export async function closeCashSessionActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const reportedAmount = parseAmountInput(formData.get("reportedAmount"));
  const closingNote = String(formData.get("closingNote") ?? "").trim();

  if (!sessionId || !Number.isFinite(reportedAmount) || reportedAmount < 0) {
    buildFinanceError("Informe o valor contado para fechar o caixa.");
  }

  const sessionResult = await supabase
    .from("salon_cash_sessions")
    .select("id, session_date, status, opening_amount")
    .eq("id", sessionId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (sessionResult.error || !sessionResult.data?.id) {
    buildFinanceError("Não foi possível localizar esse caixa.");
  }

  if (sessionResult.data.status === "closed") {
    buildFinanceError("Esse caixa já foi fechado.");
  }

  const summary = await loadCashSessionMovementSummary({
    openingAmount: Number(sessionResult.data.opening_amount ?? 0),
    salonId: salon.id,
    sessionDate: sessionResult.data.session_date,
    supabase,
    timeZone: salon.timezone ?? "America/Sao_Paulo",
  });
  const differenceAmount = Number(
    (reportedAmount - summary.expectedBalance).toFixed(2),
  );

  const { error } = await supabase
    .from("salon_cash_sessions")
    .update({
      closed_at: new Date().toISOString(),
      closed_by: user.id,
      closing_difference_amount: differenceAmount,
      closing_expected_amount: summary.expectedBalance,
      closing_note: closingNote || null,
      closing_reported_amount: reportedAmount,
      status: "closed",
    })
    .eq("id", sessionResult.data.id)
    .eq("salon_id", salon.id);

  if (error) {
    buildFinanceError("Não foi possível fechar o caixa agora.");
  }

  revalidateFinancePaths();
  redirect(
    buildRedirectNotice(
      FINANCE_PATH,
      differenceAmount === 0
        ? "Caixa fechado sem diferença."
        : `Caixa fechado com diferença de ${differenceAmount > 0 ? "+" : ""}${differenceAmount.toFixed(2)}.`,
      "success",
    ),
  );
}

export async function createRecurringExpenseRuleActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amount = parseAmountInput(formData.get("amount"));
  const cadence = normalizeCadenceInput(formData.get("cadence"));
  const nextDueOn =
    normalizeDateInput(String(formData.get("nextDueOn") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title || !category || !cadence || !Number.isFinite(amount) || amount <= 0) {
    buildFinanceError("Preencha título, categoria, frequência e valor da conta fixa.");
  }

  const { error } = await supabase.from("salon_recurring_expenses").insert({
    salon_id: salon.id,
    title,
    category,
    amount,
    cadence,
    next_due_on: nextDueOn,
    payment_method: paymentMethod || null,
    notes: notes || null,
  });

  if (error) {
    buildFinanceError("Não foi possível salvar essa conta fixa agora.");
  }

  revalidateFinancePaths();
  redirect(buildRedirectNotice(FINANCE_PATH, "Conta fixa salva com sucesso.", "success"));
}

export async function toggleRecurringExpenseRuleActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const ruleId = String(formData.get("ruleId") ?? "").trim();
  const nextState = String(formData.get("nextState") ?? "").trim().toLowerCase();
  const isActive = nextState === "active";

  if (!ruleId || !["active", "paused"].includes(nextState)) {
    buildFinanceError("Não foi possível atualizar essa conta fixa.");
  }

  const { error } = await supabase
    .from("salon_recurring_expenses")
    .update({ is_active: isActive })
    .eq("id", ruleId)
    .eq("salon_id", salon.id);

  if (error) {
    buildFinanceError("Não foi possível atualizar o status dessa conta fixa.");
  }

  revalidateFinancePaths();
  redirect(
    buildRedirectNotice(
      FINANCE_PATH,
      isActive ? "Conta fixa reativada com sucesso." : "Conta fixa pausada com sucesso.",
      "success",
    ),
  );
}

export async function recordRecurringExpensePostingActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const ruleId = String(formData.get("ruleId") ?? "").trim();

  if (!ruleId) {
    buildFinanceError("Não foi possível localizar a conta fixa para lançar o vencimento.");
  }

  const ruleResult = await supabase
    .from("salon_recurring_expenses")
    .select(
      "id, title, category, amount, cadence, next_due_on, last_posted_on, payment_method, notes, is_active",
    )
    .eq("id", ruleId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (ruleResult.error || !ruleResult.data?.id) {
    buildFinanceError("Não foi possível localizar essa conta fixa.");
  }

  if (!ruleResult.data.is_active) {
    buildFinanceError("Reative a conta fixa antes de lançar um novo vencimento.");
  }

  const existingPostingResult = await supabase
    .from("salon_financial_transactions")
    .select("id")
    .eq("salon_id", salon.id)
    .eq("recurring_expense_id", ruleResult.data.id)
    .eq("source", "recurring_expense")
    .eq("occurred_on", ruleResult.data.next_due_on)
    .maybeSingle();

  if (existingPostingResult.data?.id) {
    buildFinanceError("Esse vencimento já foi lançado no caixa.");
  }

  if (existingPostingResult.error && existingPostingResult.error.code !== "PGRST116") {
    buildFinanceError("Não foi possível validar o vencimento dessa conta fixa.");
  }

  const { error: transactionError } = await supabase
    .from("salon_financial_transactions")
    .insert({
      salon_id: salon.id,
      recurring_expense_id: ruleResult.data.id,
      title: ruleResult.data.title,
      category: ruleResult.data.category,
      entry_type: "expense",
      amount: ruleResult.data.amount,
      occurred_on: ruleResult.data.next_due_on,
      payment_method: ruleResult.data.payment_method ?? null,
      notes: ruleResult.data.notes ?? null,
      source: "recurring_expense",
    });

  if (transactionError) {
    buildFinanceError("Não foi possível lançar esse vencimento agora.");
  }

  const nextDueOn = advanceRecurringDueDate(
    ruleResult.data.next_due_on,
    ruleResult.data.cadence as RecurringCadence,
  );
  const { error: updateError } = await supabase
    .from("salon_recurring_expenses")
    .update({
      last_posted_on: ruleResult.data.next_due_on,
      next_due_on: nextDueOn,
    })
    .eq("id", ruleResult.data.id)
    .eq("salon_id", salon.id);

  if (updateError) {
    buildFinanceError("O vencimento entrou no caixa, mas não foi possível avançar a próxima cobrança.");
  }

  revalidateFinancePaths();
  redirect(
    buildRedirectNotice(FINANCE_PATH, "Vencimento da conta fixa lançado no caixa.", "success"),
  );
}

export async function createPayableActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amount = parseAmountInput(formData.get("amount"));
  const dueOn =
    normalizeDateInput(String(formData.get("dueOn") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!title || !category || !Number.isFinite(amount) || amount <= 0) {
    buildFinanceError("Preencha título, categoria, valor e vencimento da conta a pagar.");
  }

  const { error } = await supabase.from("salon_payables").insert({
    salon_id: salon.id,
    title,
    category,
    amount,
    due_on: dueOn,
    payment_method: paymentMethod || null,
    notes: notes || null,
  });

  if (error) {
    buildFinanceError("Não foi possível salvar essa conta a pagar agora.");
  }

  revalidateFinancePaths();
  redirect(buildRedirectNotice(FINANCE_PATH, "Conta a pagar salva com sucesso.", "success"));
}

export async function settlePayableActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const payableId = String(formData.get("payableId") ?? "").trim();
  const paidOn =
    normalizeDateInput(String(formData.get("paidOn") ?? "").trim()) ??
    currentDateKey(salon.timezone ?? "America/Sao_Paulo");

  if (!payableId) {
    buildFinanceError("Não foi possível localizar essa conta a pagar.");
  }

  const payableResult = await supabase
    .from("salon_payables")
    .select("id, title, category, amount, payment_method, notes, status")
    .eq("id", payableId)
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (payableResult.error || !payableResult.data?.id) {
    buildFinanceError("Não foi possível localizar essa conta a pagar.");
  }

  if (payableResult.data.status === "paid") {
    buildFinanceError("Essa conta já foi baixada no caixa.");
  }

  if (payableResult.data.status === "cancelled") {
    buildFinanceError("Reabra a conta antes de marcar como paga.");
  }

  const existingPostingResult = await supabase
    .from("salon_financial_transactions")
    .select("id")
    .eq("salon_id", salon.id)
    .eq("payable_id", payableResult.data.id)
    .eq("source", "payable")
    .maybeSingle();

  if (existingPostingResult.data?.id) {
    buildFinanceError("Essa conta já possui baixa financeira vinculada.");
  }

  const { error: transactionError } = await supabase
    .from("salon_financial_transactions")
    .insert({
      salon_id: salon.id,
      payable_id: payableResult.data.id,
      title: payableResult.data.title,
      category: payableResult.data.category,
      entry_type: "expense",
      amount: payableResult.data.amount,
      occurred_on: paidOn,
      payment_method: payableResult.data.payment_method ?? null,
      notes: payableResult.data.notes ?? null,
      source: "payable",
    });

  if (transactionError) {
    buildFinanceError("Não foi possível baixar essa conta no caixa.");
  }

  const { error: updateError } = await supabase
    .from("salon_payables")
    .update({
      status: "paid",
      paid_on: paidOn,
    })
    .eq("id", payableResult.data.id)
    .eq("salon_id", salon.id);

  if (updateError) {
    buildFinanceError("A conta entrou no caixa, mas o status não foi atualizado.");
  }

  revalidateFinancePaths();
  redirect(buildRedirectNotice(FINANCE_PATH, "Conta baixada no caixa com sucesso.", "success"));
}
