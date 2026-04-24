import "server-only";

import { performance } from "node:perf_hooks";

type TimingMetaValue = boolean | number | string | null | undefined;
type TimingMeta = Record<string, TimingMetaValue>;

function shouldLogTimings() {
  return process.env.FORTEXA_TIMINGS === "1" || process.env.NODE_ENV === "development";
}

function normalizeMeta(meta?: TimingMeta) {
  if (!meta) {
    return "";
  }

  const entries = Object.entries(meta)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return entries.length ? ` ${entries.join(" ")}` : "";
}

function emitTimingLog(
  label: string,
  durationMs: number,
  status: "ok" | "error",
  meta?: TimingMeta
) {
  if (!shouldLogTimings()) {
    return;
  }

  const duration = Number(durationMs.toFixed(1));
  console.info(`[timing] ${label} duration_ms=${duration} status=${status}${normalizeMeta(meta)}`);
}

export function startServerTiming(label: string, meta?: TimingMeta) {
  const startedAt = performance.now();

  return {
    end(extraMeta?: TimingMeta) {
      emitTimingLog(label, performance.now() - startedAt, "ok", {
        ...meta,
        ...extraMeta,
      });
    },
    fail(extraMeta?: TimingMeta) {
      emitTimingLog(label, performance.now() - startedAt, "error", {
        ...meta,
        ...extraMeta,
      });
    },
  };
}

export async function measureServerTiming<T>(
  label: string,
  run: () => Promise<T>,
  meta?: TimingMeta,
  summarize?: (value: T) => TimingMeta
) {
  const startedAt = performance.now();

  try {
    const value = await run();
    emitTimingLog(label, performance.now() - startedAt, "ok", {
      ...meta,
      ...summarize?.(value),
    });
    return value;
  } catch (error) {
    emitTimingLog(label, performance.now() - startedAt, "error", {
      ...meta,
      error: error instanceof Error ? error.name : "unknown",
    });
    throw error;
  }
}
