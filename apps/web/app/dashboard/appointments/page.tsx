import Image from "next/image";
import Link from "next/link";

import {
  consumeAppointmentMembershipAction,
  reverseAppointmentMembershipAction,
  updateAppointmentDepositAction,
  updateAppointmentStatusAction,
} from "@/app/actions";
import { ActionCommandCenter } from "@/components/ActionCommandCenter";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import {
  buildSmartScheduleTargetDayLabel,
  SmartScheduleSuggestion,
  SmartScheduleSuggestions,
} from "@/components/SmartScheduleSuggestions";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type AppointmentsPageProps = {
  searchParams?: {
    dateFrom?: string | string[];
    dateTo?: string | string[];
    message?: string;
    page?: string | string[];
    q?: string | string[];
    staffMemberId?: string | string[];
    status?: string | string[];
    tone?: string;
  };
};

type SmartScheduleResponse = {
  target_day: string;
  timezone: string;
  slot_step_minutes: number;
  suggestions: SmartScheduleSuggestion[];
};

type AppointmentBoardStatus =
  | "pending"
  | "confirmed"
  | "awaiting-completion"
  | "completed"
  | "cancelled";

type AppointmentBoardItem = {
  booking_policy_acknowledged_at: string | null;
  booking_policy_snapshot: string | null;
  booking_policy_version: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  completed_at: string | null;
  customer_confirmation_requested_at: string | null;
  customer_name: string;
  customer_presence_confirmed_at: string | null;
  date: string;
  deposit_amount: number | null;
  deposit_customer_reported_paid_at: string | null;
  deposit_customer_reported_paid_via:
    | "manual"
    | "pix"
    | "external_checkout"
    | "asaas_pix"
    | null;
  deposit_customer_reported_reference: string | null;
  deposit_notes: string | null;
  deposit_paid_at: string | null;
  deposit_status:
    | "not_required"
    | "pending"
    | "received"
    | "waived"
    | "refunded";
  ends_at: string;
  id: string;
  board_status: AppointmentBoardStatus;
  service_category: string | null;
  service_duration: number | null;
  service_name: string;
  staff_member_name: string | null;
  status: "pending" | "confirmed" | "cancelled" | "completed";
};

type AppointmentBoardResponse = {
  overview: {
    deposit_pending: number;
    deposit_received: number;
    pending: number;
    confirmed: number;
    awaiting_completion: number;
    completed: number;
    cancelled: number;
  };
  total_count: number;
  total_pages: number;
  page: number;
  page_size: number;
  items: AppointmentBoardItem[];
};

type AppointmentRelationRecord = {
  customer_id: string;
  id: string;
  service_id: string;
};

type AppointmentMembershipRecord = {
  customer_id: string;
  expires_at: string;
  id: string;
  notes: string | null;
  price_snapshot: number | string | null;
  service_id: string | null;
  service_name_snapshot: string;
  sessions_included: number;
  sessions_used: number;
  started_at: string;
  status: "active" | "completed" | "expired" | "cancelled";
  title: string;
};

type AppointmentMembershipRedemptionRecord = {
  appointment_id: string;
  membership_id: string;
};

type AppointmentDepositReceiptRecord = {
  deposit_payment_provider: string | null;
  deposit_payment_provider_invoice_url: string | null;
  deposit_payment_provider_last_synced_at: string | null;
  deposit_payment_provider_status: string | null;
  id: string;
  deposit_receipt_content_type: string | null;
  deposit_receipt_path: string | null;
  deposit_receipt_uploaded_at: string | null;
};

type AppointmentDepositReceiptPreview = {
  contentType: string | null;
  providerInvoiceUrl: string | null;
  providerName: string | null;
  providerStatus: string | null;
  providerSyncedAt: string | null;
  signedUrl: string | null;
  uploadedAt: string | null;
};

type StaffMemberOption = {
  id: string;
  name: string;
};

type AppointmentStatusSection = {
  description: string;
  items: AppointmentBoardItem[];
  key: AppointmentBoardStatus;
  title: string;
};

const PAGE_SIZE = 18;

async function buildAppointmentDepositReceiptPreviewMap(params: {
  appointmentIds: string[];
  salonId: string;
  supabase: ReturnType<typeof createClient>;
}) {
  const { appointmentIds, salonId, supabase } = params;

  if (!appointmentIds.length) {
    return new Map<string, AppointmentDepositReceiptPreview>();
  }

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, deposit_receipt_path, deposit_receipt_uploaded_at, deposit_receipt_content_type, deposit_payment_provider, deposit_payment_provider_status, deposit_payment_provider_invoice_url, deposit_payment_provider_last_synced_at",
    )
    .eq("salon_id", salonId)
    .in("id", appointmentIds);

  if (error || !data?.length) {
    return new Map<string, AppointmentDepositReceiptPreview>();
  }

  const receipts = data as AppointmentDepositReceiptRecord[];
  const uniquePaths = [
    ...new Set(
      receipts.map((item) => item.deposit_receipt_path).filter(Boolean),
    ),
  ] as string[];
  const signedUrls = await Promise.all(
    uniquePaths.map(async (path) => {
      const { data: signed } = await supabase.storage
        .from("appointment-deposit-proofs")
        .createSignedUrl(path, 60 * 60);

      return [path, signed?.signedUrl ?? null] as const;
    }),
  );
  const signedUrlMap = new Map<string, string | null>(signedUrls);

  return new Map<string, AppointmentDepositReceiptPreview>(
    receipts.map((item) => [
      item.id,
      {
        contentType: item.deposit_receipt_content_type,
        providerInvoiceUrl: item.deposit_payment_provider_invoice_url,
        providerName: item.deposit_payment_provider,
        providerStatus: item.deposit_payment_provider_status,
        providerSyncedAt: item.deposit_payment_provider_last_synced_at,
        signedUrl: item.deposit_receipt_path
          ? (signedUrlMap.get(item.deposit_receipt_path) ?? null)
          : null,
        uploadedAt: item.deposit_receipt_uploaded_at,
      },
    ]),
  );
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePage(value?: string | string[]) {
  const pageValue = Number(firstParam(value));
  if (!Number.isFinite(pageValue) || pageValue < 1) {
    return 1;
  }

  return Math.floor(pageValue);
}

