import { describe, expect, it } from "vitest";

import {
  getRequestCountryCode,
  normalizeCountryCodesInput,
} from "@/lib/panelSecurityPolicy";

describe("panel security policy helpers", () => {
  it("normalizes, deduplicates and filters country codes", () => {
    expect(
      normalizeCountryCodesInput("br, us, BR, xx, 123, de"),
    ).toEqual(["BR", "US", "DE"]);
  });

  it("reads the request country from trusted edge headers", () => {
    expect(
      getRequestCountryCode(
        new Headers({
          "x-vercel-ip-country": "br",
        }),
      ),
    ).toBe("BR");
  });
});
