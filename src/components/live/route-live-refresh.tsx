"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getLiveScope,
  shouldRefreshForLiveToken,
} from "@/components/live/live-refresh-logic";

interface RouteLiveRefreshProps {
  intervalMs?: number;
  warmupMs?: number;
  refreshCooldownMs?: number;
}

export function RouteLiveRefresh({
  intervalMs = 30_000,
  warmupMs = 8_000,
  refreshCooldownMs = 20_000,
}: RouteLiveRefreshProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scope = useMemo(() => getLiveScope(pathname), [pathname]);
  const lastTokenRef = useRef<string | null>(null);
  const lastRefreshAtRef = useRef(0);
  const routeActivatedAtRef = useRef(0);
  const suppressUntilRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const disabledRef = useRef(false);

  const checkForUpdates = useEffectEvent(async () => {
    if (disabledRef.current) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      (document.visibilityState !== "visible" || document.readyState !== "complete")
    ) {
      return;
    }

    if (Date.now() - routeActivatedAtRef.current < warmupMs) {
      return;
    }

    if (Date.now() < suppressUntilRef.current) {
      return;
    }

    if (Date.now() - lastRefreshAtRef.current < refreshCooldownMs) {
      return;
    }

    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 4_000);

    try {
      const response = await fetch(`/api/live-updates?scope=${scope}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { token?: string };

      if (!payload.token) {
        return;
      }

      if (
        shouldRefreshForLiveToken({
          previousToken: lastTokenRef.current,
          nextToken: payload.token,
          now: Date.now(),
          lastRefreshAt: lastRefreshAtRef.current,
          refreshCooldownMs,
        })
      ) {
        lastTokenRef.current = payload.token;
        lastRefreshAtRef.current = Date.now();
        startTransition(() => {
          router.refresh();
        });

        return;
      }

      lastTokenRef.current = payload.token;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      // Swallow transient refresh polling failures.
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      window.clearTimeout(timeoutId);
      inFlightRef.current = false;
    }
  });

  useEffect(() => {
    disabledRef.current = false;
    routeActivatedAtRef.current = Date.now();
    suppressUntilRef.current = Date.now() + warmupMs;
    lastTokenRef.current = null;
    abortRef.current?.abort();

    const warmupTimeoutId = window.setTimeout(() => {
      void checkForUpdates();
    }, warmupMs);

    const intervalId = window.setInterval(() => {
      void checkForUpdates();
    }, intervalMs);

    const handleFocus = () => {
      void checkForUpdates();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdates();
      }
    };

    const handlePageExit = () => {
      disabledRef.current = true;
      abortRef.current?.abort();
    };

    const handlePotentialNavigation = (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const url = new URL(anchor.href);

      if (
        url.origin === window.location.origin &&
        url.pathname !== window.location.pathname
      ) {
        suppressUntilRef.current = Date.now() + warmupMs;
        abortRef.current?.abort();
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageExit);
    document.addEventListener("click", handlePotentialNavigation, {
      capture: true,
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disabledRef.current = true;
      abortRef.current?.abort();
      window.clearTimeout(warmupTimeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageExit);
      document.removeEventListener("click", handlePotentialNavigation, {
        capture: true,
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, refreshCooldownMs, scope, warmupMs]);

  return null;
}
