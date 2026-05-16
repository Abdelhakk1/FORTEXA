"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  createAsset,
  createAssetSchema,
  updateAssetBusinessContext,
  updateAssetBusinessContextSchema,
} from "@/lib/services/assets";
import {
  bulkAssetClassificationSchema,
  bulkUpdateAssetClassification,
} from "@/lib/services/gab-business-context";
import { recalculateBusinessPrioritiesForOrganization } from "@/lib/services/business-applications";
import {
  ensureDefaultReportDefinitions,
  importAssetsFromCsv,
} from "@/lib/services/ingestion";

export async function createAssetAction(
  input: Parameters<typeof createAsset>[0]
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.assets.create",
    async () => {
      try {
        const identity = await requirePermission("assets.write");
        const activeOrganization = await requireActiveOrganization();
        const parsed = createAssetSchema.parse(input);
        const row = await createAsset(
          parsed,
          identity.profile?.id ?? null,
          activeOrganization.organization.id
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "asset.created",
          resourceType: "asset",
          resourceId: row.id,
          details: {
            assetCode: row.assetCode,
            type: row.type,
          },
        });

        await ensureDefaultReportDefinitions(
          activeOrganization.organization.id,
          identity.profile?.id ?? null
        );

        revalidatePath("/assets");
        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return ok({ id: row.id });
      } catch (error) {
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

export async function updateAssetBusinessContextAction(
  input: Parameters<typeof updateAssetBusinessContext>[1]
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.assets.updateBusinessContext",
    async () => {
      try {
        const identity = await requirePermission("assets.write");
        const activeOrganization = await requireActiveOrganization();
        const parsed = updateAssetBusinessContextSchema.parse(input);
        const row = await updateAssetBusinessContext(
          activeOrganization.organization.id,
          parsed
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "asset.business_context_updated",
          resourceType: "asset",
          resourceId: row.id,
          details: {
            assetCode: row.assetCode,
            gabExposureType: row.gabExposureType,
          },
        });

        revalidatePath("/assets");
        revalidatePath(`/assets/${row.assetCode}`);
        revalidatePath("/vulnerabilities");
        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return ok({ id: row.id });
      } catch (error) {
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

export async function bulkUpdateAssetClassificationAction(
  input: Parameters<typeof bulkUpdateAssetClassification>[1]
): Promise<ActionResult<{ updated: number }>> {
  return measureServerTiming(
    "action.assets.bulkClassification",
    async () => {
      try {
        const identity = await requirePermission("assets.write");
        const activeOrganization = await requireActiveOrganization();
        const parsed = bulkAssetClassificationSchema.parse(input);
        const updated = await bulkUpdateAssetClassification(
          activeOrganization.organization.id,
          parsed
        );

        await recalculateBusinessPrioritiesForOrganization(
          activeOrganization.organization.id
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
          userId: identity.profile?.id ?? null,
          action: "asset.bulk_classification_updated",
          resourceType: "asset",
          resourceId: "bulk",
          details: {
            updated,
            operation: parsed.operation,
            gabExposureType: parsed.gabExposureType,
          },
        });

        revalidatePath("/assets");
        revalidatePath("/vulnerabilities");
        revalidatePath("/dashboard");
        revalidatePath("/reports");

        return ok({ updated });
      } catch (error) {
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
  return measureServerTiming(
    "action.assets.importCsv",
    async () => {
      try {
        const identity = await requirePermission("assets.write");
        const activeOrganization = await requireActiveOrganization();
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
          organizationId: activeOrganization.organization.id,
        });

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
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
    },
    undefined,
    (result) => ({
      ok: result.ok,
      code: result.ok ? "ok" : result.code,
    })
  );
}
