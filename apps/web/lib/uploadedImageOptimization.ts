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

export const SAFE_RASTER_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const SAFE_LOGO_IMAGE_MIME_TYPES = [
  ...SAFE_RASTER_IMAGE_MIME_TYPES,
  "image/svg+xml",
] as const;

export const MAX_SAFE_IMAGE_INPUT_PIXELS = 24_000_000;

type SafeImageMimeType =
  | (typeof SAFE_RASTER_IMAGE_MIME_TYPES)[number]
  | "image/svg+xml";

type SafeImageUploadOptions = {
  buffer: Buffer;
  declaredMimeType?: string | null;
  allowedMimeTypes?: readonly SafeImageMimeType[];
  maxBytes?: number;
  contextLabel: string;
};

export async function optimizeUploadedImage(
  file: File,
  context: MediaUploadContext,
): Promise<OptimizedUploadedImage> {
  const preset = MEDIA_UPLOAD_PRESETS[context];
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  assertSafeImageUpload({
    buffer: inputBuffer,
    declaredMimeType: file.type,
    allowedMimeTypes: SAFE_RASTER_IMAGE_MIME_TYPES,
    maxBytes: preset.maxInputBytes,
    contextLabel: "imagem enviada",
  });

  const inputImage = createSafeSharpImage(inputBuffer).rotate();
  const metadata = await inputImage.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  assertSafeImageDimensions(width, height, "imagem enviada");

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

export async function optimizeSalonLogoImage(
  file: File,
): Promise<OptimizedUploadedImage> {
  const inputBuffer = Buffer.from(await file.arrayBuffer());
  assertSafeImageUpload({
    buffer: inputBuffer,
    declaredMimeType: file.type,
    allowedMimeTypes: SAFE_LOGO_IMAGE_MIME_TYPES,
    contextLabel: "logo do salao",
  });

  const inputImage = createSafeSharpImage(inputBuffer).rotate();
  const metadata = await inputImage.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  assertSafeImageDimensions(width, height, "logo do salao");

  const { data, info } = await inputImage
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 9,
      progressive: true,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: "image/png",
    extension: "png",
    width: info.width,
    height: info.height,
  };
}

export function assertSafeImageUpload({
  buffer,
  declaredMimeType,
  allowedMimeTypes = SAFE_RASTER_IMAGE_MIME_TYPES,
  maxBytes,
  contextLabel,
}: SafeImageUploadOptions) {
  if (buffer.length <= 0) {
    throw new Error(`Envie uma ${contextLabel} valida.`);
  }

  if (typeof maxBytes === "number" && buffer.length > maxBytes) {
    throw new Error(`A ${contextLabel} excede o tamanho permitido.`);
  }

  const detectedMimeType = detectImageMimeType(buffer);

  if (!detectedMimeType) {
    throw new Error(`Envie uma ${contextLabel} em um formato valido.`);
  }

  const allowed = new Set(allowedMimeTypes.map(normalizeImageMimeType));

  if (!allowed.has(detectedMimeType)) {
    throw new Error(`O formato da ${contextLabel} nao e permitido.`);
  }

  const normalizedDeclaredMimeType = normalizeImageMimeType(declaredMimeType);

  if (
    normalizedDeclaredMimeType &&
    normalizedDeclaredMimeType !== "application/octet-stream" &&
    normalizedDeclaredMimeType !== detectedMimeType
  ) {
    throw new Error(`O formato declarado da ${contextLabel} nao confere.`);
  }

  return detectedMimeType;
}

export function detectImageMimeType(buffer: Buffer): SafeImageMimeType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  const head = buffer
    .toString("utf8", 0, Math.min(buffer.length, 4096))
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();

  if (
    head.startsWith("<svg") ||
    (head.startsWith("<?xml") && head.includes("<svg"))
  ) {
    return "image/svg+xml";
  }

  return null;
}

export function createSafeSharpImage(buffer: Buffer) {
  return sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_SAFE_IMAGE_INPUT_PIXELS,
  });
}

export function assertSafeImageDimensions(
  width: number,
  height: number,
  contextLabel: string,
) {
  if (width <= 0 || height <= 0) {
    throw new Error(`Nao foi possivel processar a ${contextLabel}.`);
  }

  if (width * height > MAX_SAFE_IMAGE_INPUT_PIXELS) {
    throw new Error(`A ${contextLabel} tem resolucao alta demais.`);
  }
}

function normalizeImageMimeType(mimeType?: string | null) {
  const normalized = String(mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (normalized === "image/jpg" || normalized === "image/pjpeg") {
    return "image/jpeg";
  }

  if (normalized === "image/x-png") {
    return "image/png";
  }

  return normalized;
}
