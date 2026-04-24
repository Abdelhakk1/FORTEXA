import "server-only";

import * as Sentry from "@sentry/nextjs";
import { OpenRouter } from "@openrouter/sdk";
import type { ChatResult } from "@openrouter/sdk/models";
import {
  BadGatewayResponseError,
  BadRequestResponseError,
  ConnectionError,
  EdgeNetworkTimeoutResponseError,
  InternalServerResponseError,
  OpenRouterError,
  ProviderOverloadedResponseError,
  RequestAbortedError,
  RequestTimeoutError,
  RequestTimeoutResponseError,
  ResponseValidationError,
  SDKValidationError,
  ServiceUnavailableResponseError,
  TooManyRequestsResponseError,
  UnauthorizedResponseError,
  UnexpectedClientError,
  UnprocessableEntityResponseError,
} from "@openrouter/sdk/models/errors";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult, type ResultCode } from "@/lib/errors";

export const OPENROUTER_PROVIDER = "openrouter";
const OPENROUTER_TIMEOUT_MS = serverEnv.openrouterTimeoutMs;

let openRouterClient: OpenRouter | null = null;

export class LocalOpenRouterTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`OpenRouter request exceeded ${timeoutMs}ms.`);
    this.name = "LocalOpenRouterTimeoutError";
  }
}

export type OpenRouterFailureType =
  | "auth_failure"
  | "rate_limited"
  | "timeout"
  | "connection_failure"
  | "provider_error"
  | "request_rejected"
  | "empty_body"
  | "malformed_json"
  | "schema_validation_failure"
  | "unexpected_sdk_error";

export type StructuredProviderSuccess<T> = {
  ok: true;
  data: T;
  model: string;
  provider: typeof OPENROUTER_PROVIDER;
};

export type NormalizedOpenRouterError = {
  type: OpenRouterFailureType;
  message: string;
  status: number | null;
  provider: typeof OPENROUTER_PROVIDER;
  model: string;
  retryable: boolean;
  resultCode: ResultCode;
};

export type StructuredProviderFailure = {
  ok: false;
  code: ResultCode;
  message: string;
  error: NormalizedOpenRouterError;
};

type StructuredProviderResult<T> =
  | StructuredProviderSuccess<T>
  | StructuredProviderFailure;

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
    summary: {
      type: "string",
      description:
        "A concise analyst-friendly summary of the vulnerability in plain English.",
    },
    riskExplanation: {
      type: "string",
      description:
        "Why this matters to the business or asset context, focusing on risk and exposure.",
    },
    impactAnalysis: {
      type: "string",
      description:
        "A practical impact analysis for security analysts, including likely outcomes if left unaddressed.",
    },
    exploitConditions: {
      type: "string",
      description:
        "The conditions or prerequisites an attacker would typically need to exploit this issue.",
    },
    remediationGuidance: {
      type: "string",
      description:
        "Practical remediation guidance suitable for an operations or security team.",
    },
    recommendedControls: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          title: {
            type: "string",
            description: "Short control title.",
          },
          description: {
            type: "string",
            description: "Short explanation of the control.",
          },
          command: {
            type: ["string", "null"],
            description:
              "Optional command, CLI snippet, or configuration example.",
          },
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
    confidence: {
      type: "integer",
      description: "Confidence score from 0 to 100.",
    },
    unsupportedClaims: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
      },
    },
    trustLabels: {
      type: "array",
      maxItems: 6,
      items: {
        type: "string",
      },
    },
    tags: {
      type: "array",
      maxItems: 8,
      items: {
        type: "string",
      },
    },
  },
} as const;

export const assetVulnerabilityPlaybookResponseSchema = z.object({
  summary: z.string().trim().min(12).max(320),
  technicalRationale: z.string().trim().max(420).default(""),
  businessRationale: z.string().trim().max(420).default(""),
  primaryMitigation: z.string().trim().max(220).nullable().default(null),
  recommendedActions: z
    .array(z.string().trim().min(8).max(220))
    .min(1)
    .max(4),
  validationSteps: z.array(z.string().trim().min(8).max(220)).max(4).default([]),
  compensatingControls: z
    .array(z.string().trim().min(8).max(220))
    .max(3)
    .default([]),
  rollbackCaution: z.string().trim().max(220).nullable().default(null),
  maintenanceWindowNote: z.string().trim().max(220).nullable().default(null),
  citations: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(2).max(120),
        kind: z.enum(["source_reference", "scanner_evidence"]),
      })
    )
    .max(4)
    .default([]),
  confidence: z.number().int().min(0).max(100),
  unsupportedClaims: z
    .array(z.string().trim().min(5).max(220))
    .max(4)
    .default([]),
  trustLabels: z.array(z.string().trim().min(2).max(60)).max(4).default([]),
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
      maxItems: 4,
      items: { type: "string" },
    },
    validationSteps: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
    compensatingControls: {
      type: "array",
      maxItems: 3,
      items: { type: "string" },
    },
    rollbackCaution: { type: ["string", "null"] },
    maintenanceWindowNote: { type: ["string", "null"] },
    citations: {
      type: "array",
      maxItems: 4,
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
      maxItems: 4,
      items: { type: "string" },
    },
    trustLabels: {
      type: "array",
      maxItems: 4,
      items: { type: "string" },
    },
  },
} as const;

