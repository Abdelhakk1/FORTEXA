import "server-only";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

const buckets = new Map<string, RateLimitBucket>();

function cleanup(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(input: RateLimitInput) {
  const now = input.now ?? Date.now();
  cleanup(now);

  const existing = buckets.get(input.key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, { count: 1, resetAt });
    return { allowed: true, remaining: input.limit - 1, resetAt };
  }

  if (existing.count >= input.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(input.limit - existing.count, 0),
    resetAt: existing.resetAt,
  };
}

export function getRateLimitRetryAfterSeconds(resetAt: number, now = Date.now()) {
  return Math.max(Math.ceil((resetAt - now) / 1000), 1);
}

export function resetRateLimitForTests() {
  buckets.clear();
}
