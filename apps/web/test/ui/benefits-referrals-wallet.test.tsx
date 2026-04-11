// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadReferralsPageDataMock,
  markReferralRewardRedeemedActionPath,
  saveSalonReferralProgramActionPath,
} = vi.hoisted(() => ({
  loadReferralsPageDataMock: vi.fn(),
  markReferralRewardRedeemedActionPath: "/__test/redeem-referral-reward",
  saveSalonReferralProgramActionPath: "/__test/save-referral-program",
}));

vi.mock("@/app/actions", () => ({
  markReferralRewardRedeemedAction: markReferralRewardRedeemedActionPath,
  saveSalonReferralProgramAction: saveSalonReferralProgramActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/dashboard/benefits/_lib", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/dashboard/benefits/_lib")
  >("@/app/dashboard/benefits/_lib");

  return {
    ...actual,
    loadReferralsPageData: loadReferralsPageDataMock,
  };
});

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
  }) =>
    createElement(
      "a",
      { href: props.href, className: props.className },
      props.children,
    ),
}));

import ReferralsPage from "@/app/dashboard/benefits/referrals/page";

describe("benefits referrals wallet UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reward unlock operations and redeem button", async () => {
    loadReferralsPageDataMock.mockResolvedValue({
      availableRewardUnlocksCount: 1,
      hasReferralFilters: false,
      pendingCountInPeriod: 2,
      periodQualifiedCount: 4,
      referralEvents: [
        {
          id: "event-1",
          created_at: "2026-04-01T12:00:00.000Z",
          invited_name: "Julia",
          qualified_at: "2026-04-02T12:00:00.000Z",
          referrer_name: "Maria",
          status: "qualified",
          used_referral_code: "MARIA10",
        },
      ],
      referralEventsBaseCount: 4,
      referralFrom: "",
      referralProgram: {
        id: "ref-1",
        title: "Indique e ganhe",
        description: "Convide uma amiga e ganhe bônus.",
        reward_for_referrer: "Escova grátis",
        reward_for_invited: "10% OFF",
        is_active: true,
        required_qualified_referrals: 5,
        reward_service_id: "service-1",
        reward_service_name: "Escova modelada",
        updated_at: "2026-04-01T15:00:00.000Z",
      },
      rewardUnlocks: [
        {
          customerId: "customer-1",
          customerName: "Maria",
          id: "unlock-1",
          redeemedAt: null,
          requiredQualifiedReferrals: 5,
          rewardDescription: "Escova modelada grátis",
          rewardServiceName: "Escova modelada",
          status: "available",
          thresholdReached: 5,
          unlockedAt: "2026-04-02T12:00:00.000Z",
        },
        {
          customerId: "customer-2",
          customerName: "Paula",
          id: "unlock-2",
          redeemedAt: "2026-04-03T12:00:00.000Z",
          requiredQualifiedReferrals: 5,
          rewardDescription: "Hidratação bônus",
          rewardServiceName: null,
          status: "redeemed",
          thresholdReached: 10,
          unlockedAt: "2026-04-01T12:00:00.000Z",
        },
      ],
      rewardUnlocksCount: 2,
      referralStatusFilter: "",
      referralTo: "",
      serviceOptions: [
        { id: "service-1", name: "Escova modelada", category: "Cabelo" },
      ],
    });

    const ui = await ReferralsPage({
      searchParams: {
        message: "Programa atualizado.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Programa atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recompensas liberadas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Escova modelada grátis")).toBeInTheDocument();
    expect(screen.getByText("Hidratação bônus")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como entregue" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByText("Entregue")).toBeInTheDocument();
  });
});
