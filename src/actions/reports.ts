"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  createReportDownloadUrl,
  generateReportCsv,
} from "@/lib/services/reports";

export async function generateReportAction(
  definitionId: string
): Promise<ActionResult<{ id: string; signedUrl: string | null; name: string }>> {
  try {
    const identity = await requirePermission("reports.write");
    const active = await requireActiveOrganization();
    const result = await generateReportCsv({
      organizationId: active.organization.id,
      definitionId,
      generatedBy: identity.profile?.id ?? null,
    });

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "report.generated",
      resourceType: "generated_report",
      resourceId: result.generated.id,
      details: {
        reportDefinitionId: definitionId,
        reportKind: result.report.kind,
        fileFormat: "csv",
      },
    });
    revalidatePath("/reports");
    return ok({
      id: result.generated.id,
      signedUrl: result.signedUrl,
      name: result.report.name,
    });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createReportDownloadUrlAction(
  generatedReportId: string
): Promise<ActionResult<{ signedUrl: string }>> {
  try {
    await requirePermission("reports.read");
    const active = await requireActiveOrganization();
    const signedUrl = await createReportDownloadUrl(
      active.organization.id,
      generatedReportId
    );

    return ok({ signedUrl });
  } catch (error) {
    return toActionResult(error);
  }
}
