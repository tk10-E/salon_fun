import { Buffer } from "node:buffer";

export const SAFE_FEED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

type SafeFeedVideoMimeType = (typeof SAFE_FEED_VIDEO_MIME_TYPES)[number];

type VideoContainerFamily = "mp4" | "webm";

type SafeVideoUploadOptions = {
  buffer: Buffer;
  declaredMimeType?: string | null;
  maxBytes: number;
  contextLabel: string;
};

export function assertSafeVideoUpload({
  buffer,
  declaredMimeType,
  maxBytes,
  contextLabel,
}: SafeVideoUploadOptions): SafeFeedVideoMimeType {
  if (buffer.length <= 0) {
    throw new Error(`Envie um ${contextLabel} valido.`);
  }

  if (buffer.length > maxBytes) {
    throw new Error(`O ${contextLabel} excede o tamanho permitido.`);
  }

  const normalizedDeclaredMimeType = normalizeVideoMimeType(declaredMimeType);

  if (!SAFE_FEED_VIDEO_MIME_TYPES.includes(normalizedDeclaredMimeType)) {
    throw new Error(`O formato do ${contextLabel} nao e permitido.`);
  }

  const containerFamily = detectVideoContainerFamily(buffer);

  if (!containerFamily) {
    throw new Error(`Nao foi possivel validar o ${contextLabel}.`);
  }

  if (
    containerFamily === "webm" &&
    normalizedDeclaredMimeType !== "video/webm"
  ) {
    throw new Error(`O formato declarado do ${contextLabel} nao confere.`);
  }

  if (
    containerFamily === "mp4" &&
    !["video/mp4", "video/quicktime"].includes(normalizedDeclaredMimeType)
  ) {
    throw new Error(`O formato declarado do ${contextLabel} nao confere.`);
  }

  return normalizedDeclaredMimeType;
}

export function getSafeFeedVideoExtension(contentType: SafeFeedVideoMimeType) {
  if (contentType === "video/webm") {
    return "webm";
  }

  if (contentType === "video/quicktime") {
    return "mov";
  }

  return "mp4";
}

function detectVideoContainerFamily(
  buffer: Buffer,
): VideoContainerFamily | null {
  if (
    buffer.length >= 12 &&
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    return "mp4";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "webm";
  }

  return null;
}

function normalizeVideoMimeType(
  mimeType?: string | null,
): SafeFeedVideoMimeType {
  const normalized = String(mimeType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (normalized === "video/x-m4v") {
    return "video/mp4";
  }

  if (normalized === "video/mov") {
    return "video/quicktime";
  }

  return normalized as SafeFeedVideoMimeType;
}
