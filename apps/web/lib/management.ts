import { createClient } from "@/lib/supabase/server";
import {
  APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS,
  formatAppointmentPaymentPreferenceLabel,
  type AppointmentPaymentPreference,
} from "@/lib/appointmentPaymentPreference";
import {
  calculateProjectedCommissionAmount,
  resolveBookedAppointmentAmount,
} from "@/lib/financialMetrics";
import { listIgnoredPendingSettlementAppointmentIds } from "@/lib/pendingSettlementReconciliation";
import { listResolvedAppointmentReviews } from "@/lib/appointmentReviews";
import { listResolvedAppointmentPlanReservations } from "@/lib/appointmentPlanReservations";
import {
  MANAGEMENT_BASE_PATH,
  MANAGEMENT_NAV_LINKS,
  MANAGEMENT_PATHS,
} from "@/lib/management-navigation";

export { MANAGEMENT_BASE_PATH, MANAGEMENT_NAV_LINKS, MANAGEMENT_PATHS };
export {
  APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS,
  formatAppointmentPaymentPreferenceLabel,
};

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
  commission_flat_fee: number | string;
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  image_path: string | null;
  is_active: boolean;
  commission_rate_percent: number | string;
  created_at: string;
  updated_at: string;
};

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  notes: string | null;
  profile_image_path: string | null;
  created_at: string;
  updated_at: string;
};

type AppointmentRow = {
  booking_policy_snapshot?: string | null;
  customer_confirmation_requested_at?: string | null;
  id: string;
  customer_presence_confirmed_at?: string | null;
  customer_id: string;
  deposit_amount?: number | string | null;
  deposit_customer_reported_paid_at?: string | null;
  deposit_customer_reported_paid_via?: string | null;
  deposit_customer_reported_reference?: string | null;
  deposit_paid_at?: string | null;
  deposit_status?: string | null;
  service_id: string;
  staff_member_id: string;
  date: string;
  ends_at: string;
  status: ManagementAppointmentStatus;
  notes: string | null;
  payment_preference?: AppointmentPaymentPreference | null;
  protection_confirmation_required?: boolean | null;
  service_price_snapshot?: number | string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  customers: RelationValue<{
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    profile_image_path?: string | null;
  }>;
  services: RelationValue<{
    id: string;
    duration?: number;
    name: string;
    price: number | string;
  }>;
  staff_members: RelationValue<{
    commission_flat_fee?: number | string | null;
    commission_rate_percent?: number | string | null;
    id: string;
    image_path?: string | null;
    name: string;
  }>;
};

