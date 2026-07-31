import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  TEST_REDIRECT_PREFIX,
} from "../server-action-test-helpers";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TeamPage from "@/app/dashboard/team/page";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

describe("team page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("redireciona a rota legada para a tela de profissionais da gestao", async () => {
    const location = await captureRedirect(
      Promise.resolve().then(() =>
        TeamPage({
          searchParams: Promise.resolve({
            message: "Equipe atualizada.",
            tone: "success",
          }),
        }),
      ),
      redirectMock,
    );

    const url = new URL(`https://painel.example${location}`);

    expect(url.pathname).toBe(MANAGEMENT_ROUTES.professionals);
    expect(url.searchParams.get("message")).toBe("Equipe atualizada.");
    expect(url.searchParams.get("tone")).toBe("success");
  });
});
