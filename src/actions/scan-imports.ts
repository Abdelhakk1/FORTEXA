"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { createScanImportRecord } from "@/lib/services/scan-imports";
import {
  fortexaEventNames,
  sendFortexaEvent,
} from "@/lib/services/inngest";
import {
  getFortexaStorageBuckets,
  uploadFileToStorage,
} from "@/lib/services/storage";

function buildStoragePath(fileName: string) {
  const now = new Date();
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");

  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${now.getTime()}-${safeFileName}`,
  ].join("/");
}

export async function createScanImportAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("scan_imports.write");
    const file = formData.get("file");
    const name = String(formData.get("name") ?? "").trim();
    const scannerSource = String(formData.get("scannerSource") ?? "other");

    if (!(file instanceof File) || !file.size) {
      return err("validation_error", "Please choose a scan file to upload.", {
        file: ["A scan file is required."],
      });
    }

    const upload = await uploadFileToStorage({
      bucket: getFortexaStorageBuckets().scanImports,
      path: buildStoragePath(file.name),
      file,
    });

    if (!upload.ok) {
      return upload;
    }

    const record = await createScanImportRecord({
      name: name || file.name,
      scannerSource:
        scannerSource === "nessus" ||
        scannerSource === "openvas" ||
        scannerSource === "nmap" ||
        scannerSource === "qualys"
          ? scannerSource
          : "other",
      fileName: upload.data.fileName,
      fileSize: upload.data.size,
      storagePath: upload.data.path,
      importedBy: identity.profile?.id ?? null,
    });

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "scan_import.created",
      resourceType: "scan_import",
      resourceId: record.id,
      details: {
        fileName: record.fileName,
        scannerSource: record.scannerSource,
        storagePath: record.storagePath,
      },
    });

    await sendFortexaEvent({
      name: fortexaEventNames.scanImportRequested,
      data: {
        scanImportId: record.id,
        storagePath: record.storagePath,
        scannerSource: record.scannerSource,
        importedBy: record.importedBy,
      },
    });

    revalidatePath("/scan-import");
    revalidatePath("/dashboard");

    return ok({ id: record.id });
  } catch (error) {
    return toActionResult(error);
  }
}
