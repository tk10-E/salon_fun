// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postInternalAiJsonMock } = vi.hoisted(() => ({
  postInternalAiJsonMock: vi.fn(),
}));

vi.mock("@/lib/ai/clientRequest", () => ({
  postInternalAiJson: postInternalAiJsonMock,
}));

import { PromotionAiDraftAssistant } from "@/components/PromotionAiDraftAssistant";

function renderFormShell() {
  return render(
    <div>
      <PromotionAiDraftAssistant aiEnabled />
      <select id="offer-kind" defaultValue="promotion">
        <option value="promotion">Promoção</option>
        <option value="membership">Plano / pacote</option>
      </select>
      <input id="offer-title" defaultValue="" />
      <input id="offer-highlight" defaultValue="" />
      <textarea id="offer-description" defaultValue="" />
      <input id="offer-price" defaultValue="" />
      <input id="offer-start" defaultValue="" />
      <input id="offer-end" defaultValue="" />
      <input id="offer-active" type="checkbox" />
      <select id="offer-membership-service" defaultValue="">
        <option value="">Sem vínculo</option>
        <option value="11111111-1111-4111-8111-111111111111">
          Corte • Corte masculino
        </option>
        <option value="22222222-2222-4222-8222-222222222222">
          Barba • Barba premium
        </option>
      </select>
      <input id="offer-membership-sessions" defaultValue="" />
      <input id="offer-membership-validity" defaultValue="" />
    </div>,
  );
}

describe("PromotionAiDraftAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills the full offer form for a monthly plan", async () => {
    const user = userEvent.setup();

    postInternalAiJsonMock.mockResolvedValue({
      payload: {
        draft: {
          description:
            "Plano criado para manter a frequência da cliente com valor previsível e retorno mais fácil ao salão.",
          endsOn: "2026-06-11",
          highlightText:
            "Valor fixo mensal para cuidar do visual com mais previsibilidade.",
          model: "openrouter/model",
          priceSuggestion: 189.9,
          serviceId: "11111111-1111-4111-8111-111111111111",
          sessionsIncluded: 4,
          startsOn: "2026-05-13",
          title: "Plano mensal de corte",
          validityDays: 30,
        },
        ok: true,
      },
      response: new Response(null, { status: 200 }),
    });

    renderFormShell();

    await user.selectOptions(
      screen.getByLabelText("Objetivo da campanha"),
      "vender um plano mensal",
    );

    await user.click(screen.getByRole("button", { name: "Preencher oferta com IA" }));

    expect(postInternalAiJsonMock).toHaveBeenCalledWith(
      "/api/internal/ai/promotion-draft",
      expect.objectContaining({
        kind: "membership",
        serviceOptions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            label: "Corte • Corte masculino",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            label: "Barba • Barba premium",
          },
        ],
      }),
    );

    expect((document.getElementById("offer-kind") as HTMLSelectElement).value).toBe(
      "membership",
    );
    expect((document.getElementById("offer-title") as HTMLInputElement).value).toBe(
      "Plano mensal de corte",
    );
    expect(
      (document.getElementById("offer-highlight") as HTMLInputElement).value,
    ).toBe("Valor fixo mensal para cuidar do visual com mais previsibilidade.");
    expect(
      (document.getElementById("offer-description") as HTMLTextAreaElement).value,
    ).toBe(
      "Plano criado para manter a frequência da cliente com valor previsível e retorno mais fácil ao salão.",
    );
    expect((document.getElementById("offer-price") as HTMLInputElement).value).toBe(
      "189.90",
    );
    expect((document.getElementById("offer-start") as HTMLInputElement).value).toBe(
      "2026-05-13",
    );
    expect((document.getElementById("offer-end") as HTMLInputElement).value).toBe(
      "2026-06-11",
    );
    expect(
      (document.getElementById("offer-membership-service") as HTMLSelectElement)
        .value,
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(
      (document.getElementById("offer-membership-sessions") as HTMLInputElement)
        .value,
    ).toBe("4");
    expect(
      (document.getElementById("offer-membership-validity") as HTMLInputElement)
        .value,
    ).toBe("30");
    expect(
      (document.getElementById("offer-active") as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText("Oferta preenchida com a IA. Revise e publique.")).toBeInTheDocument();
  });
});
