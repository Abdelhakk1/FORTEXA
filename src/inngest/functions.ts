import "server-only";

import * as Sentry from "@sentry/nextjs";
import { inngest } from "./client";
import {
  processPendingAssetVulnerabilityEnrichments,
  runAssetVulnerabilityEnrichment,
} from "@/lib/services/asset-vulnerability-enrichment";
import {
  retryPendingOrFailedCveEnrichments,
  runCveEnrichment,
} from "@/lib/services/cve-enrichment";
import {
  processScanImport,
  recoverStaleProcessingScanImports,
} from "@/lib/services/ingestion";
import {
  dispatchOrganizationNotification,
  type NotificationKind,
} from "@/lib/services/notifications";
import { refreshOverdueRemediationTasks } from "@/lib/services/remediation";

const notificationKinds = new Set<NotificationKind>([
  "import_failure",
  "task_assignment",
  "sla_breach",
  "ai_failure",
  "daily_digest",
]);

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function addInngestBreadcrumb(message: string, data: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: "inngest",
    message,
    data: {
      organizationId: readString(data.organizationId),
      scanImportId: readString(data.scanImportId),
      cveId: readString(data.cveId),
      assetVulnerabilityId: readString(data.assetVulnerabilityId),
      remediationTaskId: readString(data.remediationTaskId),
      kind: readString(data.kind),
      force: typeof data.force === "boolean" ? data.force : undefined,
    },
    level: "info",
  });
}

const scanImportRequested = inngest.createFunction(
  {
    id: "scan-import-requested",
    triggers: [{ event: "scan.import.requested" }],
  },
  async ({ event }) => {
    addInngestBreadcrumb("scan.import.requested", event.data);

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
    addInngestBreadcrumb("cve.enrichment.requested", event.data);

    const cveId = typeof event.data.cveId === "string" ? event.data.cveId : null;
    const organizationId =
      typeof event.data.organizationId === "string"
        ? event.data.organizationId
        : undefined;

    if (!cveId) {
      return {
        received: false,
        kind: "cve-enrichment",
        reason: "missing_cve_id",
      };
    }

    const result = await runCveEnrichment(cveId, {
      force: Boolean(event.data.force),
      organizationId,
      triggerSource:
        event.data.triggerSource === "automatic_import" ||
        event.data.triggerSource === "manual_retry"
          ? event.data.triggerSource
          : "background_retry",
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

const assetVulnerabilityEnrichmentRequested = inngest.createFunction(
  {
    id: "asset-vulnerability-enrichment-requested",
    concurrency: { limit: 2 },
    triggers: [{ event: "asset_vulnerability.enrichment.requested" }],
  },
  async ({ event }) => {
    addInngestBreadcrumb("asset_vulnerability.enrichment.requested", event.data);

    const assetVulnerabilityId =
      typeof event.data.assetVulnerabilityId === "string"
        ? event.data.assetVulnerabilityId
        : null;
    const organizationId =
      typeof event.data.organizationId === "string"
        ? event.data.organizationId
        : undefined;

    if (!assetVulnerabilityId) {
      return {
        received: false,
        kind: "asset-vulnerability-enrichment",
        reason: "missing_asset_vulnerability_id",
      };
    }

    const result = await runAssetVulnerabilityEnrichment(assetVulnerabilityId, {
      force: Boolean(event.data.force),
      organizationId,
      triggerSource:
        event.data.triggerSource === "automatic_import" ||
        event.data.triggerSource === "automatic_page_open" ||
        event.data.triggerSource === "manual_retry"
          ? event.data.triggerSource
          : "background_retry",
    });

    return {
      received: true,
      kind: "asset-vulnerability-enrichment",
      status: result.ok ? result.data.status : "failed",
      assetVulnerabilityId,
      error: result.ok ? null : result.message,
    };
  }
);

const remediationSlaRefreshRequested = inngest.createFunction(
  {
    id: "remediation-sla-refresh-requested",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => {
    addInngestBreadcrumb("remediation.sla.refresh", {});
    const result = await refreshOverdueRemediationTasks();

    return {
      received: true,
      kind: "remediation-sla-refresh",
      refreshed: result.refreshed,
      alertsCreated: result.alertsCreated,
    };
  }
);

const notificationDispatchRequested = inngest.createFunction(
  {
    id: "notification-dispatch-requested",
    triggers: [{ event: "notification.dispatch.requested" }],
  },
  async ({ event }) => {
    addInngestBreadcrumb("notification.dispatch.requested", event.data);

    const organizationId = readString(event.data.organizationId);
    const kind = readString(event.data.kind);
    const subject = readString(event.data.subject);
    const text = readString(event.data.text);

    if (
      !organizationId ||
      !kind ||
      !notificationKinds.has(kind as NotificationKind) ||
      !subject ||
      !text
    ) {
      return {
        received: false,
        kind: "notification-dispatch",
        reason: "invalid_notification_payload",
      };
    }

    const result = await dispatchOrganizationNotification({
      organizationId,
      kind: kind as NotificationKind,
      subject,
      text,
      recipientProfileId: readString(event.data.recipientProfileId),
    });

    return {
      received: true,
      kind: "notification-dispatch",
      status: result.status,
    };
  }
);

const aiAndImportRecoveryRequested = inngest.createFunction(
  {
    id: "ai-and-import-recovery-requested",
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async () => {
    addInngestBreadcrumb("ai.import.recovery", {});

    const [imports, cves, assetPlaybooks] = await Promise.all([
      recoverStaleProcessingScanImports(),
      retryPendingOrFailedCveEnrichments(5),
      processPendingAssetVulnerabilityEnrichments({
        limit: 3,
        triggerSource: "background_retry",
      }),
    ]);

    return {
      received: true,
      kind: "ai-import-recovery",
      imports,
      cves,
      assetPlaybooks: assetPlaybooks.ok ? assetPlaybooks.data : assetPlaybooks.message,
    };
  }
);

export const inngestFunctions = [
  scanImportRequested,
  cveEnrichmentRequested,
  assetVulnerabilityEnrichmentRequested,
  remediationSlaRefreshRequested,
  notificationDispatchRequested,
  aiAndImportRecoveryRequested,
];