function getOpenRouterClient() {
  if (!openRouterClient) {
    openRouterClient = new OpenRouter({
      apiKey: serverEnv.openrouterApiKey ?? "",
      serverURL: serverEnv.openrouterBaseUrl,
      timeoutMs: -1,
      retryConfig: {
        strategy: "none",
      },
    });
  }

  return openRouterClient;
}

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

function extractAssistantPayload(result: ChatResult) {
  const message = result.choices[0]?.message;
  const content = message?.content;
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

function extractOpenRouterBodyMessage(error: OpenRouterError) {
  try {
    const parsed = JSON.parse(error.body) as {
      error?: {
        message?: string;
        metadata?: {
          raw?: string;
        };
      };
    };

    const raw = parsed.error?.metadata?.raw;
    if (typeof raw === "string" && raw.trim()) {
      return truncate(raw);
    }

    const message = parsed.error?.message;
    if (typeof message === "string" && message.trim()) {
      return truncate(message);
    }
  } catch {
    // Ignore JSON parse errors and fall back to the raw body string below.
  }

  return error.body.trim() ? truncate(error.body) : null;
}

function createModelAttemptList(primaryModel: string, fallbackModel?: string | null) {
  const attempts = [primaryModel.trim()];

  if (fallbackModel?.trim() && fallbackModel.trim() !== primaryModel.trim()) {
    attempts.push(fallbackModel.trim());
  }

  return attempts;
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

function logOpenRouterDiagnostic(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown> & { model: string }
) {
  const { model, ...rest } = details;

  console[level]("[openrouter]", {
    event,
    provider: OPENROUTER_PROVIDER,
    model,
    hasApiKey: Boolean(serverEnv.openrouterApiKey),
    timeoutMs: OPENROUTER_TIMEOUT_MS,
    ...rest,
  });
}

function buildNormalizedError(input: {
  type: OpenRouterFailureType;
  message: string;
  status: number | null;
  model: string;
  retryable: boolean;
  resultCode: ResultCode;
}): NormalizedOpenRouterError {
  return {
    type: input.type,
    message: input.message,
    status: input.status,
    provider: OPENROUTER_PROVIDER,
    model: input.model,
    retryable: input.retryable,
    resultCode: input.resultCode,
  };
}

export function normalizeOpenRouterFailure(
  error: unknown,
  model: string
): NormalizedOpenRouterError {
  if (
    error instanceof LocalOpenRouterTimeoutError ||
    findErrorInChain(error, (value) => value instanceof LocalOpenRouterTimeoutError)
  ) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "timeout",
      message:
        "OpenRouter timed out while generating AI enrichment. Retry AI in a moment.",
      status: null,
      model,
      retryable: true,
    });
  }

  if (error instanceof TooManyRequestsResponseError) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "rate_limited",
      message: `OpenRouter rate limited the request. ${extractOpenRouterBodyMessage(error) ?? "Retry AI in a moment."}`,
      status: error.statusCode,
      model,
      retryable: true,
    });
  }

  if (error instanceof UnauthorizedResponseError) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "auth_failure",
      message:
        "OpenRouter authentication failed. Check OPENROUTER_API_KEY in the server environment.",
      status: error.statusCode,
      model,
      retryable: false,
    });
  }

  if (
    error instanceof RequestTimeoutError ||
    error instanceof RequestTimeoutResponseError ||
    error instanceof EdgeNetworkTimeoutResponseError
  ) {
    const status = error instanceof OpenRouterError ? error.statusCode : null;

    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "timeout",
      message:
        "OpenRouter timed out while generating AI enrichment. Retry AI in a moment.",
      status,
      model,
      retryable: true,
    });
  }

  if (error instanceof ConnectionError || error instanceof RequestAbortedError) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "connection_failure",
      message:
        "OpenRouter could not be reached from this server runtime. Check connectivity and retry AI.",
      status: null,
      model,
      retryable: true,
    });
  }

  if (
    error instanceof ProviderOverloadedResponseError ||
    error instanceof ServiceUnavailableResponseError ||
    error instanceof BadGatewayResponseError ||
    error instanceof InternalServerResponseError
  ) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "provider_error",
      message: `OpenRouter provider was unavailable. ${extractOpenRouterBodyMessage(error) ?? "Retry AI in a moment."}`,
      status: error.statusCode,
      model,
      retryable: true,
    });
  }

  if (
    error instanceof ResponseValidationError ||
    error instanceof SDKValidationError
  ) {
    return buildNormalizedError({
      resultCode: "server_error",
      type: "malformed_json",
      message:
        "OpenRouter SDK could not validate the structured AI response.",
      status: null,
      model,
      retryable: true,
    });
  }

  if (
    error instanceof BadRequestResponseError ||
    error instanceof UnprocessableEntityResponseError
  ) {
    return buildNormalizedError({
      resultCode: "server_error",
      type: "request_rejected",
      message: `OpenRouter rejected the structured request. ${extractOpenRouterBodyMessage(error) ?? "Check the request payload and schema."}`,
      status: error.statusCode,
      model,
      retryable: false,
    });
  }

  if (error instanceof OpenRouterError) {
    const status = error.statusCode;

    if (status === 401 || status === 403) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "auth_failure",
        message:
          "OpenRouter authentication failed. Check OPENROUTER_API_KEY in the server environment.",
        status,
        model,
        retryable: false,
      });
    }

    if (status === 408 || status === 504 || status === 524) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "timeout",
        message:
          "OpenRouter timed out while generating AI enrichment. Retry AI in a moment.",
        status,
        model,
        retryable: true,
      });
    }

    if (status === 429 || status === 529) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "rate_limited",
        message: `OpenRouter rate limited the request. ${extractOpenRouterBodyMessage(error) ?? "Retry AI in a moment."}`,
        status,
        model,
        retryable: true,
      });
    }

    if (status >= 500) {
      return buildNormalizedError({
        resultCode: "service_unavailable",
        type: "provider_error",
        message: `OpenRouter provider was unavailable. ${extractOpenRouterBodyMessage(error) ?? "Retry AI in a moment."}`,
        status,
        model,
        retryable: true,
      });
    }

    return buildNormalizedError({
      resultCode: "server_error",
      type: "request_rejected",
      message: `OpenRouter rejected the request. ${extractOpenRouterBodyMessage(error) ?? "Check the request payload and model configuration."}`,
      status,
      model,
      retryable: false,
    });
  }

  if (error instanceof UnexpectedClientError) {
    return buildNormalizedError({
      resultCode: "service_unavailable",
      type: "unexpected_sdk_error",
      message:
        "OpenRouter SDK failed unexpectedly while generating AI enrichment.",
      status: null,
      model,
      retryable: true,
    });
  }

  return buildNormalizedError({
    resultCode: "service_unavailable",
    type: "unexpected_sdk_error",
    message:
      "OpenRouter failed unexpectedly while generating AI enrichment.",
    status: null,
    model,
    retryable: true,
  });
}

