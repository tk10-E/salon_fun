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

import CustomersPage from "@/app/dashboard/customers/page";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

describe("customers page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("redireciona a rota legada para a carteira de clientes da gestao", async () => {
    const location = await captureRedirect(
      Promise.resolve().then(() =>
        CustomersPage({
          searchParams: Promise.resolve({
            customer: "customer-1",
            message: "Cliente atualizado.",
            page: "2",
            q: "Maria",
            segment: "vip",
            sort: "spent",
            tone: "success",
          }),
        }),
      ),
      redirectMock,
    );

    const url = new URL(`https://painel.example${location}`);

    expect(url.pathname).toBe(MANAGEMENT_ROUTES.clients);
    expect(url.searchParams.get("clientId")).toBe("customer-1");
    expect(url.searchParams.get("q")).toBe("Maria");
    expect(url.searchParams.get("message")).toBe("Cliente atualizado.");
    expect(url.searchParams.get("tone")).toBe("success");
    expect(url.searchParams.get("segment")).toBeNull();
    expect(url.searchParams.get("sort")).toBeNull();
  });
});
