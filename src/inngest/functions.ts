import "server-only";

import * as Sentry from "@sentry/nextjs";
import { inngest } from "./client";

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

    return {
      received: true,
      kind: "scan-import",
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

    return {
      received: true,
      kind: "cve-enrichment",
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
