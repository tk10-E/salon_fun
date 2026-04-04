type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ?? "";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? "";
const configuredAuthDomain = normalizeOptional(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);

const firebaseWebConfig: FirebaseWebConfig | null =
  apiKey && projectId
    ? {
        apiKey,
        projectId,
        authDomain: configuredAuthDomain ?? `${projectId}.firebaseapp.com`,
        appId: normalizeOptional(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
        messagingSenderId: normalizeOptional(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
        storageBucket: normalizeOptional(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      }
    : null;

export function getFirebaseWebConfig() {
  return firebaseWebConfig;
}

export function hasFirebaseWebConfig() {
  return firebaseWebConfig !== null;
}
