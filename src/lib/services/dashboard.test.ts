import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardExposureTrend,
  buildDashboardRemediationTrend,
  emptyDashboardSummaryData,
  type DashboardScanTrendRow,
} from "./dashboard";

test("empty dashboard data has zero totals and no invented history", () => {
  const summary = emptyDashboardSummaryData();

  assert.equal(summary.hasOperationalData, false);
  assert.deepEqual(summary.exposureTrend, []);
  assert.deepEqual(summary.remediationTrend, []);
  assert.ok(Object.values(summary.totals).every((value) => value === 0));
});

test("scan history keeps the latest six imports in chronological order", () => {
  const rows: DashboardScanTrendRow[] = Array.from(
    { length: 7 },
    (_, index) => ({
      id: `scan-${index + 1}`,
      name: `Nessus scan ${index + 1}`,
      importDate: `2026-0${index + 1}-10T08:00:00.000Z`,
      critical: String(index + 1),
      high: index + 2,
      medium: index + 3,
      low: index + 4,
      newFindings: index + 5,
      fixedFindings: index + 6,
      reopenedFindings: index + 7,
    })
  ).reverse();

  const trend = buildDashboardExposureTrend(rows);

  assert.equal(trend.length, 6);
  assert.equal(trend[0]?.scanId, "scan-2");
  assert.equal(trend[5]?.scanId, "scan-7");
  assert.deepEqual(trend[5], {
    scanId: "scan-7",
    scanName: "Nessus scan 7",
    scanDate: "2026-07-10T08:00:00.000Z",
    month: "Jul 10",
    critical: 7,
    high: 8,
    medium: 9,
    low: 10,
    newFindings: 11,
    fixedFindings: 12,
    reopenedFindings: 13,
  });
});

test("remediation history fills missing months without inventing activity", () => {
  const trend = buildDashboardRemediationTrend(
    [
      {
        periodStart: "2026-03-01T00:00:00.000Z",
        opened: 5,
        closed: 2,
        overdue: 1,
      },
      {
        periodStart: "2026-05-01T00:00:00.000Z",
        opened: 3,
        closed: 4,
        overdue: 0,
      },
    ],
    new Date("2026-07-10T00:00:00.000Z")
  );

  assert.equal(trend.length, 6);
  assert.deepEqual(trend[1], {
    periodStart: "2026-03-01",
    month: "Mar",
    opened: 5,
    closed: 2,
    overdue: 1,
  });
  assert.deepEqual(trend[2], {
    periodStart: "2026-04-01",
    month: "Apr",
    opened: 0,
    closed: 0,
    overdue: 0,
  });
});
