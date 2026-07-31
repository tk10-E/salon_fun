import { describe, expect, it } from "vitest";

import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";

describe("client app config normalization", () => {
  it("drops invalid public links and malformed support email", () => {
    const config = normalizeSalonClientAppConfig({
      heroImageUrl: "ftp://cdn.example.com/hero.jpg",
      mapUrl: "notaurl",
      privacyPolicyUrl: "javascript:alert(1)",
      termsOfUseUrl: "https://studio.example.com/terms",
      supportUrl: "mailto:suporte@studio.example.com",
      supportEmail: "suporte-studio.example.com",
    });

    expect(config.heroImageUrl).toBeNull();
    expect(config.mapUrl).toBeNull();
    expect(config.privacyPolicyUrl).toBeNull();
    expect(config.termsOfUseUrl).toBe("https://studio.example.com/terms");
    expect(config.supportUrl).toBeNull();
    expect(config.supportEmail).toBeNull();
  });

  it("keeps only the host when the custom domain is stored as a full URL", () => {
    const config = normalizeSalonClientAppConfig({
      customDomain:
        "https://www.app.studiocentro.com.br/cliente/agenda?origem=painel",
    });

    expect(config.customDomain).toBe("app.studiocentro.com.br");
  });
});
