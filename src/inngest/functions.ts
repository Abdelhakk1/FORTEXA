import "server-only";

import * as Sentry from "@sentry/nextjs";
import { inngest } from "./client";
import { runCveEnrichment } from "@/lib/services/cve-enrichment";
import { processScanImport } from "@/lib/services/ingestion";

const scanImportRequested = inngest.createFunction(
  {
    id: "scan-import-requested",
    triggers: [{ event: "scan.import.requested" }],
  },
  async ({ event }) => {
    Sentry.addBreadcrumb({
      category: "inngest",
      message: "scan.import.requested",
      data: event.data,
      level: "info",
    });

    const scanImportId =
      typeof event.data.scanImportId === "string" ? event.data.scanImportId : null;

    if (!scanImportId) {
      return {
        received: false,
        kind: "scan-import",
        reason: "missing_scan_import_id",
      };
    }

    const result = await processScanImport(scanImportId);

    return {
      received: true,
      kind: "scan-import",
      status: result.status,
      createdAssets: result.createdAssets,
      createdFindings: result.createdFindings,
    };
  }
);

const cveEnrichmentRequested = inngest.createFunction(
  {
    id: "cve-enrichment-requested",
    triggers: [{ event: "cve.enrichment.requested" }],
  },
  async ({ event }) => {
    Sentry.addBreadcrumb({
      category: "inngest",
      message: "cve.enrichment.requested",
      data: event.data,
      level: "info",
    });

    const cveId = typeof event.data.cveId === "string" ? event.data.cveId : null;

    if (!cveId) {
      return {
        received: false,
        kind: "cve-enrichment",
        reason: "missing_cve_id",
      };
    }

    const result = await runCveEnrichment(cveId, {
      force: Boolean(event.data.force),
    });

    return {
      received: true,
      kind: "cve-enrichment",
      status: result.ok ? result.data.status : "failed",
      cveId,
      error: result.ok ? null : result.message,
    };
  }
);

const reportGenerationRequested = inngest.createFunction(
  {
    id: "report-generation-requested",
    triggers: [{ event: "report.generation.requested" }],
  },
  async ({ event }) => {
    Sentry.addBreadcrumb({
      category: "inngest",
      message: "report.generation.requested",
      data: event.data,
      level: "info",
    });

    return {
      received: true,
      kind: "report-generation",
    };
  }
);

const notificationDispatchRequested = inngest.createFunction(
  {
    id: "notification-dispatch-requested",
    triggers: [{ event: "notification.dispatch.requested" }],
  },
  async ({ event }) => {
    Sentry.addBreadcrumb({
      category: "inngest",
      message: "notification.dispatch.requested",
      data: event.data,
      level: "info",
    });

    return {
      received: true,
      kind: "notification-dispatch",
    };
  }
);

export const inngestFunctions = [
  scanImportRequested,
  cveEnrichmentRequested,
  reportGenerationRequested,
  notificationDispatchRequested,
];
