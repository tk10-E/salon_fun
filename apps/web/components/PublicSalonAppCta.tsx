"use client";

import { useEffect, useRef, useState } from "react";

type PublicSalonAppCtaProps = {
  joinCode: string;
  deepLinkUrl: string;
  androidStoreUrl?: string | null;
  iosStoreUrl?: string | null;
};

type CopyState = "idle" | "copied" | "error";

export function PublicSalonAppCta({
  joinCode,
  deepLinkUrl,
  androidStoreUrl,
  iosStoreUrl,
}: PublicSalonAppCtaProps) {
  const [fallbackVisible, setFallbackVisible] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const fallbackTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearFallbackTimer() {
      if (fallbackTimerRef.current != null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    }

    function clearCopyTimer() {
      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        clearFallbackTimer();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearFallbackTimer();
      clearCopyTimer();
    };
  }, []);

  async function handleCopyCode() {
    if (!navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(joinCode);
      setCopyState("copied");

      if (copyTimerRef.current != null) {
        window.clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = window.setTimeout(() => {
        setCopyState("idle");
      }, 2400);
    } catch {
      setCopyState("error");
    }
  }

  function handleOpenInApp() {
    if (fallbackTimerRef.current != null) {
      window.clearTimeout(fallbackTimerRef.current);
    }

    setFallbackVisible(false);
    fallbackTimerRef.current = window.setTimeout(() => {
      setFallbackVisible(true);
    }, 1400);

    window.location.href = deepLinkUrl;
  }

  return (
    <div className="public-salon-app-cta">
      <div className="public-salon-app-cta__actions">
        <button
          type="button"
          onClick={handleOpenInApp}
          className="public-salon-button public-salon-button--primary"
        >
          Abrir no app
        </button>
        <button
          type="button"
          onClick={handleCopyCode}
          className="public-salon-button public-salon-button--secondary"
        >
          {copyState === "copied" ? "Codigo copiado" : "Copiar codigo"}
        </button>
      </div>

      <div className="public-salon-app-cta__feedback" aria-live="polite">
        {copyState === "error" ? (
          <p>Copie manualmente o codigo {joinCode} se o navegador bloquear essa acao.</p>
        ) : null}
        {fallbackVisible ? (
          <p>
            Se o app nao abrir agora, instale a versao oficial e use o codigo {joinCode}.
          </p>
        ) : null}
      </div>

      {fallbackVisible && (androidStoreUrl || iosStoreUrl) ? (
        <div className="public-salon-install-actions">
          {androidStoreUrl ? (
            <a
              href={androidStoreUrl}
              className="public-salon-button public-salon-button--secondary"
              target="_blank"
              rel="noreferrer"
            >
              Baixar no Google Play
            </a>
          ) : null}
          {iosStoreUrl ? (
            <a
              href={iosStoreUrl}
              className="public-salon-button public-salon-button--secondary"
              target="_blank"
              rel="noreferrer"
            >
              Baixar na App Store
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
