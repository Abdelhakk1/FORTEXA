import assert from "node:assert/strict";
import test from "node:test";
import { computeTaskSlaStatus } from "./remediation";

test("remediation SLA status marks past due open tasks as overdue", () => {
  assert.equal(
    computeTaskSlaStatus({
      dueDate: new Date(Date.now() - 60_000),
      status: "open",
    }),
    "overdue"
  );
});

test("remediation SLA status ignores closed or mitigated tasks", () => {
  const pastDue = new Date(Date.now() - 60_000);

  assert.equal(
    computeTaskSlaStatus({ dueDate: pastDue, status: "closed" }),
    "on_track"
  );
  assert.equal(
    computeTaskSlaStatus({ dueDate: pastDue, status: "mitigated" }),
    "on_track"
  );
});

test("remediation SLA status marks near due tasks as at risk", () => {
  assert.equal(
    computeTaskSlaStatus({
      dueDate: new Date(Date.now() + 60 * 60 * 1000),
      status: "assigned",
    }),
    "at_risk"
  );
});
