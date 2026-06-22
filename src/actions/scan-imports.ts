"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import { processScanImport } from "@/lib/services/ingestion";
import { processPendingAssetVulnerabilityEnrichments } from "@/lib/services/asset-vulnerability-enrichment";
import { fortexaEventNames, sendFortexaEvent } from "@/lib/services/inngest";
import { createScanImportRecord } from "@/lib/services/scan-imports";
import {
  getFortexaStorageBuckets,
  uploadFileToStorage,
} from "@/lib/services/storage";

const MAX_NESSUS_IMPORT_BYTES = 25 * 1024 * 1024;

function buildStoragePath(organizationId: string, fileName: string) {
  const now = new Date();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

  return [
    organizationId,
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${now.getTime()}-${safeFileName}`,
  ].join("/");
}

async function fileLooksLikeNessusXml(file: File) {
  const sample = await file.slice(0, 8 * 1024).text();
  return /<NessusClientData_v2(?:\s|>)/.test(sample);
}

function isConnectionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: unknown; cause?: unknown; message?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  return (
    code === "CONNECT_TIMEOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.toLowerCase().includes("connect timeout") ||
    isConnectionFailure(maybeError.cause)
  );
}

function wakePostImportEnrichmentProcessor(input: {
  organizationId: string;
  scanImportId: string;
}) {
  try {
    after(async () => {
      try {
        const result = await processPendingAssetVulnerabilityEnrichments({
          organizationId: input.organizationId,
          limit: 2,
          triggerSource: "automatic_import",
        });

        console.info("[scan-import-action]", {
          action: "scan_import.ai_processor_wake_finished",
          organizationId: input.organizationId,
          scanImportId: input.scanImportId,
          ok: result.ok,
          code: result.ok ? "ok" : result.code,
          result: result.ok ? result.data : null,
          message: result.ok ? null : result.message.slice(0, 240),
        });
      } catch (error) {
        console.error("[scan-import-action]", {
          action: "scan_import.ai_processor_wake_failed",
          organizationId: input.organizationId,
          scanImportId: input.scanImportId,
          errorName: error instanceof Error ? error.name : "unknown",
          message:
            error instanceof Error
              ? error.message.slice(0, 240)
              : "Unknown post-import AI processor wake failure",
        });
      }
    });
  } catch (error) {
    console.error("[scan-import-action]", {
      action: "scan_import.ai_processor_wake_schedule_failed",
      organizationId: input.organizationId,
      scanImportId: input.scanImportId,
      errorName: error instanceof Error ? error.name : "unknown",
      message:
        error instanceof Error
          ? error.message.slice(0, 240)
          : "Unknown post-import AI processor scheduling failure",
    });
  }
}

export async function createScanImportAction(
  formData: FormData
): Promise<ActionResult<{ id: string; status: string }>> {
  return measureServerTiming(
    "action.scanImports.create",
    async () => {
      try {
        const identity = await requirePermission("scan_imports.write");
        const activeOrganization = await requireActiveOrganization();
        const file = formData.get("file");
        const name = String(formData.get("name") ?? "").trim();
        const scannerSource = String(formData.get("scannerSource") ?? "nessus");

        if (!(file instanceof File) || !file.size) {
          return err("validation_error", "Please choose a scan file to upload.", {
            file: ["A scan file is required."],
          });
        }

        if (!file.name.toLowerCase().endsWith(".nessus")) {
          return err(
            "validation_error",
            "FORTEXA MVP imports only Nessus (.nessus) files right now.",
            {
              file: ["Upload a Nessus (.nessus) file."],
            }
          );
        }

        if (file.size > MAX_NESSUS_IMPORT_BYTES) {
          return err(
            "validation_error",
            "The Nessus file is too large for synchronous import. Use a file up to 25 MB for this workflow.",
            {
              file: ["Upload a Nessus file up to 25 MB."],
            }
          );
        }

        if (!(await fileLooksLikeNessusXml(file))) {
          return err(
            "validation_error",
            "The uploaded file does not look like a Nessus v2 XML export.",
            {
              file: ["Upload a valid NessusClientData_v2 .nessus export."],
            }
          );
        }

        if (scannerSource !== "nessus") {
          return err(
            "validation_error",
            "Only the Nessus importer is enabled for the MVP workflow."
          );
        }

        const upload = await uploadFileToStorage({
          bucket: getFortexaStorageBuckets().scanImports,
          path: buildStoragePath(activeOrganization.organization.id, file.name),
          file,
        });

        const record = await createScanImportRecord({
          name: name || file.name,
          scannerSource: "nessus",
          fileName: file.name,
          fileSize: file.size,
          storagePath: upload.ok ? upload.data.path : null,
          importedBy: identity.profile?.id ?? null,
          organizationId: activeOrganization.organization.id,
        });

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "scan_import.created",
          resourceType: "scan_import",
          resourceId: record.id,
          details: {
            fileName: record.fileName,
            scannerSource: record.scannerSource,
            storagePath: record.storagePath,
            storageStatus: upload.ok ? "stored" : "skipped",
          },
        });

        let queueFallbackWarning: string | null = null;

        if (upload.ok) {
          const queued = await sendFortexaEvent({
            name: fortexaEventNames.scanImportRequested,
            data: {
              organizationId: activeOrganization.organization.id,
              scanImportId: record.id,
            },
          });

          await logAuditEvent({
            organizationId: activeOrganization.organization.id,
            userId: identity.profile?.id ?? null,
            action: queued.ok
              ? "scan_import.processing_queued"
              : "scan_import.processing_queue_fallback",
            resourceType: "scan_import",
            resourceId: record.id,
            details: {
              queueStatus: queued.ok ? "queued" : "fallback_inline",
              queueMessage: queued.ok ? null : queued.message,
            },
          });

          if (queued.ok) {
            revalidatePath("/scan-import");
            revalidatePath("/dashboard");
            revalidatePath("/alerts");

            return ok({ id: record.id, status: "processing" });
          }

          queueFallbackWarning = `Background import queue skipped: ${queued.message}`;
        }

        const xmlText = await file.text();
        const processed = await processScanImport(record.id, {
          xmlText,
          initialWarnings: [
            ...(upload.ok ? [] : [`Storage upload skipped: ${upload.message}`]),
            ...(queueFallbackWarning ? [queueFallbackWarning] : []),
          ],
        });

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: `scan_import.${processed.status}`,
          resourceType: "scan_import",
          resourceId: record.id,
          details: {
            status: processed.status,
            createdAssets: processed.createdAssets,
            createdFindings: processed.createdFindings,
            createdVulnerabilities: processed.createdVulnerabilities,
            warnings: processed.warnings.length,
            errors: processed.errors.length,
          },
        });

        revalidatePath("/scan-import");
        revalidatePath("/dashboard");
        revalidatePath("/assets");
        revalidatePath("/vulnerabilities");
        revalidatePath("/alerts");
        revalidatePath("/reports");

        if (processed.status === "failed") {
          return err(
            "validation_error",
            processed.errors[0] ??
              "The Nessus file could not be processed. Review the failed import row for details."
          );
        }

        wakePostImportEnrichmentProcessor({
          organizationId: activeOrganization.organization.id,
          scanImportId: record.id,
        });

        return ok({ id: record.id, status: processed.status });
      } catch (error) {
        if (isConnectionFailure(error)) {
          return err(
            "service_unavailable",
            "Could not reach Supabase while importing. Check your connection and retry."
          );
        }

        return toActionResult(error);
      }
    },
    undefined,
    (result) => ({
      ok: result.ok,
      code: result.ok ? "ok" : result.code,
    })
  );
}
