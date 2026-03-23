// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { signInActionMock, signUpActionMock } = vi.hoisted(() => ({
  signInActionMock: vi.fn(),
  signUpActionMock: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  signInAction: signInActionMock,
  signUpAction: signUpActionMock,
}));

import LoginPage from "@/app/(auth)/login/page";

describe("login page UI", () => {
  it("renders both access forms and the flash message", () => {
    render(createElement(LoginPage, { searchParams: { message: "Conta criada com sucesso.", tone: "success" } }));

    expect(
      screen.getByRole("heading", {
        name: "Seu salão mais organizado, mais claro e mais pronto para crescer.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entre ou crie a conta do seu painel" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail", { selector: "#signin-email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Senha", { selector: "#signin-password" })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail", { selector: "#signup-email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Senha", { selector: "#signup-password" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acessar minha conta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Começar agora" })).toBeInTheDocument();
    expect(screen.getByText("Conta criada com sucesso.")).toBeInTheDocument();
  });
});
