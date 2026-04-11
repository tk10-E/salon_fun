import { createClient } from "@/lib/supabase/server";
import {
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_NAV_LINKS,
  MANAGEMENT_PATHS,
} from "@/lib/management-navigation";

export { MANAGEMENT_BASE_PATH, MANAGEMENT_NAV_LINKS, MANAGEMENT_PATHS };

export const APPOINTMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Agendado", badgeClass: "badge--pending" },
  { value: "confirmed", label: "Confirmado", badgeClass: "badge--confirmed" },
  { value: "completed", label: "Concluído", badgeClass: "badge--completed" },
  { value: "cancelled", label: "Cancelado", badgeClass: "badge--cancelled" },
  { value: "no_show", label: "Faltou", badgeClass: "badge--soft" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credit_card", label: "Cartão de crédito" },
] as const;

export type ManagementAppointmentStatus =
  (typeof APPOINTMENT_STATUS_OPTIONS)[number]["value"];

export type ManagementPaymentMethod =
  (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

type RelationValue<T> = T | T[] | null | undefined;

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  id: string;
  name: string;
  duration: number;
  price: number | string;
  description: string | null;
  image_path: string | null;
  is_active: boolean;
  category: string;
  service_category_id: string;
  created_at: string;
  updated_at: string;
  service_categories?:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
};

type ProfessionalRow = {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_active: boolean;
  commission_rate_percent: number | string;
  created_at: string;
  updated_at: string;
};

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentRow = {
  id: string;
  customer_id: string;
  service_id: string;
  staff_member_id: string;
  date: string;
  ends_at: string;
  status: ManagementAppointmentStatus;
  notes: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  customers: RelationValue<{
    id: string;
    name: string;
    phone?: string | null;
  }>;
  services: RelationValue<{
    id: string;
    name: string;
    price: number | string;
    duration?: number;
  }>;
  staff_members: RelationValue<{
    id: string;
    name: string;
  }>;
};

type PaymentRow = {
  id: string;
  appointment_id: string;
  amount: number | string;
  payment_method: ManagementPaymentMethod;
  paid_at: string;
  notes: string | null;
  appointments: RelationValue<{
    id: string;
    status: ManagementAppointmentStatus;
    date: string;
    customer_id?: string;
    staff_member_id?: string;
    customers?: RelationValue<{ name: string }>;
    services?: RelationValue<{ name: string }>;
    staff_members?: RelationValue<{ name: string }>;
  }>;
};

export type ManagementSelectOption = {
  id: string;
  label: string;
  secondary?: string | null;
};

export type ManagementSelectOptions = {
  categories: ManagementSelectOption[];
  serviceFormCategories: ManagementSelectOption[];
  services: ManagementSelectOption[];
  professionals: ManagementSelectOption[];
  clients: ManagementSelectOption[];
};

export type DashboardProfessionalSummary = {
  id: string;
  name: string;
  scheduledCount: number;
  completedCount: number;
  revenue: number;
};

export type ManagementDashboardData = {
  stats: {
    appointmentsToday: number;
    revenueToday: number;
    clientsServedToday: number;
    upcomingCount: number;
  };
  todayAppointments: AppointmentRow[];
  upcomingAppointments: AppointmentRow[];
  professionalSummary: DashboardProfessionalSummary[];
};

export type ManagementAppointmentItem = AppointmentRow & {
  customerName: string;
  serviceName: string;
  servicePrice: number;
  professionalName: string;
  payment?: {
    id: string;
    amount: number;
    paymentMethod: ManagementPaymentMethod;
    paidAt: string;
  } | null;
};

export type ManagementClientItem = ClientRow & {
  upcomingCount: number;
  completedCount: number;
  lastVisitAt: string | null;
  history: Array<{
    id: string;
    date: string;
    serviceName: string;
    professionalName: string;
    status: ManagementAppointmentStatus;
  }>;
};

export type ManagementProfessionalItem = ProfessionalRow & {
  upcomingCount: number;
  completedCount: number;
  totalSold: number;
  commissionProjected: number;
};

export type ManagementCategoryItem = CategoryRow & {
  servicesCount: number;
  activeServicesCount: number;
};

export type ManagementServiceItem = ServiceRow & {
  categoryName: string;
  appointmentsCount: number;
  imageUrl: string | null;
};

export type ManagementPaymentItem = PaymentRow & {
  amountNumber: number;
  customerName: string;
  serviceName: string;
  professionalName: string;
};

