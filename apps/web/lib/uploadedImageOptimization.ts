import { Buffer } from "node:buffer";

import sharp from "sharp";

import {
  MEDIA_UPLOAD_PRESETS,
  type MediaUploadContext,
} from "@/lib/mediaUploadPresets";

export type OptimizedUploadedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
};

export async function optimizeUploadedImage(
  file: File,
  context: MediaUploadContext,
): Promise<OptimizedUploadedImage> {
  const preset = MEDIA_UPLOAD_PRESETS[context];
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const inputImage = sharp(inputBuffer, { failOn: "none" }).rotate();
  const metadata = await inputImage.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error("Nao foi possivel processar a imagem enviada.");
  }

  const hasAlpha = metadata.hasAlpha === true || metadata.channels === 4;
  const resizedImage = inputImage
    .resize({
      width: preset.maxWidth,
      height: preset.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .sharpen();

  if (context === "product" && hasAlpha) {
    const buffer = await resizedImage
      .png({
        compressionLevel: 9,
        progressive: true,
        palette: true,
      })
      .toBuffer();

    return {
      buffer,
      contentType: "image/png",
      extension: "png",
      width,
      height,
    };
  }

  const buffer = await resizedImage
    .flatten({ background: "#ffffff" })
    .jpeg({
      quality: preset.serverQuality,
      mozjpeg: true,
      progressive: true,
    })
    .toBuffer();

  return {
    buffer,
    contentType: "image/jpeg",
    extension: "jpg",
    width,
    height,
  };
}
