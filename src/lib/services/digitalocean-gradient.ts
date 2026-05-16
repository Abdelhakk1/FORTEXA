import "server-only";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult, type ResultCode } from "@/lib/errors";

export const DIGITALOCEAN_GRADIENT_PROVIDER = "digitalocean_gradient";
const DIGITALOCEAN_GRADIENT_TIMEOUT_MS =
  serverEnv.digitalOceanGradientTimeoutMs;
const DIGITALOCEAN_GRADIENT_FALLBACK_MODELS = [
  "openai-gpt-oss-120b",
  "openai-gpt-oss-20b",
  "minimax-m2.5",
] as const;
type DigitalOceanGradientCredential =
  (typeof serverEnv.digitalOceanGradientCredentialCandidates)[number];

export class LocalDigitalOceanGradientTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`DigitalOcean Gradient API request exceeded ${timeoutMs}ms.`);
    this.name = "LocalDigitalOceanGradientTimeoutError";
  }
}

export class DigitalOceanGradientHttpError extends Error {
  constructor(
    readonly status: number,
    readonly bodyMessage: string | null
  ) {
    super(bodyMessage ?? `DigitalOcean Gradient API request failed with HTTP ${status}.`);
    this.name = "DigitalOceanGradientHttpError";
  }
}

export type DigitalOceanGradientFailureType =
  | "auth_failure"
  | "rate_limited"
  | "timeout"
  | "connection_failure"
  | "provider_error"
  | "request_rejected"
  | "empty_body"
  | "malformed_json"
  | "schema_validation_failure"
  | "unexpected_provider_error";

export type StructuredProviderSuccess<T> = {
  ok: true;
  data: T;
  model: string;
  provider: typeof DIGITALOCEAN_GRADIENT_PROVIDER;
};

export type NormalizedDigitalOceanGradientError = {
  type: DigitalOceanGradientFailureType;
  message: string;
  status: number | null;
  provider: typeof DIGITALOCEAN_GRADIENT_PROVIDER;
  model: string;
  retryable: boolean;
  resultCode: ResultCode;
};

export type StructuredProviderFailure = {
  ok: false;
  code: ResultCode;
  message: string;
  error: NormalizedDigitalOceanGradientError;
};

type StructuredProviderResult<T> =
  | StructuredProviderSuccess<T>
  | StructuredProviderFailure;

type DigitalOceanGradientResponse = {
  model?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: unknown;
      content?: unknown;
      type?: string;
    }>;
  }>;
  choices?: Array<{
    message?: {
      content?: unknown;
      refusal?: unknown;
    };
    delta?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export const cveEnrichmentResponseSchema = z.object({
  summary: z.string().trim().min(20).max(500),
  riskExplanation: z.string().trim().min(20).max(900),
  impactAnalysis: z.string().trim().min(20).max(900),
  exploitConditions: z.string().trim().min(10).max(900),
  remediationGuidance: z.string().trim().min(20).max(1500),
  recommendedControls: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(120),
        description: z.string().trim().min(8).max(500),
        command: z.string().trim().max(500).nullable().optional(),
      })
    )
    .max(5),
  citations: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(2).max(160),
      })
    )
    .max(8),
  confidence: z.number().int().min(0).max(100),
  unsupportedClaims: z.array(z.string().trim().min(5).max(300)).max(5),
  trustLabels: z.array(z.string().trim().min(2).max(80)).max(6),
  tags: z.array(z.string().trim().min(1).max(40)).max(8),
});

export type StructuredCveEnrichment = z.infer<
  typeof cveEnrichmentResponseSchema
>;

const cveEnrichmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "riskExplanation",
    "impactAnalysis",
    "exploitConditions",
    "remediationGuidance",
    "recommendedControls",
    "citations",
    "confidence",
    "unsupportedClaims",
    "trustLabels",
    "tags",
  ],
  properties: {
    summary: { type: "string" },
    riskExplanation: { type: "string" },
    impactAnalysis: { type: "string" },
    exploitConditions: { type: "string" },
    remediationGuidance: { type: "string" },
    recommendedControls: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          command: { type: ["string", "null"] },
        },
      },
    },
    citations: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
        },
      },
    },
    confidence: { type: "integer" },
    unsupportedClaims: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    trustLabels: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    tags: {
      type: "array",
      maxItems: 8,
      items: { type: "string" },
    },
  },
} as const;

