import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { assetVulnerabilityEnrichments, cveEnrichments } from "@/db/schema";
import { serverEnv } from "@/lib/env/server";
import { err, ok, type ActionResult } from "@/lib/errors";

export type AiGenerationKind = "cve_enrichment" | "asset_vulnerability_playbook";
export type AiGenerationTriggerSource =
  | "automatic_import"
  | "automatic_page_open"
  | "manual_retry"
  | "background_retry";

export function getAiBudgetLimits() {
  return {
    dailyRequestLimit: serverEnv.fortexaAiDailyRequestLimit,
    automaticImportCveLimit: serverEnv.fortexaAiAutoImportCveLimit,
    automaticImportPlaybookLimit: serverEnv.fortexaAiAutoImportPlaybookLimit,
  };
}

function startOfUtcDay() {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export async function checkAiGenerationBudget(input: {
  kind: AiGenerationKind;
  organizationId?: string | null;
  triggerSource?: AiGenerationTriggerSource;
}): Promise<
  ActionResult<{
    limit: number;
    used: number;
    remaining: number;
  }>
> {
  const db = getDb();
  const limits = getAiBudgetLimits();

  if (!db) {
    return err(
      "service_unavailable",
      "DATABASE_URL is missing. AI budget controls cannot be evaluated."
    );
  }

  const since = startOfUtcDay();
  const [usage] =
    input.kind === "asset_vulnerability_playbook" && input.organizationId
      ? await db
          .select({ value: count() })
          .from(assetVulnerabilityEnrichments)
          .where(
            and(
              gte(assetVulnerabilityEnrichments.lastAttemptedAt, since),
              eq(assetVulnerabilityEnrichments.organizationId, input.organizationId)
            )
          )
      : await db
          .select({ value: count() })
          .from(cveEnrichments)
          .where(gte(cveEnrichments.lastAttemptedAt, since));

  const used = usage?.value ?? 0;
  const limit = limits.dailyRequestLimit;

  if (used >= limit) {
    return err(
      "rate_limited",
      `AI daily request limit reached (${used}/${limit}). Try again tomorrow or raise FORTEXA_AI_DAILY_REQUEST_LIMIT.`
    );
  }

  return ok({
    limit,
    used,
    remaining: Math.max(0, limit - used),
  });
}
