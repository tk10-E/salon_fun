// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createServiceActionMock,
  deleteServiceActionMock,
  requireOwnerSalonMock,
  updateServiceCatalogActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createServiceActionMock: vi.fn(),
  deleteServiceActionMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  updateServiceCatalogActionMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/app/actions", () => ({
  createServiceAction: createServiceActionMock,
  updateServiceCatalogAction: updateServiceCatalogActionMock,
  deleteServiceAction: deleteServiceActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import ServicesPage from "@/app/dashboard/services/page";

function createServiceListQuery(data: unknown[]) {
  const query = {
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn((field: string) => {
      if (field === "name") {
        return Promise.resolve({ data, error: null });
      }

      return query;
    }),
  };

  return query;
}

function createCategoriesQuery(data: unknown[]) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
  };

  return query;
}

describe("services page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders the empty catalog state and the new service form", async () => {
    const serviceListQuery = createServiceListQuery([]);
    const categoriesQuery = createCategoriesQuery([]);

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "services") {
          throw new Error(`Unexpected table ${table}`);
        }

        let serviceSelectCount = 0;

        return {
          select: vi.fn((selection: string) => {
            serviceSelectCount += 1;

            if (selection === "*") {
              return serviceListQuery;
            }

            if (selection === "category") {
              return categoriesQuery;
            }

            throw new Error(`Unexpected selection ${selection}`);
          }),
        };
      }),
      storage: {
        from: vi.fn(),
      },
    });

    const ui = await ServicesPage({
      searchParams: { message: "Serviço salvo com sucesso.", tone: "success" },
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Serviços cadastrados" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar serviço")).toBeInTheDocument();
    expect(screen.getByText("Nenhum serviço cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novo serviço" })).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo do serviço", { selector: "#service-category" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar serviço" })).toBeInTheDocument();
    expect(screen.getByText("Serviço salvo com sucesso.")).toBeInTheDocument();
  });
});
