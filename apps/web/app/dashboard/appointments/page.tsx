import Link from "next/link";

import { updateAppointmentStatusAction } from "@/app/actions";
import { ActionCommandCenter } from "@/components/ActionCommandCenter";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import {
  buildSmartScheduleTargetDayLabel,
  SmartScheduleSuggestion,
  SmartScheduleSuggestions,
} from "@/components/SmartScheduleSuggestions";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
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
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  completed_at: string | null;
  customer_confirmation_requested_at: string | null;
  customer_name: string;
  customer_presence_confirmed_at: string | null;
  date: string;
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

export default async function AppointmentsPage({ searchParams }: AppointmentsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const q = firstParam(searchParams?.q).trim();
  const dateFrom = firstParam(searchParams?.dateFrom).trim();
  const dateTo = firstParam(searchParams?.dateTo).trim();
  const staffMemberId = firstParam(searchParams?.staffMemberId).trim();
  const statusFilter = normalizeBoardStatus(firstParam(searchParams?.status).trim());
  const requestedPage = parsePage(searchParams?.page);

  const [staffMembersResult, boardResult, smartScheduleResult] = await Promise.all([
    supabase.from("staff_members").select("id, name").eq("salon_id", salon.id).order("name"),
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
  const safePage = boardResponse.page ?? 1;
  const totalPages = boardResponse.total_pages ?? 1;
  const totalCount = boardResponse.total_count ?? 0;
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const hasFilters = Boolean(q || dateFrom || dateTo || staffMemberId || statusFilter);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const staffMembers = (staffMembersResult.data ?? []) as StaffMemberOption[];
  const awaitingCustomerResponseCount = appointments.filter(
    (appointment) =>
      appointment.status === "confirmed" &&
      appointment.customer_confirmation_requested_at &&
      !appointment.customer_presence_confirmed_at,
  ).length;
  const actionableSuggestions = (smartSchedule.suggestions ?? []).slice(0, 3);
  const actionableOpportunityRevenue = actionableSuggestions.reduce(
    (accumulator, suggestion) => accumulator + Number(suggestion.suggested_service.price ?? 0),
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
      ctaLabel: (boardResponse.overview.pending ?? 0) > 0 ? "Responder pedidos" : "Ver agenda completa",
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
      ctaLabel: actionableSuggestions.length > 0 ? "Usar encaixes" : "Ver agenda do dia",
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

  const appointmentSections = ([
    {
      key: "pending",
      title: "Pendentes",
      description: getAppointmentSectionDescription("pending"),
      items: appointments.filter((appointment) => appointment.board_status === "pending"),
    },
    {
      key: "confirmed",
      title: "Confirmados",
      description: getAppointmentSectionDescription("confirmed"),
      items: appointments.filter((appointment) => appointment.board_status === "confirmed"),
    },
    {
      key: "awaiting-completion",
      title: "Aguardando conclusão",
      description: getAppointmentSectionDescription("awaiting-completion"),
      items: appointments.filter((appointment) => appointment.board_status === "awaiting-completion"),
    },
    {
      key: "completed",
      title: "Atendidos",
      description: getAppointmentSectionDescription("completed"),
      items: appointments.filter((appointment) => appointment.board_status === "completed"),
    },
    {
      key: "cancelled",
      title: "Cancelados",
      description: getAppointmentSectionDescription("cancelled"),
      items: appointments.filter((appointment) => appointment.board_status === "cancelled"),
    },
  ] satisfies AppointmentStatusSection[]).filter((section) => !statusFilter || section.key === statusFilter);

  return (
    <div className="page-grid">
      <SmartScheduleSuggestions
        sectionId="encaixes-inteligentes"
        title="Encaixes inteligentes de hoje"
        description="O painel aponta os melhores intervalos livres entre atendimentos para vender encaixes sem criar conflito na jornada dos profissionais."
        suggestions={smartSchedule.suggestions ?? []}
        targetDayLabel={buildSmartScheduleTargetDayLabel(smartSchedule.target_day)}
      />

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Agendamentos</h2>
            <p className="muted">Confirme, conclua ou cancele os horários com foco no que realmente importa agora.</p>
          </div>
        </div>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage message={searchParams.message} tone={searchParams.tone} />
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

        <form method="get" className="services-toolbar" style={{ marginTop: 18 }}>
          <div className="appointments-toolbar__grid">
            <div className="field">
              <label htmlFor="appointments-search">Buscar agenda</label>
              <input
                id="appointments-search"
                name="q"
                placeholder="Cliente, serviço, categoria ou profissional"
                defaultValue={q}
              />
            </div>

            <div className="field">
              <label htmlFor="appointments-status">Situação</label>
              <select id="appointments-status" name="status" defaultValue={statusFilter}>
                <option value="">Todas</option>
                <option value="pending">Pendentes</option>
                <option value="confirmed">Confirmados</option>
                <option value="awaiting-completion">Aguardando conclusão</option>
                <option value="completed">Atendidos</option>
                <option value="cancelled">Cancelados</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="appointments-staff">Profissional</label>
              <select id="appointments-staff" name="staffMemberId" defaultValue={staffMemberId}>
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
              <input id="appointments-date-from" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="field">
              <label htmlFor="appointments-date-to">Até</label>
              <input id="appointments-date-to" name="dateTo" type="date" defaultValue={dateTo} />
            </div>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar agenda
            </button>
            <span className="services-toolbar__count">
              {totalCount} {totalCount === 1 ? "agendamento encontrado" : "agendamentos encontrados"}
            </span>
            {hasFilters ? (
              <a href="/dashboard/appointments" className="secondary-button services-toolbar__clear">
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
              description: getAppointmentSectionDescription("awaiting-completion"),
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
              title={hasFilters ? "Nenhum agendamento encontrado nesse recorte" : "Nenhum agendamento por enquanto"}
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
                      <span className="eyebrow">{formatAppointmentStatus(section.key)}</span>
                      <h3>{section.title}</h3>
                      <p className="muted">{section.description}</p>
                    </div>
                    <span className={`badge badge--${section.key}`}>{section.items.length} nesta página</span>
                  </div>

                  <div className="row-list">
                    {section.items.map((appointment) => {
                      const canComplete = appointment.board_status === "awaiting-completion";
                      const completionPendingByTime = appointment.board_status === "confirmed";

                      return (
                        <article
                          key={appointment.id}
                          className={`list-row appointment-card appointment-card--${appointment.board_status}`}
                        >
                          <div className="list-row__content">
                            <h3>{appointment.customer_name}</h3>
                            <p className="muted list-description">
                              {appointment.service_category ? `${appointment.service_category} • ` : ""}
                              {appointment.service_name} • {appointment.service_duration ?? 0} min
                            </p>
                            <small className="list-meta">
                              Profissional: {appointment.staff_member_name ?? "Equipe do salão"}
                            </small>
                            <small className="list-meta">{formatDateTime(appointment.date)}</small>
                            {appointment.status === "cancelled" ? (
                              <>
                                <small className="list-meta">
                                  Cancelado por{" "}
                                  {appointment.cancelled_by === "customer"
                                    ? "cliente"
                                    : appointment.cancelled_by === "system"
                                      ? "sistema por falta de confirmação"
                                      : "salão"}
                                  {appointment.cancelled_at ? ` em ${formatDateTime(appointment.cancelled_at)}` : ""}
                                </small>
                                {appointment.cancellation_reason ? (
                                  <p className="muted list-description">
                                    Motivo: {appointment.cancellation_reason}
                                  </p>
                                ) : null}
                              </>
                            ) : null}
                            {appointment.status === "completed" && appointment.completed_at ? (
                              <small className="list-meta">
                                Atendimento concluído em {formatDateTime(appointment.completed_at)}
                              </small>
                            ) : null}
                            {appointment.status === "confirmed" &&
                            appointment.customer_presence_confirmed_at ? (
                              <small className="list-meta">
                                Cliente confirmou presença em{" "}
                                {formatDateTime(appointment.customer_presence_confirmed_at)}.
                              </small>
                            ) : null}
                            {appointment.status === "confirmed" &&
                            !appointment.customer_presence_confirmed_at &&
                            appointment.customer_confirmation_requested_at ? (
                              <small className="list-meta">
                                Confirmação enviada ao cliente em{" "}
                                {formatDateTime(appointment.customer_confirmation_requested_at)}.
                                Aguardando resposta.
                              </small>
                            ) : null}
                          </div>

                          <div className="inline-actions list-row__aside appointment-card__actions">
                            <span className={`badge badge--${appointment.board_status}`}>
                              {formatAppointmentStatus(appointment.board_status)}
                            </span>

                            {appointment.status === "pending" ? (
                              <form action={updateAppointmentStatusAction} className="appointment-inline-form">
                                <input type="hidden" name="appointmentId" value={appointment.id} />
                                <input type="hidden" name="status" value="confirmed" />
                                <button type="submit" className="success-button">
                                  Confirmar
                                </button>
                              </form>
                            ) : null}

                            {canComplete ? (
                              <form action={updateAppointmentStatusAction} className="appointment-inline-form">
                                <input type="hidden" name="appointmentId" value={appointment.id} />
                                <input type="hidden" name="status" value="completed" />
                                <button type="submit" className="primary-button">
                                  Marcar como atendido
                                </button>
                              </form>
                            ) : null}

                            {completionPendingByTime ? (
                              <div className="appointment-complete-wait">
                                <button type="button" className="secondary-button" disabled>
                                  Liberado após o horário
                                </button>
                                <small className="list-meta">
                                  Conclusão disponível quando esse atendimento terminar em{" "}
                                  {formatDateTime(appointment.ends_at)}.
                                </small>
                              </div>
                            ) : null}

                            {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
                              <form action={updateAppointmentStatusAction} className="appointment-cancel-form">
                                <input type="hidden" name="appointmentId" value={appointment.id} />
                                <input type="hidden" name="status" value="cancelled" />
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
          <nav className="notifications-pagination" aria-label="Paginação dos agendamentos">
            <div className="notifications-pagination__summary">
              Exibindo de {startItem} até {endItem} de {totalCount}. Página {safePage} de {totalPages}.
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
