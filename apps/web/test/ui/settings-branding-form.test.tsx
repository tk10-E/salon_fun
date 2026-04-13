// @vitest-environment jsdom

import {
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsBrandingForm } from "@/components/SettingsBrandingForm";

function renderForm() {
  render(
    <SettingsBrandingForm
      action="/api/internal/dashboard/settings/branding"
      salonId="salon-1"
    >
      <label>
        Logo do app
        <input name="logo" type="file" />
      </label>
      <label>
        Imagem principal
        <input name="clientAppHeroImageFile" type="file" />
      </label>
      <label>
        Capa da galeria
        <input name="clientAppGalleryCoverImageFile" type="file" />
      </label>
      <label>
        Capa do perfil
        <input name="clientAppProfileCoverImageFile" type="file" />
      </label>
      <button type="submit">Salvar identidade</button>
    </SettingsBrandingForm>,
  );

  const submitButton = screen.getByRole("button", { name: "Salvar identidade" });
  const form = submitButton.closest("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Expected branding form to be rendered.");
  }

  return {
    form,
    logoInput: screen.getByLabelText("Logo do app"),
    heroInput: screen.getByLabelText("Imagem principal"),
  };
}

describe("settings branding form", () => {
  it("blocks multiple local files before the request reaches production", async () => {
    const user = userEvent.setup();
    const { form, logoInput, heroInput } = renderForm();

    await user.upload(
      logoInput,
      new File(["logo-bytes"], "logo.png", { type: "image/png" }),
    );
    await user.upload(
      heroInput,
      new File(["hero-bytes"], "hero.jpg", { type: "image/jpeg" }),
    );

    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(
      screen.getByText(/erro 413 em produção/i),
    ).toBeInTheDocument();
  });

  it("blocks an oversized app image before submit", async () => {
    const user = userEvent.setup();
    const { form, heroInput } = renderForm();

    await user.upload(
      heroInput,
      new File([new Uint8Array(3 * 1024 * 1024 + 1)], "hero.jpg", {
        type: "image/jpeg",
      }),
    );

    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    expect(
      screen.getByText("A imagem principal do app deve ter no máximo 3 MB."),
    ).toBeInTheDocument();
  });

  it("allows a single valid local file to continue", async () => {
    const user = userEvent.setup();
    const { form, heroInput } = renderForm();

    await user.upload(
      heroInput,
      new File(["hero-bytes"], "hero.jpg", { type: "image/jpeg" }),
    );

    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(false);
    expect(
      screen.queryByText(/erro 413 em produção/i),
    ).not.toBeInTheDocument();
  });
});
