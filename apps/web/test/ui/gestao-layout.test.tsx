// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GestaoLayout from "@/app/dashboard/gestao/layout";

describe("gestao layout", () => {
  it("renders only the management page content without duplicating navigation", () => {
    render(
      <GestaoLayout>
        <div>Conteúdo da gestão</div>
      </GestaoLayout>,
    );

    expect(screen.getByText("Conteúdo da gestão")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Módulos de gestão" })).not.toBeInTheDocument();
  });
});
