// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerSalonMock, loadManagementCategoriesMock } = vi.hoisted(
  () => ({
    requireOwnerSalonMock: vi.fn(),
    loadManagementCategoriesMock: vi.fn(),
  }),
);

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementCategoryAction: "/actions/management/create-category",
  updateManagementCategoryAction: "/actions/management/update-category",
  deleteManagementCategoryAction: "/actions/management/delete-category",
}));

vi.mock("@/lib/management", () => ({
  buildFilterHref: vi.fn(() => "/dashboard/gestao/categorias"),
  loadManagementCategories: loadManagementCategoriesMock,
}));

import CategoriasPage from "@/app/dashboard/gestao/categorias/page";

describe("management categories page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
      },
    });

    loadManagementCategoriesMock.mockResolvedValue([
      {
        id: "category-1",
        name: "Cabelo",
        description: "Cortes, escovas e finalizações.",
        is_active: true,
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        servicesCount: 5,
        activeServicesCount: 4,
      },
      {
        id: "category-2",
        name: "Tratamentos",
        description: null,
        is_active: false,
        created_at: "2026-01-02T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        servicesCount: 0,
        activeServicesCount: 0,
      },
    ]);
  });

  it("renders a stronger categories overview without changing the catalog workflow", async () => {
    const ui = await CategoriasPage({
      searchParams: {
        message: "Categoria atualizada.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Categoria atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Categorias organizadas para vender melhor.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cobertura do catálogo")).toBeInTheDocument();
    expect(screen.getByText("Categoria em foco")).toBeInTheDocument();
    expect(screen.getByText("Catálogo vivo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova categoria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumo do catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Categorias cadastradas" })).toBeInTheDocument();
    expect(screen.getAllByText("Cabelo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cortes, escovas e finalizações.").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar categoria" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Salvar alterações" }).length).toBeGreaterThan(0);
  });
});