type AppointmentReviewRow = {
  appointment_id: string;
  created_at: string;
  rating: number | string;
  staff_member_id: string;
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

const SYSTEM_PLAN_COMPENSATION_CANCELLATION_REASON =
  "Programacao automatica do plano revertida pelo sistema.";

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

export type ManagementSelectOptionsScope = Partial<
  Record<keyof ManagementSelectOptions, boolean>
>;

export type ManagementServiceAssignmentOption = {
  id: string;
  isActive: boolean;
  name: string;
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
  customerEmail: string | null;
  customerName: string;
  customerPhone: string | null;
  customerProfileImageUrl: string | null;
  professionalProfileImageUrl?: string | null;
  isMembershipPlanAppointment?: boolean;
  membershipPlanExpiresAt?: string | null;
  membershipPlanId?: string | null;
  membershipPlanStartedAt?: string | null;
  membershipPlanTitle?: string | null;
  membershipPlanReservationStatus?: "scheduled" | "consumed" | null;
  membershipSessionIndex?: number | null;
  membershipSessionsIncluded?: number | null;
  serviceName: string;
  serviceDurationMinutes: number | null;
  servicePrice: number;
  professionalName: string;
  payment?: {
    id: string;
    amount: number;
    paymentMethod: ManagementPaymentMethod;
    notes?: string | null;
    paidAt: string;
  } | null;
};

export type ManagementAppointmentCounts = {
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  no_show: number;
};

export type ManagementAppointmentCollection = {
  items: ManagementAppointmentItem[];
  counts: ManagementAppointmentCounts;
};

export type ManagementStaleAppointmentQueue = {
  items: ManagementAppointmentItem[];
  total: number;
};

export type ManagementClientItem = ClientRow & {
  profileImageUrl: string | null;
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
  assignedServiceIds: string[];
  upcomingCount: number;
  completedCount: number;
  totalSold: number;
  commissionProjected: number;
  imageUrl: string | null;
  reviewAverage: number | null;
  reviewCount: number;
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

export type ManagementUnpaidAppointmentItem = {
  amount: number;
  completedAt: string;
  customerName: string;
  id: string;
  label: string;
  paymentPreference?: AppointmentPaymentPreference | null;
  professionalName: string;
  secondary?: string | null;
  serviceName: string;
};

export type ManagementPaymentsData = {
  summary: {
    totalReceived: number;
    byMethod: Record<ManagementPaymentMethod, number>;
  };
  items: ManagementPaymentItem[];
  unpaidAppointments: ManagementUnpaidAppointmentItem[];
};

export type ManagementCommissionItem = {
  professionalId: string;
  professionalName: string;
  commissionRate: number;
  appointmentsCount: number;
  totalSold: number;
  commissionAmount: number;
};

export function resolveManagementAppointmentCustomerName(args: {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
}) {
  const registeredName = args.name?.trim();
  if (registeredName) {
    return registeredName;
  }

  const registeredPhone = args.phone?.trim();
  if (registeredPhone) {
    return registeredPhone;
  }

  const registeredEmail = args.email?.trim();
  if (registeredEmail) {
    return registeredEmail;
  }

  return "Cliente app";
}

export function resolveManagementAgendaDisplayDay(args: {
  requestedDay: string;
  appointments: Array<{ date: string }>;
  timeZone: string;
}) {
  const appointmentDays = Array.from(
    new Set(
      args.appointments.map((appointment) =>
        getLocalDateKey(appointment.date, args.timeZone),
      ),
    ),
  ).sort();

  if (!appointmentDays.length) {
    return args.requestedDay;
  }

  if (appointmentDays.includes(args.requestedDay)) {
    return args.requestedDay;
  }

  return (
    appointmentDays.find((dayKey) => dayKey >= args.requestedDay) ??
    appointmentDays[appointmentDays.length - 1] ??
    args.requestedDay
  );
}

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

const DEFAULT_MANAGEMENT_SELECT_OPTIONS_SCOPE: Record<
  keyof ManagementSelectOptions,
  boolean
> = {
  categories: true,
  serviceFormCategories: true,
  services: true,
  professionals: true,
  clients: true,
};

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

function normalizeManagementErrorText(
  error:
    | {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
) {
  return [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();
}

function isMissingManagementResourceError(
  error:
    | {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
  resourceName: string,
) {
  const normalizedText = normalizeManagementErrorText(error);
  const normalizedResourceName = resourceName.trim().toLowerCase();

  return (
    normalizedText.includes(normalizedResourceName) &&
    (normalizedText.includes("does not exist") ||
      normalizedText.includes("schema cache") ||
      normalizedText.includes("could not find") ||
      normalizedText.includes("relationship")) &&
    (error?.code === "42P01" ||
      error?.code === "PGRST200" ||
      error?.code === "PGRST204" ||
      error?.code === "PGRST205" ||
      normalizedText.length > 0)
  );
}

function isMissingManagementPaymentPreferenceColumnError(
  error:
    | {
        code?: string | null;
        details?: string | null;
        hint?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
) {
  const normalizedText = normalizeManagementErrorText(error);

  return (
    error?.code === "42703" &&
    normalizedText.includes("payment_preference") &&
    normalizedText.includes("appointments")
  );
}

const MANAGEMENT_FETCH_PAGE_SIZE = 1000;

function normalizeManagementLabel(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function resolveManagementSelectOptionsScope(
  scope?: ManagementSelectOptionsScope,
) {
  return {
    ...DEFAULT_MANAGEMENT_SELECT_OPTIONS_SCOPE,
    ...scope,
  };
}

async function fetchAllManagementRows<T>(args: {
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: T[] | null;
    error?: { code?: string | null; message?: string | null } | null;
  }>;
  failureMessage: string;
}): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += MANAGEMENT_FETCH_PAGE_SIZE) {
    const to = from + MANAGEMENT_FETCH_PAGE_SIZE - 1;
    const result = await args.fetchPage(from, to);

    if (result.error) {
      throw new Error(args.failureMessage);
    }

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < MANAGEMENT_FETCH_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function buildSalonAssetImageUrl(args: {
  height: number;
  path?: string | null;
  quality?: number;
  supabase: any;
  width: number;
}) {
  const normalizedPath = args.path?.trim();

  if (!normalizedPath) {
    return null;
  }

  if (isAbsoluteManagementImageUrl(normalizedPath)) {
    return normalizedPath;
  }

  // Public avatar transforms are returning 403 in production for staff photos.
  // Use the stable bucket URL and let the UI crop with object-fit instead.
  return args.supabase.storage
    .from("salon-assets")
    .getPublicUrl(normalizedPath).data.publicUrl;
}

function isAbsoluteManagementImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function hasMissingImageColumnError(error: {
  code?: string | null;
  message?: string | null;
} | null | undefined) {
  if (error?.code !== "42703") {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return message.includes("profile_image_path") || message.includes("image_path");
}

function createCustomerProfileImageUrlResolver(supabase: any) {
  const cache = new Map<string, Promise<string | null>>();

  return (path?: string | null) => {
    const normalizedPath = path?.trim();

    if (!normalizedPath) {
      return Promise.resolve(null);
    }

    if (isAbsoluteManagementImageUrl(normalizedPath)) {
      return Promise.resolve(normalizedPath);
    }

    const cached = cache.get(normalizedPath);

    if (cached) {
      return cached;
    }

    const pending = supabase.storage
      .from("customer-profiles")
      .createSignedUrl(normalizedPath, 60 * 60 * 12)
      .then(
        (signedUrlResult: {
          data?: { signedUrl?: string | null } | null;
        }) => signedUrlResult.data?.signedUrl ?? null,
      )
      .catch(() => null);

    cache.set(normalizedPath, pending);
    return pending;
  };
}

async function hydrateManagementAppointments(args: {
  appointments: AppointmentRow[];
  salonId: string;
  supabase: any;
  resolveCustomerProfileImageUrl: (
    path?: string | null,
  ) => Promise<string | null>;
}): Promise<ManagementAppointmentItem[]> {
  const paymentIds = args.appointments.map((appointment) => appointment.id);
  const paymentsResult = paymentIds.length
    ? await args.supabase
        .from("appointment_payments")
        .select("id, appointment_id, amount, payment_method, paid_at, notes")
        .in("appointment_id", paymentIds)
    : { data: [] as PaymentRow[] };
  const planReservations = paymentIds.length
    ? await listResolvedAppointmentPlanReservations({
        appointmentIds: paymentIds,
        salonId: args.salonId,
      })
    : [];
  const paymentsMap = new Map(
    (
      (paymentsResult.data ?? []) as Array<{
        id: string;
        appointment_id: string;
        amount: number | string;
        payment_method: ManagementPaymentMethod;
        notes?: string | null;
        paid_at: string;
      }>
    ).map((payment) => [
      payment.appointment_id,
      {
        id: payment.id,
        amount: toNumber(payment.amount),
        paymentMethod: payment.payment_method,
        notes: payment.notes ?? null,
        paidAt: payment.paid_at,
      },
    ]),
  );
  const planReservationMap = new Map(
    planReservations.map((reservation) => [
      reservation.appointmentId,
      reservation,
    ]),
  );

  const customerImageUrls = await Promise.all(
    Array.from(
      new Map(
        args.appointments
          .map((appointment) => {
            const customer = firstRelation(appointment.customers);
            const imagePath = customer?.profile_image_path?.trim() ?? null;

            return customer?.id ? ([customer.id, imagePath] as const) : null;
          })
          .filter(
            (value): value is readonly [string, string | null] =>
              value !== null,
          ),
      ),
    ).map(async ([customerId, imagePath]) => {
      if (!imagePath) {
        return [customerId, null] as const;
      }

      return [
        customerId,
        await args.resolveCustomerProfileImageUrl(imagePath),
      ] as const;
    }),
  );
  const customerImageMap = new Map<string, string | null>(customerImageUrls);
  const professionalImageMap = new Map(
    Array.from(
      new Map(
        args.appointments
          .map((appointment) => {
            const professional = firstRelation(appointment.staff_members);
            const imagePath = professional?.image_path?.trim() ?? null;

            return professional?.id
              ? ([professional.id, imagePath] as const)
              : null;
          })
          .filter(
            (value): value is readonly [string, string | null] =>
              value !== null,
          ),
      ),
    ).map(([professionalId, imagePath]) => [
      professionalId,
      buildSalonAssetImageUrl({
        height: 320,
        path: imagePath,
        quality: 100,
        supabase: args.supabase,
        width: 320,
      }),
    ]),
  );

  return args.appointments.map((appointment) => {
    const customer = firstRelation(appointment.customers);
    const service = firstRelation(appointment.services);
    const professional = firstRelation(appointment.staff_members);
    const planReservation = planReservationMap.get(appointment.id) ?? null;

    return {
      ...appointment,
      customerEmail: customer?.email ?? null,
      customerName: resolveManagementAppointmentCustomerName({
        email: customer?.email ?? null,
        name: customer?.name ?? null,
        phone: customer?.phone ?? null,
      }),
      customerPhone: customer?.phone ?? null,
      customerProfileImageUrl: customer?.id
        ? (customerImageMap.get(customer.id) ?? null)
        : null,
      professionalProfileImageUrl: professional?.id
        ? (professionalImageMap.get(professional.id) ?? null)
        : null,
      serviceName: service?.name ?? "Serviço",
      serviceDurationMinutes: service?.duration ?? null,
      servicePrice: resolveBookedAppointmentAmount({
        servicePrice: service?.price,
        servicePriceSnapshot: appointment.service_price_snapshot,
      }),
      professionalName: professional?.name ?? "Profissional",
      isMembershipPlanAppointment: planReservation != null,
      membershipPlanExpiresAt: planReservation?.membershipExpiresAt ?? null,
      membershipPlanId: planReservation?.membershipId ?? null,
      membershipPlanReservationStatus:
        planReservation?.reservationStatus ?? null,
      membershipPlanStartedAt: planReservation?.membershipStartedAt ?? null,
      membershipPlanTitle: planReservation?.membershipTitle ?? null,
      membershipSessionIndex: planReservation?.sessionIndex ?? null,
      membershipSessionsIncluded: planReservation?.sessionsIncluded ?? null,
      payment: paymentsMap.get(appointment.id) ?? null,
    };
  });
}

function buildManagementAppointmentCounts(
  items: ManagementAppointmentItem[],
): ManagementAppointmentCounts {
  return {
    pending: items.filter((item) => item.status === "pending").length,
    confirmed: items.filter((item) => item.status === "confirmed").length,
    completed: items.filter((item) => item.status === "completed").length,
    cancelled: items.filter((item) => item.status === "cancelled").length,
    no_show: items.filter((item) => item.status === "no_show").length,
  };
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

export function getUtcRangeForLocalMonth(monthKey: string, timeZone: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const nextMonthKey = `${nextMonth.getUTCFullYear()}-${String(
    nextMonth.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  return {
    start: combineDateAndTimeToUtc(startKey, "00:00", timeZone),
    end: combineDateAndTimeToUtc(nextMonthKey, "00:00", timeZone),
  };
}

export function getUtcRangeForLocalWeek(dayKey: string, timeZone: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const reference = new Date(Date.UTC(year, month - 1, day, 12));
  const weekStart = new Date(reference);
  weekStart.setUTCDate(reference.getUTCDate() - reference.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  const startKey = `${weekStart.getUTCFullYear()}-${String(
    weekStart.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;
  const endKey = `${weekEnd.getUTCFullYear()}-${String(
    weekEnd.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(weekEnd.getUTCDate()).padStart(2, "0")}`;

  return {
    start: combineDateAndTimeToUtc(startKey, "00:00", timeZone),
    end: combineDateAndTimeToUtc(endKey, "00:00", timeZone),
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
  scope?: ManagementSelectOptionsScope,
): Promise<ManagementSelectOptions> {
  const supabase = createClient() as any;
  const resolvedScope = resolveManagementSelectOptionsScope(scope);
  const shouldLoadCategories =
    resolvedScope.categories || resolvedScope.serviceFormCategories;
  const [categoryState, servicesResult, professionalsResult, clientsResult] =
    await Promise.all([
      shouldLoadCategories
        ? ensureManagementServiceFormCategories({
            salonId,
            supabase,
          })
        : Promise.resolve<{
            allCategories: ServiceCategoryOptionRow[];
            formCategories: ManagementSelectOption[];
          } | null>(null),
      resolvedScope.services
        ? supabase
            .from("services")
            .select("id, name, price")
            .eq("salon_id", salonId)
            .eq("is_active", true)
            .order("category")
            .order("name")
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              price?: number | string;
            }>,
          }),
      resolvedScope.professionals
        ? supabase
            .from("staff_members")
            .select("id, name, role")
            .eq("salon_id", salonId)
            .eq("is_active", true)
            .order("name")
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              role?: string | null;
            }>,
          }),
      resolvedScope.clients
        ? supabase
            .from("customers")
            .select("id, name, phone")
            .eq("salon_id", salonId)
            .order("name")
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              phone?: string | null;
            }>,
          }),
    ]);
  const allCategories = categoryState?.allCategories ?? [];
  const formCategories = categoryState?.formCategories ?? [];

  return {
    categories: resolvedScope.categories
      ? allCategories
          .filter((item) => item.is_active)
          .map((item) => ({
            id: item.id,
            label: item.name,
          }))
      : [],
    serviceFormCategories: resolvedScope.serviceFormCategories
      ? formCategories
      : [],
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

export async function loadManagementServiceAssignmentOptions(
  salonId: string,
): Promise<ManagementServiceAssignmentOption[]> {
  const supabase = createClient() as any;
  const servicesResult = await supabase
    .from("services")
    .select("id, name, is_active")
    .eq("salon_id", salonId)
    .order("is_active", { ascending: false })
    .order("name");

  return (
    (servicesResult.data ?? []) as Array<{
      id: string;
      is_active: boolean;
      name: string;
    }>
  ).map((item) => ({
    id: item.id,
    isActive: item.is_active,
    name: item.name,
  }));
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
          "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, customers(id, name, phone), services(id, name, price), staff_members(id, name)",
        )
        .eq("salon_id", salonId)
        .gte("date", todayRange.start.toISOString())
        .lt("date", todayRange.end.toISOString())
        .order("date", { ascending: true }),
      supabase
        .from("appointments")
        .select(
          "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, customers(id, name, phone), services(id, name, price), staff_members(id, name)",
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
        paymentByAppointment.get(appointment.id) ??
        resolveBookedAppointmentAmount({
          servicePrice: service?.price,
          servicePriceSnapshot: appointment.service_price_snapshot,
        });
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
}): Promise<ManagementAppointmentCollection> {
  const dayRange = getUtcRangeForLocalDate(args.dayKey, args.timeZone);

  return loadManagementAppointmentsInRange({
    salonId: args.salonId,
    startIso: dayRange.start.toISOString(),
    endIso: dayRange.end.toISOString(),
    professionalId: args.professionalId,
    status: args.status,
  });
}

export async function loadManagementAppointmentsMonth(args: {
  salonId: string;
  timeZone: string;
  monthKey: string;
  professionalId?: string;
  status?: string;
}): Promise<ManagementAppointmentCollection> {
  const monthRange = getUtcRangeForLocalMonth(args.monthKey, args.timeZone);

  return loadManagementAppointmentsInRange({
    salonId: args.salonId,
    startIso: monthRange.start.toISOString(),
    endIso: monthRange.end.toISOString(),
    professionalId: args.professionalId,
    status: args.status,
  });
}

export async function loadManagementAppointmentsWeek(args: {
  salonId: string;
  timeZone: string;
  dayKey: string;
  professionalId?: string;
  status?: string;
}): Promise<ManagementAppointmentCollection> {
  const weekRange = getUtcRangeForLocalWeek(args.dayKey, args.timeZone);

  return loadManagementAppointmentsInRange({
    salonId: args.salonId,
    startIso: weekRange.start.toISOString(),
    endIso: weekRange.end.toISOString(),
    professionalId: args.professionalId,
    status: args.status,
  });
}

async function loadManagementAppointmentsInRange(args: {
  salonId: string;
  startIso: string;
  endIso: string;
  professionalId?: string;
  status?: string;
}): Promise<ManagementAppointmentCollection> {
  const supabase = createClient() as any;
  const resolveCustomerProfileImageUrl = createCustomerProfileImageUrlResolver(
    supabase,
  );
  const buildAppointmentsQuery = (selectClause: string) => {
    let query = supabase
      .from("appointments")
      .select(selectClause)
      .eq("salon_id", args.salonId)
      .gte("date", args.startIso)
      .lt("date", args.endIso)
      .order("date", { ascending: true });

    if (args.professionalId) {
      query = query.eq("staff_member_id", args.professionalId);
    }

    if (args.status) {
      query = query.eq("status", args.status);
    }

    return query;
  };

  let appointmentsResult = await buildAppointmentsQuery(
    "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, payment_preference, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, booking_policy_snapshot, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_amount, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, deposit_customer_reported_reference, deposit_paid_at, deposit_status, protection_confirmation_required, customers(id, name, phone, email, profile_image_path), services(id, name, price, duration), staff_members(id, name, image_path)",
  );

  if (hasMissingImageColumnError(appointmentsResult.error)) {
    appointmentsResult = await buildAppointmentsQuery(
      "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, payment_preference, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, booking_policy_snapshot, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_amount, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, deposit_customer_reported_reference, deposit_paid_at, deposit_status, protection_confirmation_required, customers(id, name, phone, email), services(id, name, price, duration), staff_members(id, name)",
    );
  }
  const appointments = ((appointmentsResult.data ?? []) as AppointmentRow[]).filter(
    (appointment) =>
      !(
        appointment.status === "cancelled" &&
        appointment.cancellation_reason ===
          SYSTEM_PLAN_COMPENSATION_CANCELLATION_REASON
      ),
  );

  const paymentIds = appointments.map((appointment) => appointment.id);
  const paymentsResult = paymentIds.length
    ? await supabase
        .from("appointment_payments")
        .select("id, appointment_id, amount, payment_method, paid_at, notes")
        .in("appointment_id", paymentIds)
    : { data: [] as PaymentRow[] };
  const planReservations = paymentIds.length
    ? await listResolvedAppointmentPlanReservations({
        appointmentIds: paymentIds,
        salonId: args.salonId,
      })
    : [];
  const paymentsMap = new Map(
    (
      (paymentsResult.data ?? []) as Array<{
        id: string;
        appointment_id: string;
        amount: number | string;
        payment_method: ManagementPaymentMethod;
        notes?: string | null;
        paid_at: string;
      }>
    ).map((payment) => [
      payment.appointment_id,
      {
        id: payment.id,
        amount: toNumber(payment.amount),
        paymentMethod: payment.payment_method,
        notes: payment.notes ?? null,
        paidAt: payment.paid_at,
      },
    ]),
  );
  const planReservationMap = new Map(
    planReservations.map((reservation) => [
      reservation.appointmentId,
      reservation,
    ]),
  );

  const customerImageUrls = await Promise.all(
    Array.from(
      new Map(
        appointments
          .map((appointment) => {
            const customer = firstRelation(appointment.customers);
            const imagePath = customer?.profile_image_path?.trim() ?? null;

            return customer?.id ? ([customer.id, imagePath] as const) : null;
          })
          .filter(
            (value): value is readonly [string, string | null] =>
              value !== null,
          ),
      ),
    ).map(async ([customerId, imagePath]) => {
      if (!imagePath) {
        return [customerId, null] as const;
      }

      return [
        customerId,
        await resolveCustomerProfileImageUrl(imagePath),
      ] as const;
    }),
  );
  const customerImageMap = new Map<string, string | null>(customerImageUrls);
  const professionalImageMap = new Map(
    Array.from(
      new Map(
        appointments
          .map((appointment) => {
            const professional = firstRelation(appointment.staff_members);
            const imagePath = professional?.image_path?.trim() ?? null;

            return professional?.id
              ? ([professional.id, imagePath] as const)
              : null;
          })
          .filter(
            (value): value is readonly [string, string | null] =>
              value !== null,
          ),
      ),
    ).map(([professionalId, imagePath]) => [
      professionalId,
      buildSalonAssetImageUrl({
        height: 320,
        path: imagePath,
        quality: 100,
        supabase,
        width: 320,
      }),
    ]),
  );

  const items: ManagementAppointmentItem[] = appointments.map((appointment) => {
    const customer = firstRelation(appointment.customers);
    const service = firstRelation(appointment.services);
    const professional = firstRelation(appointment.staff_members);
    const planReservation = planReservationMap.get(appointment.id) ?? null;

    return {
      ...appointment,
      customerEmail: customer?.email ?? null,
      customerName: resolveManagementAppointmentCustomerName({
        email: customer?.email ?? null,
        name: customer?.name ?? null,
        phone: customer?.phone ?? null,
      }),
      customerPhone: customer?.phone ?? null,
      customerProfileImageUrl: customer?.id
        ? (customerImageMap.get(customer.id) ?? null)
        : null,
      professionalProfileImageUrl: professional?.id
        ? (professionalImageMap.get(professional.id) ?? null)
        : null,
      serviceName: service?.name ?? "Serviço",
      serviceDurationMinutes: service?.duration ?? null,
      servicePrice: resolveBookedAppointmentAmount({
        servicePrice: service?.price,
        servicePriceSnapshot: appointment.service_price_snapshot,
      }),
      professionalName: professional?.name ?? "Profissional",
      isMembershipPlanAppointment: planReservation != null,
      membershipPlanExpiresAt: planReservation?.membershipExpiresAt ?? null,
      membershipPlanId: planReservation?.membershipId ?? null,
      membershipPlanReservationStatus:
        planReservation?.reservationStatus ?? null,
      membershipPlanStartedAt: planReservation?.membershipStartedAt ?? null,
      membershipPlanTitle: planReservation?.membershipTitle ?? null,
      membershipSessionIndex: planReservation?.sessionIndex ?? null,
      membershipSessionsIncluded: planReservation?.sessionsIncluded ?? null,
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

export async function loadManagementStaleAppointments(args: {
  salonId: string;
  professionalId?: string;
  limit?: number;
}): Promise<ManagementStaleAppointmentQueue> {
  const supabase = createClient() as any;
  const resolveCustomerProfileImageUrl = createCustomerProfileImageUrlResolver(
    supabase,
  );
  const limit = Math.max(1, Math.min(args.limit ?? 8, 30));
  const nowIso = new Date().toISOString();
  const buildStaleQuery = (selectClause: string) => {
    let query = supabase
      .from("appointments")
      .select(selectClause, { count: "exact" })
      .eq("salon_id", args.salonId)
      .in("status", ["pending", "confirmed"])
      .lt("ends_at", nowIso)
      .order("ends_at", { ascending: true })
      .limit(limit);

    if (args.professionalId) {
      query = query.eq("staff_member_id", args.professionalId);
    }

    return query;
  };

  let staleAppointmentsResult = await buildStaleQuery(
    "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, payment_preference, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, booking_policy_snapshot, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_amount, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, deposit_customer_reported_reference, deposit_paid_at, deposit_status, protection_confirmation_required, customers(id, name, phone, email, profile_image_path), services(id, name, price, duration), staff_members(id, name, image_path)",
  );

  if (hasMissingImageColumnError(staleAppointmentsResult.error)) {
    staleAppointmentsResult = await buildStaleQuery(
      "id, customer_id, service_id, staff_member_id, date, ends_at, status, notes, payment_preference, service_price_snapshot, completed_at, cancelled_at, cancellation_reason, booking_policy_snapshot, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_amount, deposit_customer_reported_paid_at, deposit_customer_reported_paid_via, deposit_customer_reported_reference, deposit_paid_at, deposit_status, protection_confirmation_required, customers(id, name, phone, email), services(id, name, price, duration), staff_members(id, name)",
    );
  }

  const items = await hydrateManagementAppointments({
    appointments: (staleAppointmentsResult.data ?? []) as AppointmentRow[],
    salonId: args.salonId,
    supabase,
    resolveCustomerProfileImageUrl,
  });

  return {
    items,
    total: staleAppointmentsResult.count ?? items.length,
  };
}

export async function loadManagementClients(
  salonId: string,
  search = "",
): Promise<ManagementClientItem[]> {
  const supabase = createClient() as any;
  const resolveCustomerProfileImageUrl = createCustomerProfileImageUrlResolver(
    supabase,
  );
  let query = supabase
    .from("customers")
    .select(
      "id, name, phone, email, birth_date, notes, profile_image_path, created_at, updated_at",
    )
    .eq("salon_id", salonId)
    .order("name", { ascending: true });

  if (search.trim()) {
    const normalized = search.trim();
    query = query.or(
      `name.ilike.%${normalized}%,phone.ilike.%${normalized}%,email.ilike.%${normalized}%`,
    );
  }

  let clientsResult = await query;
  if (
    clientsResult.error?.code === "42703" &&
    clientsResult.error.message?.toLowerCase().includes("profile_image_path")
  ) {
    let legacyQuery = supabase
      .from("customers")
      .select(
        "id, name, phone, email, birth_date, notes, created_at, updated_at",
      )
      .eq("salon_id", salonId)
      .order("name", { ascending: true });

    if (search.trim()) {
      const normalized = search.trim();
      legacyQuery = legacyQuery.or(
        `name.ilike.%${normalized}%,phone.ilike.%${normalized}%,email.ilike.%${normalized}%`,
      );
    }

    clientsResult = await legacyQuery;
  }
  const clients = (clientsResult.data ?? []) as ClientRow[];
  const profileImageUrls = await Promise.all(
    clients.map(async (client) => {
      const imagePath = client.profile_image_path?.trim();
      if (!imagePath) {
        return [client.id, null] as const;
      }

      return [client.id, await resolveCustomerProfileImageUrl(imagePath)] as const;
    }),
  );
  const profileImageMap = new Map<string, string | null>(profileImageUrls);
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
      profileImageUrl: profileImageMap.get(client.id) ?? null,
      upcomingCount: summary?.upcomingCount ?? 0,
      completedCount: summary?.completedCount ?? 0,
      lastVisitAt: summary?.lastVisitAt ?? null,
      history: summary?.history ?? [],
    };
  });
}

export async function loadManagementProfessionals(args: {
  salonId: string;
  timeZone: string;
}): Promise<ManagementProfessionalItem[]> {
  const supabase = createClient() as any;
  const currentMonthKey = getLocalDateKey(new Date(), args.timeZone).slice(
    0,
    7,
  );
  const currentMonthRange = getUtcRangeForLocalMonth(
    currentMonthKey,
    args.timeZone,
  );
  let professionalsResult = await supabase
    .from("staff_members")
    .select(
      "id, name, role, phone, image_path, is_active, commission_rate_percent, commission_flat_fee, created_at, updated_at",
    )
    .eq("salon_id", args.salonId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (
    professionalsResult.error?.code === "42703" &&
    professionalsResult.error.message?.toLowerCase().includes("image_path")
  ) {
    professionalsResult = await supabase
      .from("staff_members")
      .select(
        "id, name, role, phone, is_active, commission_rate_percent, commission_flat_fee, created_at, updated_at",
      )
      .eq("salon_id", args.salonId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });
  }

  const professionals = (professionalsResult.data ?? []) as ProfessionalRow[];
  const professionalIds = professionals.map((professional) => professional.id);
  const assignmentsResult = professionalIds.length
    ? await supabase
        .from("staff_service_assignments")
        .select("staff_member_id, service_id")
        .in("staff_member_id", professionalIds)
    : { data: [] as Array<{ service_id: string; staff_member_id: string }> };
  if (professionalIds.length && assignmentsResult.error) {
    throw new Error(
      "Não foi possível carregar os serviços habilitados da equipe.",
    );
  }
  const nowIso = new Date().toISOString();
  const upcomingAppointments = professionalIds.length
    ? await fetchAllManagementRows<
        AppointmentRow & {
          staff_member_id: string;
        }
      >({
        failureMessage: "Não foi possível carregar a agenda futura da equipe.",
        fetchPage: (from, to) =>
          supabase
            .from("appointments")
            .select("staff_member_id, date, status")
            .eq("salon_id", args.salonId)
            .gte("date", nowIso)
            .in("status", ["pending", "confirmed"])
            .order("date", { ascending: false })
            .range(from, to),
      })
    : [];
  const monthlyCompletedAppointments = professionalIds.length
    ? await fetchAllManagementRows<
        AppointmentRow & {
          staff_member_id: string;
        }
      >({
        failureMessage:
          "Não foi possível carregar a produção mensal da equipe.",
        fetchPage: (from, to) =>
          supabase
            .from("appointments")
            .select(
              "staff_member_id, status, completed_at, service_price_snapshot, services(price)",
            )
            .eq("salon_id", args.salonId)
            .eq("status", "completed")
            .not("completed_at", "is", null)
            .gte("completed_at", currentMonthRange.start.toISOString())
            .lt("completed_at", currentMonthRange.end.toISOString())
            .order("completed_at", { ascending: false })
            .range(from, to),
      })
    : [];
  let appointmentReviews: AppointmentReviewRow[] = [];

  if (professionalIds.length) {
    try {
      appointmentReviews = (
        await listResolvedAppointmentReviews({
          salonId: args.salonId,
          staffMemberIds: professionalIds,
        })
      ).map((review) => ({
        appointment_id: review.appointmentId,
        created_at: review.createdAt,
        rating: review.rating,
        staff_member_id: review.staffMemberId,
      }));
    } catch {
      throw new Error(
        "Nao foi possivel carregar as avaliacoes reais do app da equipe.",
      );
    }
  }

  if (false && professionalIds.length) {
    const reviewsResult = await supabase
      .from("appointment_reviews")
      .select("appointment_id, created_at, rating, staff_member_id")
      .eq("salon_id", args.salonId)
      .in("staff_member_id", professionalIds)
      .order("created_at", { ascending: false });

    if (
      reviewsResult.error &&
      !isMissingManagementResourceError(
        reviewsResult.error,
        "appointment_reviews",
      )
    ) {
      throw new Error(
        "Não foi possível carregar as avaliações reais do app da equipe.",
      );
    }

    appointmentReviews = (reviewsResult.data ?? []) as AppointmentReviewRow[];
  }

  const grouped = new Map<
    string,
    {
      upcomingCount: number;
      completedCount: number;
      totalSold: number;
      reviewCount: number;
      reviewSum: number;
    }
  >();
  const assignedServiceIdsByProfessional = new Map<string, string[]>();

  for (const assignment of (assignmentsResult.data ?? []) as Array<{
    service_id: string;
    staff_member_id: string;
  }>) {
    const current =
      assignedServiceIdsByProfessional.get(assignment.staff_member_id) ?? [];
    current.push(assignment.service_id);
    assignedServiceIdsByProfessional.set(assignment.staff_member_id, current);
  }

  for (const appointment of upcomingAppointments) {
    const current = grouped.get(appointment.staff_member_id) ?? {
      upcomingCount: 0,
      completedCount: 0,
      totalSold: 0,
      reviewCount: 0,
      reviewSum: 0,
    };

    if (
      appointment.status === "pending" ||
      appointment.status === "confirmed"
    ) {
      current.upcomingCount += 1;
    }

    grouped.set(appointment.staff_member_id, current);
  }

  for (const appointment of monthlyCompletedAppointments) {
    const current = grouped.get(appointment.staff_member_id) ?? {
      upcomingCount: 0,
      completedCount: 0,
      totalSold: 0,
      reviewCount: 0,
      reviewSum: 0,
    };
    const service = firstRelation(appointment.services);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });

    current.completedCount += 1;
    current.totalSold += amount;
    grouped.set(appointment.staff_member_id, current);
  }

  for (const review of appointmentReviews) {
    const current = grouped.get(review.staff_member_id) ?? {
      upcomingCount: 0,
      completedCount: 0,
      totalSold: 0,
      reviewCount: 0,
      reviewSum: 0,
    };

    current.reviewCount += 1;
    current.reviewSum += toNumber(review.rating);
    grouped.set(review.staff_member_id, current);
  }

  return professionals.map((professional) => {
    const summary = grouped.get(professional.id);
    const commissionRate = toNumber(professional.commission_rate_percent);
    const commissionFlatFee = toNumber(professional.commission_flat_fee);
    const totalSold = summary?.totalSold ?? 0;
    const completedCount = summary?.completedCount ?? 0;
    const reviewCount = summary?.reviewCount ?? 0;
    const imageUrl = buildSalonAssetImageUrl({
      height: 480,
      path: professional.image_path,
      quality: 100,
      supabase,
      width: 480,
    });

    return {
      ...professional,
      assignedServiceIds:
        assignedServiceIdsByProfessional.get(professional.id) ?? [],
      upcomingCount: summary?.upcomingCount ?? 0,
      completedCount,
      totalSold,
      commissionProjected:
        totalSold * (commissionRate / 100) + completedCount * commissionFlatFee,
      imageUrl,
      reviewAverage: reviewCount
        ? Number(((summary?.reviewSum ?? 0) / reviewCount).toFixed(1))
        : null,
      reviewCount,
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

  let recentCompletedResult = await supabase
    .from("appointments")
    .select(
      "id, date, completed_at, payment_preference, service_price_snapshot, customers(name), services(name, price), staff_members(name)",
    )
    .eq("salon_id", args.salonId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", dayAtIso(-30))
    .order("completed_at", { ascending: false })
    .limit(80);
  if (
    isMissingManagementPaymentPreferenceColumnError(
      recentCompletedResult.error,
    )
  ) {
    recentCompletedResult = await supabase
      .from("appointments")
      .select(
        "id, date, completed_at, service_price_snapshot, customers(name), services(name, price), staff_members(name)",
      )
      .eq("salon_id", args.salonId)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", dayAtIso(-30))
      .order("completed_at", { ascending: false })
      .limit(80);
  }

  if (recentCompletedResult.error) {
    throw recentCompletedResult.error;
  }

  const recentCompletedAppointments = (recentCompletedResult.data ?? []) as Array<{
    completed_at?: string | null;
    customers: RelationValue<{ name: string }>;
    date: string;
    id: string;
    payment_preference?: AppointmentPaymentPreference | null;
    service_price_snapshot?: number | string | null;
    services: RelationValue<{ name: string; price?: number | string | null }>;
    staff_members: RelationValue<{ name: string }>;
  }>;
  const recentCompletedIds = recentCompletedAppointments.map(
    (appointment) => appointment.id,
  );
  const [
    recentPaymentsResult,
    recentPlanReservations,
    ignoredPendingSettlementAppointmentIds,
  ] = await Promise.all([
    recentCompletedIds.length
      ? supabase
          .from("appointment_payments")
          .select("appointment_id")
          .in("appointment_id", recentCompletedIds)
      : Promise.resolve({
          data: [] as Array<{ appointment_id: string }>,
          error: null,
        }),
    recentCompletedIds.length
      ? listResolvedAppointmentPlanReservations({
          appointmentIds: recentCompletedIds,
          salonId: args.salonId,
        })
      : Promise.resolve([]),
    listIgnoredPendingSettlementAppointmentIds({
      appointmentIds: recentCompletedIds,
      salonId: args.salonId,
    }),
  ]);
  const paidAppointmentIds = new Set<string>(
    ((recentPaymentsResult.data ?? []) as Array<{ appointment_id: string }>).map(
      (item) => item.appointment_id,
    ),
  );
  if (recentPaymentsResult.error) {
    throw recentPaymentsResult.error;
  }
  const membershipAppointmentIds = new Set(
    recentPlanReservations.map((reservation) => reservation.appointmentId),
  );

  const unpaidAppointments = recentCompletedAppointments
    .filter(
      (appointment) =>
        !paidAppointmentIds.has(appointment.id) &&
        !membershipAppointmentIds.has(appointment.id) &&
        !ignoredPendingSettlementAppointmentIds.has(appointment.id),
    )
    .map((appointment) => {
      const customerName =
        firstRelation(appointment.customers)?.name ?? "Cliente";
      const service = firstRelation(appointment.services);
      const serviceName = service?.name ?? "Servico";
      const professionalName =
        firstRelation(appointment.staff_members)?.name ?? "Profissional";
      const completedAt = appointment.completed_at ?? appointment.date;
      const amount = resolveBookedAppointmentAmount({
        servicePrice: service?.price ?? null,
        servicePriceSnapshot: appointment.service_price_snapshot ?? null,
      });

      return {
        amount,
        completedAt,
        customerName,
        id: appointment.id,
        label: `${customerName} - ${serviceName}`,
        paymentPreference: appointment.payment_preference ?? null,
        professionalName,
        secondary: formatDateTimeLabel(completedAt, args.timeZone),
        serviceName,
      };
    });

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
      "id, staff_member_id, date, completed_at, service_price_snapshot, services(price), staff_members(name, commission_rate_percent, commission_flat_fee)",
    )
    .eq("salon_id", args.salonId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", fromRange.start.toISOString())
    .lt("completed_at", toRange.end.toISOString())
    .order("completed_at", { ascending: false });

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
    const commissionFlatFee = toNumber(
      (professional as { commission_flat_fee?: number | string })
        .commission_flat_fee,
    );
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const current = grouped.get(appointment.staff_member_id) ?? {
      professionalId: appointment.staff_member_id,
      professionalName: professional.name,
      commissionRate,
      appointmentsCount: 0,
      totalSold: 0,
      commissionAmount: 0,
    };

    current.appointmentsCount += 1;
    current.totalSold += amount;
    current.commissionAmount += calculateProjectedCommissionAmount({
      amount,
      commissionFlatFee,
      commissionRatePercent: commissionRate,
    });

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
