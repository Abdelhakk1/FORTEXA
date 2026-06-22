import assert from "node:assert/strict";
import test from "node:test";
import { getAiBudgetLimits } from "./ai-budget";

test("AI budget defaults expose hard caps for automatic and daily generation", () => {
  const limits = getAiBudgetLimits();

  assert.equal(Number.isInteger(limits.dailyRequestLimit), true);
  assert.equal(Number.isInteger(limits.automaticImportCveLimit), true);
  assert.equal(Number.isInteger(limits.automaticImportPlaybookLimit), true);
  assert.ok(limits.dailyRequestLimit >= limits.automaticImportCveLimit);
  assert.ok(limits.dailyRequestLimit >= limits.automaticImportPlaybookLimit);
});