function normalizeBoardStatus(value: string): AppointmentBoardStatus | "" {
  if (
    value === "pending" ||
    value === "confirmed" ||
    value === "awaiting-completion" ||
    value === "completed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "";
}

function formatAppointmentStatus(status: AppointmentBoardStatus) {
  switch (status) {
    case "awaiting-completion":
      return "Aguardando conclusão";
    case "confirmed":
      return "Confirmado";
    case "completed":
      return "Atendido";
    case "cancelled":
      return "Cancelado";
    default:
      return "Pendente";
  }
}

function getAppointmentSectionDescription(status: AppointmentBoardStatus) {
  switch (status) {
    case "awaiting-completion":
      return "Atendimentos que já passaram do horário e podem ser concluídos agora.";
    case "confirmed":
      return "Horários futuros já reservados e prontos para atendimento.";
    case "completed":
      return "Atendimentos concluídos e registrados no histórico do salão.";
    case "cancelled":
      return "Pedidos cancelados, com motivo e origem do cancelamento registrados.";
    default:
      return "Pedidos novos esperando a confirmação do salão.";
  }
}

function formatAppointmentDepositStatus(
  status: AppointmentBoardItem["deposit_status"],
) {
  switch (status) {
    case "pending":
      return "Sinal pendente";
    case "received":
      return "Sinal recebido";
    case "refunded":
      return "Sinal estornado";
    case "waived":
      return "Sinal dispensado";
    default:
      return "Sem sinal";
  }
}

function getAppointmentDepositBadgeTone(
  status: AppointmentBoardItem["deposit_status"],
) {
  switch (status) {
    case "received":
      return "confirmed";
    case "refunded":
      return "cancelled";
    case "waived":
      return "soft";
    default:
      return "pending";
  }
}

function formatSystemCancellationOrigin(reason: string | null) {
  const normalizedReason = (reason ?? "").toLowerCase();

  if (normalizedReason.includes("sinal")) {
    return "sistema por sinal pendente";
  }

  if (normalizedReason.includes("confirm")) {
    return "sistema por falta de confirmacao";
  }

  return "sistema pela automacao da reserva";
}

function formatDepositReportedVia(
  paymentMethod: AppointmentBoardItem["deposit_customer_reported_paid_via"],
) {
  switch (paymentMethod) {
    case "asaas_pix":
      return "Pix automatico";
    case "pix":
      return "Pix";
    case "external_checkout":
      return "checkout externo";
    default:
      return "operacao manual";
  }
}

function formatManagedDepositProviderStatus(status: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "PENDING":
      return "Pix aguardando pagamento";
    case "RECEIVED":
      return "Pix recebido automaticamente";
    case "CONFIRMED":
      return "Pix confirmado no Asaas";
    case "OVERDUE":
      return "Pix vencido no Asaas";
    case "REFUNDED":
      return "Pix estornado no Asaas";
    default:
      return status ? `Asaas ${status.toLowerCase()}` : "Pix gerenciado";
  }
}

function buildHref(
  currentSearchParams: AppointmentsPageProps["searchParams"],
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  const entries = [
    ["q", firstParam(currentSearchParams?.q)],
    ["status", firstParam(currentSearchParams?.status)],
    ["staffMemberId", firstParam(currentSearchParams?.staffMemberId)],
    ["dateFrom", firstParam(currentSearchParams?.dateFrom)],
    ["dateTo", firstParam(currentSearchParams?.dateTo)],
    ["page", String(parsePage(currentSearchParams?.page))],
  ] as const;

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();
  return `/dashboard/appointments${search ? `?${search}` : ""}`;
}

function resolveAppointmentMembershipStatus(
  membership: AppointmentMembershipRecord,
  today: string,
) {
  if (membership.status === "cancelled") {
    return "cancelled";
  }

  if (membership.sessions_used >= membership.sessions_included) {
    return "completed";
  }

  if (membership.expires_at < today || membership.status === "expired") {
    return "expired";
  }

  return "active";
}

