"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import { runCveEnrichment } from "@/lib/services/cve-enrichment";

export async function retryCveEnrichmentAction(input: {
  cveId: string;
  cveCode: string;
  force?: boolean;
}): Promise<
  ActionResult<{
    cveId: string;
    status: "pending" | "completed" | "failed";
    mode: "queued" | "inline";
  }>
> {
  try {
    const identity = await requirePermission("cves.enrich");
    const active = await requireActiveOrganization();

    const inline = await runCveEnrichment(input.cveId, {
      force: input.force ?? true,
    });

    revalidatePath("/vulnerabilities");
    revalidatePath(`/vulnerabilities/${input.cveCode}`);

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: inline.ok ? "cve.ai_retry_completed" : "cve.ai_retry_failed",
      resourceType: "cve",
      resourceId: input.cveId,
      details: {
        cveCode: input.cveCode,
        force: input.force ?? true,
        status: inline.ok ? inline.data.status : "failed",
        code: inline.ok ? "ok" : inline.code,
        message: inline.ok ? null : inline.message.slice(0, 240),
      },
    });

    if (!inline.ok) {
      return inline;
    }

    return ok({
      cveId: input.cveId,
      status: inline.data.status === "failed" ? "failed" : "completed",
      mode: "inline",
    });
  } catch (error) {
    return toActionResult(error);
  }
}
