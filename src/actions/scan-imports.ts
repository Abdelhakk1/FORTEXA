"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import { processScanImport } from "@/lib/services/ingestion";
import { createScanImportRecord } from "@/lib/services/scan-imports";
import {
  getFortexaStorageBuckets,
  uploadFileToStorage,
} from "@/lib/services/storage";

const MAX_NESSUS_IMPORT_BYTES = 25 * 1024 * 1024;

function buildStoragePath(fileName: string) {
  const now = new Date();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

  return [
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

        const xmlText = await file.text();
        const upload = await uploadFileToStorage({
          bucket: getFortexaStorageBuckets().scanImports,
          path: buildStoragePath(file.name),
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

        const processed = await processScanImport(record.id, {
          xmlText,
          initialWarnings: upload.ok
            ? []
            : [`Storage upload skipped: ${upload.message}`],
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
