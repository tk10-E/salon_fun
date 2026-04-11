import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";

import { getRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";

let firebasePersistencePromise: Promise<void> | null = null;

export function getFirebaseApp() {
  const config = getRuntimeFirebaseWebConfig();
  if (config == null) {
    throw new Error("missing_firebase_web_config");
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(config);
}

export function getFirebasePanelAuth() {
  const auth = getAuth(getFirebaseApp());

  if (firebasePersistencePromise == null) {
    firebasePersistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }

  return auth;
}
