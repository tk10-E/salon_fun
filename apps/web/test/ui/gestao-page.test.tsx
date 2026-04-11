import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import GestaoPage from "@/app/dashboard/gestao/page";

describe("gestao page", () => {
  it("redirects the management landing route to agendamentos", () => {
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`);
    });

    expect(() => GestaoPage({})).toThrow(
      "REDIRECT:/dashboard/gestao/agendamentos",
    );
  });

  it("preserves flash message params when redirecting", () => {
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`);
    });

    expect(() =>
      GestaoPage({
        searchParams: {
          message: "Conta atualizada",
          tone: "success",
        },
      })).toThrow(
      "REDIRECT:/dashboard/gestao/agendamentos?message=Conta+atualizada&tone=success",
    );
  });
});
