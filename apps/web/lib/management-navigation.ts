export const MANAGEMENT_BASE_PATH = "/dashboard/gestao";

export const MANAGEMENT_ROUTES = {
  dashboard: MANAGEMENT_BASE_PATH,
  appointments: `${MANAGEMENT_BASE_PATH}/agendamentos`,
  clients: `${MANAGEMENT_BASE_PATH}/clientes`,
  professionals: `${MANAGEMENT_BASE_PATH}/profissionais`,
  categories: `${MANAGEMENT_BASE_PATH}/categorias`,
  services: `${MANAGEMENT_BASE_PATH}/servicos`,
  payments: `${MANAGEMENT_BASE_PATH}/pagamentos`,
  commissions: `${MANAGEMENT_BASE_PATH}/comissoes`,
} as const;

export const MANAGEMENT_NAV_LINKS = [
  { href: MANAGEMENT_ROUTES.appointments, label: "Agendamentos" },
  { href: MANAGEMENT_ROUTES.clients, label: "Clientes" },
  { href: MANAGEMENT_ROUTES.professionals, label: "Profissionais" },
  { href: MANAGEMENT_ROUTES.categories, label: "Categorias" },
  { href: MANAGEMENT_ROUTES.services, label: "Serviços" },
  { href: MANAGEMENT_ROUTES.payments, label: "Pagamentos" },
  { href: MANAGEMENT_ROUTES.commissions, label: "Comissões" },
] as const;

export const MANAGEMENT_PATHS = MANAGEMENT_NAV_LINKS.map((item) => item.href);

export const LEGACY_MANAGEMENT_ROUTES = {
  appointments: "/dashboard/appointments",
  customers: "/dashboard/customers",
  services: "/dashboard/services",
  team: "/dashboard/team",
} as const;

type LegacySearchParams = Record<string, string | string[] | undefined>;

function firstSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value: string,
) {
  if (value) {
    params.set(key, value);
  }
}

function normalizeLegacyAppointmentStatus(value: string) {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "no_show"
  ) {
    return value;
  }

  return "";
}

export function buildLegacyManagementRedirectPath(
  legacyPath: string,
  searchParams?: LegacySearchParams,
) {
  const params = new URLSearchParams();
  const message = firstSearchParam(searchParams?.message).trim();
  const tone = firstSearchParam(searchParams?.tone).trim();

  switch (legacyPath) {
    case LEGACY_MANAGEMENT_ROUTES.appointments: {
      const day = firstSearchParam(searchParams?.dateFrom).trim();
      const professionalId = firstSearchParam(searchParams?.staffMemberId).trim();
      const status = normalizeLegacyAppointmentStatus(
        firstSearchParam(searchParams?.status).trim(),
      );

      appendSearchParam(params, "day", day);
      appendSearchParam(params, "professionalId", professionalId);
      appendSearchParam(params, "status", status);
      appendSearchParam(params, "message", message);
      appendSearchParam(params, "tone", tone);
      break;
    }
    case LEGACY_MANAGEMENT_ROUTES.customers: {
      const clientId = firstSearchParam(searchParams?.customer).trim();
      const query = firstSearchParam(searchParams?.q).trim();

      appendSearchParam(params, "clientId", clientId);
      appendSearchParam(params, "q", query);
      appendSearchParam(params, "message", message);
      appendSearchParam(params, "tone", tone);
      break;
    }
    case LEGACY_MANAGEMENT_ROUTES.services: {
      const query =
        firstSearchParam(searchParams?.q).trim() ||
        firstSearchParam(searchParams?.category).trim();

      appendSearchParam(params, "q", query);
      appendSearchParam(params, "message", message);
      appendSearchParam(params, "tone", tone);
      break;
    }
    case LEGACY_MANAGEMENT_ROUTES.team: {
      appendSearchParam(params, "message", message);
      appendSearchParam(params, "tone", tone);
      break;
    }
    default:
      break;
  }

  const pathname =
    legacyPath === LEGACY_MANAGEMENT_ROUTES.appointments
      ? MANAGEMENT_ROUTES.appointments
      : legacyPath === LEGACY_MANAGEMENT_ROUTES.customers
        ? MANAGEMENT_ROUTES.clients
        : legacyPath === LEGACY_MANAGEMENT_ROUTES.services
          ? MANAGEMENT_ROUTES.services
          : legacyPath === LEGACY_MANAGEMENT_ROUTES.team
            ? MANAGEMENT_ROUTES.professionals
            : MANAGEMENT_ROUTES.appointments;
  const query = params.toString();

  return `${pathname}${query ? `?${query}` : ""}`;
}
