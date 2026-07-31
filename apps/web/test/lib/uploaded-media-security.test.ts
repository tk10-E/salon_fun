import { Buffer } from "node:buffer";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  assertSafeImageUpload,
  detectImageMimeType,
  optimizeUploadedImage,
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
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00,
  0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
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

  it("rescales uploaded service images and reports the output dimensions", async () => {
    const largeJpeg = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 238, g: 212, b: 188 },
      },
    })
      .jpeg()
      .toBuffer();

    const optimized = await optimizeUploadedImage(
      new File([largeJpeg], "service.jpg", { type: "image/jpeg" }),
      "service",
    );
    const metadata = await sharp(optimized.buffer).metadata();

    expect(metadata.width).toBe(1800);
    expect(metadata.height).toBe(1350);
    expect(optimized.width).toBe(1800);
    expect(optimized.height).toBe(1350);
  });
});