export const assetVulnerabilityPlaybookResponseSchema = z.object({
  summary: z.string().trim().min(12).max(420),
  technicalRationale: z.string().trim().max(900).default(""),
  businessRationale: z.string().trim().max(900).default(""),
  primaryMitigation: z.string().trim().max(360).nullable().default(null),
  recommendedActions: z
    .array(z.string().trim().min(8).max(360))
    .min(1)
    .max(6),
  validationSteps: z.array(z.string().trim().min(8).max(360)).max(5).default([]),
  compensatingControls: z
    .array(z.string().trim().min(8).max(360))
    .max(4)
    .default([]),
  rollbackCaution: z.string().trim().max(360).nullable().default(null),
  maintenanceWindowNote: z.string().trim().max(360).nullable().default(null),
  citations: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(2).max(120),
        kind: z.enum(["source_reference", "scanner_evidence"]),
      })
    )
    .max(6)
    .default([]),
  confidence: z.number().int().min(0).max(100),
  unsupportedClaims: z
    .array(z.string().trim().min(5).max(320))
    .max(6)
    .default([]),
  trustLabels: z.array(z.string().trim().min(2).max(60)).max(6).default([]),
});

export type AssetVulnerabilityPlaybook = z.infer<
  typeof assetVulnerabilityPlaybookResponseSchema
>;

const assetVulnerabilityPlaybookJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "technicalRationale",
    "businessRationale",
    "primaryMitigation",
    "recommendedActions",
    "validationSteps",
    "compensatingControls",
    "rollbackCaution",
    "maintenanceWindowNote",
    "citations",
    "confidence",
    "unsupportedClaims",
    "trustLabels",
  ],
  properties: {
    summary: { type: "string" },
    technicalRationale: { type: "string" },
    businessRationale: { type: "string" },
    primaryMitigation: { type: ["string", "null"] },
    recommendedActions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string" },
    },
    validationSteps: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    compensatingControls: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
    rollbackCaution: { type: ["string", "null"] },
    maintenanceWindowNote: { type: ["string", "null"] },
    citations: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "kind"],
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          kind: {
            type: "string",
            enum: ["source_reference", "scanner_evidence"],
          },
        },
      },
    },
    confidence: { type: "integer" },
    unsupportedClaims: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    trustLabels: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
  },
} as const;

function truncate(value: string, max = 240) {
  return value.trim().slice(0, max);
}

function isMissingFieldIssue(issue: z.ZodIssue) {
  return (
    issue.code === "invalid_type" &&
    issue.message.toLowerCase().includes("undefined")
  );
}

