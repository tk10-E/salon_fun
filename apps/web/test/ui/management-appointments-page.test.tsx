// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerSalonMock,
  loadManagementAppointmentsMock,
  loadManagementAppointmentsMonthMock,
  loadManagementAppointmentsWeekMock,
  loadManagementStaleAppointmentsMock,
  loadManagementSelectOptionsMock,
  routerRefreshMock,
} = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementAppointmentsMock: vi.fn(),
  loadManagementAppointmentsMonthMock: vi.fn(),
  loadManagementAppointmentsWeekMock: vi.fn(),
  loadManagementStaleAppointmentsMock: vi.fn(),
  loadManagementSelectOptionsMock: vi.fn(),
  routerRefreshMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementAppointmentAction: "/actions/management/create-appointment",
  reprocessManagementMembershipPlanAction:
    "/actions/management/reprocess-membership-plan",
  updateManagementAppointmentAction: "/actions/management/update-appointment",
  updateManagementAppointmentStatusAction:
    "/actions/management/update-appointment-status",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@/lib/management", () => ({
  APPOINTMENT_STATUS_OPTIONS: [
    { value: "pending", label: "Agendado" },
    { value: "confirmed", label: "Confirmado" },
    { value: "completed", label: "Concluido" },
    { value: "cancelled", label: "Cancelado" },
    { value: "no_show", label: "Falta" },
  ],
  APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS: [
    { value: "pix", label: "Pix" },
    { value: "cash", label: "Dinheiro" },
    { value: "debit_card", label: "Cartao de debito" },
    { value: "credit_card", label: "Cartao de credito" },
    { value: "to_be_defined", label: "Decidir no salao" },
  ],
  buildFilterHref: vi.fn(() => "/dashboard/gestao/agendamentos?day=2026-04-08"),
  formatAppointmentStatusLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      pending: "Agendado",
      confirmed: "Confirmado",
      completed: "Concluido",
      cancelled: "Cancelado",
      no_show: "Falta",
    };

    return labels[value] ?? value;
  }),
  formatAppointmentPaymentPreferenceLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      pix: "Pix",
      cash: "Dinheiro",
      debit_card: "Cartao de debito",
      credit_card: "Cartao de credito",
      to_be_defined: "Decidir no salao",
    };

    return labels[value] ?? value;
  }),
  formatPaymentMethodLabel: vi.fn((value: string) =>
    value === "pix" ? "Pix" : value,
  ),
  formatTimeInput: vi.fn((value: string) => value.slice(11, 16)),
  getAppointmentStatusBadgeClass: vi.fn(() => "badge--accent"),
  getLocalDateKey: vi.fn(() => "2026-04-08"),
  loadManagementAppointments: loadManagementAppointmentsMock,
  loadManagementAppointmentsMonth: loadManagementAppointmentsMonthMock,
  loadManagementAppointmentsWeek: loadManagementAppointmentsWeekMock,
  loadManagementStaleAppointments: loadManagementStaleAppointmentsMock,
  loadManagementSelectOptions: loadManagementSelectOptionsMock,
  resolveManagementAgendaDisplayDay: vi.fn(
    ({ requestedDay }: { requestedDay: string }) => requestedDay,
  ),
}));

import AgendamentosPage from "@/app/dashboard/gestao/agendamentos/page";

