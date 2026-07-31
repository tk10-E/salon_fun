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

import ServicesPage from "@/app/dashboard/services/page";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

describe("services page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("redireciona a rota legada para o catalogo de servicos da gestao", async () => {
    const location = await captureRedirect(
      Promise.resolve().then(() =>
        ServicesPage({
          searchParams: Promise.resolve({
            category: "Cabelo",
            message: "Servico salvo com sucesso.",
            tone: "success",
          }),
        }),
      ),
      redirectMock,
    );

    const url = new URL(`https://painel.example${location}`);

    expect(url.pathname).toBe(MANAGEMENT_ROUTES.services);
    expect(url.searchParams.get("q")).toBe("Cabelo");
    expect(url.searchParams.get("message")).toBe("Servico salvo com sucesso.");
    expect(url.searchParams.get("tone")).toBe("success");
  });
});
