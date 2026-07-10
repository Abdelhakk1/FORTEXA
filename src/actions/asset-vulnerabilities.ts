"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  processPendingAssetVulnerabilityEnrichments,
  queueAssetVulnerabilityEnrichment,
} from "@/lib/services/asset-vulnerability-enrichment";
import { updateAssetVulnerabilityStatus } from "@/lib/services/asset-vulnerabilities";
import { updateAiSettings } from "@/lib/services/organizations";

type AssetVulnerabilityEnrichmentActionData = {
  assetVulnerabilityId: string;
  mode: "queued" | "skipped";
  status:
    | "queued"
    | "already_processing"
    | "already_queued"
    | "fresh_completed"
    | "recent_failure_cooldown"
    | "automatic_retry_limit";
  message: string;
};

function queueStatusMessage(
  status: AssetVulnerabilityEnrichmentActionData["status"]
) {
  switch (status) {
    case "queued":
      return "AI enrichment queued in the background.";
    case "already_processing":
      return "AI enrichment is already processing.";
    case "already_queued":
      return "AI enrichment is already queued.";
    case "fresh_completed":
      return "A fresh AI enrichment already exists.";
    case "recent_failure_cooldown":
      return "AI enrichment failed recently. Retry will be available after the cooldown.";
    case "automatic_retry_limit":
      return "Automatic AI enrichment reached the retry limit. Use manual retry after reviewing the failure.";
    default:
      return "AI enrichment state updated.";
  }
}

function logActionException(
  action: string,
  error: unknown,
  details: Record<string, unknown>
) {
  Sentry.captureException(error);
  console.error("[asset-vulnerability-action]", {
    action,
    ...details,
    errorName: error instanceof Error ? error.name : "unknown",
    message:
      error instanceof Error
        ? error.message.slice(0, 240)
        : "Unknown server action failure",
  });
}

async function logAuditEventSafe(
  action: string,
  input: Parameters<typeof logAuditEvent>[0]
) {
  try {
    await logAuditEvent(input);
  } catch (error) {
    logActionException(`${action}.audit_failed`, error, {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
    });
  }
}

function revalidatePathSafe(action: string, path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    logActionException(`${action}.revalidate_failed`, error, { path });
  }
}

function wakeAssetVulnerabilityEnrichmentProcessor(input: {
  action: string;
  organizationId: string;
  assetVulnerabilityId: string;
}) {
  try {
    after(async () => {
      try {
        const result = await processPendingAssetVulnerabilityEnrichments({
          organizationId: input.organizationId,
          limit: 1,
          triggerSource: "background_retry",
        });

        console.info("[asset-vulnerability-action]", {
          action: `${input.action}.processor_wake_finished`,
          organizationId: input.organizationId,
          assetVulnerabilityId: input.assetVulnerabilityId,
          ok: result.ok,
          code: result.ok ? "ok" : result.code,
          result: result.ok ? result.data : null,
          message: result.ok ? null : result.message.slice(0, 240),
        });
      } catch (error) {
        logActionException(`${input.action}.processor_wake_failed`, error, {
          organizationId: input.organizationId,
          assetVulnerabilityId: input.assetVulnerabilityId,
        });
      }
    });
  } catch (error) {
    logActionException(`${input.action}.processor_wake_schedule_failed`, error, {
      organizationId: input.organizationId,
      assetVulnerabilityId: input.assetVulnerabilityId,
    });
  }
}

export async function enableAiPlaybooksAction(): Promise<
  ActionResult<{ enabled: true }>