function shouldTryFallback(
  failure: NormalizedOpenRouterError,
  attemptIndex: number,
  attemptCount: number
) {
  return failure.retryable && attemptIndex < attemptCount - 1;
}

async function sendOpenRouterStructuredRequest(input: {
  model: string;
  schemaName: string;
  schema: Record<string, unknown>;
  prompt: string;
  maxCompletionTokens: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new LocalOpenRouterTimeoutError(OPENROUTER_TIMEOUT_MS));
  }, OPENROUTER_TIMEOUT_MS);

  try {
    return await getOpenRouterClient().chat.send(
      {
        chatRequest: {
          model: input.model,
          stream: false,
          temperature: 0,
          maxCompletionTokens: input.maxCompletionTokens,
          plugins: [
            {
              id: "response-healing",
              enabled: true,
            },
          ],
          messages: [
            {
              role: "system",
              content:
                "Return only valid JSON that matches the supplied schema. Prefer null or [] over guessing.",
            },
            {
              role: "user",
              content: input.prompt,
            },
          ],
          responseFormat: {
            type: "json_schema",
            jsonSchema: {
              name: input.schemaName,
              strict: true,
              schema: input.schema,
            },
          },
        },
      },
      {
        timeoutMs: -1,
        fetchOptions: {
          signal: controller.signal,
        },
      }
    );
  } catch (error) {
    const timeoutError = findErrorInChain(
      error,
      (value) => value instanceof LocalOpenRouterTimeoutError
    );

    if (timeoutError) {
      throw timeoutError;
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
}): { ok: true; data: T } | { ok: false; error: NormalizedOpenRouterError } {
  if (!input.text) {
    return {
      ok: false,
      error: buildNormalizedError({
        resultCode: "server_error",
        type: "empty_body",
        message: "OpenRouter returned an empty structured response for AI enrichment.",
        status: 200,
        model: input.model,
        retryable: true,
      }),
    };
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(input.text);
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

async function requestStructuredOpenRouterJson<T>(input: {
  schemaName: string;
  schema: Record<string, unknown>;
  validator: z.ZodType<T>;
  prompt: string;
  invalidJsonMessage: string;
  invalidSchemaMessage: string;
  model?: string;
  fallbackModel?: string | null;
  maxCompletionTokens?: number;
  normalizeParsedJson?: (value: unknown) => unknown;
  missingFieldMessages?: Record<string, string>;
}): Promise<StructuredProviderResult<T>> {
  if (!serverEnv.openrouterApiKey) {
    const error = buildNormalizedError({
      resultCode: "service_unavailable",
      type: "auth_failure",
      message: "OPENROUTER_API_KEY is missing. AI enrichment is currently disabled.",
      status: null,
      model: input.model ?? serverEnv.openrouterModel,
      retryable: false,
    });

    logOpenRouterDiagnostic("error", "request_failed", {
      model: error.model,
      failureType: error.type,
      status: error.status,
      reason: "missing_api_key",
    });

    return {
      ok: false,
      code: error.resultCode,
      message: error.message,
      error,
    };
  }

  const primaryModel = (input.model ?? serverEnv.openrouterModel).trim();
  const attemptModels = createModelAttemptList(
    primaryModel,
    input.fallbackModel ?? serverEnv.openrouterFallbackModel
  );
  const promptChars = input.prompt.length;
  const estimatedTokens = estimateTokenCount(promptChars);
  const maxCompletionTokens = input.maxCompletionTokens ?? 420;
  let lastFailure: StructuredProviderFailure | null = null;

  for (const [attemptIndex, model] of attemptModels.entries()) {
    logOpenRouterDiagnostic("info", "request_started", {
      model,
      attempt: attemptIndex + 1,
      attemptCount: attemptModels.length,
      promptChars,
      estimatedTokens,
      maxCompletionTokens,
    });

    try {
      const result = await sendOpenRouterStructuredRequest({
        model,
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
          message: `OpenRouter returned a refusal instead of structured output: ${assistant.refusal}`,
          error: buildNormalizedError({
            resultCode: "server_error",
            type: "empty_body",
            message: `OpenRouter returned a refusal instead of structured output: ${assistant.refusal}`,
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
          logOpenRouterDiagnostic("info", "request_succeeded", {
            model: result.model || model,
            attempt: attemptIndex + 1,
            attemptCount: attemptModels.length,
            status: 200,
            responseModel: result.model || model,
            promptChars,
            estimatedTokens,
            maxCompletionTokens,
          });

          return {
            ok: true,
            data: parsed.data,
            model: result.model || model,
            provider: OPENROUTER_PROVIDER,
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
      const normalized = normalizeOpenRouterFailure(error, model);
      lastFailure = {
        ok: false,
        code: normalized.resultCode,
        message: normalized.message,
        error: normalized,
      };

      if (
        !(error instanceof UnauthorizedResponseError) &&
        !(error instanceof TooManyRequestsResponseError)
      ) {
        Sentry.captureException(error);
      }
    }

    if (lastFailure) {
      logOpenRouterDiagnostic("error", "request_failed", {
        model,
        attempt: attemptIndex + 1,
        attemptCount: attemptModels.length,
        failureType: lastFailure.error.type,
        status: lastFailure.error.status,
        promptChars,
        estimatedTokens,
        maxCompletionTokens,
      });

      if (!shouldTryFallback(lastFailure.error, attemptIndex, attemptModels.length)) {
        return lastFailure;
      }
    }
  }

  return (
    lastFailure ?? {
      ok: false,
      code: "service_unavailable",
      message: "OpenRouter failed unexpectedly while generating AI enrichment.",
      error: buildNormalizedError({
        resultCode: "service_unavailable",
        type: "unexpected_sdk_error",
        message: "OpenRouter failed unexpectedly while generating AI enrichment.",
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
  const result = await requestStructuredOpenRouterJson({
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
  fallbackModel?: string | null;
  maxCompletionTokens?: number;
}): Promise<
  StructuredProviderResult<{
    playbook: AssetVulnerabilityPlaybook;
  }>
> {
  const result = await requestStructuredOpenRouterJson({
    schemaName: "fortexa_asset_vulnerability_playbook",
    schema: assetVulnerabilityPlaybookJsonSchema,
    validator: assetVulnerabilityPlaybookResponseSchema,
    prompt: input.prompt,
    invalidJsonMessage: "AI enrichment returned malformed playbook JSON.",
    invalidSchemaMessage: "AI playbook JSON failed validation",
    model: input.model,
    fallbackModel: input.fallbackModel,
    maxCompletionTokens: input.maxCompletionTokens,
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
      playbook: result.data,
    },
    model: result.model,
    provider: result.provider,
  };
}
