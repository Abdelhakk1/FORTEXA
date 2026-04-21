"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  createRemediationTask,
  createRemediationTaskSchema,
  updateRemediationStatus,
} from "@/lib/services/remediation";

export async function createRemediationTaskAction(
  input: Parameters<typeof createRemediationTask>[0]
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("remediation.write");
    const parsed = createRemediationTaskSchema.parse(input);
    const row = await createRemediationTask(parsed, identity.profile!.id);

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "remediation_task.created",
      resourceType: "remediation_task",
      resourceId: row.id,
      details: {
        status: row.status,
        priority: row.priority,
      },
    });

    revalidatePath("/remediation");
    revalidatePath("/dashboard");

    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateRemediationStatusAction(
  taskId: string,
  status: Parameters<typeof updateRemediationStatus>[1]
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("remediation.update_status");
    const row = await updateRemediationStatus(taskId, status);

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "remediation_task.status_updated",
      resourceType: "remediation_task",
      resourceId: row.id,
      details: {
        status: row.status,
      },
    });

    revalidatePath("/remediation");
    revalidatePath("/dashboard");

    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}
