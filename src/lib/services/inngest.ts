import "server-only";

import * as Sentry from "@sentry/nextjs";
import { err, ok, type ActionResult } from "@/lib/errors";
import { inngest } from "@/inngest/client";

export const fortexaEventNames = {
  scanImportRequested: "scan.import.requested",
  cveEnrichmentRequested: "cve.enrichment.requested",
  reportGenerationRequested: "report.generation.requested",
  notificationDispatchRequested: "notification.dispatch.requested",
} as const;

export type FortexaEventName =
  (typeof fortexaEventNames)[keyof typeof fortexaEventNames];

export async function sendFortexaEvent<T extends Record<string, unknown>>(input: {
  name: FortexaEventName;
  data: T;
}): Promise<ActionResult<{ ids: string[] }>> {
  try {
    const result = await inngest.send({
      name: input.name,
      data: input.data,
    });

    const ids = Array.isArray(result?.ids) ? result.ids : [];
    return ok({ ids });
  } catch (error) {
    Sentry.captureException(error);
    return err(
      "service_unavailable",
      "Inngest is not fully configured yet. The app will continue without background execution."
    );
  }
}
