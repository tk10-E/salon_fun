// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PanelAiAssistant } from "@/components/PanelAiAssistant";

describe("PanelAiAssistant", () => {
  it("renders the simplified AI workspace with ready-made actions and prompts", () => {
    render(<PanelAiAssistant aiEnabled workspaceHref={null} />);

    expect(
      screen.getByRole("heading", { name: "IA para agir no salao" }),
    ).toBeInTheDocument();
    expect(screen.getByText("IA ativa com dados reais")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Acoes prontas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Preencher horarios vagos")).toBeInTheDocument();
    expect(screen.getByText("Ver quem esta mais livre")).toBeInTheDocument();
    expect(screen.getByText("Criar campanha certa")).toBeInTheDocument();
    expect(screen.getByText("Entender o caixa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Perguntas prontas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Qual profissional tem mais horarios livres hoje?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Quem posso chamar para uma vaga aberta hoje?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("O que voce quer resolver agora?"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Analisar agora" }),
    ).toBeInTheDocument();
  });
});
