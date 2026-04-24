"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import { runAssetVulnerabilityEnrichment } from "@/lib/services/asset-vulnerability-enrichment";
import { updateAssetVulnerabilityStatus } from "@/lib/services/asset-vulnerabilities";

export async function retryAssetVulnerabilityEnrichmentAction(input: {
  assetVulnerabilityId: string;
  force?: boolean;
}): Promise<
  ActionResult<{
    assetVulnerabilityId: string;
    mode: "queued" | "inline";
  }>
> {
  return measureServerTiming(
    "action.assetVulnerabilities.retryEnrichment",
    async () => {
      try {
        const identity = await requirePermission("cves.enrich");

        const inline = await runAssetVulnerabilityEnrichment(
          input.assetVulnerabilityId,
          {
            force: input.force ?? true,
          }
        );

        revalidatePath(`/vulnerabilities/${input.assetVulnerabilityId}`);

        await logAuditEvent({
          userId: identity.profile?.id ?? null,
          action: inline.ok
            ? "asset_vulnerability.ai_retry_completed"
            : "asset_vulnerability.ai_retry_failed",
          resourceType: "asset_vulnerability",
          resourceId: input.assetVulnerabilityId,
          details: {
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
          assetVulnerabilityId: input.assetVulnerabilityId,
          mode: "inline",
        });
      } catch (error) {
        return toActionResult(error);
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
        const row = await updateAssetVulnerabilityStatus({
          ...input,
          actorProfileId: identity.profile?.id ?? null,
        });

        await logAuditEvent({
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