function formatZodError(
  error: z.ZodError,
  missingFieldMessages: Record<string, string> = {}
) {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      const missingFieldMessage = missingFieldMessages[path];

      if (missingFieldMessage && isMissingFieldIssue(issue)) {
        return missingFieldMessage;
      }

      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function estimateTokenCount(value: string | number) {
  const chars = typeof value === "number" ? value : value.length;
  return Math.ceil(chars / 4);
}

export function normalizeStructuredJsonText(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf("{");

  if (objectStart >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = objectStart; index < trimmed.length; index += 1) {
      const char = trimmed[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = inString;
        continue;
      }

      if (char === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;

        if (depth === 0) {
          return trimmed.slice(objectStart, index + 1).trim();
        }
      }
    }
  }

  return trimmed;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function unwrapStructuredProviderObject(value: unknown) {
  const wrapperKeys = ["playbook", "enrichment", "data", "result", "output"];
  let current = value;

  for (let depth = 0; depth < 3; depth += 1) {
    if (!isPlainRecord(current) || "summary" in current) {
      return current;
    }

    let wrapperKey: string | null = null;

    for (const key of wrapperKeys) {
      if (isPlainRecord(current[key])) {
        wrapperKey = key;
        break;
      }
    }

    if (!wrapperKey) {
      return current;
    }

    current = current[wrapperKey];
  }

  return current;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

function cleanNullableText(value: unknown, max: number) {
  if (value === null) {
    return null;
  }

  return cleanText(value, max);
}

function textFromUnknown(value: unknown, max: number) {
  const direct = cleanText(value, max);
  if (direct) {
    return direct;
  }

  if (!isPlainRecord(value)) {
    return null;
  }

  const fields = ["text", "description", "action", "step", "title", "label", "value"];
  const parts = fields
    .map((field) => cleanText(value[field], max))
    .filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(": ").slice(0, max) : null;
}

function stringListFromUnknown(value: unknown, maxItems: number, maxChars: number) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set<string>();
  const items: string[] = [];

  for (const entry of values) {
    const text = textFromUnknown(entry, maxChars);

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    items.push(text);

    if (items.length >= maxItems) {
      break;
    }
  }

  return items;
}

function citationKindFromUnknown(value: unknown, id: string) {
  if (value === "source_reference" || value === "scanner_evidence") {
    return value;
  }

  if (/^E\d+$/i.test(id)) {
    return "scanner_evidence" as const;
  }

  if (/^S\d+$/i.test(id)) {
    return "source_reference" as const;
  }

  return null;
}

function citationsFromUnknown(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  const citations: Array<{
    id: string;
    label: string;
    kind: "source_reference" | "scanner_evidence";
  }> = [];

  for (const entry of values) {
    const record = isPlainRecord(entry) ? entry : null;
    const id = textFromUnknown(
      record?.id ?? record?.sourceId ?? record?.evidenceId ?? entry,
      80
    );

    if (!id) {
      continue;
    }

    const kind = citationKindFromUnknown(record?.kind, id);
    if (!kind) {
      continue;
    }

    citations.push({
      id,
      label: textFromUnknown(record?.label ?? record?.title ?? id, 120) ?? id,
      kind,
    });

    if (citations.length >= 6) {
      break;
    }
  }

  return citations;
}

function confidenceFromUnknown(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

export function normalizeAssetVulnerabilityPlaybookJson(value: unknown) {
  const unwrapped = unwrapStructuredProviderObject(value);

  if (!isPlainRecord(unwrapped)) {
    return unwrapped;
  }

  const recommendedActions = stringListFromUnknown(
    unwrapped.recommendedActions ??
      unwrapped.remediationSteps ??
      unwrapped.actions ??
      unwrapped.steps,
    6,
    360
  );
  const summary = cleanText(unwrapped.summary, 420);
  const unsupportedClaims = stringListFromUnknown(
    unwrapped.unsupportedClaims,
    6,
    320
  );
  const trustLabels = stringListFromUnknown(unwrapped.trustLabels, 6, 60);
  const usedFallbackSummary = !summary && recommendedActions.length > 0;

  return {
    summary:
      summary ??
      (usedFallbackSummary
        ? "AI playbook output omitted a summary; review the validated remediation steps against scanner evidence before action."
        : undefined),
    technicalRationale:
      cleanText(unwrapped.technicalRationale ?? unwrapped.technicalContext, 900) ??
      "",
    businessRationale:
      cleanText(
        unwrapped.businessRationale ??
          unwrapped.businessImpact ??
          unwrapped.riskIfIgnored,
        900
      ) ?? "",
    primaryMitigation: cleanNullableText(
      unwrapped.primaryMitigation ?? unwrapped.mitigation,
      360
    ),
    recommendedActions,
    validationSteps: stringListFromUnknown(
      unwrapped.validationSteps ?? unwrapped.verificationSteps,
      5,
      360
    ),
    compensatingControls: stringListFromUnknown(
      unwrapped.compensatingControls,
      4,
      360
    ),
    rollbackCaution: cleanNullableText(
      unwrapped.rollbackCaution ?? unwrapped.rollback,
      360
    ),
    maintenanceWindowNote: cleanNullableText(
      unwrapped.maintenanceWindowNote ?? unwrapped.changeWindow,
      360
    ),
    citations: citationsFromUnknown(unwrapped.citations),
    confidence: confidenceFromUnknown(unwrapped.confidence),
    unsupportedClaims: usedFallbackSummary
      ? [
          ...unsupportedClaims,
          "Provider omitted the required summary; Fortexa preserved validated partial playbook sections.",
        ].slice(0, 6)
      : unsupportedClaims,
    trustLabels: usedFallbackSummary
      ? [...trustLabels, "partial provider output"].slice(0, 6)
      : trustLabels,
  };
}

function extractTextPart(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("content" in value && typeof value.content === "string") {
      return value.content;
    }
  }

  return "";
}

function extractAssistantPayload(result: DigitalOceanGradientResponse) {
  if (typeof result.output_text === "string" && result.output_text.trim()) {
    return {
      text: normalizeStructuredJsonText(result.output_text),
      refusal: null,
    };
  }

  const responseOutputText =
    result.output
      ?.flatMap((output) => output.content ?? [])
      .map(extractTextPart)
      .join("") ?? "";

  if (responseOutputText.trim()) {
    return {
      text: normalizeStructuredJsonText(responseOutputText),
      refusal: null,
    };
  }

  const choice = result.choices?.[0];
  const message = choice?.message;
  const content = message?.content ?? choice?.delta?.content;
  let text = "";

  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    text = content.map(extractTextPart).join("");
  } else if (content && typeof content === "object") {
    text = extractTextPart(content);
  }

  return {
    text: normalizeStructuredJsonText(text),
    refusal:
      typeof message?.refusal === "string" ? truncate(message.refusal, 180) : null,
  };
}

