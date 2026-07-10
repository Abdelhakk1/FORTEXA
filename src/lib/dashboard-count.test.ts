import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDashboardCount,
  formatDashboardTooltip,
} from "./dashboard-count";

test("dashboard counts stay exact below 1000", () => {
  assert.deepEqual(formatDashboardCount(243), {
    display: "243",
    exact: "243",
  });
  assert.equal(formatDashboardCount(999).display, "999");
});

test("dashboard counts use compact notation from 1000 upward", () => {
  assert.equal(formatDashboardCount(1_000).display, "1K");
  assert.equal(formatDashboardCount(1_200).display, "1.2K");
  assert.equal(formatDashboardCount(12_700).display, "12.7K");
});

test("dashboard tooltips always contain exact localized values", () => {
  const tooltip = formatDashboardTooltip("April 10, 2026", [
    { seriesName: "Critical", value: 12_700 },
    { seriesName: "New", value: 243 },
  ]);

  assert.match(tooltip, /Critical: 12,700/);
  assert.match(tooltip, /New: 243/);
  assert.doesNotMatch(tooltip, /12\.7K/);
});
