import assert from "node:assert/strict";
import test from "node:test";
import {
  getLiveScope,
  shouldRefreshForLiveToken,
} from "./live-refresh-logic";

test("live scope follows protected route families", () => {
  assert.equal(getLiveScope("/assets/123"), "assets");
  assert.equal(getLiveScope("/vulnerabilities/123"), "vulnerabilities");
  assert.equal(getLiveScope("/remediation"), "remediation");
  assert.equal(getLiveScope("/dashboard"), "dashboard");
});

test("unchanged live token never refreshes", () => {
  assert.equal(
    shouldRefreshForLiveToken({
      previousToken: "a",
      nextToken: "a",
      now: 30_000,
      lastRefreshAt: 0,
      refreshCooldownMs: 20_000,
    }),
    false
  );
});

test("changed live token refreshes only after cooldown", () => {
  assert.equal(
    shouldRefreshForLiveToken({
      previousToken: "a",
      nextToken: "b",
      now: 10_000,
      lastRefreshAt: 0,
      refreshCooldownMs: 20_000,
    }),
    false
  );
  assert.equal(
    shouldRefreshForLiveToken({
      previousToken: "a",
      nextToken: "b",
      now: 21_000,
      lastRefreshAt: 0,
      refreshCooldownMs: 20_000,
    }),
    true
  );
});
