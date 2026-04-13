import { Buffer } from "node:buffer";

import { expect } from "vitest";

export const TEST_REDIRECT_PREFIX = "TEST_REDIRECT:";

type RedirectMock = {
  mock: {
    calls: unknown[][];
  };
};

type FormValue = FormDataEntryValue | FormDataEntryValue[] | null | undefined;

export async function captureRedirect(promise: Promise<unknown>, redirectMock: RedirectMock) {
  await expect(promise).rejects.toThrow(TEST_REDIRECT_PREFIX);

  const location = redirectMock.mock.calls.at(-1)?.[0];
  expect(typeof location).toBe("string");

  return String(location);
}

export function makeFormData(entries: Record<string, FormValue>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        formData.append(key, entry);
      }
      continue;
    }

    formData.set(key, value);
  }

  return formData;
}

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9p1+tH0AAAAASUVORK5CYII=";

export function makeImageFile(
  name: string,
  contents: BlobPart = "image-bytes",
  type = "image/png",
) {
  const payload =
    contents === "image-bytes"
      ? Buffer.from(TINY_PNG_BASE64, "base64")
      : contents;

  return new File([payload], name, { type });
}

const TINY_MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
]);

export function makeVideoFile(
  name: string,
  contents: BlobPart = TINY_MP4_BYTES,
  type = "video/mp4",
) {
  return new File([contents], name, { type });
}
