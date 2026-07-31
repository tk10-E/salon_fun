type JsonRequestResult<T> = {
  payload: T | null;
  response: Response;
};

export async function postInternalAiJson<T>(
  url: string,
  body: unknown,
  timeoutMs = 15_000,
): Promise<JsonRequestResult<T>> {
  const controller = new AbortController();
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as T | null;

    return {
      payload,
      response,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("request_timeout");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutHandle);
  }
}
