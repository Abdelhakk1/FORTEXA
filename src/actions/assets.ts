"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { createAsset, createAssetSchema } from "@/lib/services/assets";
import {
  ensureDefaultReportDefinitions,
  importAssetsFromCsv,
} from "@/lib/services/ingestion";

export async function createAssetAction(
  input: Parameters<typeof createAsset>[0]
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("assets.write");
    const parsed = createAssetSchema.parse(input);
    const row = await createAsset(parsed, identity.profile?.id ?? null);

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "asset.created",
      resourceType: "asset",
      resourceId: row.id,
      details: {
        assetCode: row.assetCode,
        type: row.type,
      },
    });

    await ensureDefaultReportDefinitions(identity.profile?.id ?? null);

    revalidatePath("/assets");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function importAssetsCsvAction(
  formData: FormData
): Promise<
  ActionResult<{
    totalRows: number;
    createdAssets: number;
    updatedAssets: number;
    errors: Array<{ rowNumber: number; message: string }>;
  }>
> {
  try {
    const identity = await requirePermission("assets.write");
    const file = formData.get("file");

    if (!(file instanceof File) || !file.size) {
      return err("validation_error", "Please choose a CSV file to import.", {
        file: ["A CSV file is required."],
      });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return err("validation_error", "FORTEXA asset imports only accept CSV files.", {
        file: ["Upload a .csv file."],
      });
    }

    const result = await importAssetsFromCsv({
      file,
      importedBy: identity.profile?.id ?? null,
    });

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "asset.csv_imported",
      resourceType: "asset_import",
      resourceId: `csv:${file.name}`,
      details: {
        fileName: file.name,
        totalRows: result.totalRows,
        createdAssets: result.createdAssets,
        updatedAssets: result.updatedAssets,
        errorCount: result.errors.length,
      },
    });

    revalidatePath("/assets");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return ok(result);
  } catch (error) {
    return toActionResult(error);
  }
}
