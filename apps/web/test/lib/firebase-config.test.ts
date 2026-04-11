import { describe, expect, it } from "vitest";

import { resolveFirebaseWebConfig } from "@/lib/firebase/config";

describe("firebase config", () => {
  it("returns null when placeholder values are still present", () => {
    expect(
      resolveFirebaseWebConfig({
        NEXT_PUBLIC_FIREBASE_API_KEY: "your-firebase-api-key",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "your-firebase-project-id",
      }),
    ).toBeNull();
  });

  it("resolves the config when the public firebase env is valid", () => {
    expect(
      resolveFirebaseWebConfig({
        NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyExampleKey123",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "salon-fun-prod",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "painel.salonfun.com.br",
        NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "salon-fun.appspot.com",
      }),
    ).toEqual({
      apiKey: "AIzaSyExampleKey123",
      projectId: "salon-fun-prod",
      authDomain: "painel.salonfun.com.br",
      appId: "1:123:web:abc",
      messagingSenderId: "123",
      storageBucket: "salon-fun.appspot.com",
    });
  });
});