function createModelAttemptList(primaryModel: string) {
  const models = [primaryModel.trim()].filter(Boolean);

  for (const fallbackModel of DIGITALOCEAN_GRADIENT_FALLBACK_MODELS) {
    if (!models.includes(fallbackModel)) {
      models.push(fallbackModel);
    }
  }

  return models;
}

function findErrorInChain(
  error: unknown,
  predicate: (value: Error) => boolean
): Error | null {
  const seen = new Set<Error>();
  let current = error;

  while (current instanceof Error && !seen.has(current)) {
    if (predicate(current)) {
      return current;
    }

    seen.add(current);
    current =
      "cause" in current
        ? (current as Error & { cause?: unknown }).cause
        : undefined;
  }

  return null;
}

function logDigitalOceanGradientDiagnostic(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown> & { model: string }
) {
  const { model, ...rest } = details;

  console[level]("[digitalocean-gradient-ai]", {
    event,
    provider: DIGITALOCEAN_GRADIENT_PROVIDER,
    model,
    hasApiKey: Boolean(serverEnv.digitalOceanGradientApiKey),
    timeoutMs: DIGITALOCEAN_GRADIENT_TIMEOUT_MS,
    ...rest,
  });
}

function buildNormalizedError(input: {
  type: DigitalOceanGradientFailureType;
  message: string;
  status: number | null;
  model: string;
  retryable: boolean;
  resultCode: ResultCode;
}): NormalizedDigitalOceanGradientError {
  return {
    type: input.type,
    message: input.message,
    status: input.status,
    provider: DIGITALOCEAN_GRADIENT_PROVIDER,
    model: input.model,
    retryable: input.retryable,
    resultCode: input.resultCode,
  };
}

function isProviderMaintenanceBody(value: string | null) {
  return Boolean(
    value &&
      /digitalocean\s*-\s*maintenance|maintenance|<!doctype\s+html|<html[\s>]/i.test(
        value
      )
  );
}

