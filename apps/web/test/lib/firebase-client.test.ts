import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authInstance,
  browserLocalPersistenceMock,
  getAppMock,
  getAppsMock,
  getAuthMock,
  initializeAppMock,
  setPersistenceMock,
} = vi.hoisted(() => ({
  authInstance: { currentUser: null },
  browserLocalPersistenceMock: { type: "browserLocalPersistence" },
  getAppMock: vi.fn(),
  getAppsMock: vi.fn(),
  getAuthMock: vi.fn(),
  initializeAppMock: vi.fn(),
  setPersistenceMock: vi.fn(),
}));

vi.mock("firebase/app", () => ({
  getApp: getAppMock,
  getApps: getAppsMock,
  initializeApp: initializeAppMock,
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: browserLocalPersistenceMock,
  getAuth: getAuthMock,
  setPersistence: setPersistenceMock,
}));

vi.mock("@/lib/firebase/runtimeConfig", () => ({
  getRuntimeFirebaseWebConfig: () => ({
    apiKey: "test-key",
    authDomain: "panel.example.com",
    appId: "app-1",
    messagingSenderId: "sender-1",
    projectId: "project-1",
  }),
}));

describe("firebase client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getAppsMock.mockReturnValue([{}]);
    getAppMock.mockReturnValue({ name: "panel-app" });
    getAuthMock.mockReturnValue(authInstance);
    setPersistenceMock.mockResolvedValue(undefined);
  });

  it("starts browser persistence eagerly and reuses the same promise", async () => {
    let resolvePersistence!: () => void;
    setPersistenceMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePersistence = resolve;
        }),
    );

    const { getFirebasePanelAuth, getReadyFirebasePanelAuth } = await import(
      "@/lib/firebase/client"
    );

    expect(getFirebasePanelAuth()).toBe(authInstance);
    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
    expect(setPersistenceMock).toHaveBeenCalledWith(
      authInstance,
      browserLocalPersistenceMock,
    );

    let readyResolved = false;
    const readyPromise = getReadyFirebasePanelAuth().then((auth) => {
      readyResolved = true;
      expect(auth).toBe(authInstance);
    });

    await Promise.resolve();
    expect(readyResolved).toBe(false);

    resolvePersistence();
    await readyPromise;

    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the auth instance available even when persistence setup fails", async () => {
    setPersistenceMock.mockRejectedValue(new Error("persistence_unavailable"));

    const { getReadyFirebasePanelAuth } = await import("@/lib/firebase/client");

    await expect(getReadyFirebasePanelAuth()).resolves.toBe(authInstance);
    expect(setPersistenceMock).toHaveBeenCalledTimes(1);
  });
});