describe("management appointments page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Prime",
        timezone: "America/Sao_Paulo",
        whatsapp_dispatch_enabled: true,
      },
    });

    loadManagementSelectOptionsMock.mockResolvedValue({
      clients: [
        { id: "client-1", label: "Ana Paula", secondary: "11999999999" },
        { id: "client-2", label: "Carla Mendes", secondary: null },
      ],
      professionals: [
        { id: "pro-1", label: "Camila" },
        { id: "pro-2", label: "Ricardo" },
      ],
      services: [
        { id: "service-1", label: "Corte feminino" },
        { id: "service-2", label: "Escova premium" },
      ],
    });

    const items = [
      {
        id: "appointment-1",
        customer_id: "client-1",
        service_id: "service-1",
        staff_member_id: "pro-1",
        customerName: "Ana Paula",
        customerEmail: "ana@studio.com",
        customerPhone: "11999999999",
        customerProfileImageUrl: "https://cdn.example.com/customers/ana.jpg",
        customerWhatsAppPhone: "5511999999999",
        serviceName: "Corte feminino",
        serviceDurationMinutes: 60,
        professionalName: "Camila",
        servicePrice: 120,
        date: "2026-04-08T13:00:00.000Z",
        ends_at: "2026-04-08T14:00:00.000Z",
        status: "confirmed",
        protection_confirmation_required: true,
        customer_presence_confirmed_at: "2026-04-08T12:40:00.000Z",
        deposit_amount: 40,
        deposit_status: "received",
        deposit_paid_at: "2026-04-08T11:20:00.000Z",
        booking_policy_snapshot:
          "Reserva protegida\nResumo: Sinal para segurar horarios premium.",
        payment_preference: "pix",
        notes: "Cliente prefere atendimento silencioso.",
        payment: {
          id: "payment-1",
          amount: 120,
          paymentMethod: "pix",
          paidAt: "2026-04-08T13:05:00.000Z",
          notes: "Pago no caixa.",
        },
      },
      {
        id: "appointment-2",
        customer_id: "client-2",
        service_id: "service-2",
        staff_member_id: "pro-2",
        customerName: "Carla Mendes",
        customerEmail: null,
        customerPhone: null,
        customerProfileImageUrl: null,
        customerWhatsAppPhone: null,
        serviceName: "Escova premium",
        serviceDurationMinutes: 45,
        professionalName: "Ricardo",
        servicePrice: 90,
        date: "2026-04-08T15:30:00.000Z",
        ends_at: "2026-04-08T16:15:00.000Z",
        status: "pending",
        protection_confirmation_required: true,
        customer_confirmation_requested_at: "2026-04-08T15:00:00.000Z",
        deposit_amount: 0,
        deposit_status: "not_required",
        payment_preference: null,
        isMembershipPlanAppointment: true,
        membershipPlanTitle: "Plano brilho",
        membershipPlanReservationStatus: "scheduled",
        membershipSessionIndex: 2,
        membershipSessionsIncluded: 4,
        membershipPlanExpiresAt: "2026-04-30",
        notes: null,
        payment: null,
      },
    ];

    loadManagementAppointmentsMock.mockResolvedValue({
      counts: {
        pending: 1,
        confirmed: 1,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
      items,
    });

    loadManagementAppointmentsMonthMock.mockResolvedValue({
      counts: {
        pending: 1,
        confirmed: 1,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
      items,
    });

    loadManagementAppointmentsWeekMock.mockResolvedValue({
      counts: {
        pending: 1,
        confirmed: 1,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
      items,
    });

    loadManagementStaleAppointmentsMock.mockResolvedValue({
      total: 1,
      items: [
        {
          id: "appointment-stale-1",
          customer_id: "client-1",
          service_id: "service-1",
          staff_member_id: "pro-1",
          customerName: "Ana Paula",
          customerEmail: "ana@studio.com",
          customerPhone: "11999999999",
          customerProfileImageUrl: null,
          serviceName: "Corte feminino",
          serviceDurationMinutes: 60,
          professionalName: "Camila",
          servicePrice: 120,
          date: "2026-04-05T13:00:00.000Z",
          ends_at: "2026-04-05T14:00:00.000Z",
          status: "confirmed",
          protection_confirmation_required: false,
          customer_presence_confirmed_at: "2026-04-05T12:40:00.000Z",
          deposit_amount: 0,
          deposit_status: "not_required",
          payment_preference: "pix",
          notes: null,
          payment: null,
        },
      ],
    });
  });

  it("renders the monthly agenda workspace with sidebar, calendar and day operations", async () => {
    const ui = await AgendamentosPage({
      searchParams: Promise.resolve({
        day: "2026-04-08",
        professionalId: "pro-1",
        status: "confirmed",
        message: "Agenda atualizada.",
        tone: "success",
      }),
    });

    const { container } = render(ui);

    expect(screen.getByText("Agenda atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Novo agendamento" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dia")).toBeInTheDocument();
    expect(screen.getByLabelText("Profissional")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /\+ Novo agendamento/i }),
    ).toBeInTheDocument();
    const openComposerLink = screen.getByRole("link", {
      name: /\+ Novo agendamento/i,
    });
    expect(openComposerLink.getAttribute("href")).toContain("composer=new");
    expect(openComposerLink.getAttribute("href")).toContain("day=2026-04-08");
    expect(openComposerLink.getAttribute("href")).toContain("view=day");
    expect(openComposerLink.getAttribute("href")).toContain(
      "professionalId=pro-1",
    );
    expect(openComposerLink.getAttribute("href")).toContain("status=confirmed");
    expect(openComposerLink.getAttribute("href")).not.toContain("message=");
    expect(
      screen.getByRole("link", { name: "Abrir agenda" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Controle do salão")).toBeInTheDocument();
    expect(screen.getByText("1 horário para fechar")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Feche ou marque falta com base no retorno real da cliente no app.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir dia" })).toBeInTheDocument();
    expect(screen.queryByText("Abril de 2026")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Semana" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Atendimentos do dia").length).toBeGreaterThan(0);
    expect(screen.getByText("Recebido no dia")).toBeInTheDocument();
    expect(screen.getByText("Pagamentos")).toBeInTheDocument();
    expect(screen.getByText("Caixa em dia")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir pagamentos" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Camila").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carla Mendes").length).toBeGreaterThan(0);
    expect(screen.getByAltText("Foto de Ana Paula")).toBeInTheDocument();
    expect(
      screen.getByText("Foto do cadastro carregada."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Corte feminino").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Concluir atendimento" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Confirmar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Marcar falta" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "Cancelar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: /Recalcular sess.es do plano/i,
      })
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Cliente prefere atendimento silencioso.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Cliente").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Veio do app do cliente").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Profissional: Ricardo").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Pago R\$\s?120,00 via Pix/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Pago pelo plano").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Plano - Plano brilho").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/Sess.o 2\/4/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Presença confirmada").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("Confirmou no app")).toBeInTheDocument();
    expect(screen.getByText("Pagamento alinhado")).toBeInTheDocument();
    expect(screen.getAllByText("Aguardando cliente").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/Sinal pago/).length).toBeGreaterThan(0);
    expect(screen.getByText("Cliente confirmou")).toBeInTheDocument();
    expect(screen.getByText("Prefere Pix")).toBeInTheDocument();
    expect(
      screen.getByText("Reserva protegida ativa neste horário."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Forma preferida de pagamento"),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?120,00/).length).toBeGreaterThan(0);
    expect(
      container.querySelector('section#agenda-dia'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll(
        'input[name="returnPath"][value="/dashboard/gestao/agendamentos?day=2026-04-08"]',
      ).length,
    ).toBeGreaterThan(0);
  }, 10000);

  it("opens the quick appointment form only when requested by the sidebar button", async () => {
    const ui = await AgendamentosPage({
      searchParams: Promise.resolve({
        day: "2026-04-08",
        composer: "new",
      }),
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Novo agendamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar agendamento" }),
    ).toBeInTheDocument();
    const closeComposerLink = screen.getByRole("link", { name: "Fechar" });
    expect(closeComposerLink.getAttribute("href")).toBe(
      "/dashboard/gestao/agendamentos?day=2026-04-08&view=day",
    );
  });

  it("keeps the monthly calendar attached to the filter workspace to avoid empty gaps", async () => {
    const ui = await AgendamentosPage({
      searchParams: Promise.resolve({
        day: "2026-04-08",
        professionalId: "pro-1",
        status: "confirmed",
        view: "month",
      }),
    });

    const { container } = render(ui);
    const monthSection = container.querySelector("section#agenda-mes");

    expect(monthSection).not.toBeNull();
    expect(
      monthSection?.previousElementSibling?.textContent,
    ).toContain("Dia em foco");
    expect(screen.getByLabelText("Dia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mes anterior" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Próximo mês" }),
    ).toBeInTheDocument();
  });

  it("surfaces financial closure risk when a completed appointment has no payment yet", async () => {
    const completedUnpaidAppointment = {
      id: "appointment-finance-1",
      customer_id: "client-2",
      service_id: "service-2",
      staff_member_id: "pro-2",
      customerName: "Carla Mendes",
      customerEmail: null,
      customerPhone: "11977778888",
      customerProfileImageUrl: null,
      customerWhatsAppPhone: "5511977778888",
      serviceName: "Escova premium",
      serviceDurationMinutes: 45,
      professionalName: "Ricardo",
      servicePrice: 90,
      date: "2026-04-08T15:30:00.000Z",
      ends_at: "2026-04-08T16:15:00.000Z",
      status: "completed",
      protection_confirmation_required: false,
      customer_presence_confirmed_at: "2026-04-08T16:20:00.000Z",
      deposit_amount: 0,
      deposit_status: "not_required",
      payment_preference: "pix",
      notes: null,
      payment: null,
    };

    loadManagementAppointmentsMock.mockResolvedValue({
      counts: {
        pending: 0,
        confirmed: 0,
        completed: 1,
        cancelled: 0,
        no_show: 0,
      },
      items: [completedUnpaidAppointment],
    });

    loadManagementAppointmentsMonthMock.mockResolvedValue({
      counts: {
        pending: 0,
        confirmed: 0,
        completed: 1,
        cancelled: 0,
        no_show: 0,
      },
      items: [completedUnpaidAppointment],
    });

    loadManagementAppointmentsWeekMock.mockResolvedValue({
      counts: {
        pending: 0,
        confirmed: 0,
        completed: 1,
        cancelled: 0,
        no_show: 0,
      },
      items: [completedUnpaidAppointment],
    });

    loadManagementStaleAppointmentsMock.mockResolvedValue({
      total: 0,
      items: [],
    });

    const ui = await AgendamentosPage({
      searchParams: Promise.resolve({
        day: "2026-04-08",
      }),
    });

    render(ui);

    expect(screen.getByText("1 pagamento pendente hoje")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Há atendimento concluído sem pagamento registrado. Revise antes de fechar o caixa.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 atendimento ainda sem pagamento registrado."),
    ).toBeInTheDocument();
    expect(screen.getByText("Recebido no dia")).toBeInTheDocument();
    expect(screen.getAllByText("Carla Mendes").length).toBeGreaterThan(0);
  });
});