> {
  return measureServerTiming(
    "action.assetVulnerabilities.enableAiPlaybooks",
    async () => {
      try {
        const identity = await requirePermission("cves.enrich");
        const activeOrganization = await requireActiveOrganization();

        await updateAiSettings(activeOrganization.organization.id, {
          enabled: true,
          consentAccepted: true,
          dataPolicy: "minimal_evidence",
        });

        await logAuditEventSafe("organization.enable_ai_playbooks", {
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "organization.ai_playbooks_enabled",
          resourceType: "organization",
          resourceId: activeOrganization.organization.id,
          details: { source: "just_in_time_consent" },
        });

        revalidatePathSafe("organization.enable_ai_playbooks", "/settings");
        return ok({ enabled: true });
      } catch (error) {
        return toActionResult(error);
      }
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function retryAssetVulnerabilityEnrichmentAction(input: {
  assetVulnerabilityId: string;
  force?: boolean;
}): Promise<ActionResult<AssetVulnerabilityEnrichmentActionData>> {
  return measureServerTiming(
    "action.assetVulnerabilities.retryEnrichment",
    async () => {
      try {
        const identity = await requirePermission("cves.enrich");
        const activeOrganization = await requireActiveOrganization();

        const queued = await queueAssetVulnerabilityEnrichment(
          input.assetVulnerabilityId,
          {
            force: input.force ?? true,
            organizationId: activeOrganization.organization.id,
            triggerSource: "manual_retry",
          }
        );

        revalidatePathSafe(
          "asset_vulnerability.retry_ai",
          `/vulnerabilities/${input.assetVulnerabilityId}`
        );

        await logAuditEventSafe("asset_vulnerability.retry_ai", {
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: queued.ok
            ? "asset_vulnerability.ai_retry_queued"
            : "asset_vulnerability.ai_retry_failed",
          resourceType: "asset_vulnerability",
          resourceId: input.assetVulnerabilityId,
          details: {
            force: input.force ?? true,
            queued: queued.ok ? queued.data.queued : false,
            skippedReason: queued.ok ? queued.data.skippedReason ?? null : null,
            code: queued.ok ? "ok" : queued.code,
            message: queued.ok ? null : queued.message.slice(0, 240),
          },
        });

        if (!queued.ok) {
          return queued;
        }

        if (queued.data.queued) {
          wakeAssetVulnerabilityEnrichmentProcessor({
            action: "asset_vulnerability.retry_ai",
            organizationId: activeOrganization.organization.id,
            assetVulnerabilityId: input.assetVulnerabilityId,
          });
        }

        return ok({
          assetVulnerabilityId: input.assetVulnerabilityId,
          mode: queued.data.queued ? "queued" : "skipped",
          status: queued.data.status,
          message: queueStatusMessage(queued.data.status),
        });
      } catch (error) {
        logActionException("asset_vulnerability.retry_ai.failed", error, {
          assetVulnerabilityId: input.assetVulnerabilityId,
        });
        const result = toActionResult<AssetVulnerabilityEnrichmentActionData>(error);

        if (!result.ok && result.code === "server_error") {
          return err(
            "server_error",
            "Retry AI could not be queued because Fortexa hit a server-side error. The failure was logged safely."
          );
        }

        return result;
      }
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function startAssetVulnerabilityEnrichmentAction(input: {
  assetVulnerabilityId: string;
}): Promise<ActionResult<AssetVulnerabilityEnrichmentActionData>> {
  return measureServerTiming(
    "action.assetVulnerabilities.startEnrichment",
    async () => {
      try {
        const identity = await requirePermission("cves.enrich");
        const activeOrganization = await requireActiveOrganization();

        const queued = await queueAssetVulnerabilityEnrichment(
          input.assetVulnerabilityId,
          {
            force: false,
            organizationId: activeOrganization.organization.id,
            triggerSource: "automatic_page_open",
          }
        );

        await logAuditEventSafe("asset_vulnerability.auto_ai", {
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: queued.ok
            ? "asset_vulnerability.ai_auto_queued"
            : "asset_vulnerability.ai_auto_skipped",
          resourceType: "asset_vulnerability",
          resourceId: input.assetVulnerabilityId,
          details: {
            queued: queued.ok ? queued.data.queued : false,
            skippedReason: queued.ok ? queued.data.skippedReason ?? null : null,
            code: queued.ok ? "ok" : queued.code,
            message: queued.ok ? null : queued.message.slice(0, 240),
          },
        });

        if (!queued.ok) {
          return queued;
        }

        if (queued.data.queued) {
          wakeAssetVulnerabilityEnrichmentProcessor({
            action: "asset_vulnerability.auto_ai",
            organizationId: activeOrganization.organization.id,
            assetVulnerabilityId: input.assetVulnerabilityId,
          });
        }

        revalidatePathSafe(
          "asset_vulnerability.auto_ai",
          `/vulnerabilities/${input.assetVulnerabilityId}`
        );

        return ok({
          assetVulnerabilityId: input.assetVulnerabilityId,
          mode: queued.data.queued ? "queued" : "skipped",
          status: queued.data.status,
          message: queueStatusMessage(queued.data.status),
        });
      } catch (error) {
        logActionException("asset_vulnerability.auto_ai.failed", error, {
          assetVulnerabilityId: input.assetVulnerabilityId,
        });
        const result = toActionResult<AssetVulnerabilityEnrichmentActionData>(error);

        if (!result.ok && result.code === "server_error") {
          return err(
            "server_error",
            "AI enrichment could not be started because Fortexa hit a server-side error. The failure was logged safely."
          );
        }

        return result;
      }
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function updateAssetVulnerabilityStatusAction(input: {
  id: string;
  status: Parameters<typeof updateAssetVulnerabilityStatus>[0]["status"];
  note?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.assetVulnerabilities.updateStatus",
    async () => {
      try {
        const identity = await requirePermission("asset_vulnerabilities.write");
        const activeOrganization = await requireActiveOrganization();
        const row = await updateAssetVulnerabilityStatus({
          ...input,
          organizationId: activeOrganization.organization.id,
          actorProfileId: identity.profile?.id ?? null,
        });

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "asset_vulnerability.status_updated",
          resourceType: "asset_vulnerability",
          resourceId: row.id,
          details: {
            status: row.status,
            note: input.note ?? null,
          },
        });

        revalidatePath("/vulnerabilities");
        revalidatePath(`/vulnerabilities/${row.id}`);
        revalidatePath("/alerts");
        revalidatePath("/dashboard");

        return ok({ id: row.id });
      } catch (error) {
        return toActionResult(error);
      }
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}
