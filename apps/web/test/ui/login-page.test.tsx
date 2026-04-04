// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { panelAuthClientMock, getAuthenticatedPanelEntryPathMock, redirectMock } = vi.hoisted(() => ({
  panelAuthClientMock: vi.fn(),
  getAuthenticatedPanelEntryPathMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@/components/auth/PanelAuthClient", () => ({
  PanelAuthClient: (props: { initialMessage?: string; initialTone?: string }) => {
    panelAuthClientMock(props);

    return (
      <div>
        <h3>Continuar com Google</h3>
        <label htmlFor="signin-email">E-mail</label>
        <input id="signin-email" />
        <label htmlFor="signin-password">Senha</label>
        <input id="signin-password" />
        <label htmlFor="recovery-email">E-mail da conta</label>
        <input id="recovery-email" />
        <label htmlFor="signup-email">E-mail</label>
        <input id="signup-email" />
        <label htmlFor="signup-password">Senha</label>
        <input id="signup-password" />
        <label htmlFor="signup-password-confirmation">Confirmar senha</label>
        <input id="signup-password-confirmation" />
        <button type="button">Continuar com Google</button>
        <button type="button">Acessar minha conta</button>
        <button type="button">Enviar link de recuperação</button>
        <button type="button">Começar agora</button>
        {props.initialMessage ? <span>{props.initialMessage}</span> : null}
      </div>
    );
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedPanelEntryPath: getAuthenticatedPanelEntryPathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import LoginPage from "@/app/(auth)/login/page";

describe("login page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedPanelEntryPathMock.mockResolvedValue(null);
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`);
    });
  });

  it("renders both access forms and the flash message", () => {
    return LoginPage({
      searchParams: { message: "Conta criada com sucesso.", tone: "success" },
    }).then((page) => {
      render(page);

      expect(
        screen.getByRole("heading", {
          name: "Seu salão mais organizado, mais claro e mais pronto para crescer.",
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Entre ou crie a conta do seu painel" })).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail", { selector: "#signin-email" })).toBeInTheDocument();
      expect(screen.getByLabelText("Senha", { selector: "#signin-password" })).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail da conta", { selector: "#recovery-email" })).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail", { selector: "#signup-email" })).toBeInTheDocument();
      expect(screen.getByLabelText("Senha", { selector: "#signup-password" })).toBeInTheDocument();
      expect(
        screen.getByLabelText("Confirmar senha", { selector: "#signup-password-confirmation" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Continuar com Google" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Acessar minha conta" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Enviar link de recuperação" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Começar agora" })).toBeInTheDocument();
      expect(screen.getByText("Conta criada com sucesso.")).toBeInTheDocument();
      expect(panelAuthClientMock).toHaveBeenCalledWith({
        initialMessage: "Conta criada com sucesso.",
        initialTone: "success",
      });
    });
  });

  it("redirects authenticated users away from the login page", async () => {
    getAuthenticatedPanelEntryPathMock.mockResolvedValue("/dashboard");

    await expect(LoginPage({})).rejects.toThrow("REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });
});
