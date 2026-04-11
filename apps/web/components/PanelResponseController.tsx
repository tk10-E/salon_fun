"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PendingMode = "navigation" | "submit";

const MIN_INDICATOR_VISIBLE_MS = 280;
const MAX_NAVIGATION_INDICATOR_MS = 12000;
const MAX_SUBMIT_INDICATOR_MS = 2600;

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isInternalNavigationAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  if (
    anchor.target === "_blank" ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("rel") === "external"
  ) {
    return null;
  }

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) {
    return null;
  }

  try {
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function PanelResponseController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;
  const [pendingMode, setPendingMode] = useState<PendingMode | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const lastRouteKeyRef = useRef(routeKey);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const routeChanged = lastRouteKeyRef.current !== routeKey;
    lastRouteKeyRef.current = routeKey;

    if (!routeChanged || pendingMode == null) {
      return;
    }

    const elapsed =
      startedAtRef.current == null ? 0 : performance.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_INDICATOR_VISIBLE_MS - elapsed);

    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setPendingMode(null);
      startedAtRef.current = null;
      timeoutRef.current = null;
    }, wait);
  }, [pendingMode, routeKey]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function beginPending(mode: PendingMode) {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current);
      }

      startedAtRef.current = performance.now();
      setPendingMode(mode);

      timeoutRef.current = window.setTimeout(
        () => {
          setPendingMode(null);
          startedAtRef.current = null;
          timeoutRef.current = null;
        },
        mode === "submit"
          ? MAX_SUBMIT_INDICATOR_MS
          : MAX_NAVIGATION_INDICATOR_MS,
      );
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        isModifiedEvent(event)
      ) {
        return;
      }

      const url = isInternalNavigationAnchor(event.target);
      if (!url) {
        return;
      }

      const nextRouteKey = `${url.pathname}${url.search}`;
      const currentRouteKey = `${window.location.pathname}${window.location.search}`;

      if (nextRouteKey === currentRouteKey) {
        return;
      }

      beginPending("navigation");
    }

    function handleFormSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      beginPending("submit");
    }

    document.addEventListener("click", handleDocumentClick, true);
    document.addEventListener("submit", handleFormSubmit, true);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      document.removeEventListener("submit", handleFormSubmit, true);
    };
  }, []);

  return (
    <>
      <div
        className={
          pendingMode
            ? "panel-response-indicator panel-response-indicator--active"
            : "panel-response-indicator"
        }
        aria-hidden="true"
      />

      <div
        className={
          pendingMode
            ? "panel-response-chip panel-response-chip--active"
            : "panel-response-chip"
        }
        aria-live="polite"
      >
        <span className="panel-response-chip__dot" aria-hidden="true" />
        <span>
          {pendingMode === "submit" ? "Salvando..." : "Carregando..."}
        </span>
      </div>
    </>
  );
}
