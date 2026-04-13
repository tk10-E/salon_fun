// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerSalonMock,
  loadManagementAppointmentsMock,
  loadManagementSelectOptionsMock,
  sendAppointmentWhatsAppActionPath,
} = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementAppointmentsMock: vi.fn(),
  loadManagementSelectOptionsMock: vi.fn(),
  sendAppointmentWhatsAppActionPath: "/actions/send-appointment-whatsapp",
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementAppointmentAction: "/actions/management/create-appointment",
  updateManagementAppointmentAction: "/actions/management/update-appointment",
  updateManagementAppointmentStatusAction:
    "/actions/management/update-appointment-status",
}));

vi.mock("@/app/actions", () => ({
  sendAppointmentWhatsAppAction: sendAppointmentWhatsAppActionPath,
}));

vi.mock("@/lib/management", () => ({
  APPOINTMENT_STATUS_OPTIONS: [
    { value: "pending", label: "Agendado" },
    { value: "confirmed", label: "Confirmado" },
    { value: "completed", label: "Concluído" },
    { value: "cancelled", label: "Cancelado" },
    { value: "no_show", label: "Falta" },
  ],
  buildFilterHref: vi.fn(() => "/dashboard/gestao/agendamentos?day=2026-04-08"),
  formatAppointmentStatusLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      pending: "Agendado",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Falta",
    };

    return labels[value] ?? value;
  }),
  formatDateInput: vi.fn((value: string) => value.slice(0, 10)),
  formatPaymentMethodLabel: vi.fn((value: string) =>
    value === "pix" ? "Pix" : value,
  ),
  formatTimeInput: vi.fn((value: string) => value.slice(11, 16)),
  getAppointmentStatusBadgeClass: vi.fn(() => "badge--accent"),
  getLocalDateKey: vi.fn(() => "2026-04-08"),
  loadManagementAppointments: loadManagementAppointmentsMock,
  loadManagementSelectOptions: loadManagementSelectOptionsMock,
}));

import AgendamentosPage from "@/app/dashboard/gestao/agendamentos/page";

describe("management appointments page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
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

    loadManagementAppointmentsMock.mockResolvedValue({
      counts: {
        pending: 1,
        confirmed: 1,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      },
      items: [
        {
          id: "appointment-1",
          customer_id: "client-1",
          service_id: "service-1",
          staff_member_id: "pro-1",
          customerName: "Ana Paula",
          serviceName: "Corte feminino",
          professionalName: "Camila",
          servicePrice: 120,
          date: "2026-04-08T13:00:00.000Z",
          ends_at: "2026-04-08T14:00:00.000Z",
          status: "confirmed",
          notes: "Cliente prefere atendimento silencioso.",
          payment: {
            id: "payment-1",
            amount: 120,
            paymentMethod: "pix",
            paidAt: "2026-04-08T13:05:00.000Z",
          },
        },
        {
          id: "appointment-2",
          customer_id: "client-2",
          service_id: "service-2",
          staff_member_id: "pro-2",
          customerName: "Carla Mendes",
          serviceName: "Escova premium",
          professionalName: "Ricardo",
          servicePrice: 90,
          date: "2026-04-08T15:30:00.000Z",
          ends_at: "2026-04-08T16:15:00.000Z",
          status: "pending",
          notes: null,
          payment: null,
        },
      ],
    });
  });

  it("renders a stronger agenda overview without changing the workflow", async () => {
    const ui = await AgendamentosPage({
      searchParams: {
        day: "2026-04-08",
        professionalId: "pro-1",
        status: "confirmed",
        message: "Agenda atualizada.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Agenda atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Agenda de/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Movimento previsto")).toBeInTheDocument();
    expect(screen.getAllByText("Camila").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmado").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Novo agendamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filtro da agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda do dia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carla Mendes").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("WhatsApp do atendimento").length,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getAllByText("WhatsApp do atendimento")
        .every((element) => element.tagName.toLowerCase() === "strong"),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Enviar lembrete" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar confirmação" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Pedir reagendamento" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Cliente prefere atendimento silencioso.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s?210,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s?120,00/).length).toBeGreaterThan(0);
  });
});
