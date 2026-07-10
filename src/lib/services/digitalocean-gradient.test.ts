import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
  normalizeBaseUrlEnv,
} from "@/lib/env/server";
import {
  assetVulnerabilityPlaybookResponseSchema,
  buildDigitalOceanGradientRequestPayload,
  DigitalOceanGradientHttpError,
  LocalDigitalOceanGradientTimeoutError,
  normalizeAssetVulnerabilityPlaybookJson,
  normalizeDigitalOceanGradientFailure,
  parseStructuredAssistantText,
  unwrapStructuredProviderObject,
} from "./digitalocean-gradient";

test("default DigitalOcean Gradient model uses the accessible serverless model", () => {
  assert.equal(DEFAULT_DIGITALOCEAN_GRADIENT_MODEL, "deepseek-4-flash");
});

test("DigitalOcean base URL preserves the required API version path", () => {
  assert.equal(
    normalizeBaseUrlEnv("https://inference.do-ai.run/v1"),
    "https://inference.do-ai.run/v1"
  );
});

test("DigitalOcean Gradient request shape uses the Responses API model payload", () => {
  const payload = buildDigitalOceanGradientRequestPayload({
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
    schemaName: "fortexa_test",
    schema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
      additionalProperties: false,
    },
    prompt: "Return a test response.",
    maxCompletionTokens: 100,
  });

  assert.equal(payload.model, "deepseek-4-flash");
  assert.equal(payload.max_output_tokens, 100);
  assert.equal(payload.text.format.type, "json_schema");
  assert.equal(payload.text.format.name, "fortexa_test");
  assert.equal(payload.input[0]?.role, "system");
  assert.equal(payload.input[1]?.role, "user");
});

test("timeout normalization preserves the real timeout failure", () => {
  const failure = normalizeDigitalOceanGradientFailure(
    new LocalDigitalOceanGradientTimeoutError(30_000),
    DEFAULT_DIGITALOCEAN_GRADIENT_MODEL
  );

  assert.equal(failure.type, "timeout");
  assert.equal(failure.model, DEFAULT_DIGITALOCEAN_GRADIENT_MODEL);
  assert.equal(failure.retryable, true);
  assert.match(failure.message, /timed out/i);
});

test("DigitalOcean maintenance HTML is retryable provider unavailability", () => {
  const failure = normalizeDigitalOceanGradientFailure(
    new DigitalOceanGradientHttpError(
      400,
      '<!DOCTYPE html><html><head><title>DigitalOcean - Maintenance</title></head></html>'
    ),
    DEFAULT_DIGITALOCEAN_GRADIENT_MODEL
  );

  assert.equal(failure.type, "provider_error");
  assert.equal(failure.resultCode, "service_unavailable");
  assert.equal(failure.retryable, true);
  assert.match(failure.message, /maintenance/i);
});

test("provider overload is retryable without exposing the raw provider body", () => {
  const failure = normalizeDigitalOceanGradientFailure(
    new DigitalOceanGradientHttpError(
      429,
      "Platform overloaded. Internal capacity pool do-fra1-007 exhausted."
    ),
    DEFAULT_DIGITALOCEAN_GRADIENT_MODEL
  );

  assert.equal(failure.type, "rate_limited");
  assert.equal(failure.resultCode, "service_unavailable");
  assert.equal(failure.retryable, true);
  assert.match(failure.message, /temporarily busy/i);
  assert.doesNotMatch(failure.message, /capacity pool|do-fra1-007|platform overloaded/i);
});

test("malformed provider output is classified as malformed json", () => {
  const parsed = parseStructuredAssistantText({
    text: "```json\nnot-json\n```",
    validator: z.object({
      ok: z.boolean(),
    }),
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
  });

  assert.equal(parsed.ok, false);

  if (parsed.ok) {
    throw new Error("Expected malformed JSON parsing to fail.");
  }

  assert.equal(parsed.error.type, "malformed_json");
  assert.equal(parsed.error.message, "AI enrichment returned malformed playbook JSON.");
});

test("structured output parser accepts leading JSON with trailing provider text", () => {
  const parsed = parseStructuredAssistantText({
    text: '{"ok":true}\n\nAdditional provider text that should be ignored.',
    validator: z.object({
      ok: z.boolean(),
    }),
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
  });

  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.equal(parsed.data.ok, true);
  }
});

test("empty provider output is classified as an empty structured response", () => {
  const parsed = parseStructuredAssistantText({
    text: "   ",
    validator: z.object({
      ok: z.boolean(),
    }),
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
  });

  assert.equal(parsed.ok, false);

  if (parsed.ok) {
    throw new Error("Expected empty output parsing to fail.");
  }

  assert.equal(parsed.error.type, "empty_body");
  assert.match(parsed.error.message, /empty structured response/i);
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
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
    normalizeParsedJson: unwrapStructuredProviderObject,
  });

  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.match(parsed.data.summary, /Patch the affected asset/);
  }
});

test("missing optional asset playbook fields are safely defaulted", () => {
  const parsed = parseStructuredAssistantText({
    text: JSON.stringify({
      summary: "Patch the exposed ATM service and verify the scanner finding clears.",
      recommendedActions: [
        "Schedule an approved change window and confirm backups before patching.",
      ],
      confidence: "73",
    }),
    validator: assetVulnerabilityPlaybookResponseSchema,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
    normalizeParsedJson: normalizeAssetVulnerabilityPlaybookJson,
  });

  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.equal(parsed.data.technicalRationale, "");
    assert.equal(parsed.data.primaryMitigation, null);
    assert.deepEqual(parsed.data.validationSteps, []);
    assert.equal(parsed.data.confidence, 73);
  }
});

test("multi-evidence playbook citations are normalized without breaking validation", () => {
  const parsed = parseStructuredAssistantText({
    text: JSON.stringify({
      summary: "Patch the ATM controller finding and confirm all scanner evidence clears.",
      recommendedActions: [
        { step: "Prepare", description: "Confirm the affected host and change window." },
        { step: "Patch", description: "Apply the vendor-supported fix." },
      ],
      validationSteps: [
        { step: "Rescan", description: "Confirm E1 and E2 are no longer reported." },
      ],
      citations: [
        { id: "E1", label: "Nessus plugin output", kind: "scanner_evidence" },
        { id: "E2", label: "Second scanner observation" },
        "S1",
      ],
      confidence: 81,
    }),
    validator: assetVulnerabilityPlaybookResponseSchema,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
    normalizeParsedJson: normalizeAssetVulnerabilityPlaybookJson,
  });

  assert.equal(parsed.ok, true);

  if (parsed.ok) {
    assert.equal(parsed.data.citations.length, 3);
    assert.deepEqual(
      parsed.data.citations.map((citation) => citation.kind),
      ["scanner_evidence", "scanner_evidence", "source_reference"]
    );
    assert.match(parsed.data.recommendedActions[0], /Prepare/);
  }
});

test("missing asset playbook summary preserves safe partial output when actions exist", () => {
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
    model: DEFAULT_DIGITALOCEAN_GRADIENT_MODEL,
    normalizeParsedJson: normalizeAssetVulnerabilityPlaybookJson,
    missingFieldMessages: {
      summary: "summary is missing from provider output.",
    },
  });

  assert.equal(parsed.ok, true);

  if (!parsed.ok) {
    throw new Error("Expected missing summary to be normalized with a safe fallback.");
  }

  assert.match(parsed.data.summary, /omitted a summary/);
  assert.ok(
    parsed.data.unsupportedClaims.some((claim) => /omitted the required summary/i.test(claim))
  );
});
