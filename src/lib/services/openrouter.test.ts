import assert from "node:assert/strict";
import test from "node:test";
import { UnexpectedClientError } from "@openrouter/sdk/models/errors";
import { z } from "zod";
import {
  assetVulnerabilityPlaybookResponseSchema,
  LocalOpenRouterTimeoutError,
  normalizeOpenRouterFailure,
  parseStructuredAssistantText,
  unwrapStructuredProviderObject,
} from "./openrouter";

test("timeout normalization preserves the real timeout failure", () => {
  const failure = normalizeOpenRouterFailure(
    new UnexpectedClientError("Unexpected HTTP client error", {
      cause: new LocalOpenRouterTimeoutError(30_000),
    }),
    "inclusionai/ling-2.6-flash:free"
  );

  assert.equal(failure.type, "timeout");
  assert.equal(failure.model, "inclusionai/ling-2.6-flash:free");
  assert.equal(failure.retryable, true);
  assert.match(failure.message, /timed out/i);
});

test("malformed provider output is classified as malformed json", () => {
  const parsed = parseStructuredAssistantText({
    text: "```json\nnot-json\n```",
    validator: z.object({
      ok: z.boolean(),
    }),
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: "inclusionai/ling-2.6-flash:free",
  });

  assert.equal(parsed.ok, false);

  if (parsed.ok) {
    throw new Error("Expected malformed JSON parsing to fail.");
  }

  assert.equal(parsed.error.type, "malformed_json");
  assert.equal(parsed.error.message, "AI enrichment returned malformed playbook JSON.");
});

test("wrapped asset playbook output is safely normalized", () => {
  const parsed = parseStructuredAssistantText({
    text: JSON.stringify({
      playbook: {
        summary: "Patch the affected asset and validate exposure after the change.",
        technicalRationale: "",
        businessRationale: "",
        primaryMitigation: "Apply the vendor fix.",
        recommendedActions: ["Apply the vendor fix during the approved window."],
        validationSteps: ["Confirm the scanner no longer reports this CVE."],
        compensatingControls: [],
        rollbackCaution: null,
        maintenanceWindowNote: null,
        citations: [],
        confidence: 82,
        unsupportedClaims: [],
        trustLabels: ["scanner evidence"],
      },
    }),
    validator: assetVulnerabilityPlaybookResponseSchema,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: "inclusionai/ling-2.6-flash:free",
    normalizeParsedJson: unwrapStructuredProviderObject,
  });

  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.match(parsed.data.summary, /Patch the affected asset/);
  }
});

test("missing asset playbook summary fails with precise validation message", () => {
  const parsed = parseStructuredAssistantText({
    text: JSON.stringify({
      technicalRationale: "",
      businessRationale: "",
      primaryMitigation: "Apply the vendor fix.",
      recommendedActions: ["Apply the vendor fix during the approved window."],
      validationSteps: ["Confirm the scanner no longer reports this CVE."],
      compensatingControls: [],
      rollbackCaution: null,
      maintenanceWindowNote: null,
      citations: [],
      confidence: 82,
      unsupportedClaims: [],
      trustLabels: ["scanner evidence"],
    }),
    validator: assetVulnerabilityPlaybookResponseSchema,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: "inclusionai/ling-2.6-flash:free",
    normalizeParsedJson: unwrapStructuredProviderObject,
    missingFieldMessages: {
      summary: "summary is missing from provider output.",
    },
  });

  assert.equal(parsed.ok, false);

  if (parsed.ok) {
    throw new Error("Expected missing summary validation to fail.");
  }

  assert.equal(parsed.error.type, "schema_validation_failure");
  assert.equal(
    parsed.error.message,
    "AI playbook JSON failed validation: summary is missing from provider output."
  );
});
