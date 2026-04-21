import "server-only";

import * as Sentry from "@sentry/nextjs";
import { GoogleGenAI } from "@google/genai";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult } from "@/lib/errors";

let geminiClient: GoogleGenAI | null = null;

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
      contents: `Summarize ${input.cveId} for a vulnerability management analyst.\nTitle: ${input.title}\nDescription: ${input.description}\nReturn two sections only:\n1. Summary\n2. Recommendations (3 short bullet-style lines)`,
    });

    const text = response.text ?? "";
    const [summaryBlock, recommendationBlock = ""] = text.split(
      /Recommendations:?/i
    );

    return ok({
      summary: summaryBlock.replace(/Summary:?/i, "").trim(),
      recommendations: recommendationBlock
        .split("\n")
        .map((line) => line.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 3),
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
