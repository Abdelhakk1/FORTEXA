import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_DATA_OPTIONS,
  ONBOARDING_STEPS,
  REMEDIATION_POLICY_PRESET_MAP,
  normalizeOnboardingStep,
} from "./onboarding-flow";

test("Fortexa onboarding has four MVP steps", () => {
  assert.deepEqual(
    ONBOARDING_STEPS.map((step) => step.label),
    ["Workspace", "Environment", "Remediation policy", "First data"]
  );
});

test("dedicated ATM/GAB area and AI steps are removed", () => {
  const labels = ONBOARDING_STEPS.map((step) => step.label.toLowerCase());

  assert.equal(labels.some((label) => label.includes("atm/gab area")), false);
  assert.equal(labels.includes("ai"), false);
});

test("legacy onboarding step names map to the simplified flow", () => {
  assert.equal(normalizeOnboardingStep("organization"), "workspace");
  assert.equal(normalizeOnboardingStep("context"), "environment");
  assert.equal(normalizeOnboardingStep("site"), "environment");
  assert.equal(normalizeOnboardingStep("sla"), "remediation");
  assert.equal(normalizeOnboardingStep("ai"), "data");
});

test("remediation policy presets persist expected due-date defaults", () => {
  assert.deepEqual(REMEDIATION_POLICY_PRESET_MAP.standard.dueDays, {
    critical: 7,
    high: 14,
    medium: 30,
    low: 90,
  });
  assert.deepEqual(REMEDIATION_POLICY_PRESET_MAP.aggressive.dueDays, {
    critical: 3,
    high: 7,
    medium: 21,
    low: 60,
  });
  assert.deepEqual(REMEDIATION_POLICY_PRESET_MAP.conservative.dueDays, {
    critical: 14,
    high: 30,
    medium: 60,
    low: 120,
  });
});

test("first data choices route to the expected product surfaces", () => {
  const routes = Object.fromEntries(
    FIRST_DATA_OPTIONS.map((option) => [option.value, option.href])
  );

  assert.equal(routes.nessus_upload, "/scan-import");
  assert.equal(routes.sample_data, "/dashboard");
  assert.equal(routes.csv_assets, "/assets");
  assert.equal(routes.skip, "/dashboard");
});
