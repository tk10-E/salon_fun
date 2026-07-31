// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthenticatedPanelEntryPathMock,
  panelAuthClientMock,
  redirectMock,
} = vi.hoisted(() => ({
  getAuthenticatedPanelEntryPathMock: vi.fn(),
  panelAuthClientMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string }) => (
    <a href={props.href}>{props.children}</a>
  ),
}));

vi.mock("@/components/auth/PanelAuthClient", () => ({
  PanelAuthClient: (props: {
    emailConfirmationPath?: string;
    firebaseConfig: unknown;
    initialMessage?: string;
    initialTone?: string;
    mode?: string;
    onboardingPath?: string;
  }) => {
    panelAuthClientMock(props);

    return <div>PainelAuth</div>;
  },
}));

vi.mock("@/components/auth/FirebaseWebRuntimeConfig", () => ({
  FirebaseWebRuntimeConfig: () => null,
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedPanelEntryPath: getAuthenticatedPanelEntryPathMock,
}));

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseWebConfig: () => null,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import ActivationPage from "@/app/(auth)/comecar/page";

describe("activation page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedPanelEntryPathMock.mockResolvedValue(null);
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`REDIRECT:${location}`);
    });
  });

  it("renders the activation entry with sign-up mode enabled", () => {
    return ActivationPage({
      searchParams: Promise.resolve({
        message: "Ative o salão pelo plano anual.",
        returnPath: "/planos?interval=yearly",
        tone: "info",
      }),
    }).then((page) => {
      render(page);

      expect(
        screen.getByRole("heading", { name: "Crie sua conta" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Abra a conta principal",
        }),
      ).toBeInTheDocument();
      expect(screen.getByText("PainelAuth")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ir para login" })).toHaveAttribute(
        "href",
        "/login",
      );
      expect(panelAuthClientMock).toHaveBeenCalledWith({
        emailConfirmationPath: "/comecar",
        firebaseConfig: null,
        initialMessage: "Ative o salão pelo plano anual.",
        initialTone: "info",
        mode: "sign-up",
        onboardingPath: "/onboarding?returnPath=%2Fplanos%3Finterval%3Dyearly",
      });
    });
  });

  it("redirects authenticated owners without a salon to onboarding preserving the selected plan context", async () => {
    getAuthenticatedPanelEntryPathMock.mockResolvedValue("/onboarding");

    await expect(
      ActivationPage({
        searchParams: Promise.resolve({
          returnPath: "/planos?interval=monthly",
        }),
      }),
    ).rejects.toThrow("REDIRECT:/onboarding?returnPath=%2Fplanos%3Finterval%3Dmonthly");
    expect(redirectMock).toHaveBeenCalledWith(
      "/onboarding?returnPath=%2Fplanos%3Finterval%3Dmonthly",
    );
  });
});
