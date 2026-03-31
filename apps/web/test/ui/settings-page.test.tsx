// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  regenerateSalonCodeActionMock,
  requireOwnerSalonMock,
  updateSalonBrandingActionMock,
  updateSalonScheduleActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  regenerateSalonCodeActionMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  updateSalonBrandingActionMock: vi.fn(),
  updateSalonScheduleActionMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/app/actions", () => ({
  regenerateSalonCodeAction: regenerateSalonCodeActionMock,
  updateSalonBrandingAction: updateSalonBrandingActionMock,
  updateSalonScheduleAction: updateSalonScheduleActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import SettingsPage from "@/app/dashboard/settings/page";

describe("settings page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Centro",
        tagline: "Beleza com agenda inteligente.",
        brand_color: "#C56B43",
        business_segment: "beauty_salon",
        whatsapp_phone: "5511999999999",
        timezone: "America/Sao_Paulo",
        slot_step_minutes: 30,
        logo_path: null,
        created_at: "2026-03-01T12:00:00.000Z",
        join_code: "ABCD1234",
      },
    });
  });

  it("renders branding, online schedule and join code forms", async () => {
    const businessHoursOrder = vi.fn().mockResolvedValue({
      data: [
        {
          weekday: 1,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        },
        {
          weekday: 2,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        },
      ],
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salon_business_hours") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: businessHoursOrder,
            })),
          })),
        };
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const ui = await SettingsPage({
      searchParams: { message: "Configurações salvas.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Configurações salvas.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Identidade do salão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Preview do app")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Segmento do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Cor principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo da experiência")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tema do app do cliente"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Headline premium da home"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Imagem hero principal por arquivo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Imagem da galeria por arquivo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Capa institucional do perfil por arquivo"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Foco horizontal").length,
    ).toBeGreaterThan(2);
    expect(
      screen.getByText("Módulos visíveis na home"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByLabelText("Zoom da imagem").length,
    ).toBeGreaterThan(2);
    expect(screen.getByLabelText("Instagram do salão")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar identidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda online" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fuso horário")).toBeInTheDocument();
    expect(screen.getByLabelText("Intervalo da agenda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Código para clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ABCD1234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir vitrine pública" }),
    ).toHaveAttribute("href", "/s/ABCD1234");
    expect(
      screen.getByRole("button", { name: "Gerar novo código" }),
    ).toBeInTheDocument();
  });
});
