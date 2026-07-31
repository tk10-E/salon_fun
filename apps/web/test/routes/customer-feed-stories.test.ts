import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createCustomerFeedStoryMock,
  getClientIpMock,
  guardApiRequestMock,
  hashSecurityIdentifierMock,
} = vi.hoisted(() => ({
  createCustomerFeedStoryMock: vi.fn(),
  getClientIpMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  hashSecurityIdentifierMock: vi.fn(),
}));

vi.mock("@/lib/customerFeedStories", () => ({
  createCustomerFeedStory: createCustomerFeedStoryMock,
  normalizeCustomerFeedStoryRouteError: (error: unknown) =>
    error instanceof Error ? error.message : String(error ?? ""),
}));

vi.mock("@/lib/security", () => ({
  getClientIp: getClientIpMock,
  guardApiRequest: guardApiRequestMock,
  hashSecurityIdentifier: hashSecurityIdentifierMock,
}));

import { POST } from "@/app/api/public/customer-feed-stories/route";

describe("customer feed stories route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCustomerFeedStoryMock.mockReset();
    getClientIpMock.mockReturnValue("127.0.0.1");
    guardApiRequestMock.mockResolvedValue(null);
    hashSecurityIdentifierMock.mockImplementation((value: string) => value);
  });

  it("returns 401 when the client app does not send an access token", async () => {
    const formData = new FormData();
    formData.append(
      "image",
      new File(["story"], "story.jpg", { type: "image/jpeg" }),
    );

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-feed-stories",
        {
          method: "POST",
          body: formData,
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      ok: false,
    });
    expect(createCustomerFeedStoryMock).not.toHaveBeenCalled();
  });

  it("publishes the authenticated customer's story photo", async () => {
    createCustomerFeedStoryMock.mockResolvedValue({
      id: "story-1",
      imageUrl: "https://cdn.example.com/story.jpg",
      sourceType: "customer_story",
      title: "Ana",
    });
    const formData = new FormData();
    formData.append(
      "image",
      new File(["story"], "story.jpg", { type: "image/jpeg" }),
    );
    formData.append("caption", "Meu novo corte");

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-feed-stories",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
          },
          body: formData,
        },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      story: {
        id: "story-1",
        imageUrl: "https://cdn.example.com/story.jpg",
        sourceType: "customer_story",
        title: "Ana",
      },
    });
    expect(createCustomerFeedStoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "customer-token",
        caption: "Meu novo corte",
        imageFile: expect.any(File),
      }),
    );
  });
});
