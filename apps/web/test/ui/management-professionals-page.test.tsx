// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerSalonMock, loadManagementProfessionalsMock } = vi.hoisted(
  () => ({
    requireOwnerSalonMock: vi.fn(),
    loadManagementProfessionalsMock: vi.fn(),
  }),
);

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
}));

import ProfissionaisPage from "@/app/dashboard/gestao/profissionais/page";

describe("management professionals page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
      },
    });

    loadManagementProfessionalsMock.mockResolvedValue([
      {
        id: "professional-1",
        name: "Camila",
        role: "Colorista",
        phone: "11999999999",
        is_active: true,
        commission_rate_percent: 35,
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 4,
        completedCount: 12,
        totalSold: 2480,
        commissionProjected: 868,
      },
      {
        id: "professional-2",
        name: "Ricardo",
        role: "Barbeiro",
        phone: "11888888888",
        is_active: false,
        commission_rate_percent: 30,
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 1,
        completedCount: 6,
        totalSold: 1260,
        commissionProjected: 378,
      },
    ]);
  });

  it("renders a stronger team overview without changing the management workflow", async () => {
    const ui = await ProfissionaisPage({
      searchParams: {
        message: "Equipe atualizada.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Equipe atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Profissionais alinhados com agenda, venda e comissão.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Equipe ativa").length).toBeGreaterThan(0);
    expect(screen.getByText("Profissional em foco")).toBeInTheDocument();
    expect(screen.getByText("Escala ativa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novo profissional" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumo rápido" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Equipe ativa" })).toBeInTheDocument();
    expect(screen.getAllByText("Camila").length).toBeGreaterThan(0);
    expect(screen.getByText("Colorista • 11999999999")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Ao remover um profissional com agenda, o painel preserva o histórico/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver histórico da equipe (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Histórico da equipe" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar profissional" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Remover da equipe" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Salvar alterações" }).length).toBeGreaterThan(0);
  });

  it("shows inactive professionals only when the owner opens the history", async () => {
    const ui = await ProfissionaisPage({
      searchParams: {
        showHistory: "1",
      },
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Histórico da equipe" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Fora da equipe").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Ocultar histórico" }),
    ).toBeInTheDocument();
  });
});
