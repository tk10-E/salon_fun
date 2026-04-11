"use client";

import { useEffect } from "react";

import type { FirebaseWebConfig } from "@/lib/firebase/config";
import { setRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";

type FirebaseWebRuntimeConfigProps = {
  config: FirebaseWebConfig | null;
};

export function FirebaseWebRuntimeConfig({
  config,
}: FirebaseWebRuntimeConfigProps) {
  useEffect(() => {
    setRuntimeFirebaseWebConfig(config);
  }, [config]);

  return null;
}
