#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const model = process.env.DIGITALOCEAN_GRADIENT_MODEL ?? "deepseek-4-flash";
const baseUrl =
  process.env.DIGITALOCEAN_GRADIENT_BASE_URL ??
  "https://inference.do-ai.run/v1";
const timeoutMs = Number.parseInt(process.env.DIGITALOCEAN_GRADIENT_TIMEOUT_MS ?? "30000", 10);
const credentialCandidates = [
  ["model_access_key", process.env.DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY?.trim()],
  ["legacy_api_key", process.env.DIGITALOCEAN_GRADIENT_API_KEY?.trim()],
  ["model_access_key", process.env.MODEL_ACCESS_KEY?.trim()],
  ["account_token", process.env.DIGITALOCEAN_TOKEN?.trim()],
].reduce((candidates, [source, value]) => {
  if (value && !candidates.some((candidate) => candidate.value === value)) {
    candidates.push({ source, value });
  }

  return candidates;
}, []);
const hasApiKey = credentialCandidates.length > 0;

function responsesUrl() {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("responses", normalizedBaseUrl).toString();
}

function chatCompletionsUrl() {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalizedBaseUrl).toString();
}

function normalizeStructuredJsonText(value) {
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

function extractBodyMessage(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value.error?.message ?? value.message;
  if (typeof message === "string" && message.trim()) {
    return message.trim().slice(0, 240);
  }

  return null;
}

function classifyHttp(status, message) {
  if (status === 401 || status === 403) {
    if (message && /not available|subscription tier|model/i.test(message)) {
      return {
        result: "model_unavailable",
        status,
        message,
      };
    }

    return {
      result: "auth_failure",
      status,
      message:
        "DigitalOcean Gradient API authentication or authorization failed. Use a model access key or token authorized for Serverless Inference.",
    };
  }

  if (status === 429 || status === 529) {
    return {
      result: "rate_limited",
      status,
      message: message ?? "DigitalOcean Gradient API rate limited the request.",
    };
  }

  if (status === 408 || status === 504 || status === 524) {
    return {
      result: "timeout",
      status,
      message: "DigitalOcean Gradient API request timed out.",
    };
  }

  if (status >= 500) {
    return {
      result: "provider_unavailable",
      status,
      message: message ?? "DigitalOcean Gradient API was unavailable.",
    };
  }

  return {
    result: "provider_rejected_request",
    status,
    message: message ?? "DigitalOcean Gradient API rejected the smoke-test request.",
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
      message: "DIGITALOCEAN_GRADIENT_MODEL_ACCESS_KEY is missing.",
    },
    1
  );
}

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

try {
  let lastFailure = null;

  for (const credential of credentialCandidates) {
    const response = await fetch(responsesUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${credential.value}`,
        "Content-Type": "application/json",
        "User-Agent": "Fortexa/1.0",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_output_tokens: 128,
        text: {
          format: {
            type: "json_schema",
            name: "fortexa_digitalocean_smoke",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["ok"],
              properties: { ok: { type: "boolean" } },
            },
          },
        },
        input: [
          {
            role: "system",
            content: "Return only JSON. Do not include markdown or prose.",
          },
          {
            role: "user",
            content: "Return only JSON with a boolean field named ok set to true.",
          },
        ],
      }),
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let body = null;
    let effectiveOk = response.ok;
    let effectiveStatus = response.status;

    try {
      body = rawBody.trim() ? JSON.parse(rawBody) : null;
    } catch {
      const fallbackResponse = await fetch(chatCompletionsUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credential.value}`,
          "Content-Type": "application/json",
          "User-Agent": "Fortexa/1.0",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 128,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Return only JSON. Do not include markdown or prose.",
            },
            {
              role: "user",
              content:
                "Return only JSON with a boolean field named ok set to true.",
            },
          ],
        }),
        signal: controller.signal,
      });
      const fallbackRawBody = await fallbackResponse.text();

      try {
        body = fallbackRawBody.trim() ? JSON.parse(fallbackRawBody) : null;
      } catch {
        printResult(
          {
            result: "malformed_output",
            model,
            credentialSource: credential.source,
            hasApiKey,
            timeoutMs,
            status: fallbackResponse.status,
            message: "DigitalOcean Gradient API returned a non-JSON HTTP body.",
          },
          1
        );
      }

      effectiveOk = fallbackResponse.ok;
      effectiveStatus = fallbackResponse.status;

      if (!fallbackResponse.ok) {
        lastFailure = {
          ...classifyHttp(fallbackResponse.status, extractBodyMessage(body)),
          model,
          credentialSource: credential.source,
          hasApiKey,
          timeoutMs,
        };
        continue;
      }
    }

    if (!effectiveOk) {
      lastFailure = {
        ...classifyHttp(effectiveStatus, extractBodyMessage(body)),
        model,
        credentialSource: credential.source,
        hasApiKey,
        timeoutMs,
      };
      continue;
    }

    const responseOutputText = Array.isArray(body?.output)
      ? body.output.flatMap((item) => item.content ?? []).map(extractTextPart).join("")
      : "";
    const content =
      body?.output_text || responseOutputText || body?.choices?.[0]?.message?.content;
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
          model: body?.model || model,
          credentialSource: credential.source,
          hasApiKey,
          timeoutMs,
          status: 200,
          message: "DigitalOcean Gradient API returned no parseable content.",
        },
        1
      );
    }

    const parsed = JSON.parse(text);

    if (!parsed || parsed.ok !== true) {
      printResult(
        {
          result: "malformed_output",
          model: body?.model || model,
          credentialSource: credential.source,
          hasApiKey,
          timeoutMs,
          status: 200,
          message:
            "DigitalOcean Gradient API returned JSON, but it did not match the expected shape.",
        },
        1
      );
    }

    printResult(
      {
        result: "success",
        model: body?.model || model,
        credentialSource: credential.source,
        hasApiKey,
        timeoutMs,
        status: 200,
      },
      0
    );
  }

  printResult(
    lastFailure ?? {
      result: "provider_rejected_request",
      model,
      hasApiKey,
      timeoutMs,
      status: null,
      message: "DigitalOcean Gradient API rejected all configured credentials.",
    },
    1
  );
} catch (error) {
  printResult(
    {
      result:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "connection_failure",
      model,
      hasApiKey,
      timeoutMs,
      status: null,
      message:
        error instanceof Error && error.name === "AbortError"
          ? "DigitalOcean Gradient API request timed out."
          : error instanceof Error
            ? error.message
            : "Unknown DigitalOcean Gradient API failure.",
    },
    1
  );
} finally {
  clearTimeout(timeoutId);
}
