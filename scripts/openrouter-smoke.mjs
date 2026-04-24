#!/usr/bin/env node

import nextEnv from "@next/env";
import { OpenRouter } from "@openrouter/sdk";
import {
  BadGatewayResponseError,
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
  BadRequestResponseError,
} from "@openrouter/sdk/models/errors";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const model =
  process.env.OPENROUTER_MODEL ?? "inclusionai/ling-2.6-flash:free";
const baseUrl =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
const timeoutMs = Number.parseInt(
  process.env.OPENROUTER_TIMEOUT_MS ?? "30000",
  10
);
const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY?.trim());

function normalizeStructuredJsonText(value) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

function extractTextPart(value) {
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

function extractBodyMessage(error) {
  try {
    const parsed = JSON.parse(error.body);
    const raw = parsed?.error?.metadata?.raw;
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim().slice(0, 240);
    }

    const message = parsed?.error?.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 240);
    }
  } catch {
    // Ignore JSON parse errors and fall back to the raw body string.
  }

  return error.body?.trim()?.slice(0, 240) || null;
}

function classify(error) {
  if (error instanceof UnauthorizedResponseError) {
    return {
      result: "auth_failure",
      status: error.statusCode,
      message: "OpenRouter authentication failed.",
    };
  }

  if (error instanceof TooManyRequestsResponseError) {
    return {
      result: "rate_limited",
      status: error.statusCode,
      message: extractBodyMessage(error) ?? "OpenRouter rate limited the request.",
    };
  }

  if (
    error instanceof RequestTimeoutError ||
    error instanceof RequestTimeoutResponseError ||
    error instanceof EdgeNetworkTimeoutResponseError
  ) {
    return {
      result: "timeout",
      status: error instanceof OpenRouterError ? error.statusCode : null,
      message: "OpenRouter request timed out.",
    };
  }

  if (error instanceof ConnectionError || error instanceof RequestAbortedError) {
    return {
      result: "connection_failure",
      status: null,
      message: "OpenRouter could not be reached from this runtime.",
    };
  }

  if (
    error instanceof ProviderOverloadedResponseError ||
    error instanceof ServiceUnavailableResponseError ||
    error instanceof BadGatewayResponseError ||
    error instanceof InternalServerResponseError
  ) {
    return {
      result: "provider_unavailable",
      status: error.statusCode,
      message:
        extractBodyMessage(error) ?? "OpenRouter provider was unavailable.",
    };
  }

  if (
    error instanceof ResponseValidationError ||
    error instanceof SDKValidationError
  ) {
    return {
      result: "malformed_output",
      status: null,
      message: "The OpenRouter SDK could not validate the response.",
    };
  }

  if (
    error instanceof BadRequestResponseError ||
    error instanceof UnprocessableEntityResponseError
  ) {
    return {
      result: "provider_unavailable",
      status: error.statusCode,
      message:
        extractBodyMessage(error) ?? "OpenRouter rejected the smoke-test request.",
    };
  }

  if (error instanceof OpenRouterError) {
    return {
      result:
        error.statusCode >= 500 ? "provider_unavailable" : "malformed_output",
      status: error.statusCode,
      message:
        extractBodyMessage(error) ?? "OpenRouter request failed unexpectedly.",
    };
  }

  if (error instanceof UnexpectedClientError) {
    return {
      result: "connection_failure",
      status: null,
      message: "OpenRouter SDK failed unexpectedly.",
    };
  }

  return {
    result: "connection_failure",
    status: null,
    message: error instanceof Error ? error.message : "Unknown OpenRouter failure.",
  };
}

function printResult(payload, exitCode) {
  console.log(JSON.stringify(payload));
  process.exit(exitCode);
}

if (!hasApiKey) {
  printResult(
    {
      result: "auth_failure",
      model,
      hasApiKey,
      timeoutMs,
      status: null,
      message: "OPENROUTER_API_KEY is missing.",
    },
    1
  );
}

try {
  const client = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    serverURL: baseUrl,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    retryConfig: {
      strategy: "none",
    },
  });

  const response = await client.chat.send({
    chatRequest: {
      model,
      stream: false,
      temperature: 0,
      plugins: [
        {
          id: "response-healing",
          enabled: true,
        },
      ],
      messages: [
        {
          role: "user",
          content: "Return only JSON with a boolean field named ok set to true.",
        },
      ],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "openrouter_smoke",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["ok"],
            properties: {
              ok: {
                type: "boolean",
              },
            },
          },
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  const text = normalizeStructuredJsonText(
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map(extractTextPart).join("")
        : extractTextPart(content)
  );

  if (!text) {
    printResult(
      {
        result: "malformed_output",
        model: response.model || model,
        hasApiKey,
        timeoutMs,
        status: 200,
        message: "OpenRouter returned no parseable content.",
      },
      1
    );
  }

  const parsed = JSON.parse(text);

  if (!parsed || parsed.ok !== true) {
    printResult(
      {
        result: "malformed_output",
        model: response.model || model,
        hasApiKey,
        timeoutMs,
        status: 200,
        message: "OpenRouter returned JSON, but it did not match the expected shape.",
      },
      1
    );
  }

  printResult(
    {
      result: "success",
      model: response.model || model,
      hasApiKey,
      timeoutMs,
      status: 200,
    },
    0
  );
} catch (error) {
  const classified = classify(error);

  printResult(
    {
      ...classified,
      model,
      hasApiKey,
      timeoutMs,
    },
    1
  );
}
