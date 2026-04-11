import { describe, expect, it } from "vitest";

import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";

describe("client app config normalization", () => {
  it("drops invalid public links and malformed support email", () => {
    const config = normalizeSalonClientAppConfig({
      heroImageUrl: "ftp://cdn.example.com/hero.jpg",
      instagramUrl: "instagram.com/studio",
      mapUrl: "notaurl",
      privacyPolicyUrl: "javascript:alert(1)",
      termsOfUseUrl: "https://studio.example.com/terms",
      supportUrl: "mailto:suporte@studio.example.com",
      supportEmail: "suporte-studio.example.com",
    });

    expect(config.heroImageUrl).toBeNull();
    expect(config.instagramUrl).toBeNull();
    expect(config.mapUrl).toBeNull();
    expect(config.privacyPolicyUrl).toBeNull();
    expect(config.termsOfUseUrl).toBe("https://studio.example.com/terms");
    expect(config.supportUrl).toBeNull();
    expect(config.supportEmail).toBeNull();
  });
});