export function normalizeDigitalOceanGradientFailure(
  error: unknown,
  model: string
): NormalizedDigitalOceanGradientError {
  if (
    error instanceof LocalDigitalOceanGradientTimeoutError ||
    findErrorInChain(error, (value) => value instanceof LocalDigitalOceanGradientTimeoutError)
  ) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "timeout",
      message:
        "DigitalOcean Gradient API timed out while generating AI enrichment. Retry AI in a moment.",
      status: null,
      model,
      retryable: true,
    });
  }

  if (error instanceof DigitalOceanGradientHttpError) {
    const status = error.status;

    if (isProviderMaintenanceBody(error.bodyMessage)) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "provider_error",
        message: `DigitalOcean Gradient API was unavailable. ${error.bodyMessage ?? "Retry AI in a moment."}`,
        status,
        model,
        retryable: true,
      });
    }

    if (status === 401 || status === 403) {
      if (
        error.bodyMessage &&
        /not available|subscription tier|model/i.test(error.bodyMessage)
      ) {
        return buildNormalizedError({
          resultCode: "service_unavailable",
          type: "request_rejected",
          message: `DigitalOcean Gradient model ${model} is not available for this subscription or credential. ${error.bodyMessage}`,
          status,
          model,
          retryable: true,
        });
      }

      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "auth_failure",
        message:
          "DigitalOcean Gradient API authentication or authorization failed. Check that DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY is authorized for Serverless Inference, or provide DIGITALOCEAN_TOKEN as a fallback.",
        status,
        model,
        retryable: true,
      });
    }

    if (status === 408 || status === 504 || status === 524) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "timeout",
        message:
          "DigitalOcean Gradient API timed out while generating AI enrichment. Retry AI in a moment.",
        status,
        model,
        retryable: true,
      });
    }

    if (status === 429 || status === 529) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "rate_limited",
        message: `DigitalOcean Gradient API rate limited the request. ${error.bodyMessage ?? "Retry AI in a moment."}`,
        status,
        model,
        retryable: true,
      });
    }

    if (status >= 500) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "provider_error",
        message: `DigitalOcean Gradient API was unavailable. ${error.bodyMessage ?? "Retry AI in a moment."}`,
        status,
        model,
        retryable: true,
      });
    }

    return buildNormalizedError({
      resultCode: "server_error",
      type: "request_rejected",
      message: `DigitalOcean Gradient API rejected the request for ${model}. ${error.bodyMessage ?? "Check the model configuration and request payload."}`,
      status,
      model,
      retryable: false,
    });
  }

  if (
    error instanceof TypeError ||
    (error instanceof Error && /fetch|network|abort/i.test(error.message))
  ) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "connection_failure",
      message:
        "DigitalOcean Gradient API could not be reached from this server runtime. Check connectivity and retry AI.",
      status: null,
      model,
      retryable: true,
    });
  }

  return buildNormalizedError({
    resultCode: "service_unavailable",
    type: "unexpected_provider_error",
    message:
      "DigitalOcean Gradient API failed unexpectedly while generating AI enrichment.",
    status: null,
    model,
    retryable: true,
  });
}

function shouldTryFallback(
  failure: NormalizedDigitalOceanGradientError,
  attemptIndex: number,
  attemptCount: number
) {
  return failure.retryable && attemptIndex < attemptCount - 1;
}

function digitalOceanGradientResponsesUrl() {
  const baseUrl = serverEnv.digitalOceanGradientBaseUrl.endsWith("/")
    ? serverEnv.digitalOceanGradientBaseUrl
    : `${serverEnv.digitalOceanGradientBaseUrl}/`;
  return new URL("responses", baseUrl).toString();
}

function digitalOceanGradientChatCompletionsUrl() {
  const baseUrl = serverEnv.digitalOceanGradientBaseUrl.endsWith("/")
    ? serverEnv.digitalOceanGradientBaseUrl
    : `${serverEnv.digitalOceanGradientBaseUrl}/`;
  return new URL("chat/completions", baseUrl).toString();
}

function responseMessageFromBody(value: unknown) {
  if (!isPlainRecord(value)) {
    return null;
  }

  const error = isPlainRecord(value.error) ? value.error : null;
  return cleanText(error?.message ?? value.message, 240);
}

async function parseResponseBody(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    return { rawText: "", parsedJson: null, message: null };
  }

  try {
    const parsedJson = JSON.parse(text) as unknown;
    return {
      rawText: text,
      parsedJson,
      message: responseMessageFromBody(parsedJson),
    };
  } catch {
    return {
      rawText: text,
      parsedJson: null,
      message: truncate(text),
    };
  }
}

