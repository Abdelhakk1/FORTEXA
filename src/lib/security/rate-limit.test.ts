import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRateLimit,
  getRateLimitRetryAfterSeconds,
  resetRateLimitForTests,
} from "./rate-limit";

test("rate limiter blocks after the configured window quota", () => {
  resetRateLimitForTests();

  assert.equal(
    checkRateLimit({ key: "invite:test", limit: 2, windowMs: 1000, now: 0 })
      .allowed,
    true
  );
  assert.equal(
    checkRateLimit({ key: "invite:test", limit: 2, windowMs: 1000, now: 100 })
      .allowed,
    true
  );
  assert.equal(
    checkRateLimit({ key: "invite:test", limit: 2, windowMs: 1000, now: 200 })
      .allowed,
    false
  );
});

test("rate limiter resets after the window expires", () => {
  resetRateLimitForTests();

  assert.equal(
    checkRateLimit({ key: "live:test", limit: 1, windowMs: 1000, now: 0 })
      .allowed,
    true
  );
  assert.equal(
    checkRateLimit({ key: "live:test", limit: 1, windowMs: 1000, now: 100 })
      .allowed,
    false
  );
  assert.equal(
    checkRateLimit({ key: "live:test", limit: 1, windowMs: 1000, now: 1001 })
      .allowed,
    true
  );
});

test("retry-after is rounded up and never below one second", () => {
  assert.equal(getRateLimitRetryAfterSeconds(1500, 1000), 1);
  assert.equal(getRateLimitRetryAfterSeconds(2500, 1000), 2);
  assert.equal(getRateLimitRetryAfterSeconds(500, 1000), 1);
});
