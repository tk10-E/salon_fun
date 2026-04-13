import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  assertSafeImageUpload,
  detectImageMimeType,
} from "@/lib/uploadedImageOptimization";
import {
  assertSafeVideoUpload,
  getSafeFeedVideoExtension,
} from "@/lib/uploadedVideoValidation";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p1+tH0AAAAASUVORK5CYII=",
  "base64",
);

const tinyMp4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
]);

describe("uploaded media security", () => {
  it("detects image type by signature instead of trusting the form content type", () => {
    expect(detectImageMimeType(tinyPng)).toBe("image/png");
    expect(() =>
      assertSafeImageUpload({
        buffer: tinyPng,
        declaredMimeType: "image/jpeg",
        contextLabel: "imagem de teste",
      }),
    ).toThrow("nao confere");
  });

  it("rejects unsupported image signatures", () => {
    expect(() =>
      assertSafeImageUpload({
        buffer: Buffer.from("<svg />"),
        declaredMimeType: "image/svg+xml",
        contextLabel: "imagem de teste",
      }),
    ).toThrow("nao e permitido");
  });

  it("validates feed video container before upload", () => {
    const contentType = assertSafeVideoUpload({
      buffer: tinyMp4,
      declaredMimeType: "video/mp4",
      maxBytes: 1024,
      contextLabel: "video de teste",
    });

    expect(contentType).toBe("video/mp4");
    expect(getSafeFeedVideoExtension(contentType)).toBe("mp4");
  });
});
