// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnerSalonMock, loadManagementClientsMock } = vi.hoisted(() => ({
  requireOwnerSalonMock: vi.fn(),
  loadManagementClientsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  createManagementClientAction: "/actions/management/create-client",
  updateManagementClientAction: "/actions/management/update-client",
  deleteManagementClientAction: "/actions/management/delete-client",
}));

vi.mock("@/lib/management", () => ({
  buildFilterHref: vi.fn(() => "/dashboard/gestao/clientes"),
  formatDateLabel: vi.fn((value: string) => value.slice(0, 10)),
  loadManagementClients: loadManagementClientsMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import ClientesPage from "@/app/dashboard/gestao/clientes/page";

describe("management clients page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
    });

    loadManagementClientsMock.mockResolvedValue([
      {
        id: "client-1",
        name: "Ana Paula",
        phone: "11999999999",
        whatsapp_phone: "11999999999",
        email: "ana@example.com",
        birth_date: "1993-05-10",
        notes: "Prefere contato pelo WhatsApp.",
        profileImageUrl: "https://example.com/ana.png",
        created_at: "2026-01-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 2,
        completedCount: 5,
        lastVisitAt: "2026-04-05T14:00:00.000Z",
        history: [
          {
            id: "history-1",
            date: "2026-04-05T14:00:00.000Z",
            serviceName: "Escova premium",
            professionalName: "Camila",
            status: "completed",
          },
        ],
      },
      {
        id: "client-2",
        name: "Bruna Costa",
        phone: null,
        whatsapp_phone: null,
        email: "bruna@example.com",
        birth_date: null,
        notes: null,
        profileImageUrl: null,
        created_at: "2026-02-01T10:00:00.000Z",
        updated_at: "2026-04-08T10:00:00.000Z",
        upcomingCount: 0,
        completedCount: 1,
        lastVisitAt: "2026-03-20T09:00:00.000Z",
        history: [],
      },
    ]);
  });

  it("renders the clearer client board without losing the management workflow", async () => {
    const ui = await ClientesPage({
      searchParams: Promise.resolve({
        clientId: "client-1",
        message: "Cliente atualizado.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Cliente atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Clientes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lista de clientes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Busca rapida",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prefere contato pelo WhatsApp.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escova premium").length).toBeGreaterThan(0);
    expect(screen.getByText(/Camila/)).toBeInTheDocument();
    expect(screen.getAllByText("Ver resumo").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Foto de Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getByText("Foto enviada pela cliente no app.")).toBeInTheDocument();
    expect(screen.getByText("Sem foto enviada pela cliente.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Cadastro rÃ¡pido para recepÃ§Ã£o",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo cliente" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar cliente" })).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar alteraÃ§Ãµes" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Cliente forte").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Com histÃ³rico").length).toBeGreaterThan(0);

    cleanup();

    const uiWithComposer = await ClientesPage({
      searchParams: Promise.resolve({
        clientId: "client-1",
        composer: "1",
      }),
    });

    render(uiWithComposer);

    expect(
      screen.getByRole("heading", {
        name: "Cadastro rÃ¡pido para recepÃ§Ã£o",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar cliente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar cadastro" })).toBeInTheDocument();
  });
});