export type ManagementPaymentsData = {
  summary: {
    totalReceived: number;
    byMethod: Record<ManagementPaymentMethod, number>;
  };
  items: ManagementPaymentItem[];
  unpaidAppointments: ManagementSelectOption[];
};

export type ManagementCommissionItem = {
  professionalId: string;
  professionalName: string;
  commissionRate: number;
  appointmentsCount: number;
  totalSold: number;
  commissionAmount: number;
};

const MANAGEMENT_SERVICE_FORM_CATEGORY_PRESETS = [
  {
    label: "Principal",
    secondary:
      "Use para o carro-chefe do salão, como corte, barba, química ou coloração.",
  },
  {
    label: "Complementar",
    secondary:
      "Use para extras, manutenção e adicionais vendidos junto do atendimento.",
  },
] as const;

function firstRelation<T>(value: RelationValue<T>) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeManagementLabel(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

type ServiceCategoryOptionRow = Pick<
  CategoryRow,
  "id" | "name" | "description" | "is_active"
>;

async function listManagementServiceCategories(args: {
  salonId: string;
  supabase: any;
}): Promise<ServiceCategoryOptionRow[]> {
  const result = await args.supabase
    .from("service_categories")
    .select("id, name, description, is_active")
    .eq("salon_id", args.salonId)
    .order("name");

  return (result.data ?? []) as ServiceCategoryOptionRow[];
}

async function ensureManagementServiceFormCategories(args: {
  salonId: string;
  supabase: any;
}): Promise<{
  allCategories: ServiceCategoryOptionRow[];
  formCategories: ManagementSelectOption[];
}> {
  let categories = await listManagementServiceCategories(args);
  const presetNames = new Set(
    MANAGEMENT_SERVICE_FORM_CATEGORY_PRESETS.map((item) =>
      normalizeManagementLabel(item.label),
    ),
  );
  const existingNames = new Set(
    categories.map((item) => normalizeManagementLabel(item.name)),
  );
  const missingPresets = MANAGEMENT_SERVICE_FORM_CATEGORY_PRESETS.filter(
    (item) => !existingNames.has(normalizeManagementLabel(item.label)),
  );

  if (missingPresets.length) {
    const insertResult = await args.supabase.from("service_categories").insert(
      missingPresets.map((item) => ({
        salon_id: args.salonId,
        name: item.label,
        description: item.secondary,
        is_active: true,
      })),
    );

    if (!insertResult.error || insertResult.error.code === "23505") {
      categories = await listManagementServiceCategories(args);
    }
  }

  const inactivePresetIds = categories
    .filter(
      (item) =>
        presetNames.has(normalizeManagementLabel(item.name)) && !item.is_active,
    )
    .map((item) => item.id);

  if (inactivePresetIds.length) {
    await args.supabase
      .from("service_categories")
      .update({ is_active: true })
      .eq("salon_id", args.salonId)
      .in("id", inactivePresetIds);

    categories = categories.map((item) =>
      inactivePresetIds.includes(item.id) ? { ...item, is_active: true } : item,
    );
  }

  const formCategories: ManagementSelectOption[] = [];

  for (const item of MANAGEMENT_SERVICE_FORM_CATEGORY_PRESETS) {
    const matchedCategory = categories.find(
      (category) =>
        normalizeManagementLabel(category.name) ===
        normalizeManagementLabel(item.label),
    );

    if (!matchedCategory) {
      continue;
    }

    formCategories.push({
      id: matchedCategory.id,
      label: item.label,
      secondary: item.secondary,
    });
  }

  return {
    allCategories: categories,
    formCategories: formCategories.length
      ? formCategories
      : categories
          .filter((item) => item.is_active)
          .slice(0, 2)
          .map((item) => ({
            id: item.id,
            label: item.name,
            secondary: item.description,
          })),
  };
}

function formatParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = formatParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

export function combineDateAndTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const firstOffset = getTimeZoneOffset(utcGuess, timeZone);
  const corrected = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffset(corrected, timeZone);

  if (secondOffset !== firstOffset) {
    return new Date(utcGuess.getTime() - secondOffset);
  }

  return corrected;
}

