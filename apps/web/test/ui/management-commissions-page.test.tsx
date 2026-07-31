// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerSalonMock,
  loadManagementCommissionsMock,
  loadManagementSelectOptionsMock,
} = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementCommissionsMock: vi.fn(),
  loadManagementSelectOptionsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/management", () => ({
  getLocalDateKey: vi.fn(() => "2026-04-08"),
  loadManagementCommissions: loadManagementCommissionsMock,
  loadManagementSelectOptions: loadManagementSelectOptionsMock,
}));

import ComissoesPage from "@/app/dashboard/gestao/comissoes/page";

describe("management commissions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
    });

    loadManagementSelectOptionsMock.mockResolvedValue({
      categories: [],
      services: [],
      clients: [],
      professionals: [
        { id: "professional-1", label: "Camila" },
        { id: "professional-2", label: "Ricardo" },
      ],
    });

    loadManagementCommissionsMock.mockResolvedValue([
      {
        professionalId: "professional-1",
        professionalName: "Camila",
        commissionRate: 35,
        appointmentsCount: 8,
        totalSold: 2480,
        commissionAmount: 868,
      },
      {
        professionalId: "professional-2",
        professionalName: "Ricardo",
        commissionRate: 30,
        appointmentsCount: 5,
        totalSold: 1200,
        commissionAmount: 360,
      },
    ]);
  });

  it("renders a stronger commissions overview without changing the filter workflow", async () => {
    const ui = await ComissoesPage({
      searchParams: Promise.resolve({
        professionalId: "professional-1",
        dateFrom: "2026-04-01",
        dateTo: "2026-04-08",
        message: "Comissao recalculada.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Comissao recalculada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Comissões da equipe",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Comissão calculada").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Profissional em foco" })).toBeInTheDocument();
    expect(screen.getAllByText("Venda do período").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Filtro do período" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumo do período" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comissões por profissional" })).toBeInTheDocument();
    expect(screen.getAllByText("Camila").length).toBeGreaterThan(0);
    expect(screen.getAllByText("35.0%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
  });
});