export function buildDigitalOceanGradientRequestPayload(input: {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
  maxCompletionTokens: number;
}) {
  return {
    model: input.model,
    temperature: 0,
    max_output_tokens: input.maxCompletionTokens,
    text: {
      format: {
        type: "json_schema",
        name: input.schemaName,
        schema: input.schema,
        strict: true,
      },
    },
    input: [
      {
        role: "system",
        content: [
          "Return only valid JSON. Do not include markdown, prose, or code fences.",
          `The JSON must match this schema named ${input.schemaName}:`,
          JSON.stringify(input.schema),
          "Prefer null or [] over guessing. Keep all claims grounded in the supplied context.",
        ].join("\n"),
      },
      {
        role: "user",
        content: input.prompt,
      },
    ],
  };
}

function buildDigitalOceanGradientChatPayload(input: {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
  maxCompletionTokens: number;
}) {
  return {
    model: input.model,
    temperature: 0,
    max_tokens: input.maxCompletionTokens,
    messages: [
      {
        role: "system",
        content: [
          "Return only valid JSON. Do not include markdown, prose, or code fences.",
          `The JSON must match this schema named ${input.schemaName}:`,
          JSON.stringify(input.schema),
          "Prefer null or [] over guessing. Keep all claims grounded in the supplied context.",
        ].join("\n"),
      },
      {
        role: "user",
        content: input.prompt,
      },
    ],
  };
}

async function sendDigitalOceanGradientStructuredRequest(input: {
  model: string;
  credential: DigitalOceanGradientCredential;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
  maxCompletionTokens: number;
}) {
  const controller = new AbortController();
  const timeoutError = new LocalDigitalOceanGradientTimeoutError(DIGITALOCEAN_GRADIENT_TIMEOUT_MS);
  const timeoutId = setTimeout(() => {
    controller.abort(timeoutError);
  }, DIGITALOCEAN_GRADIENT_TIMEOUT_MS);

  try {
    const response = await fetch(digitalOceanGradientResponsesUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.credential.value}`,
        "Content-Type": "application/json",
        "User-Agent": "Fortexa/1.0",
      },
      body: JSON.stringify(buildDigitalOceanGradientRequestPayload(input)),
      signal: controller.signal,
    });

    const body = await parseResponseBody(response);

    if (!body.parsedJson) {
      const fallbackResponse = await fetch(digitalOceanGradientChatCompletionsUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${input.credential.value}`,
          "Content-Type": "application/json",
          "User-Agent": "Fortexa/1.0",
        },
        body: JSON.stringify(buildDigitalOceanGradientChatPayload(input)),
        signal: controller.signal,
      });
      const fallbackBody = await parseResponseBody(fallbackResponse);

      if (!fallbackResponse.ok) {
        throw new DigitalOceanGradientHttpError(
          fallbackResponse.status,
          fallbackBody.message
        );
      }

      if (!fallbackBody.parsedJson) {
        throw new DigitalOceanGradientHttpError(
          fallbackResponse.status,
          fallbackBody.rawText.trim()
            ? `DigitalOcean Gradient API returned non-JSON response body: ${truncate(fallbackBody.rawText)}`
            : "DigitalOcean Gradient API returned an empty response body."
        );
      }

      return fallbackBody.parsedJson as DigitalOceanGradientResponse;
    }

    if (!response.ok) {
      throw new DigitalOceanGradientHttpError(response.status, body.message);
    }

    return body.parsedJson as DigitalOceanGradientResponse;
  } catch (error) {
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseStructuredAssistantText<T>(input: {
  text: string;
  validator: z.ZodType<T>;
  invalidJsonMessage: string;
  invalidSchemaMessage: string;
  model: string;
  normalizeParsedJson?: (value: unknown) => unknown;
  missingFieldMessages?: Record<string, string>;
}): { ok: true; data: T } | { ok: false; error: NormalizedDigitalOceanGradientError } {
  const text = normalizeStructuredJsonText(input.text);

  if (!text.trim()) {
    return {
      ok: false,
      error: buildNormalizedError({
        resultCode: "server_error",
        type: "empty_body",
        message: "DigitalOcean Gradient API returned an empty structured response for AI enrichment.",
        status: 200,
        model: input.model,
        retryable: true,
      }),
    };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: buildNormalizedError({
        resultCode: "server_error",
        type: "malformed_json",
        message: input.invalidJsonMessage,
        status: 200,
        model: input.model,
        retryable: true,
      }),
    };
  }

  const normalizedJson = input.normalizeParsedJson
    ? input.normalizeParsedJson(parsedJson)
    : parsedJson;
  const parsed = input.validator.safeParse(normalizedJson);
  if (!parsed.success) {
    return {
      ok: false,
      error: buildNormalizedError({
        resultCode: "server_error",
        type: "schema_validation_failure",
        message: `${input.invalidSchemaMessage}: ${formatZodError(parsed.error, input.missingFieldMessages)}`,
        status: 200,
        model: input.model,
        retryable: true,
      }),
    };
  }

  return {
    ok: true,
    data: parsed.data,
  };
}

