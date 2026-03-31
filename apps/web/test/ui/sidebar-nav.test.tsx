// @vitest-environment jsdom

import type { ReactNode } from "react";
import type { MouseEventHandler } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      onClick={props.onClick}
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

describe("SidebarNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePathnameMock.mockReturnValue("/dashboard");
    useRouterMock.mockReturnValue({
      prefetch: prefetchMock,
    });
  });

  it("marca o link clicado como pendente imediatamente", () => {
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /feed/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /notificações/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajustes/i })).toBeInTheDocument();

    const servicesLink = screen.getByRole("link", { name: /serviços/i });
    fireEvent.click(servicesLink);

    expect(servicesLink).toHaveClass("nav-link--pending");
    expect(servicesLink).toHaveAttribute("aria-busy", "true");
    expect(prefetchMock).toHaveBeenCalledWith("/dashboard/services");
  });
});
