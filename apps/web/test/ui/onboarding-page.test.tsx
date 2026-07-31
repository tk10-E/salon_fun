// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, createSalonActionMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSalonActionMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/app/actions", () => ({
  createSalonAction: createSalonActionMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import OnboardingPage from "@/app/onboarding/page";

describe("onboarding page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`redirect:${location}`);
    });
  });

  it("renders the salon setup form for an authenticated owner without a salon", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const match = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ match }));

    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-1" },
            },
          },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: "user-1" },
          },
        }),
      },
      from: vi.fn((table: string) => {
        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }

        return { select };
      }),
    });

    const ui = await OnboardingPage({
      searchParams: Promise.resolve({ message: "Tudo certo para continuar.", tone: "info" }),
    });

    render(ui);

    expect(screen.getByText("Primeiros passos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Falta pouco para o seu salão começar." })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Segmento do salão")).toBeInTheDocument();
    expect(screen.getByDisplayValue("/planos")).toHaveAttribute("name", "returnPath");
    expect(screen.getByRole("button", { name: "Salvar e continuar" })).toBeInTheDocument();
    expect(screen.getByText("Tudo certo para continuar.")).toBeInTheDocument();
    expect(select).toHaveBeenCalledWith("*");
    expect(match).toHaveBeenCalledWith({ owner_user_id: "user-1" });
  });
});
