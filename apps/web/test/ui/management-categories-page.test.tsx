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
  buildFilterHref: vi.fn(
    (
      pathname: string,
      current: Record<string, string | string[] | undefined> | undefined,
      overrides: Record<string, string | undefined>,
    ) => {
      const params = new URLSearchParams();

      if (current) {
        for (const [key, rawValue] of Object.entries(current)) {
          const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
          if (value) {
            params.set(key, value);
          }
        }
      }

      for (const [key, value] of Object.entries(overrides)) {
        if (!value) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const query = params.toString();
      return `${pathname}${query ? `?${query}` : ""}`;
    },
  ),
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
        description: "Cortes, escovas e finalizacoes.",
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

  it("renders the redesigned categories workspace with hidden compose by default", async () => {
    const ui = await CategoriasPage({
      searchParams: Promise.resolve({
        message: "Categoria atualizada.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Categoria atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Categorias do catálogo",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Categorias ativas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Categorias cadastradas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Prioridades do catálogo" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Cabelo").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Cortes, escovas e finalizacoes.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Nova categoria" }).getAttribute("href"),
    ).toContain("compose=1");
    expect(
      screen.queryByRole("button", { name: "Salvar categoria" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar alterações" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens the category compose panel when compose=1", async () => {
    const ui = await CategoriasPage({
      searchParams: Promise.resolve({
        compose: "1",
      }),
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Criar categoria" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar categoria" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar" })).toHaveAttribute(
      "href",
      "/dashboard/gestao/categorias",
    );
  });
});
