"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import { createAsset, createAssetSchema } from "@/lib/services/assets";

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

    revalidatePath("/assets");
    revalidatePath("/dashboard");

    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}
