// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerSalonMock, loadManagementPaymentsMock } = vi.hoisted(
  () => ({
    requireOwnerSalonMock: vi.fn(),
    loadManagementPaymentsMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  upsertManagementPaymentAction: "/actions/management/upsert-payment",
  deleteManagementPaymentAction: "/actions/management/delete-payment",
}));

vi.mock("@/lib/management", () => ({
  PAYMENT_METHOD_OPTIONS: [
    { value: "pix", label: "Pix" },
    { value: "cash", label: "Dinheiro" },
    { value: "debit_card", label: "Cartão de débito" },
    { value: "credit_card", label: "Cartão de crédito" },
  ],
  buildFilterHref: vi.fn(
    () => "/dashboard/gestao/pagamentos?dateFrom=2026-04-08&dateTo=2026-04-08",
  ),
  formatDateTimeLabel: vi.fn((value: string) => value.slice(0, 16)),
  formatPaymentMethodLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      pix: "Pix",
      cash: "Dinheiro",
      debit_card: "Cartão de débito",
      credit_card: "Cartão de crédito",
    };

    return labels[value] ?? value;
  }),
  formatTimeInput: vi.fn(() => "14:30"),
  getLocalDateKey: vi.fn(() => "2026-04-08"),
  loadManagementPayments: loadManagementPaymentsMock,
}));

import PagamentosPage from "@/app/dashboard/gestao/pagamentos/page";

describe("management payments page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
    });

    loadManagementPaymentsMock.mockResolvedValue({
      summary: {
        totalReceived: 410,
        byMethod: {
          pix: 210,
          cash: 80,
          debit_card: 60,
          credit_card: 60,
        },
      },
      unpaidAppointments: [
        { id: "appointment-1", label: "Ana Paula", secondary: "Corte feminino" },
      ],
      items: [
        {
          id: "payment-1",
          appointment_id: "appointment-1",
          amount: 210,
          amountNumber: 210,
          payment_method: "pix",
          paid_at: "2026-04-08T14:00:00.000Z",
          notes: "Entrada do dia.",
          customerName: "Ana Paula",
          serviceName: "Corte feminino",
          professionalName: "Camila",
        },
        {
          id: "payment-2",
          appointment_id: "appointment-2",
          amount: 200,
          amountNumber: 200,
          payment_method: "cash",
          paid_at: "2026-04-08T15:00:00.000Z",
          notes: null,
          customerName: "Bruna Costa",
          serviceName: "Escova premium",
          professionalName: "Ricardo",
        },
      ],
    });
  });

  it("renders a stronger caixa overview without changing payment actions", async () => {
    const ui = await PagamentosPage({
      searchParams: {
        dateFrom: "2026-04-08",
        dateTo: "2026-04-08",
        paymentMethod: "pix",
        message: "Pagamento salvo.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Pagamento salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Recebimentos com leitura clara de caixa.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Total recebido")).toBeInTheDocument();
    expect(screen.getByText("Leitura do movimento")).toBeInTheDocument();
    expect(screen.getByText("Canal forte")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Registrar pagamento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filtro do caixa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Movimentações do caixa" })).toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Corte feminino/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Entrada do dia.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar pagamento" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remover pagamento" }).length).toBeGreaterThan(0);
  });
});
