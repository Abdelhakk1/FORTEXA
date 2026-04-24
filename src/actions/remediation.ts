"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requirePermission } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  createRemediationTask,
  createRemediationTaskSchema,
  getRemediationTask,
  updateRemediationTask,
  updateRemediationTaskSchema,
  updateRemediationStatus,
} from "@/lib/services/remediation";

export async function createRemediationTaskAction(
  input: Parameters<typeof createRemediationTask>[0]
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.remediation.create",
    async () => {
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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function updateRemediationStatusAction(
  taskId: string,
  status: Parameters<typeof updateRemediationStatus>[1]
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.remediation.updateStatus",
    async () => {
      try {
        const identity = await requireAuth();
        const current = await getRemediationTask(taskId);
        const canWrite = identity.permissions.includes("remediation.write");
        const canUpdateOwnStatus =
          identity.permissions.includes("remediation.update_status") &&
          current.assignedTo === identity.profile?.id;

        if (!canWrite && !canUpdateOwnStatus) {
          throw new AppError(
            "forbidden",
            "You do not have permission to update this remediation task."
          );
        }

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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function updateRemediationTaskAction(
  input: Parameters<typeof updateRemediationTask>[0]
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.remediation.updateTask",
    async () => {
      try {
        const identity = await requireAuth();
        const current = await getRemediationTask(input.id);
        const canWrite = identity.permissions.includes("remediation.write");
        const canUpdateStatus = identity.permissions.includes(
          "remediation.update_status"
        );
        const isOwnAssignedTask = current.assignedTo === identity.profile?.id;
        const canUpdateOwnStatus = canUpdateStatus && isOwnAssignedTask;

        if (!canWrite && !canUpdateOwnStatus) {
          throw new AppError(
            "forbidden",
            "You do not have permission to update this remediation task."
          );
        }

        if (!canWrite) {
          if (
            input.assignedTo !== undefined ||
            input.dueDate !== undefined ||
            input.priority !== undefined ||
            input.businessPriority !== undefined
          ) {
            throw new AppError(
              "forbidden",
              "Only users with remediation write access can reassign tasks or change due dates and priority."
            );
          }
        }

        const parsed = updateRemediationTaskSchema.parse(input);
        const row = await updateRemediationTask(parsed);

        await logAuditEvent({
          userId: identity.profile?.id ?? null,
          action: "remediation_task.updated",
          resourceType: "remediation_task",
          resourceId: row.id,
          details: {
            status: row.status,
            assignedTo: row.assignedTo,
            dueDate: row.dueDate,
            priority: row.priority,
            progress: row.progress,
          },
        });

        revalidatePath("/remediation");
        revalidatePath("/dashboard");
        revalidatePath("/alerts");
        if (row.assetVulnerabilityId) {
          revalidatePath(`/vulnerabilities/${row.assetVulnerabilityId}`);
        }

        return ok({ id: row.id });
      } catch (error) {
        return toActionResult(error);
      }
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}