async function requestStructuredDigitalOceanGradientJson<T>(input: {
  schemaName: string;
  schema: Record<string, unknown>;
  validator: z.ZodType<T>;
  prompt: string;
  invalidJsonMessage: string;
  invalidSchemaMessage: string;
  model?: string;
  maxCompletionTokens?: number;
  normalizeParsedJson?: (value: unknown) => unknown;
  missingFieldMessages?: Record<string, string>;
}): Promise<StructuredProviderResult<T>> {
  const credentials = serverEnv.digitalOceanGradientCredentialCandidates;

  if (credentials.length === 0) {
    const error = buildNormalizedError({
      resultCode: "service_unavailable",
      type: "auth_failure",
      message:
        "DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY is missing. AI enrichment is currently disabled.",
      status: null,
      model: input.model ?? serverEnv.digitalOceanGradientModel,
      retryable: false,
    });

    logDigitalOceanGradientDiagnostic("error", "request_failed", {
      model: error.model,
      failureType: error.type,
      status: error.status,
      reason: "missing_model_access_key",
    });

    return {
      ok: false,
      code: error.resultCode,
      message: error.message,
      error,
    };
  }

  const primaryModel = (input.model ?? serverEnv.digitalOceanGradientModel).trim();
  const attemptModels = createModelAttemptList(primaryModel);
  const promptChars = input.prompt.length;
  const estimatedTokens = estimateTokenCount(promptChars);
  const maxCompletionTokens = input.maxCompletionTokens ?? 420;
  let lastFailure: StructuredProviderFailure | null = null;
  const attemptCount = attemptModels.length * credentials.length;
  let attemptNumber = 0;

  for (const model of attemptModels) {
    for (const credential of credentials) {
      attemptNumber += 1;
      logDigitalOceanGradientDiagnostic("info", "request_started", {
        model,
        attempt: attemptNumber,
        attemptCount,
        credentialSource: credential.source,
        promptChars,
        estimatedTokens,
        maxCompletionTokens,
      });

      try {
        const result = await sendDigitalOceanGradientStructuredRequest({
          model,
          credential,
          schemaName: input.schemaName,
          schema: input.schema,
          prompt: input.prompt,
          maxCompletionTokens,
        });
        const assistant = extractAssistantPayload(result);

        if (!assistant.text && assistant.refusal) {
          lastFailure = {
            ok: false,
            code: "server_error",
            message: `DigitalOcean Gradient API returned a refusal instead of structured output: ${assistant.refusal}`,
            error: buildNormalizedError({
              resultCode: "server_error",
              type: "empty_body",
              message: `DigitalOcean Gradient API returned a refusal instead of structured output: ${assistant.refusal}`,
              status: 200,
              model,
              retryable: false,
            }),
          };
        } else {
          const parsed = parseStructuredAssistantText({
            text: assistant.text,
            validator: input.validator,
            invalidJsonMessage: input.invalidJsonMessage,
            invalidSchemaMessage: input.invalidSchemaMessage,
            model,
            normalizeParsedJson: input.normalizeParsedJson,
            missingFieldMessages: input.missingFieldMessages,
          });

          if (parsed.ok) {
            logDigitalOceanGradientDiagnostic("info", "request_succeeded", {
              model: result.model || model,
              attempt: attemptNumber,
              attemptCount,
              status: 200,
              responseModel: result.model || model,
              credentialSource: credential.source,
              promptChars,
              estimatedTokens,
              maxCompletionTokens,
            });

            return {
              ok: true,
              data: parsed.data,
              model: result.model || model,
              provider: DIGITALOCEAN_GRADIENT_PROVIDER,
            };
          }

          lastFailure = {
            ok: false,
            code: parsed.error.resultCode,
            message: parsed.error.message,
            error: parsed.error,
          };
        }
      } catch (error) {
        const normalized = normalizeDigitalOceanGradientFailure(error, model);
        lastFailure = {
          ok: false,
          code: normalized.resultCode,
          message: normalized.message,
          error: normalized,
        };

        if (
          !(
            error instanceof DigitalOceanGradientHttpError &&
            [401, 403, 429].includes(error.status)
          )
        ) {
          Sentry.captureException(error);
        }
      }

      if (lastFailure) {
        logDigitalOceanGradientDiagnostic("error", "request_failed", {
          model,
          attempt: attemptNumber,
          attemptCount,
          credentialSource: credential.source,
          failureType: lastFailure.error.type,
          status: lastFailure.error.status,
          promptChars,
          estimatedTokens,
          maxCompletionTokens,
        });

        if (!shouldTryFallback(lastFailure.error, attemptNumber - 1, attemptCount)) {
          return lastFailure;
        }
      }
    }
  }

  return (
    lastFailure ?? {
      ok: false,
      code: "service_unavailable",
      message: "DigitalOcean Gradient API failed unexpectedly while generating AI enrichment.",
      error: buildNormalizedError({
        resultCode: "service_unavailable",
        type: "unexpected_provider_error",
        message: "DigitalOcean Gradient API failed unexpectedly while generating AI enrichment.",
        status: null,
        model: primaryModel,
        retryable: true,
      }),
    }
  );
}

