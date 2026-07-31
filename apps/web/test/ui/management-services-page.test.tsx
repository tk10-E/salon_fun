// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("@/lib/formatters", () => ({
  formatCurrency: vi.fn((value: number) => `R$ ${value.toFixed(2)}`),
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
          id: "category-1",
          label: "Principal",
          secondary: "Carro-chefe do salão.",
        },
        {
          id: "category-2",
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
        imageUrl: "https://example.com/corte.png",
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
        imageUrl: null,
      },
    ]);
  });

  it("renders the premium light catalog while preserving real management actions", async () => {
    const ui = await ServicosPage({
      searchParams: Promise.resolve({
        message: "Serviço salvo com sucesso.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Serviço salvo com sucesso.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Serviços" })).toBeInTheDocument();
    expect(screen.getByText("Catalogo")).toBeInTheDocument();
    expect(screen.getByText("Servicos ativos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cabelo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tratamento" })).toBeInTheDocument();
    expect(screen.getAllByText("Corte feminino").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hidratação premium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Finalização e escova leve.").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Tratamento profundo com máscara nutritiva.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Ativo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inativo").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Novo serviço" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Novo serviço",
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar serviço" })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar alterações" }).length,
    ).toBeGreaterThan(0);

    cleanup();

    const uiWithComposer = await ServicosPage({
      searchParams: Promise.resolve({
        composer: "1",
        draftCategoryId: "category-1",
      }),
    });

    render(uiWithComposer);

    expect(screen.getAllByRole("heading", { name: "Novo serviço" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar serviço" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar cadastro" })).toBeInTheDocument();
    expect(screen.getAllByText("Principal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Complementar").length).toBeGreaterThan(0);
  });
});


