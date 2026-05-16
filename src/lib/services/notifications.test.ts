import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendNotification } from "./notifications";

test("notification dispatch requires the global email toggle", () => {
  assert.equal(
    shouldSendNotification(
      { emailEnabled: false, importFailures: true },
      "import_failure"
    ),
    false
  );
  assert.equal(
    shouldSendNotification(
      { emailEnabled: true, importFailures: true },
      "import_failure"
    ),
    true
  );
});

test("notification dispatch respects per-kind toggles", () => {
  assert.equal(
    shouldSendNotification(
      { emailEnabled: true, taskAssignments: false },
      "task_assignment"
    ),
    false
  );
  assert.equal(
    shouldSendNotification({ emailEnabled: true, slaBreaches: true }, "sla_breach"),
    true
  );
});

test("daily digest stays opt-in by default", () => {
  assert.equal(shouldSendNotification({ emailEnabled: true }, "daily_digest"), false);
  assert.equal(
    shouldSendNotification({ emailEnabled: true, dailyDigest: true }, "daily_digest"),
    true
  );
});