export function getLocalDateKey(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getUtcRangeForLocalDate(dayKey: string, timeZone: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayKey = `${nextDay.getUTCFullYear()}-${String(
    nextDay.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;

  return {
    start: combineDateAndTimeToUtc(dayKey, "00:00", timeZone),
    end: combineDateAndTimeToUtc(nextDayKey, "00:00", timeZone),
  };
}

export function formatDateInput(value: string | Date, timeZone: string) {
  return getLocalDateKey(value, timeZone);
}

export function formatTimeInput(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateLabel(
  value: string | Date,
  timeZone = "America/Sao_Paulo",
) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "medium",
  }).format(date);
}

export function formatTimeLabel(
  value: string | Date,
  timeZone = "America/Sao_Paulo",
) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDateTimeLabel(
  value: string | Date,
  timeZone = "America/Sao_Paulo",
) {
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatAppointmentStatusLabel(
  status: ManagementAppointmentStatus,
) {
  return (
    APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === status)?.label ??
    status
  );
}

export function getAppointmentStatusBadgeClass(
  status: ManagementAppointmentStatus,
) {
  return (
    APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === status)
      ?.badgeClass ?? "badge--soft"
  );
}

export function formatPaymentMethodLabel(value: ManagementPaymentMethod) {
  return (
    PAYMENT_METHOD_OPTIONS.find((item) => item.value === value)?.label ?? value
  );
}

export function buildFilterHref(
  pathname: string,
  current: Record<string, string | string[] | undefined> | undefined,
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (current) {
    for (const [key, rawValue] of Object.entries(current)) {
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      if (value) {
        params.set(key, value);
      }
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export async function loadManagementSelectOptions(
  salonId: string,
): Promise<ManagementSelectOptions> {
  const supabase = createClient() as any;
  const [categoryState, servicesResult, professionalsResult, clientsResult] =
    await Promise.all([
      ensureManagementServiceFormCategories({
        salonId,
        supabase,
      }),
      supabase
        .from("services")
        .select("id, name, price")
        .eq("salon_id", salonId)
        .eq("is_active", true)
        .order("category")
        .order("name"),
      supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("salon_id", salonId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("customers")
        .select("id, name, phone")
        .eq("salon_id", salonId)
        .order("name"),
    ]);

  return {
    categories: categoryState.allCategories
      .filter((item) => item.is_active)
      .map((item) => ({
        id: item.id,
        label: item.name,
      })),
    serviceFormCategories: categoryState.formCategories,
    services: (
      (servicesResult.data ?? []) as Array<{
        id: string;
        name: string;
        price?: number | string;
      }>
    ).map((item) => ({
      id: item.id,
      label: item.name,
      secondary:
        toNumber(item.price) > 0
          ? `R$ ${toNumber(item.price).toFixed(2)}`
          : null,
    })),
    professionals: (
      (professionalsResult.data ?? []) as Array<{
        id: string;
        name: string;
        role?: string | null;
      }>
    ).map((item) => ({
      id: item.id,
      label: item.name,
      secondary: item.role ?? null,
    })),
    clients: (
      (clientsResult.data ?? []) as Array<{
        id: string;
        name: string;
        phone?: string | null;
      }>
    ).map((item) => ({
      id: item.id,
      label: item.name,
      secondary: item.phone ?? null,
    })),
  };
}

export async function loadManagementDashboard(
  salonId: string,
  timeZone: string,
): Promise<ManagementDashboardData> {
  const supabase = createClient() as any;
  const now = new Date();
  const todayKey = getLocalDateKey(now, timeZone);
  const todayRange = getUtcRangeForLocalDate(todayKey, timeZone);

  const [todayAppointmentsResult, upcomingResult, todayPaymentsResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, completed_at, cancelled_at, cancellation_reason, customers(id, name, phone), services(id, name, price), staff_members(id, name)",
        )
        .eq("salon_id", salonId)
        .gte("date", todayRange.start.toISOString())
        .lt("date", todayRange.end.toISOString())
        .order("date", { ascending: true }),
      supabase
        .from("appointments")
        .select(
          "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, completed_at, cancelled_at, cancellation_reason, customers(id, name, phone), services(id, name, price), staff_members(id, name)",
        )
        .eq("salon_id", salonId)
        .gte("date", now.toISOString())
        .in("status", ["pending", "confirmed"])
        .order("date", { ascending: true })
        .limit(6),
      supabase
        .from("appointment_payments")
        .select("id, appointment_id, amount, payment_method, paid_at")
        .eq("salon_id", salonId)
        .gte("paid_at", todayRange.start.toISOString())
        .lt("paid_at", todayRange.end.toISOString())
        .order("paid_at", { ascending: false }),
    ]);

  const todayAppointments = (todayAppointmentsResult.data ??
    []) as AppointmentRow[];
  const upcomingAppointments = (upcomingResult.data ?? []) as AppointmentRow[];
  const todayPayments = (todayPaymentsResult.data ?? []) as Array<{
    id: string;
    appointment_id: string;
    amount: number | string;
  }>;

  const paymentByAppointment = new Map(
    todayPayments.map((item) => [item.appointment_id, toNumber(item.amount)]),
  );
  const servedCustomers = new Set<string>();
  const professionalSummaryMap = new Map<
    string,
    DashboardProfessionalSummary
  >();

  for (const appointment of todayAppointments) {
    const staff = firstRelation(appointment.staff_members);
    const service = firstRelation(appointment.services);

    if (!staff) {
      continue;
    }

    const current = professionalSummaryMap.get(staff.id) ?? {
      id: staff.id,
      name: staff.name,
      scheduledCount: 0,
      completedCount: 0,
      revenue: 0,
    };

    if (appointment.status !== "cancelled") {
      current.scheduledCount += 1;
    }

    if (appointment.status === "completed") {
      current.completedCount += 1;
      current.revenue +=
        paymentByAppointment.get(appointment.id) ?? toNumber(service?.price);
      servedCustomers.add(appointment.customer_id);
    }

    professionalSummaryMap.set(staff.id, current);
  }

  return {
    stats: {
      appointmentsToday: todayAppointments.filter(
        (item) => item.status !== "cancelled",
      ).length,
      revenueToday: todayPayments.reduce(
        (total, item) => total + toNumber(item.amount),
        0,
      ),
      clientsServedToday: servedCustomers.size,
      upcomingCount: upcomingAppointments.length,
    },
    todayAppointments,
    upcomingAppointments,
    professionalSummary: [...professionalSummaryMap.values()].sort(
      (left, right) =>
        right.revenue - left.revenue ||
        left.name.localeCompare(right.name, "pt-BR"),
    ),
  };
}

export async function loadManagementAppointments(args: {
  salonId: string;
  timeZone: string;
  dayKey: string;
  professionalId?: string;
  status?: string;
}) {
  const supabase = createClient() as any;
  const dayRange = getUtcRangeForLocalDate(args.dayKey, args.timeZone);
  let query = supabase
    .from("appointments")
    .select(
      "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, completed_at, cancelled_at, cancellation_reason, customers(id, name, phone), services(id, name, price), staff_members(id, name)",
    )
    .eq("salon_id", args.salonId)
    .gte("date", dayRange.start.toISOString())
    .lt("date", dayRange.end.toISOString())
    .order("date", { ascending: true });

  if (args.professionalId) {
    query = query.eq("staff_member_id", args.professionalId);
  }

  if (args.status) {
    query = query.eq("status", args.status);
  }

  const appointmentsResult = await query;
  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];

  const paymentIds = appointments.map((appointment) => appointment.id);
  const paymentsResult = paymentIds.length
    ? await supabase
        .from("appointment_payments")
        .select("id, appointment_id, amount, payment_method, paid_at")
        .in("appointment_id", paymentIds)
    : { data: [] as PaymentRow[] };
  const paymentsMap = new Map(
    (
      (paymentsResult.data ?? []) as Array<{
        id: string;
        appointment_id: string;
        amount: number | string;
        payment_method: ManagementPaymentMethod;
        paid_at: string;
      }>
    ).map((payment) => [
      payment.appointment_id,
      {
        id: payment.id,
        amount: toNumber(payment.amount),
        paymentMethod: payment.payment_method,
        paidAt: payment.paid_at,
      },
    ]),
  );

  const items: ManagementAppointmentItem[] = appointments.map((appointment) => {
    const customer = firstRelation(appointment.customers);
    const service = firstRelation(appointment.services);
    const professional = firstRelation(appointment.staff_members);

    return {
      ...appointment,
      customerName: customer?.name ?? "Cliente",
      serviceName: service?.name ?? "Serviço",
      servicePrice: toNumber(service?.price),
      professionalName: professional?.name ?? "Profissional",
      payment: paymentsMap.get(appointment.id) ?? null,
    };
  });

  const counts = {
    pending: items.filter((item) => item.status === "pending").length,
    confirmed: items.filter((item) => item.status === "confirmed").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    no_show: items.filter((item) => item.status === "no_show").length,
  };

  return {
    items,
    counts,
  };
}

export async function loadManagementClients(
  salonId: string,
  search = "",
): Promise<ManagementClientItem[]> {
  const supabase = createClient() as any;
  let query = supabase
    .from("customers")
    .select(
      "id, name, phone, whatsapp_phone, email, birth_date, notes, created_at, updated_at",
    )
    .eq("salon_id", salonId)
    .order("name", { ascending: true });

  if (search.trim()) {
    const normalized = search.trim();
    query = query.or(
      `name.ilike.%${normalized}%,phone.ilike.%${normalized}%,whatsapp_phone.ilike.%${normalized}%,email.ilike.%${normalized}%`,
    );
  }

  const clientsResult = await query;
  const clients = (clientsResult.data ?? []) as ClientRow[];
  const clientIds = clients.map((client) => client.id);

  const appointmentsResult = clientIds.length
    ? await supabase
        .from("appointments")
        .select(
          "id, customer_id, date, status, completed_at, services(name), staff_members(name)",
        )
        .eq("salon_id", salonId)
        .in("customer_id", clientIds)
        .order("date", { ascending: false })
        .limit(300)
    : { data: [] as AppointmentRow[] };

  const grouped = new Map<
    string,
    {
      upcomingCount: number;
      completedCount: number;
      lastVisitAt: string | null;
      history: ManagementClientItem["history"];
    }
  >();
  const nowIso = new Date().toISOString();

  for (const row of (appointmentsResult.data ?? []) as Array<
    AppointmentRow & { customer_id: string }
  >) {
    const current = grouped.get(row.customer_id) ?? {
      upcomingCount: 0,
      completedCount: 0,
      lastVisitAt: null,
      history: [],
    };

    if (row.status === "completed") {
      current.completedCount += 1;
      current.lastVisitAt = current.lastVisitAt ?? row.date;
    }

    if (
      (row.status === "pending" || row.status === "confirmed") &&
      row.date >= nowIso
    ) {
      current.upcomingCount += 1;
    }

    if (current.history.length < 5) {
      const service = firstRelation(row.services);
      const professional = firstRelation(row.staff_members);
      current.history.push({
        id: row.id,
        date: row.date,
        serviceName: service?.name ?? "Serviço",
        professionalName: professional?.name ?? "Profissional",
        status: row.status,
      });
    }

    grouped.set(row.customer_id, current);
  }

  return clients.map((client) => {
    const summary = grouped.get(client.id);

    return {
      ...client,
      upcomingCount: summary?.upcomingCount ?? 0,
      completedCount: summary?.completedCount ?? 0,
      lastVisitAt: summary?.lastVisitAt ?? null,
      history: summary?.history ?? [],
    };
  });
}

export async function loadManagementProfessionals(
  salonId: string,
): Promise<ManagementProfessionalItem[]> {
  const supabase = createClient() as any;
  const [professionalsResult, appointmentsResult] = await Promise.all([
    supabase
      .from("staff_members")
      .select(
        "id, name, role, phone, is_active, commission_rate_percent, created_at, updated_at",
      )
      .eq("salon_id", salonId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, staff_member_id, date, status, services(price)")
      .eq("salon_id", salonId)
      .gte("date", dayAtIso(-45))
      .order("date", { ascending: false })
      .limit(300),
  ]);

  const professionals = (professionalsResult.data ?? []) as ProfessionalRow[];
  const grouped = new Map<
    string,
    {
      upcomingCount: number;
      completedCount: number;
      totalSold: number;
    }
  >();
  const nowIso = new Date().toISOString();

  for (const appointment of (appointmentsResult.data ?? []) as Array<
    AppointmentRow & {
      staff_member_id: string;
    }
  >) {
    const current = grouped.get(appointment.staff_member_id) ?? {
      upcomingCount: 0,
      completedCount: 0,
      totalSold: 0,
    };

    if (
      (appointment.status === "pending" ||
        appointment.status === "confirmed") &&
      appointment.date >= nowIso
    ) {
      current.upcomingCount += 1;
    }

    if (appointment.status === "completed") {
      const service = firstRelation(appointment.services);
      current.completedCount += 1;
      current.totalSold += toNumber(service?.price);
    }

    grouped.set(appointment.staff_member_id, current);
  }

  return professionals.map((professional) => {
    const summary = grouped.get(professional.id);
    const commissionRate = toNumber(professional.commission_rate_percent);
    const totalSold = summary?.totalSold ?? 0;

    return {
      ...professional,
      upcomingCount: summary?.upcomingCount ?? 0,
      completedCount: summary?.completedCount ?? 0,
      totalSold,
      commissionProjected: totalSold * (commissionRate / 100),
    };
  });
}

export async function loadManagementCategories(
  salonId: string,
): Promise<ManagementCategoryItem[]> {
  const supabase = createClient() as any;
  const [categoriesResult, servicesResult] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id, name, description, is_active, created_at, updated_at")
      .eq("salon_id", salonId)
      .order("name", { ascending: true }),
    supabase
      .from("services")
      .select("id, service_category_id, is_active")
      .eq("salon_id", salonId),
  ]);

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const counters = new Map<
    string,
    { servicesCount: number; activeServicesCount: number }
  >();

  for (const service of (servicesResult.data ?? []) as Array<{
    service_category_id: string;
    is_active: boolean;
  }>) {
    const current = counters.get(service.service_category_id) ?? {
      servicesCount: 0,
      activeServicesCount: 0,
    };

    current.servicesCount += 1;
    if (service.is_active) {
      current.activeServicesCount += 1;
    }

    counters.set(service.service_category_id, current);
  }

  return categories.map((category) => ({
    ...category,
    servicesCount: counters.get(category.id)?.servicesCount ?? 0,
    activeServicesCount: counters.get(category.id)?.activeServicesCount ?? 0,
  }));
}

export async function loadManagementServices(args: {
  salonId: string;
  search?: string;
  categoryId?: string;
  status?: string;
}): Promise<ManagementServiceItem[]> {
  const supabase = createClient() as any;
  let query = supabase
    .from("services")
    .select(
      "id, name, duration, price, description, image_path, is_active, category, service_category_id, created_at, updated_at, service_categories(id, name)",
    )
    .eq("salon_id", args.salonId)
    .order("is_active", { ascending: false })
    .order("category")
    .order("name");

  if (args.categoryId) {
    query = query.eq("service_category_id", args.categoryId);
  }

  if (args.status === "active") {
    query = query.eq("is_active", true);
  } else if (args.status === "inactive") {
    query = query.eq("is_active", false);
  }

  if (args.search?.trim()) {
    const normalized = args.search.trim();
    query = query.or(
      `name.ilike.%${normalized}%,description.ilike.%${normalized}%,category.ilike.%${normalized}%`,
    );
  }

  const servicesResult = await query;
  const services = (servicesResult.data ?? []) as ServiceRow[];
  const serviceIds = services.map((service) => service.id);
  const appointmentsResult = serviceIds.length
    ? await supabase
        .from("appointments")
        .select("id, service_id")
        .eq("salon_id", args.salonId)
        .in("service_id", serviceIds)
    : { data: [] as Array<{ service_id: string }> };
  const appointmentCounts = new Map<string, number>();

  for (const appointment of (appointmentsResult.data ?? []) as Array<{
    service_id: string;
  }>) {
    appointmentCounts.set(
      appointment.service_id,
      (appointmentCounts.get(appointment.service_id) ?? 0) + 1,
    );
  }

  return services.map((service) => ({
    ...service,
    categoryName:
      firstRelation(service.service_categories)?.name ?? service.category,
    appointmentsCount: appointmentCounts.get(service.id) ?? 0,
    imageUrl: service.image_path
      ? supabase.storage.from("salon-assets").getPublicUrl(service.image_path)
          .data.publicUrl
      : null,
  }));
}

export async function loadManagementPayments(args: {
  salonId: string;
  timeZone: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
}): Promise<ManagementPaymentsData> {
  const supabase = createClient() as any;
  const todayKey = getLocalDateKey(new Date(), args.timeZone);
  const fromKey = args.dateFrom || todayKey;
  const toKey = args.dateTo || fromKey;
  const fromRange = getUtcRangeForLocalDate(fromKey, args.timeZone);
  const toRange = getUtcRangeForLocalDate(toKey, args.timeZone);
  let query = supabase
    .from("appointment_payments")
    .select(
      "id, appointment_id, amount, payment_method, paid_at, notes, appointments(id, status, date, customers(name), services(name), staff_members(name))",
    )
    .eq("salon_id", args.salonId)
    .gte("paid_at", fromRange.start.toISOString())
    .lt("paid_at", toRange.end.toISOString())
    .order("paid_at", { ascending: false });

  if (args.paymentMethod) {
    query = query.eq("payment_method", args.paymentMethod);
  }

  const paymentsResult = await query;
  const items = ((paymentsResult.data ?? []) as PaymentRow[]).map((item) => {
    const appointment = firstRelation(item.appointments);
    const customer = firstRelation(appointment?.customers);
    const service = firstRelation(appointment?.services);
    const professional = firstRelation(appointment?.staff_members);

    return {
      ...item,
      amountNumber: toNumber(item.amount),
      customerName: customer?.name ?? "Cliente",
      serviceName: service?.name ?? "Serviço",
      professionalName: professional?.name ?? "Profissional",
    };
  });

  const paidAppointmentIds = new Set(items.map((item) => item.appointment_id));
  const recentCompletedResult = await supabase
    .from("appointments")
    .select("id, date, customers(name), services(name)")
    .eq("salon_id", args.salonId)
    .eq("status", "completed")
    .gte("date", dayAtIso(-30))
    .order("date", { ascending: false })
    .limit(50);

  const unpaidAppointments = (
    (recentCompletedResult.data ?? []) as Array<{
      id: string;
      date: string;
      customers: RelationValue<{ name: string }>;
      services: RelationValue<{ name: string }>;
    }>
  )
    .filter((appointment) => !paidAppointmentIds.has(appointment.id))
    .map((appointment) => ({
      id: appointment.id,
      label: `${firstRelation(appointment.customers)?.name ?? "Cliente"} • ${firstRelation(appointment.services)?.name ?? "Serviço"}`,
      secondary: formatDateTimeLabel(appointment.date, args.timeZone),
    }));

  const byMethod: Record<ManagementPaymentMethod, number> = {
    pix: 0,
    cash: 0,
    debit_card: 0,
    credit_card: 0,
  };

  for (const item of items) {
    byMethod[item.payment_method] += item.amountNumber;
  }

  return {
    summary: {
      totalReceived: items.reduce(
        (total, item) => total + item.amountNumber,
        0,
      ),
      byMethod,
    },
    items,
    unpaidAppointments,
  };
}

export async function loadManagementCommissions(args: {
  salonId: string;
  timeZone: string;
  professionalId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const supabase = createClient() as any;
  const todayKey = getLocalDateKey(new Date(), args.timeZone);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const fromKey = args.dateFrom || monthStart;
  const toKey = args.dateTo || todayKey;
  const fromRange = getUtcRangeForLocalDate(fromKey, args.timeZone);
  const toRange = getUtcRangeForLocalDate(toKey, args.timeZone);
  let query = supabase
    .from("appointments")
    .select(
      "id, staff_member_id, date, completed_at, services(price), staff_members(name, commission_rate_percent)",
    )
    .eq("salon_id", args.salonId)
    .eq("status", "completed")
    .gte("date", fromRange.start.toISOString())
    .lt("date", toRange.end.toISOString())
    .order("date", { ascending: false });

  if (args.professionalId) {
    query = query.eq("staff_member_id", args.professionalId);
  }

  const appointmentsResult = await query;
  const grouped = new Map<string, ManagementCommissionItem>();

  for (const appointment of (appointmentsResult.data ?? []) as Array<
    AppointmentRow & { staff_member_id: string }
  >) {
    const professional = firstRelation(appointment.staff_members);
    const service = firstRelation(appointment.services);

    if (!professional) {
      continue;
    }

    const commissionRate = toNumber(
      (professional as { commission_rate_percent?: number | string })
        .commission_rate_percent,
    );
    const current = grouped.get(appointment.staff_member_id) ?? {
      professionalId: appointment.staff_member_id,
      professionalName: professional.name,
      commissionRate,
      appointmentsCount: 0,
      totalSold: 0,
      commissionAmount: 0,
    };

    current.appointmentsCount += 1;
    current.totalSold += toNumber(service?.price);
    current.commissionAmount = current.totalSold * (commissionRate / 100);

    grouped.set(appointment.staff_member_id, current);
  }

  return [...grouped.values()].sort(
    (left, right) =>
      right.commissionAmount - left.commissionAmount ||
      left.professionalName.localeCompare(right.professionalName, "pt-BR"),
  );
}

function dayAtIso(daysOffset: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}
