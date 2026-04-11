// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireOwnerSalonMock,
  loadManagementSelectOptionsMock,
  loadManagementServicesMock,
} = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementSelectOptionsMock: vi.fn(),
  loadManagementServicesMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementServiceAction: "/actions/management/create-service",
  updateManagementServiceAction: "/actions/management/update-service",
  deleteManagementServiceAction: "/actions/management/delete-service",
}));

vi.mock("@/lib/management", () => ({
  buildFilterHref: vi.fn(() => "/dashboard/gestao/servicos"),
  loadManagementSelectOptions: loadManagementSelectOptionsMock,
  loadManagementServices: loadManagementServicesMock,
}));

import ServicosPage from "@/app/dashboard/gestao/servicos/page";

describe("management services page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
      },
    });

    loadManagementSelectOptionsMock.mockResolvedValue({
      categories: [
        { id: "category-1", label: "Cabelo" },
        { id: "category-2", label: "Tratamento" },
      ],
      serviceFormCategories: [
        {
          id: "category-quick-1",
          label: "Principal",
          secondary: "Carro-chefe do salão.",
        },
        {
          id: "category-quick-2",
          label: "Complementar",
          secondary: "Extras e adicionais.",
        },
      ],
      services: [],
      professionals: [],
      clients: [],
    });

    loadManagementServicesMock.mockResolvedValue([
      {
        id: "service-1",
        name: "Corte feminino",
        duration: 60,
        price: 120,
        description: "Finalização e escova leve.",
        is_active: true,
        category: "Cabelo",
        service_category_id: "category-1",
        categoryName: "Cabelo",
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        appointmentsCount: 8,
      },
      {
        id: "service-2",
        name: "Hidratação premium",
        duration: 45,
        price: 150,
        description: "Tratamento profundo com máscara nutritiva.",
        is_active: false,
        category: "Tratamento",
        service_category_id: "category-2",
        categoryName: "Tratamento",
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        appointmentsCount: 3,
      },
    ]);
  });

  it("renders a stronger services overview without changing catalog actions", async () => {
    const ui = await ServicosPage({
      searchParams: {
        message: "Serviço salvo com sucesso.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Serviço salvo com sucesso.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Serviços prontos para vender com clareza.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Catálogo ativo")).toBeInTheDocument();
    expect(screen.getByText("Leitura do catálogo")).toBeInTheDocument();
    expect(screen.getAllByText("Categoria forte").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Novo serviço" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filtros do catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serviços cadastrados" })).toBeInTheDocument();
    expect(screen.getAllByText("Principal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Complementar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Corte feminino").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finalização e escova leve.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidratação premium").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar serviço" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Salvar alterações" }).length).toBeGreaterThan(0);
  });
});
