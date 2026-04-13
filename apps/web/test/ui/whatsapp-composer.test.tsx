// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { WhatsAppComposer } from "@/app/dashboard/whatsapp/WhatsAppComposer";

describe("whatsapp composer", () => {
  it("applies quick replies and allows clearing the draft", async () => {
    const user = userEvent.setup();

    render(
      <form action="/__test/send-manual-whatsapp">
        <WhatsAppComposer
          textareaId="composer-message"
          defaultValue="Mensagem inicial"
          hint="Teste"
          quickReplySections={[
            {
              label: "Sugestões para resposta",
              replies: [
                {
                  label: "Confirmado",
                  message: "Oi Ana, confirmado por aqui.",
                },
              ],
            },
            {
              label: "Objetivos da conversa",
              replies: [
                {
                  label: "Fechar agenda",
                  message: "Oi Ana, consigo separar horários agora para você.",
                },
                {
                  label: "Vender pacote",
                  message: "Oi Ana, também posso te mostrar um combo que vale mais a pena.",
                },
              ],
            },
          ]}
        />
      </form>,
    );

    const textarea = screen.getByLabelText("Mensagem");
    expect(textarea).toHaveValue("Mensagem inicial");
    expect(
      screen.getByText("Sugestões para resposta"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Objetivos da conversa"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmado" }));
    expect(textarea).toHaveValue("Oi Ana, confirmado por aqui.");

    await user.click(screen.getByRole("button", { name: "Fechar agenda" }));
    expect(textarea).toHaveValue(
      "Oi Ana, consigo separar horários agora para você.",
    );

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(textarea).toHaveValue("");
  });

  it("submits the form with Ctrl+Enter", async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );

    render(
      <form onSubmit={handleSubmit}>
        <WhatsAppComposer
          textareaId="composer-shortcut"
          defaultValue="Mensagem inicial"
          hint="Teste"
        />
      </form>,
    );

    await user.click(screen.getByLabelText("Mensagem"));
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});