export default async function AppointmentsPage({
  searchParams,
}: AppointmentsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const q = firstParam(searchParams?.q).trim();
  const dateFrom = firstParam(searchParams?.dateFrom).trim();
  const dateTo = firstParam(searchParams?.dateTo).trim();
  const staffMemberId = firstParam(searchParams?.staffMemberId).trim();
  const statusFilter = normalizeBoardStatus(
    firstParam(searchParams?.status).trim(),
  );
  const requestedPage = parsePage(searchParams?.page);

  const [staffMembersResult, boardResult, smartScheduleResult] =
    await Promise.all([
      supabase
        .from("staff_members")
        .select("id, name")
        .eq("salon_id", salon.id)
        .order("name"),
      supabase.rpc("get_owner_appointment_board", {
        search_input: q || null,
        date_from_input: dateFrom || null,
        date_to_input: dateTo || null,
        staff_member_id_input: staffMemberId || null,
        board_status_input: statusFilter || null,
        page_input: requestedPage,
        page_size_input: PAGE_SIZE,
      }),
      supabase.rpc("get_smart_schedule_opportunities", {}),
    ]);

  const smartSchedule = (smartScheduleResult.data ?? {
    target_day: new Date().toISOString().slice(0, 10),
    timezone: "America/Sao_Paulo",
    slot_step_minutes: salon.slot_step_minutes ?? 30,
    suggestions: [],
  }) as SmartScheduleResponse;

  const boardResponse = (boardResult.data ?? {
    overview: {
      deposit_pending: 0,
      deposit_received: 0,
      pending: 0,
      confirmed: 0,
      awaiting_completion: 0,
      completed: 0,
      cancelled: 0,
    },
    total_count: 0,
    total_pages: 1,
    page: 1,
    page_size: PAGE_SIZE,
    items: [],
  }) as AppointmentBoardResponse;

  const appointments = boardResponse.items ?? [];
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const today = new Date().toISOString().slice(0, 10);
  const appointmentRelationById = new Map<string, AppointmentRelationRecord>();
  const appointmentMembershipsByCustomerId = new Map<
    string,
    AppointmentMembershipRecord[]
  >();
  const appointmentMembershipById = new Map<
    string,
    AppointmentMembershipRecord
  >();
  const appointmentRedemptionByAppointmentId = new Map<
    string,
    AppointmentMembershipRedemptionRecord
  >();
  const [
    appointmentRelationsResult,
    appointmentRedemptionsResult,
    appointmentDepositReceiptPreviews,
  ] = await Promise.all([
    appointmentIds.length
      ? supabase
          .from("appointments")
          .select("id, customer_id, service_id")
          .eq("salon_id", salon.id)
          .in("id", appointmentIds)
      : Promise.resolve({ data: [], error: null }),
    appointmentIds.length
      ? supabase
          .from("customer_membership_redemptions")
          .select("appointment_id, membership_id")
          .eq("salon_id", salon.id)
          .in("appointment_id", appointmentIds)
          .is("reversed_at", null)
      : Promise.resolve({ data: [], error: null }),
    buildAppointmentDepositReceiptPreviewMap({
      appointmentIds,
      salonId: salon.id,
      supabase,
    }),
  ]);

  const appointmentRelations = (appointmentRelationsResult.data ??
    []) as AppointmentRelationRecord[];
  for (const relation of appointmentRelations) {
    appointmentRelationById.set(relation.id, relation);
  }

  const customerIds = [
    ...new Set(appointmentRelations.map((relation) => relation.customer_id)),
  ];

  if (customerIds.length) {
    const membershipsResult = await supabase
      .from("customer_memberships")
      .select(
        "id, customer_id, title, service_id, service_name_snapshot, price_snapshot, sessions_included, sessions_used, started_at, expires_at, status, notes",
      )
      .eq("salon_id", salon.id)
      .in("customer_id", customerIds)
      .neq("status", "cancelled");

    const memberships = (membershipsResult.data ??
      []) as AppointmentMembershipRecord[];

    for (const membership of memberships) {
      appointmentMembershipById.set(membership.id, membership);

      const customerMemberships =
        appointmentMembershipsByCustomerId.get(membership.customer_id) ?? [];
      customerMemberships.push(membership);
      customerMemberships.sort((left, right) => {
        const leftStatus = resolveAppointmentMembershipStatus(left, today);
        const rightStatus = resolveAppointmentMembershipStatus(right, today);
        const leftPriority =
          leftStatus === "active"
            ? 0
            : leftStatus === "completed"
              ? 1
              : leftStatus === "expired"
                ? 2
                : 3;
        const rightPriority =
          rightStatus === "active"
            ? 0
            : rightStatus === "completed"
              ? 1
              : rightStatus === "expired"
                ? 2
                : 3;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.expires_at.localeCompare(right.expires_at);
      });
      appointmentMembershipsByCustomerId.set(
        membership.customer_id,
        customerMemberships,
      );
    }
  }

  for (const redemption of (appointmentRedemptionsResult.data ??
    []) as AppointmentMembershipRedemptionRecord[]) {
    appointmentRedemptionByAppointmentId.set(
      redemption.appointment_id,
      redemption,
    );
  }

  const safePage = boardResponse.page ?? 1;
  const totalPages = boardResponse.total_pages ?? 1;
  const totalCount = boardResponse.total_count ?? 0;
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem =
    totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const hasFilters = Boolean(
    q || dateFrom || dateTo || staffMemberId || statusFilter,
  );
  const hasAdvancedFilters = Boolean(
    dateFrom || dateTo || staffMemberId || statusFilter,
  );
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const staffMembers = (staffMembersResult.data ?? []) as StaffMemberOption[];
  const depositPendingCount = boardResponse.overview.deposit_pending ?? 0;
  const depositReceivedCount = boardResponse.overview.deposit_received ?? 0;
  const awaitingCustomerResponseCount = appointments.filter(
    (appointment) =>
      appointment.status === "confirmed" &&
      appointment.customer_confirmation_requested_at &&
      !appointment.customer_presence_confirmed_at,
  ).length;
  const actionableSuggestions = (smartSchedule.suggestions ?? []).slice(0, 3);
  const actionableOpportunityRevenue = actionableSuggestions.reduce(
    (accumulator, suggestion) =>
      accumulator + Number(suggestion.suggested_service.price ?? 0),
    0,
  );
  const bestSuggestion = actionableSuggestions[0];
  const agendaCommandCards = [
    {
      eyebrow: "Agora",
      title:
        (boardResponse.overview.pending ?? 0) > 0
          ? "Pendências do salão que pedem resposta imediata"
          : "Sem pedidos parados aguardando o salão",
      highlight: `${boardResponse.overview.pending ?? 0} pendências`,
      description:
        (boardResponse.overview.pending ?? 0) > 0
          ? "Aprovar rápido reduz desistência e abre espaço para encaixar o que faz mais sentido no dia."
          : "A triagem da agenda está em dia. Dá para usar a energia na ocupação inteligente e na retenção.",
      support:
        (boardResponse.overview.pending ?? 0) > 0
          ? "Comece por aqui para não perder cliente que já demonstrou intenção de compra."
          : "Fila de confirmação zerada neste recorte.",
      href: "/dashboard/appointments?status=pending",
      ctaLabel:
        (boardResponse.overview.pending ?? 0) > 0
          ? "Responder pedidos"
          : "Ver agenda completa",
      tone: "warm" as const,
    },
    {
      eyebrow: "Confirmação",
      title:
        awaitingCustomerResponseCount > 0
          ? "Clientes aguardando resposta do lembrete"
          : "Nenhuma confirmação pendurada agora",
      highlight: `${awaitingCustomerResponseCount} em aberto`,
      description:
        awaitingCustomerResponseCount > 0
          ? "Esses horários já foram lembrados no app e ainda dependem de retorno. Vale acompanhar antes de a vaga virar desperdício."
          : "As confirmações já voltaram ou ainda não precisaram ser disparadas.",
      support:
        awaitingCustomerResponseCount > 0
          ? "Monitorar isso cedo ajuda a reaproveitar vaga antes da última hora."
          : "Agenda confirmada sem fila de resposta visível nesta página.",
      href: "/dashboard/appointments?status=confirmed",
      ctaLabel: "Acompanhar confirmações",
      tone: "soft" as const,
    },
    {
      eyebrow: "Reserva protegida",
      title:
        depositPendingCount > 0
          ? "Sinais pendentes que pedem follow-up agora"
          : "Nenhum sinal pendente neste recorte",
      highlight: `${depositPendingCount} pendentes`,
      description:
        depositPendingCount > 0
          ? "Essas reservas ja nasceram com politica aplicada. Confirmar o sinal cedo reduz no-show e evita tratativa manual solta."
          : "Quando o salao exigir sinal, o acompanhamento passa a aparecer aqui na leitura da agenda.",
      support:
        depositReceivedCount > 0
          ? `${depositReceivedCount} reserva${depositReceivedCount === 1 ? "" : "s"} com sinal recebido nesta leitura.`
          : "Sem reserva protegida conciliada ainda neste recorte.",
      href: "/dashboard/appointments?status=pending",
      ctaLabel:
        depositPendingCount > 0 ? "Cobrar sinais" : "Ver reservas protegidas",
      tone: "warm" as const,
    },
    {
      eyebrow: "Oportunidade",
      title:
        actionableSuggestions.length > 0
          ? "Janelas livres com chance real de virar caixa"
          : "Nenhum encaixe estratégico visível agora",
      highlight:
        actionableSuggestions.length > 0
          ? formatCurrency(actionableOpportunityRevenue)
          : "Agenda encaixada",
      description:
        actionableSuggestions.length > 0
          ? "Os melhores intervalos do dia já estão mapeados. Atacar esses encaixes tende a gerar receita sem estressar a jornada da equipe."
          : "Quando surgir uma janela livre compatível com algum serviço, ela passa a aparecer aqui automaticamente.",
      support:
        bestSuggestion == null
          ? "Sem gap vendável neste momento."
          : `${bestSuggestion.staff_member_name} • ${bestSuggestion.suggested_service.name} • ${bestSuggestion.gap_minutes} min livres.`,
      href: "/dashboard/appointments#encaixes-inteligentes",
      ctaLabel:
        actionableSuggestions.length > 0
          ? "Usar encaixes"
          : "Ver agenda do dia",
      tone: "accent" as const,
    },
    {
      eyebrow: "Fechamento",
      title:
        (boardResponse.overview.awaiting_completion ?? 0) > 0
          ? "Atendimentos já liberados para conclusão"
          : "Nada pendente de fechamento no momento",
      highlight: `${boardResponse.overview.awaiting_completion ?? 0} para fechar`,
      description:
        (boardResponse.overview.awaiting_completion ?? 0) > 0
          ? "Concluir no tempo certo alimenta comissão, histórico, fidelidade e inteligência do salão sem buraco operacional."
          : "O histórico está sendo fechado no tempo certo nesta leitura da agenda.",
      support:
        (boardResponse.overview.awaiting_completion ?? 0) > 0
          ? "Esse fechamento mantém relatórios e automações consistentes."
          : "Sem atendimento passado aguardando ação do dono.",
      href: "/dashboard/appointments?status=awaiting-completion",
      ctaLabel:
        (boardResponse.overview.awaiting_completion ?? 0) > 0
          ? "Concluir atendimentos"
          : "Abrir histórico da agenda",
      tone: "soft" as const,
    },
  ];

  const appointmentSections = (
    [
      {
        key: "pending",
        title: "Pendentes",
        description: getAppointmentSectionDescription("pending"),
        items: appointments.filter(
          (appointment) => appointment.board_status === "pending",
        ),
      },
      {
        key: "confirmed",
        title: "Confirmados",
        description: getAppointmentSectionDescription("confirmed"),
        items: appointments.filter(
          (appointment) => appointment.board_status === "confirmed",
        ),
      },
      {
        key: "awaiting-completion",
        title: "Aguardando conclusão",
        description: getAppointmentSectionDescription("awaiting-completion"),
        items: appointments.filter(
          (appointment) => appointment.board_status === "awaiting-completion",
        ),
      },
      {
        key: "completed",
        title: "Atendidos",
        description: getAppointmentSectionDescription("completed"),
        items: appointments.filter(
          (appointment) => appointment.board_status === "completed",
        ),
      },
      {
        key: "cancelled",
        title: "Cancelados",
        description: getAppointmentSectionDescription("cancelled"),
        items: appointments.filter(
          (appointment) => appointment.board_status === "cancelled",
        ),
      },
    ] satisfies AppointmentStatusSection[]
  ).filter((section) => !statusFilter || section.key === statusFilter);
  const agendaFilterSummary = [
    q || null,
    statusFilter || null,
    staffMemberId || null,
    dateFrom || null,
    dateTo || null,
  ].filter(Boolean).length;

  return (
    <div className="page-grid workspace-page appointments-page">
      <SmartScheduleSuggestions
        sectionId="encaixes-inteligentes"
        title="Encaixes inteligentes de hoje"
        description="O painel aponta os melhores intervalos livres entre atendimentos para vender encaixes sem criar conflito na jornada dos profissionais."
        suggestions={smartSchedule.suggestions ?? []}
        targetDayLabel={buildSmartScheduleTargetDayLabel(
          smartSchedule.target_day,
        )}
      />

      <DashboardWorkspaceHero
        eyebrow="Agenda operacional"
        title="Horários, confirmações e encaixes estratégicos na mesma superfície."
        description="A agenda do salão agora destaca o que precisa de ação imediata e o que pode virar faturamento sem improviso. Tudo segue vindo da operação real e das RPCs do painel."
        highlight={{
          label: "Volume no recorte",
          value: `${totalCount} agendamento${totalCount === 1 ? "" : "s"}`,
          note:
            agendaFilterSummary > 0
              ? `Recorte filtrado com ${agendaFilterSummary} critério${agendaFilterSummary === 1 ? "" : "s"} ativo${agendaFilterSummary === 1 ? "" : "s"}.`
              : "Leitura ampla da agenda sem filtros adicionais.",
        }}
        signals={[
          {
            label: "Pendências",
            value: boardResponse.overview.pending ?? 0,
            tone: (boardResponse.overview.pending ?? 0) > 0 ? "warm" : "soft",
          },
          {
            label: "Confirmações abertas",
            value: awaitingCustomerResponseCount,
            tone: awaitingCustomerResponseCount > 0 ? "accent" : "success",
          },
          {
            label: "Sinais pendentes",
            value: depositPendingCount,
            tone: depositPendingCount > 0 ? "warm" : "soft",
          },
        ]}
        stats={[
          {
            label: "Confirmados",
            value: boardResponse.overview.confirmed ?? 0,
            note: "Horários futuros já seguros na agenda.",
            tone: "soft",
          },
          {
            label: "Aguardando conclusão",
            value: boardResponse.overview.awaiting_completion ?? 0,
            note: "Atendimentos que já podem alimentar histórico e comissão.",
            tone: "accent",
          },
          {
            label: "Atendidos",
            value: boardResponse.overview.completed ?? 0,
            note: "Serviços concluídos no recorte atual.",
            tone: "success",
          },
          {
            label: "Cancelados",
            value: boardResponse.overview.cancelled ?? 0,
            note: "Horários perdidos que merecem análise de causa.",
            tone:
              (boardResponse.overview.cancelled ?? 0) > 0 ? "danger" : "soft",
          },
        ]}
        aside={
          <>
            <span className="workspace-panel__eyebrow">
              Oportunidade do dia
            </span>
            <h3>
              {bestSuggestion
                ? `${bestSuggestion.staff_member_name} tem uma janela vendável agora.`
                : "Nenhuma janela estratégica evidente no momento."}
            </h3>
            <p>
              {bestSuggestion
                ? `${bestSuggestion.suggested_service.name} cabe em ${bestSuggestion.gap_minutes} minutos livres e pode adicionar ${formatCurrency(Number(bestSuggestion.suggested_service.price ?? 0))} ao caixa sem estressar a operação.`
                : "Quando houver gap comercialmente saudável entre atendimentos, esta área passa a sugerir encaixes com serviço e potencial de receita."}
            </p>
          </>
        }
      />

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Agendamentos</h2>
            <p className="muted">
              Confirme, conclua ou cancele os horários com foco no que realmente
              importa agora.
            </p>
          </div>
        </div>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage
              message={searchParams.message}
              tone={searchParams.tone}
            />
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <ActionCommandCenter
            title="Operação que merece atenção agora"
            description="Em vez de navegar no escuro, o painel já destaca onde a agenda pede ação imediata para proteger receita e evitar ociosidade."
            cards={agendaCommandCards}
            framed={false}
          />
        </div>

        <form
          method="get"
          className="services-toolbar"
          style={{ marginTop: 18 }}
        >
          <div className="appointments-toolbar__grid appointments-toolbar__grid--primary">
            <div className="field">
              <label htmlFor="appointments-search">Buscar agenda</label>
              <input
                id="appointments-search"
                name="q"
                placeholder="Cliente, serviço, categoria ou profissional"
                defaultValue={q}
              />
            </div>
          </div>

          <details
            className="appointments-filter-shell"
            open={hasAdvancedFilters || undefined}
          >
            <summary className="appointments-filter-shell__summary">
              <div>
                <strong>Filtros avançados</strong>
                <span>
                  {hasAdvancedFilters
                    ? "Refinando profissional, situação ou período da agenda."
                    : "Abra só quando precisar refinar profissional, situação ou período."}
                </span>
              </div>
              <span className="appointments-filter-shell__pill">
                {hasAdvancedFilters
                  ? `${agendaFilterSummary - (q ? 1 : 0)} ativo${agendaFilterSummary - (q ? 1 : 0) === 1 ? "" : "s"}`
                  : "Opcional"}
              </span>
            </summary>

            <div className="appointments-filter-shell__body">
              <div className="appointments-toolbar__grid appointments-toolbar__grid--advanced">
                <div className="field">
                  <label htmlFor="appointments-status">Situação</label>
                  <select
                    id="appointments-status"
                    name="status"
                    defaultValue={statusFilter}
                  >
                    <option value="">Todas</option>
                    <option value="pending">Pendentes</option>
                    <option value="confirmed">Confirmados</option>
                    <option value="awaiting-completion">
                      Aguardando conclusão
                    </option>
                    <option value="completed">Atendidos</option>
                    <option value="cancelled">Cancelados</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="appointments-staff">Profissional</label>
                  <select
                    id="appointments-staff"
                    name="staffMemberId"
                    defaultValue={staffMemberId}
                  >
                    <option value="">Toda a equipe</option>
                    {staffMembers.map((staffMember) => (
                      <option key={staffMember.id} value={staffMember.id}>
                        {staffMember.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="appointments-date-from">De</label>
                  <input
                    id="appointments-date-from"
                    name="dateFrom"
                    type="date"
                    defaultValue={dateFrom}
                  />
                </div>

                <div className="field">
                  <label htmlFor="appointments-date-to">Até</label>
                  <input
                    id="appointments-date-to"
                    name="dateTo"
                    type="date"
                    defaultValue={dateTo}
                  />
                </div>
              </div>
            </div>
          </details>

          <p className="appointments-toolbar__helper">
            Busca principal sempre visível. Os filtros mais técnicos ficam
            recolhidos para a agenda abrir mais limpa no dia a dia.
          </p>

          <input type="hidden" name="page" value="1" />

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar agenda
            </button>
            <span className="services-toolbar__count">
              {totalCount}{" "}
              {totalCount === 1
                ? "agendamento encontrado"
                : "agendamentos encontrados"}
            </span>
            {hasFilters ? (
              <a
                href="/dashboard/appointments"
                className="secondary-button services-toolbar__clear"
              >
                Limpar filtros
              </a>
            ) : null}
          </div>
        </form>

        <div className="appointments-overview" style={{ marginTop: 18 }}>
          {[
            {
              key: "pending",
              title: "Pendentes",
              count: boardResponse.overview.pending,
              description: getAppointmentSectionDescription("pending"),
            },
            {
              key: "confirmed",
              title: "Confirmados",
              count: boardResponse.overview.confirmed,
              description: getAppointmentSectionDescription("confirmed"),
            },
            {
              key: "awaiting-completion",
              title: "Aguardando conclusão",
              count: boardResponse.overview.awaiting_completion,
              description: getAppointmentSectionDescription(
                "awaiting-completion",
              ),
            },
            {
              key: "completed",
              title: "Atendidos",
              count: boardResponse.overview.completed,
              description: getAppointmentSectionDescription("completed"),
            },
            {
              key: "cancelled",
              title: "Cancelados",
              count: boardResponse.overview.cancelled,
              description: getAppointmentSectionDescription("cancelled"),
            },
          ].map((section) => (
            <article
              key={section.key}
              className={`appointments-overview__card appointments-overview__card--${section.key}`}
            >
              <span className="eyebrow">{section.title}</span>
              <strong>{section.count}</strong>
              <p>{section.description}</p>
            </article>
          ))}
        </div>

        <div className="appointment-status-board" style={{ marginTop: 22 }}>
          {!appointments.length ? (
            <EmptyStateCard
              eyebrow={hasFilters ? "Nenhum resultado" : "Agenda livre"}
              title={
                hasFilters
                  ? "Nenhum agendamento encontrado nesse recorte"
                  : "Nenhum agendamento por enquanto"
              }
              description={
                hasFilters
                  ? "Ajuste o período, o profissional ou a situação para localizar os horários certos."
                  : "Quando seus clientes começarem a marcar horários, os pedidos vão aparecer aqui para confirmação."
              }
            />
          ) : (
            appointmentSections
              .filter((section) => section.items.length > 0)
              .map((section) => (
                <section
                  key={section.key}
                  className={`appointment-status-section appointment-status-section--${section.key}`}
                >
                  <div className="appointment-status-section__header">
                    <div>
                      <span className="eyebrow">
                        {formatAppointmentStatus(section.key)}
                      </span>
                      <h3>{section.title}</h3>
                      <p className="muted">{section.description}</p>
                    </div>
                    <span className={`badge badge--${section.key}`}>
                      {section.items.length} nesta página
                    </span>
                  </div>

                  <div className="row-list">
                    {section.items.map((appointment) => {
                      const canComplete =
                        appointment.board_status === "awaiting-completion";
                      const completionPendingByTime =
                        appointment.board_status === "confirmed";
                      const hasDepositControl =
                        Number(appointment.deposit_amount ?? 0) > 0;
                      const depositReceiptPreview =
                        appointmentDepositReceiptPreviews.get(appointment.id) ??
                        null;
                      const appointmentRelation =
                        appointmentRelationById.get(appointment.id) ?? null;
                      const appointmentRedemption =
                        appointmentRedemptionByAppointmentId.get(
                          appointment.id,
                        ) ?? null;
                      const eligibleMemberships = appointmentRelation
                        ? (
                            appointmentMembershipsByCustomerId.get(
                              appointmentRelation.customer_id,
                            ) ?? []
                          ).filter((membership) => {
                            const membershipStatus =
                              resolveAppointmentMembershipStatus(
                                membership,
                                today,
                              );

                            return (
                              membership.service_id ===
                                appointmentRelation.service_id &&
                              membershipStatus === "active" &&
                              membership.sessions_used <
                                membership.sessions_included
                            );
                          })
                        : [];
                      const activeMembership =
                        appointmentRedemption?.membership_id != null
                          ? (appointmentMembershipById.get(
                              appointmentRedemption.membership_id,
                            ) ?? null)
                          : (eligibleMemberships[0] ?? null);
                      const activeMembershipRemainingSessions =
                        activeMembership == null
                          ? 0
                          : Math.max(
                              activeMembership.sessions_included -
                                activeMembership.sessions_used -
                                (appointmentRedemption ? 1 : 0),
                              0,
                            );

                      return (
                        <article
                          key={appointment.id}
                          className={`list-row appointment-card appointment-card--${appointment.board_status}`}
                        >
                          <div className="list-row__content">
                            <h3>{appointment.customer_name}</h3>
                            <p className="muted list-description">
                              {appointment.service_category
                                ? `${appointment.service_category} • `
                                : ""}
                              {appointment.service_name} •{" "}
                              {appointment.service_duration ?? 0} min
                            </p>
                            <div className="appointment-card__meta">
                              <small className="list-meta">
                                Profissional:{" "}
                                {appointment.staff_member_name ??
                                  "Equipe do salão"}
                              </small>
                              <small className="list-meta">
                                {formatDateTime(appointment.date)}
                              </small>
                              {appointment.status === "cancelled" ? (
                                <>
                                  <small className="list-meta">
                                    Cancelado por{" "}
                                    {appointment.cancelled_by === "customer"
                                      ? "cliente"
                                      : appointment.cancelled_by === "system"
                                        ? formatSystemCancellationOrigin(
                                            appointment.cancellation_reason,
                                          )
                                        : "salão"}
                                    {appointment.cancelled_at
                                      ? ` em ${formatDateTime(appointment.cancelled_at)}`
                                      : ""}
                                  </small>
                                  {appointment.cancellation_reason ? (
                                    <p className="muted list-description">
                                      Motivo: {appointment.cancellation_reason}
                                    </p>
                                  ) : null}
                                </>
                              ) : null}
                              {appointment.status === "completed" &&
                              appointment.completed_at ? (
                                <small className="list-meta">
                                  Atendimento concluído em{" "}
                                  {formatDateTime(appointment.completed_at)}
                                </small>
                              ) : null}
                              {appointment.status === "confirmed" &&
                              appointment.customer_presence_confirmed_at ? (
                                <small className="list-meta">
                                  Cliente confirmou presença em{" "}
                                  {formatDateTime(
                                    appointment.customer_presence_confirmed_at,
                                  )}
                                  .
                                </small>
                              ) : null}
                              {appointment.status === "confirmed" &&
                              !appointment.customer_presence_confirmed_at &&
                              appointment.customer_confirmation_requested_at ? (
                                <small className="list-meta">
                                  Confirmação enviada ao cliente em{" "}
                                  {formatDateTime(
                                    appointment.customer_confirmation_requested_at,
                                  )}
                                  . Aguardando resposta.
                                </small>
                              ) : null}
                              {hasDepositControl ? (
                                <small className="list-meta">
                                  {formatAppointmentDepositStatus(
                                    appointment.deposit_status,
                                  )}{" "}
                                  de{" "}
                                  {formatCurrency(
                                    Number(appointment.deposit_amount ?? 0),
                                  )}
                                  {appointment.deposit_status === "received" &&
                                  appointment.deposit_paid_at
                                    ? ` em ${formatDateTime(appointment.deposit_paid_at)}`
                                    : "."}
                                </small>
                              ) : null}
                              {appointment.booking_policy_version ? (
                                <small className="list-meta">
                                  {appointment.booking_policy_acknowledged_at
                                    ? `Politica aceita no app em ${formatDateTime(appointment.booking_policy_acknowledged_at)}.`
                                    : `Politica aplicada na reserva (${appointment.booking_policy_version}).`}
                                </small>
                              ) : null}
                              {appointmentRedemption && activeMembership ? (
                                <small className="list-meta">
                                  Pacote consumido: {activeMembership.title} •{" "}
                                  {activeMembershipRemainingSessions} restante
                                  {activeMembershipRemainingSessions === 1
                                    ? ""
                                    : "s"}{" "}
                                  até {formatDate(activeMembership.expires_at)}.
                                </small>
                              ) : null}
                              {!appointmentRedemption && activeMembership ? (
                                <small className="list-meta">
                                  Pacote disponível: {activeMembership.title} •{" "}
                                  {Math.max(
                                    activeMembership.sessions_included -
                                      activeMembership.sessions_used,
                                    0,
                                  )}{" "}
                                  restante
                                  {Math.max(
                                    activeMembership.sessions_included -
                                      activeMembership.sessions_used,
                                    0,
                                  ) === 1
                                    ? ""
                                    : "s"}{" "}
                                  até {formatDate(activeMembership.expires_at)}.
                                </small>
                              ) : null}
                              {appointment.deposit_notes ? (
                                <p className="muted list-description">
                                  Sinal: {appointment.deposit_notes}
                                </p>
                              ) : null}
                              {appointment.deposit_status === "pending" &&
                              appointment.deposit_customer_reported_paid_at ? (
                                <small className="list-meta">
                                  Cliente informou pagamento via{" "}
                                  {formatDepositReportedVia(
                                    appointment.deposit_customer_reported_paid_via,
                                  )}{" "}
                                  em{" "}
                                  {formatDateTime(
                                    appointment.deposit_customer_reported_paid_at,
                                  )}
                                  .
                                </small>
                              ) : null}
                              {appointment.deposit_status === "pending" &&
                              appointment.deposit_customer_reported_reference ? (
                                <p className="muted list-description">
                                  Referencia enviada pela cliente:{" "}
                                  {
                                    appointment.deposit_customer_reported_reference
                                  }
                                </p>
                              ) : null}
                              {depositReceiptPreview?.uploadedAt ? (
                                <small className="list-meta">
                                  Comprovante enviado em{" "}
                                  {formatDateTime(
                                    depositReceiptPreview.uploadedAt,
                                  )}
                                  .
                                </small>
                              ) : null}
                              {depositReceiptPreview?.providerStatus ? (
                                <small className="list-meta">
                                  {formatManagedDepositProviderStatus(
                                    depositReceiptPreview.providerStatus,
                                  )}
                                  {depositReceiptPreview.providerSyncedAt
                                    ? ` em ${formatDateTime(depositReceiptPreview.providerSyncedAt)}.`
                                    : "."}
                                </small>
                              ) : null}
                              {depositReceiptPreview?.signedUrl ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 12,
                                    alignItems: "center",
                                    marginTop: 10,
                                  }}
                                >
                                  <a
                                    href={depositReceiptPreview.signedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="secondary-button appointment-card__link"
                                  >
                                    Abrir comprovante
                                  </a>
                                  <Image
                                    src={depositReceiptPreview.signedUrl}
                                    alt={`Comprovante de ${appointment.customer_name}`}
                                    width={88}
                                    height={88}
                                    unoptimized
                                    style={{
                                      width: 88,
                                      height: 88,
                                      objectFit: "cover",
                                      borderRadius: 18,
                                      border: "1px solid var(--border-subtle)",
                                    }}
                                  />
                                </div>
                              ) : null}
                              {depositReceiptPreview?.providerInvoiceUrl ? (
                                <div style={{ marginTop: 10 }}>
                                  <a
                                    href={
                                      depositReceiptPreview.providerInvoiceUrl
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="secondary-button appointment-card__link"
                                  >
                                    Abrir cobranca Pix
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="inline-actions list-row__aside appointment-card__actions">
                            <span
                              className={`badge badge--${appointment.board_status}`}
                            >
                              {formatAppointmentStatus(
                                appointment.board_status,
                              )}
                            </span>
                            {hasDepositControl ? (
                              <span
                                className={`badge badge--${getAppointmentDepositBadgeTone(appointment.deposit_status)}`}
                              >
                                {formatAppointmentDepositStatus(
                                  appointment.deposit_status,
                                )}
                              </span>
                            ) : null}
                            {hasDepositControl &&
                            appointment.deposit_status === "pending" &&
                            appointment.deposit_customer_reported_paid_at ? (
                              <span className="badge badge--soft">
                                Cliente informou
                              </span>
                            ) : null}
                            {hasDepositControl &&
                            depositReceiptPreview?.uploadedAt ? (
                              <span className="badge badge--soft">
                                Comprovante anexado
                              </span>
                            ) : null}
                            {hasDepositControl &&
                            depositReceiptPreview?.providerStatus ? (
                              <span className="badge badge--soft">
                                Pix gerenciado
                              </span>
                            ) : null}
                            {appointmentRedemption ? (
                              <span className="badge badge--accent">
                                Pacote consumido
                              </span>
                            ) : activeMembership ? (
                              <span className="badge badge--soft">
                                Pacote disponível
                              </span>
                            ) : null}

                            <Link
                              href={`/dashboard/customers?q=${encodeURIComponent(appointment.customer_name)}`}
                              className="secondary-button appointment-card__link"
                            >
                              Abrir cliente
                            </Link>

                            {hasDepositControl &&
                            appointment.deposit_status !== "received" ? (
                              <form
                                action={updateAppointmentDepositAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="depositStatus"
                                  value="received"
                                />
                                <input
                                  type="hidden"
                                  name="depositNotes"
                                  value=""
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Marcar sinal recebido
                                </button>
                              </form>
                            ) : null}

                            {hasDepositControl &&
                            appointment.deposit_status === "pending" ? (
                              <form
                                action={updateAppointmentDepositAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="depositStatus"
                                  value="waived"
                                />
                                <input
                                  type="hidden"
                                  name="depositNotes"
                                  value=""
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Dispensar sinal
                                </button>
                              </form>
                            ) : null}

                            {hasDepositControl &&
                            (appointment.deposit_status === "waived" ||
                              appointment.deposit_status === "refunded") ? (
                              <form
                                action={updateAppointmentDepositAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="depositStatus"
                                  value="pending"
                                />
                                <input
                                  type="hidden"
                                  name="depositNotes"
                                  value=""
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Voltar para pendente
                                </button>
                              </form>
                            ) : null}

                            {hasDepositControl &&
                            appointment.deposit_status === "received" ? (
                              <form
                                action={updateAppointmentDepositAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="depositStatus"
                                  value="refunded"
                                />
                                <input
                                  type="hidden"
                                  name="depositNotes"
                                  value=""
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Estornar sinal
                                </button>
                              </form>
                            ) : null}

                            {appointment.status === "pending" ? (
                              <form
                                action={updateAppointmentStatusAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="confirmed"
                                />
                                <button
                                  type="submit"
                                  className="success-button"
                                >
                                  Confirmar
                                </button>
                              </form>
                            ) : null}

                            {canComplete ? (
                              <form
                                action={updateAppointmentStatusAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="completed"
                                />
                                {activeMembership ? (
                                  <input
                                    type="hidden"
                                    name="membershipPackageId"
                                    value={activeMembership.id}
                                  />
                                ) : null}
                                <button
                                  type="submit"
                                  className="primary-button"
                                >
                                  {activeMembership
                                    ? "Atender e consumir pacote"
                                    : "Marcar como atendido"}
                                </button>
                              </form>
                            ) : null}

                            {appointment.status === "completed" &&
                            !appointmentRedemption &&
                            activeMembership ? (
                              <form
                                action={consumeAppointmentMembershipAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="membershipPackageId"
                                  value={activeMembership.id}
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Consumir 1 sessão
                                </button>
                              </form>
                            ) : null}

                            {appointmentRedemption ? (
                              <form
                                action={reverseAppointmentMembershipAction}
                                className="appointment-inline-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <button
                                  type="submit"
                                  className="secondary-button"
                                >
                                  Estornar sessão
                                </button>
                              </form>
                            ) : null}

                            {completionPendingByTime ? (
                              <div className="appointment-complete-wait">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled
                                >
                                  Liberado após o horário
                                </button>
                                <small className="list-meta">
                                  Conclusão disponível quando esse atendimento
                                  terminar em{" "}
                                  {formatDateTime(appointment.ends_at)}.
                                </small>
                              </div>
                            ) : null}

                            {appointment.status !== "cancelled" &&
                            appointment.status !== "completed" ? (
                              <form
                                action={updateAppointmentStatusAction}
                                className="appointment-cancel-form"
                              >
                                <input
                                  type="hidden"
                                  name="appointmentId"
                                  value={appointment.id}
                                />
                                <input
                                  type="hidden"
                                  name="status"
                                  value="cancelled"
                                />
                                <input
                                  type="text"
                                  name="cancellationReason"
                                  placeholder="Motivo do cancelamento"
                                />
                                <button type="submit" className="danger-button">
                                  Cancelar
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
          )}
        </div>

        {totalPages > 1 ? (
          <nav
            className="notifications-pagination"
            aria-label="Paginação dos agendamentos"
          >
            <div className="notifications-pagination__summary">
              Exibindo de {startItem} até {endItem} de {totalCount}. Página{" "}
              {safePage} de {totalPages}.
            </div>

            <div className="notifications-pagination__links">
              {safePage > 1 ? (
                <Link
                  href={buildHref(searchParams, { page: safePage - 1 })}
                  className="secondary-button"
                >
                  Anterior
                </Link>
              ) : null}

              {pageNumbers.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildHref(searchParams, { page: pageNumber })}
                  className={`secondary-button${pageNumber === safePage ? " notifications-pagination__link--active" : ""}`}
                >
                  {pageNumber}
                </Link>
              ))}

              {safePage < totalPages ? (
                <Link
                  href={buildHref(searchParams, { page: safePage + 1 })}
                  className="secondary-button"
                >
                  Próxima
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
