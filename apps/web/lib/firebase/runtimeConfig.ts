import type { FirebaseWebConfig } from "@/lib/firebase/config";
import { getFirebaseWebConfig as getBuildTimeFirebaseWebConfig } from "@/lib/firebase/config";

let runtimeFirebaseWebConfig: FirebaseWebConfig | null | undefined;

export function setRuntimeFirebaseWebConfig(config: FirebaseWebConfig | null) {
  runtimeFirebaseWebConfig = config;
}

export function getRuntimeFirebaseWebConfig() {
  return runtimeFirebaseWebConfig ?? getBuildTimeFirebaseWebConfig();
}

export function hasRuntimeFirebaseWebConfig() {
  return getRuntimeFirebaseWebConfig() !== null;
}
