import "server-only";

import * as Sentry from "@sentry/nextjs";
import { err, ok, type ActionResult } from "@/lib/errors";
import { inngest } from "@/inngest/client";
import { serverEnv } from "@/lib/env/server";

export const fortexaEventNames = {
  scanImportRequested: "scan.import.requested",
  cveEnrichmentRequested: "cve.enrichment.requested",
  assetVulnerabilityEnrichmentRequested:
    "asset_vulnerability.enrichment.requested",
  notificationDispatchRequested: "notification.dispatch.requested",
} as const;

export type FortexaEventName =
  (typeof fortexaEventNames)[keyof typeof fortexaEventNames];

export async function sendFortexaEvent<T extends Record<string, unknown>>(input: {
  name: FortexaEventName;
  data: T;
}): Promise<ActionResult<{ ids: string[] }>> {
  if (!serverEnv.inngestEventKey) {
    console.error("[fortexa-event-queue]", {
      event: "worker_not_configured",
      name: input.name,
      hasInngestAppId: Boolean(serverEnv.inngestAppId),
      hasInngestSigningKey: Boolean(serverEnv.inngestSigningKey),
      hasInngestEventKey: false,
    });

    return err(
      "worker_not_configured",
      "AI enrichment could not be queued because the background worker event key is not configured."
    );
  }

  try {
    const result = await inngest.send({
      name: input.name,
      data: input.data,
    });

    const ids = Array.isArray(result?.ids) ? result.ids : [];
    console.info("[fortexa-event-queue]", {
      event: "event_sent",
      name: input.name,
      ids,
    });
    return ok({ ids });
  } catch (error) {
    Sentry.captureException(error);
    console.error("[fortexa-event-queue]", {
      event: "event_send_failed",
      name: input.name,
      errorName: error instanceof Error ? error.name : "unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 240)
          : "Unknown Inngest send failure",
    });
    return err(
      "worker_not_configured",
      "AI enrichment could not be queued because the background worker did not accept the event."
    );
  }
}
