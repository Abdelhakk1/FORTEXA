"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import { queueCveEnrichment, runCveEnrichment } from "@/lib/services/cve-enrichment";

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
    await requirePermission("cves.enrich");

    const queued = await queueCveEnrichment(input.cveId, {
      force: input.force ?? true,
    });

    if (queued.ok) {
      revalidatePath("/vulnerabilities");
      revalidatePath(`/vulnerabilities/${input.cveCode}`);

      return ok({
        cveId: input.cveId,
        status: queued.data.status,
        mode: "queued",
      });
    }

    const inline = await runCveEnrichment(input.cveId, {
      force: input.force ?? true,
    });

    if (!inline.ok) {
      return inline;
    }

    revalidatePath("/vulnerabilities");
    revalidatePath(`/vulnerabilities/${input.cveCode}`);

    return ok({
      cveId: input.cveId,
      status: inline.data.status === "failed" ? "failed" : "completed",
      mode: "inline",
    });
  } catch (error) {
    return toActionResult(error);
  }
}
