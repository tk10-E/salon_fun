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

export function makeImageFile(name: string, contents = "image-bytes", type = "image/jpeg") {
  return new File([contents], name, { type });
}
