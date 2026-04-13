import { describe, expect, it } from "vitest";

import { makeImageFile } from "@/test/server-action-test-helpers";

import {
  SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE,
  getSettingsBrandingUploadError,
} from "@/lib/settingsBrandingUploads";

describe("settings branding uploads", () => {
  it("rejects more than one local file in the same save", () => {
    const error = getSettingsBrandingUploadError({
      clientAppHeroImageFile: makeImageFile("hero.jpg"),
      clientAppGalleryCoverImageFile: makeImageFile("gallery.jpg"),
    });

    expect(error).toBe(SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE);
  });

  it("rejects an oversized app image", () => {
    const error = getSettingsBrandingUploadError({
      clientAppHeroImageFile: new File(
        [new Uint8Array(3 * 1024 * 1024 + 1)],
        "hero.jpg",
        { type: "image/jpeg" },
      ),
    });

    expect(error).toBe("A imagem principal do app deve ter no máximo 3 MB.");
  });

  it("rejects unsupported cover formats before submitting", () => {
    const error = getSettingsBrandingUploadError({
      clientAppHeroImageFile: makeImageFile("hero.gif", "GIF89a", "image/gif"),
    });

    expect(error).toBe("Envie uma imagem válida para o hero principal do app.");
  });

  it("allows svg only for the logo field", () => {
    const logoError = getSettingsBrandingUploadError({
      logo: makeImageFile("logo.svg", "<svg />", "image/svg+xml"),
    });
    const coverError = getSettingsBrandingUploadError({
      clientAppHeroImageFile: makeImageFile(
        "hero.svg",
        "<svg />",
        "image/svg+xml",
      ),
    });

    expect(logoError).toBeNull();
    expect(coverError).toBe(
      "Envie uma imagem válida para o hero principal do app.",
    );
  });
});
