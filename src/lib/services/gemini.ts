import "server-only";

import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult } from "@/lib/errors";

let geminiClient: GoogleGenAI | null = null;

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
  confidence: z.number().int().min(0).max(100),
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
    "confidence",
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
    confidence: {
      type: "integer",
      description: "Confidence score from 0 to 100.",
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

function getGeminiClient() {
  if (!serverEnv.geminiApiKey) {
    return null;
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: serverEnv.geminiApiKey,
    });
  }

  return geminiClient;
}

export function parseStructuredGeminiJson(text: string) {
  try {
    return cveEnrichmentResponseSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function generateStructuredCveEnrichment(input: {
  prompt: string;
}): Promise<
  ActionResult<{
    enrichment: StructuredCveEnrichment;
    model: string;
  }>
> {
  const client = getGeminiClient();

  if (!client) {
    return err(
      "service_unavailable",
      "GEMINI_API_KEY is missing. AI enrichment is currently disabled."
    );
  }

  try {
    const response = await client.models.generateContent({
      model: serverEnv.geminiModel,
      contents: input.prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: cveEnrichmentJsonSchema,
      },
    });

    const text = response.text ?? "";
    const enrichment = parseStructuredGeminiJson(text);

    if (!enrichment) {
      return err(
        "server_error",
        "Gemini returned malformed enrichment JSON."
      );
    }

    return ok({
      enrichment,
      model: serverEnv.geminiModel,
    });
  } catch (error) {
    Sentry.captureException(error);
    return err(
      "server_error",
      "Gemini enrichment failed. The event has been captured for review."
    );
  }
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
    return result;
  }

  return ok({
    summary: result.data.enrichment.summary,
    recommendations: result.data.enrichment.recommendedControls
      .map((control) => control.title)
      .slice(0, 3),
    model: result.data.model,
  });
}
