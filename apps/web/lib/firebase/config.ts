export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  messagingSenderId?: string;
  storageBucket?: string;
};

type FirebaseEnvSource = {
  NEXT_PUBLIC_FIREBASE_API_KEY?: string;
  NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string;
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  NEXT_PUBLIC_FIREBASE_APP_ID?: string;
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
} & Record<string, string | undefined>;

function normalizeOptional(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

const placeholderFirebaseValues = new Set([
  "your-firebase-api-key",
  "your-firebase-project-id",
  "your-firebase-auth-domain",
  "your-firebase-sender-id",
  "your-firebase-storage-bucket",
  "your-firebase-app-id",
  "changeme",
  "replace-me",
]);

function isPlaceholderFirebaseValue(value: string | undefined) {
  const normalized = normalizeOptional(value)?.toLowerCase();
  return normalized ? placeholderFirebaseValues.has(normalized) : false;
}

export function resolveFirebaseWebConfig(
  env: FirebaseEnvSource,
): FirebaseWebConfig | null {
  const apiKey = normalizeOptional(env.NEXT_PUBLIC_FIREBASE_API_KEY);
  const projectId = normalizeOptional(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  if (!apiKey || !projectId) {
    return null;
  }

  if (
    isPlaceholderFirebaseValue(apiKey) ||
    isPlaceholderFirebaseValue(projectId)
  ) {
    return null;
  }

  const configuredAuthDomain = normalizeOptional(
    env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  );

  return {
    apiKey,
    projectId,
    authDomain: configuredAuthDomain ?? `${projectId}.firebaseapp.com`,
    appId: normalizeOptional(env.NEXT_PUBLIC_FIREBASE_APP_ID),
    messagingSenderId: normalizeOptional(
      env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    storageBucket: normalizeOptional(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  };
}

export function getFirebaseWebConfig() {
  return resolveFirebaseWebConfig(process.env);
}

export function hasFirebaseWebConfig() {
  return getFirebaseWebConfig() !== null;
}
