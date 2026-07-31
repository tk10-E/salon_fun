"use client";

import { startTransition, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getDashboardRefreshDelay } from "@/lib/dashboardRefreshBudget";
import { getDashboardLiveSyncSubscriptions } from "@/lib/dashboard-live-sync";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DashboardLiveSyncProps = {
  salonId: string;
};

const SESSION_KEEP_ALIVE_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_REVALIDATION_THROTTLE_MS = 4 * 1000;
const REFRESH_DEBOUNCE_MS = 240;
const MIN_REFRESH_INTERVAL_MS = 1800;
const MAX_DEFERRED_REFRESH_MS = 5000;
const RESUME_POLL_INTERVAL_MS = 900;
const SESSION_KEEP_ALIVE_ENDPOINT = "/api/internal/session/ping";
const SESSION_EXPIRED_MESSAGE =
  "Sessão encerrada por inatividade. Entre novamente para continuar.";

function isUnauthorizedPingResponse(response: Response) {
  if (response.status === 401) {
    return true;
  }

  if (response.redirected && response.url.includes("/login")) {
    return true;
  }

  const redirectedPathname = (() => {
    try {
      return new URL(response.url).pathname;
    } catch {
      return "";
    }
  })();

  return redirectedPathname === "/login";
}

function isInteractiveElement(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  return (
    element.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function DashboardLiveSync({ salonId }: DashboardLiveSyncProps) {
  const pathname = usePathname();
  const router = useRouter();
  const keepAliveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSessionPingAtRef = useRef(0);
  const sessionPingInFlightRef = useRef(false);
  const unauthorizedPingCountRef = useRef(0);
  const pendingRefreshRef = useRef(false);
  const queuedRefreshSinceRef = useRef<number | null>(null);
  const lastRefreshCommittedAtRef = useRef(0);
  const subscriptions = useMemo(
    () => getDashboardLiveSyncSubscriptions(pathname),
    [pathname],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const clearRefreshTimer = () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const clearResumePollTimer = () => {
      if (resumePollTimerRef.current !== null) {
        clearTimeout(resumePollTimerRef.current);
        resumePollTimerRef.current = null;
      }
    };

    const clearKeepAliveTimer = () => {
      if (keepAliveTimerRef.current !== null) {
        clearInterval(keepAliveTimerRef.current);
        keepAliveTimerRef.current = null;
      }
    };

    const redirectToLogin = () => {
      const searchParams = new URLSearchParams({
        message: SESSION_EXPIRED_MESSAGE,
        tone: "info",
      });

      window.location.assign(`/login?${searchParams.toString()}`);
    };

    const isRefreshSuspended = () => {
      if (typeof document === "undefined") {
        return false;
      }

      if (document.visibilityState !== "visible") {
        return true;
      }

      if (
        document.querySelector("[data-panel-pending='true'], form[aria-busy='true']")
      ) {
        return true;
      }

      return isInteractiveElement(document.activeElement);
    };

    const pingSession = async (options?: {
      bypassThrottle?: boolean;
      keepalive?: boolean;
      redirectOnUnauthorized?: boolean;
      skipWhenHidden?: boolean;
    }) => {
      if (
        options?.skipWhenHidden &&
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }

      if (sessionPingInFlightRef.current) {
        return;
      }

      const now = Date.now();
      if (
        !options?.bypassThrottle &&
        lastSessionPingAtRef.current > 0 &&
        now - lastSessionPingAtRef.current < SESSION_REVALIDATION_THROTTLE_MS
      ) {
        return;
      }

      sessionPingInFlightRef.current = true;
      lastSessionPingAtRef.current = now;

      try {
        const response = await fetch(SESSION_KEEP_ALIVE_ENDPOINT, {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "x-panel-keepalive": "1",
          },
          keepalive: options?.keepalive,
        });

        if (isUnauthorizedPingResponse(response)) {
          const sessionResult = await supabase.auth.getSession().catch(() => ({
            data: { session: null },
          }));
          const session = sessionResult.data.session;

          if (session?.refresh_token) {
            const refreshedSession = await supabase.auth
              .refreshSession()
              .catch(() => ({ data: { session: null }, error: new Error() }));

            if (!refreshedSession.error && refreshedSession.data.session) {
              unauthorizedPingCountRef.current = 0;
              return;
            }
          }

          if (options?.redirectOnUnauthorized) {
            unauthorizedPingCountRef.current += 1;

            if (unauthorizedPingCountRef.current >= 2) {
              redirectToLogin();
            }
          }

          return;
        }

        unauthorizedPingCountRef.current = 0;
      } catch {
        // best effort: transient keep-alive failures should not interrupt the panel
      } finally {
        sessionPingInFlightRef.current = false;
      }
    };

    const restartKeepAlive = () => {
      clearKeepAliveTimer();

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      keepAliveTimerRef.current = setInterval(() => {
        void pingSession({ skipWhenHidden: true });
      }, SESSION_KEEP_ALIVE_INTERVAL_MS);
    };

    const scheduleResumePoll = () => {
      if (resumePollTimerRef.current !== null) {
        return;
      }

      resumePollTimerRef.current = setTimeout(() => {
        resumePollTimerRef.current = null;
        if (!pendingRefreshRef.current) {
          return;
        }

        if (isRefreshSuspended()) {
          scheduleResumePoll();
          return;
        }

        pendingRefreshRef.current = false;
        queueRefresh();
      }, RESUME_POLL_INTERVAL_MS);
    };

    const queueRefresh = () => {
      if (isRefreshSuspended()) {
        pendingRefreshRef.current = true;
        queuedRefreshSinceRef.current ??= Date.now();
        scheduleResumePoll();
        return;
      }

      clearResumePollTimer();
      pendingRefreshRef.current = false;

      if (refreshTimerRef.current !== null) {
        return;
      }

      const now = Date.now();
      queuedRefreshSinceRef.current ??= now;
      const delayMs = getDashboardRefreshDelay({
        debounceMs: REFRESH_DEBOUNCE_MS,
        lastRefreshAt: lastRefreshCommittedAtRef.current,
        maxDeferredRefreshMs: MAX_DEFERRED_REFRESH_MS,
        minRefreshIntervalMs: MIN_REFRESH_INTERVAL_MS,
        now,
        queuedAt: queuedRefreshSinceRef.current,
      });

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        if (isRefreshSuspended()) {
          pendingRefreshRef.current = true;
          scheduleResumePoll();
          return;
        }

        lastRefreshCommittedAtRef.current = Date.now();
        queuedRefreshSinceRef.current = null;
        startTransition(() => {
          router.refresh();
        });
      }, delayMs);
    };

    const flushPendingRefresh = () => {
      if (!pendingRefreshRef.current || isRefreshSuspended()) {
        return;
      }

      queueRefresh();
    };

    const focusListener = () => {
      flushPendingRefresh();
      void pingSession({ redirectOnUnauthorized: true });
      restartKeepAlive();
    };
    const visibilityListener = () => {
      if (document.visibilityState === "visible") {
        flushPendingRefresh();
        void pingSession({ redirectOnUnauthorized: true });
      } else {
        void pingSession({ bypassThrottle: true, keepalive: true });
      }

      restartKeepAlive();
    };

    window.addEventListener("focus", focusListener);
    document.addEventListener("visibilitychange", visibilityListener);
    restartKeepAlive();

    let channel = supabase.channel(
      `dashboard-live-sync:${salonId}:${pathname ?? "dashboard"}`,
    );

    for (const subscription of subscriptions) {
      const filter = subscription.filterColumn
        ? `${subscription.filterColumn}=eq.${salonId}`
        : undefined;
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: subscription.table,
          filter,
        },
        () => {
          queueRefresh();
        },
      );
    }

    channel.subscribe();

    return () => {
      window.removeEventListener("focus", focusListener);
      document.removeEventListener("visibilitychange", visibilityListener);
      clearKeepAliveTimer();
      clearRefreshTimer();
      clearResumePollTimer();
      void supabase.removeChannel(channel);
    };
  }, [pathname, router, salonId, subscriptions]);

  return null;
}
