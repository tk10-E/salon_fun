import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";

import { getRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";

let firebasePersistencePromise: Promise<Auth> | null = null;

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

  void ensureFirebasePanelAuthReady(auth);

  return auth;
}

export async function getReadyFirebasePanelAuth() {
  return ensureFirebasePanelAuthReady(getAuth(getFirebaseApp()));
}

function ensureFirebasePanelAuthReady(auth: Auth) {
  if (firebasePersistencePromise == null) {
    firebasePersistencePromise = setPersistence(
      auth,
      browserLocalPersistence,
    )
      .then(() => auth)
      .catch(() => auth);
  }

  return firebasePersistencePromise;
}
