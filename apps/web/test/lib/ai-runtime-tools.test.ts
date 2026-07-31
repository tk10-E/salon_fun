import { describe, expect, it } from "vitest";

import {
  getPanelAssistantToolCatalog,
  getPanelAssistantToolDefinition,
} from "@/lib/ai/runtime/tools";

describe("ai runtime tool catalog", () => {
  it("exposes the operational tools in panel order", () => {
    const tools = getPanelAssistantToolCatalog();

    expect(tools.map((tool) => tool.id)).toEqual([
      "getAgenda",
      "getClientesInativos",
      "criarCampanha",
      "getHorariosVagos",
      "getFaturamento",
      "getProfissionaisDisponiveis",
      "getCancelamentos",
      "sugerirEncaixes",
    ]);
    expect(tools[0]?.quickAction.label).toBe("Ver agenda");
    expect(tools[2]?.kind).toBe("write");
  });

  it("keeps quick actions aligned with the real dashboard routes", () => {
    const campaignTool = getPanelAssistantToolDefinition("criarCampanha");
    const financeTool = getPanelAssistantToolDefinition("getFaturamento");

    expect(campaignTool.quickAction.href).toBe(
      "/dashboard/benefits/promotions?compose=1",
    );
    expect(financeTool.quickAction.href).toBe("/dashboard/finance");
  });
});
