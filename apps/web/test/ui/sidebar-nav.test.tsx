// @vitest-environment jsdom

import type { MouseEventHandler, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathnameMock, useRouterMock, prefetchMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
  useRouterMock: vi.fn(),
  prefetchMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
    onMouseEnter?: () => void;
    onTouchStart?: () => void;
    onFocus?: () => void;
    "aria-busy"?: boolean | "false" | "true";
    "data-pending"?: string;
  }) => (
    <a
      href={props.href}
      className={props.className}
      onClick={(event) => {
        props.onClick?.(event);
        event.preventDefault();
      }}
      onMouseEnter={props.onMouseEnter}
      onTouchStart={props.onTouchStart}
      onFocus={props.onFocus}
      aria-busy={props["aria-busy"]}
      data-pending={props["data-pending"]}
    >
      {props.children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: useRouterMock,
}));

import { SidebarNav } from "@/components/SidebarNav";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

describe("SidebarNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/dashboard");
    useRouterMock.mockReturnValue({
      prefetch: prefetchMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefetches only when the user signals navigation intent", () => {
    render(<SidebarNav />);

    expect(prefetchMock).not.toHaveBeenCalled();

    const campaignsLink = screen.getByRole("link", { name: /campanhas/i });

    fireEvent.mouseEnter(campaignsLink);
    expect(prefetchMock).toHaveBeenCalledTimes(1);
    expect(prefetchMock).toHaveBeenLastCalledWith(
      "/dashboard/benefits/promotions",
    );

    fireEvent.focus(campaignsLink);
    fireEvent.touchStart(campaignsLink);

    expect(prefetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows the main salon and client-app areas and marks clicks as pending", () => {
    render(<SidebarNav />);

    expect(
      screen.getByText(/o que move o salão e o app do cliente/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/essencial/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /^hoje/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^agenda/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^clientes/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^serviços/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^equipe/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^caixa/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^feed/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^loja/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^campanhas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^app do cliente/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^ajustes/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /central ia/i }),
    ).not.toBeInTheDocument();

    const clientsLink = screen.getByRole("link", { name: /^clientes/i });
    fireEvent.click(clientsLink);

    expect(clientsLink).toHaveClass("nav-link--pending");
    expect(clientsLink).toHaveAttribute("aria-busy", "true");
    expect(prefetchMock).toHaveBeenCalledTimes(1);
    expect(prefetchMock).toHaveBeenCalledWith(MANAGEMENT_ROUTES.clients);
  });

  it("notifies the shell when a valid navigation starts", () => {
    const onNavigate = vi.fn();

    render(<SidebarNav onNavigate={onNavigate} />);

    fireEvent.click(screen.getByRole("link", { name: /clientes/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("warms up the most likely routes after the panel settles", () => {
    vi.useFakeTimers();

    render(<SidebarNav />);

    expect(prefetchMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2400);
    });

    expect(prefetchMock).toHaveBeenCalledWith(MANAGEMENT_ROUTES.appointments);
    expect(prefetchMock).toHaveBeenCalledWith(MANAGEMENT_ROUTES.clients);
    expect(prefetchMock).toHaveBeenCalledWith(MANAGEMENT_ROUTES.services);
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/finance");
    expect(prefetchMock).toHaveBeenCalledWith(MANAGEMENT_ROUTES.professionals);
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/feed");
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/inventory");
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/benefits/promotions");
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/client-app");
  });

  it("shows only billing activation when the workspace is locked", () => {
    render(
      <SidebarNav
        isWorkspaceLocked
        allowedPathsWhenLocked={["/planos"]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /escolher plano/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /agenda/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /clientes/i }),
    ).not.toBeInTheDocument();
  });
});
