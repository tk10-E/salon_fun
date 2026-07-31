// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerSalonMock,
  loadManagementProfessionalsMock,
  loadManagementServiceAssignmentOptionsMock,
} = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementProfessionalsMock: vi.fn(),
  loadManagementServiceAssignmentOptionsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementProfessionalAction: "/actions/management/create-professional",
  updateManagementProfessionalAction: "/actions/management/update-professional",
  deleteManagementProfessionalAction: "/actions/management/delete-professional",
}));

vi.mock("@/lib/management", () => ({
  buildFilterHref: vi.fn(() => "/dashboard/gestao/profissionais"),
  loadManagementProfessionals: loadManagementProfessionalsMock,
  loadManagementServiceAssignmentOptions:
    loadManagementServiceAssignmentOptionsMock,
}));

vi.mock("@/lib/formatters", () => ({
  formatCurrency: vi.fn((value: number) => `R$ ${value.toFixed(2)}`),
}));

import ProfissionaisPage from "@/app/dashboard/gestao/profissionais/page";

describe("management professionals page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
    });

    loadManagementProfessionalsMock.mockResolvedValue([
      {
        assignedServiceIds: ["service-1", "service-2"],
        id: "professional-1",
        name: "Camila",
        role: "Especialista em trança",
        phone: "11999999999",
        image_path: "salon-1/staff/camila.jpg",
        imageUrl: "https://example.com/camila.jpg",
        is_active: true,
        commission_rate_percent: 35,
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 4,
        completedCount: 12,
        totalSold: 2480,
        commissionProjected: 868,
        reviewAverage: 4.8,
        reviewCount: 16,
      },
      {
        assignedServiceIds: ["service-2"],
        id: "professional-2",
        name: "Tania",
        role: "Colorista",
        phone: "11888887777",
        image_path: null,
        imageUrl: null,
        is_active: true,
        commission_rate_percent: 30,
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 2,
        completedCount: 5,
        totalSold: 980,
        commissionProjected: 294,
        reviewAverage: null,
        reviewCount: 0,
      },
      {
        assignedServiceIds: [],
        id: "professional-3",
        name: "Ricardo",
        role: "Barbeiro",
        phone: "11888888888",
        image_path: null,
        imageUrl: null,
        is_active: false,
        commission_rate_percent: 30,
        created_at: "2026-01-03T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 0,
        completedCount: 6,
        totalSold: 1260,
        commissionProjected: 378,
        reviewAverage: 4.2,
        reviewCount: 3,
      },
    ]);

    loadManagementServiceAssignmentOptionsMock.mockResolvedValue([
      {
        id: "service-1",
        name: "Trança",
        isActive: true,
      },
      {
        id: "service-2",
        name: "Pigmentação",
        isActive: true,
      },
    ]);
  });

  it("renders the premium light team board without losing the management actions", async () => {
    const ui = await ProfissionaisPage({
      searchParams: Promise.resolve({
        message: "Equipe atualizada.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Equipe atualizada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profissionais" })).toBeInTheDocument();
    expect(screen.getAllByText("Equipe").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Lista da equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Profissionais ativos")).toBeInTheDocument();
    expect(screen.getByText("Agenda futura")).toBeInTheDocument();
    expect(screen.getByText("Vendas do mes")).toBeInTheDocument();
    expect(screen.getAllByText("Camila").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Especialista em trança").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("img", { name: "Foto de Camila" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Ver resultados do mês").length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Ver agenda" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Salvar alterações" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "Remover da equipe" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "Novo profissional" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar profissional" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Novo profissional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Histórico (1)" }),
    ).toBeInTheDocument();

    cleanup();

    const uiWithComposer = await ProfissionaisPage({
      searchParams: Promise.resolve({
        composer: "1",
        showHistory: "1",
      }),
    });

    render(uiWithComposer);

    expect(
      screen.getAllByRole("heading", { name: "Novo profissional" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Salvar profissional" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Fechar cadastro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Histórico da equipe" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Trança").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pigmentação").length).toBeGreaterThan(0);
  });
});