export async function generateStructuredCveEnrichment(input: {
  prompt: string;
}): Promise<
  StructuredProviderResult<{
    enrichment: StructuredCveEnrichment;
  }>
> {
  const result = await requestStructuredDigitalOceanGradientJson({
    schemaName: "fortexa_cve_enrichment",
    schema: cveEnrichmentJsonSchema,
    validator: cveEnrichmentResponseSchema,
    prompt: input.prompt,
    invalidJsonMessage: "AI enrichment returned malformed JSON.",
    invalidSchemaMessage: "AI enrichment JSON failed validation",
    normalizeParsedJson: unwrapStructuredProviderObject,
    missingFieldMessages: {
      summary: "summary is missing from provider output.",
    },
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      enrichment: result.data,
    },
    model: result.model,
    provider: result.provider,
  };
}

export async function enrichCveContent(input: {
  cveId: string;
  title: string;
  description: string;
}): Promise<
  ActionResult<{
    summary: string;
    recommendations: string[];
    model: string;
  }>
> {
  const result = await generateStructuredCveEnrichment({
    prompt: [
      "You are FORTEXA AI.",
      "Return structured JSON for a vulnerability-management analyst.",
      `CVE: ${input.cveId}`,
      `Title: ${input.title}`,
      `Description: ${input.description}`,
    ].join("\n"),
  });

  if (!result.ok) {
    return err(result.code, result.message);
  }

  return ok({
    summary: result.data.enrichment.summary,
    recommendations: result.data.enrichment.recommendedControls
      .map((control) => control.title)
      .slice(0, 3),
    model: result.model,
  });
}

export async function generateAssetVulnerabilityPlaybook(input: {
  prompt: string;
  model?: string;
  maxCompletionTokens?: number;
}): Promise<
  StructuredProviderResult<{
    playbook: AssetVulnerabilityPlaybook;
  }>
> {
  const result = await requestStructuredDigitalOceanGradientJson({
    schemaName: "fortexa_asset_vulnerability_playbook",
    schema: assetVulnerabilityPlaybookJsonSchema,
    validator: assetVulnerabilityPlaybookResponseSchema,
    prompt: input.prompt,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: input.model,
    maxCompletionTokens: input.maxCompletionTokens,
    normalizeParsedJson: normalizeAssetVulnerabilityPlaybookJson,
    missingFieldMessages: {
      summary: "summary is missing from provider output.",
      recommendedActions:
        "recommendedActions is missing from provider output; no safe remediation steps were available to persist.",
    },
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      playbook: result.data,
    },
    model: result.model,
    provider: result.provider,
  };
}
