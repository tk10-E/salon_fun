// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prefetchMock, usePathnameMock, useRouterMock, useSearchParamsMock } =
  vi.hoisted(() => ({
    prefetchMock: vi.fn(),
    usePathnameMock: vi.fn(),
    useRouterMock: vi.fn(),
    useSearchParamsMock: vi.fn(),
  }));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: useRouterMock,
  useSearchParams: useSearchParamsMock,
}));

import { PanelResponseController } from "@/components/PanelResponseController";

function dispatchSubmit(form: HTMLFormElement, submitter: HTMLElement) {
  const event = new Event("submit", {
    bubbles: true,
    cancelable: true,
  }) as SubmitEvent;
  Object.defineProperty(event, "submitter", {
    configurable: true,
    value: submitter,
  });

  form.dispatchEvent(event);
  return event;
}

describe("PanelResponseController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/dashboard");
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    useRouterMock.mockReturnValue({
      prefetch: prefetchMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefetches dashboard routes when the user signals navigation intent", () => {
    render(
      <>
        <PanelResponseController />
        <a href="/dashboard/settings">Configurações</a>
        <a href="https://example.com/s/D1E438">Vitrine</a>
      </>,
    );

    const settingsLink = screen.getByRole("link", {
      name: "Configurações",
    });
    const storefrontLink = screen.getByRole("link", { name: "Vitrine" });

    fireEvent.pointerOver(settingsLink);
    fireEvent.focus(settingsLink);
    fireEvent.pointerOver(storefrontLink);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("marks submit buttons immediately and blocks duplicate submits while pending", () => {
    vi.useFakeTimers();

    render(
      <>
        <PanelResponseController />
        <form>
          <button type="submit" className="primary-button">
            Salvar
          </button>
        </form>
      </>,
    );

    const form = document.querySelector("form");
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(form).not.toBeNull();

    let firstSubmit: SubmitEvent;
    act(() => {
      firstSubmit = dispatchSubmit(form!, button);
    });

    expect(firstSubmit!.defaultPrevented).toBe(false);
    expect(form).toHaveAttribute("data-panel-pending", "true");
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("data-panel-submitter-pending", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Salvando...").parentElement).toHaveClass(
      "panel-response-chip--active",
    );

    let duplicateSubmit: SubmitEvent;
    act(() => {
      duplicateSubmit = dispatchSubmit(form!, button);
    });

    expect(duplicateSubmit!.defaultPrevented).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(form).not.toHaveAttribute("data-panel-pending");
    expect(form).not.toHaveAttribute("aria-busy");
    expect(button).not.toHaveAttribute("data-panel-submitter-pending");
    expect(button).not.toHaveAttribute("aria-busy");
  });
});
