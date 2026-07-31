// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  SettingsCampaignsField,
  type SettingsClientAppCampaignDraft,
} from "@/components/SettingsCampaignsField";

describe("SettingsCampaignsField", () => {
  it("starts with a single empty campaign when no draft exists and lets the user add more", async () => {
    const user = userEvent.setup();

    render(<SettingsCampaignsField initialCampaigns={[]} />);

    expect(
      screen.getByRole("button", { name: "Adicionar campanha" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Campanha 1").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Título")).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Adicionar campanha" }),
    );

    expect(screen.getAllByText("Campanha 2").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Título")).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Remover" }).length,
    ).toBeGreaterThan(0);
  });

  it("renders saved campaigns and allows removing extra cards without breaking the first one", async () => {
    const user = userEvent.setup();
    const campaigns: SettingsClientAppCampaignDraft[] = [
      {
        slot: 1,
        id: "campaign-1",
        isActive: true,
        priority: "high",
        startsAt: "",
        endsAt: "",
        audience: "all",
        eyebrow: "Agora no app",
        title: "Volte essa semana",
        message: "Uma campanha operacional já pronta para a home.",
        campaignLabel: "Retorno da semana",
        ctaLabel: "",
        ctaTarget: "explore",
      },
      {
        slot: 2,
        id: "campaign-2",
        isActive: false,
        priority: "low",
        startsAt: "",
        endsAt: "",
        audience: "without_active_benefits",
        eyebrow: "",
        title: "Chame a equipe",
        message: "Direciona a cliente para o canal do salão.",
        campaignLabel: "",
        ctaLabel: "",
        ctaTarget: "support",
      },
    ];

    render(<SettingsCampaignsField initialCampaigns={campaigns} />);

    expect(screen.getByText("Volte essa semana")).toBeInTheDocument();
    expect(screen.getByText("Chame a equipe")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Remover" })[1]);

    expect(screen.queryByText("Chame a equipe")).not.toBeInTheDocument();
    expect(screen.getByText("Volte essa semana")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Título")).toHaveLength(1);
  });
});
