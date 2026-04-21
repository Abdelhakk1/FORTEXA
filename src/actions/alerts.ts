"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  acknowledgeAllNewAlerts,
  updateAlertStatus,
} from "@/lib/services/alerts";

async function revalidateAlertViews() {
  revalidatePath("/alerts");
  revalidatePath("/dashboard");
}

export async function acknowledgeAlertAction(
  alertId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("alerts.acknowledge");
    const row = await updateAlertStatus(alertId, "acknowledged");

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "alert.acknowledged",
      resourceType: "alert",
      resourceId: row.id,
      details: {
        status: row.status,
      },
    });

    await revalidateAlertViews();
    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function resolveAlertAction(
  alertId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("alerts.resolve");
    const row = await updateAlertStatus(
      alertId,
      "resolved",
      identity.profile?.id ?? null
    );

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "alert.resolved",
      resourceType: "alert",
      resourceId: row.id,
      details: {
        status: row.status,
        resolvedBy: identity.profile?.id ?? null,
      },
    });

    await revalidateAlertViews();
    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function dismissAlertAction(
  alertId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const identity = await requirePermission("alerts.resolve");
    const row = await updateAlertStatus(alertId, "dismissed");

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "alert.dismissed",
      resourceType: "alert",
      resourceId: row.id,
      details: {
        status: row.status,
      },
    });

    await revalidateAlertViews();
    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function acknowledgeAllAlertsAction(): Promise<
  ActionResult<{ count: number }>
> {
  try {
    const identity = await requirePermission("alerts.acknowledge");
    const rows = await acknowledgeAllNewAlerts();

    if (!rows.length) {
      return err("not_found", "There are no new alerts to acknowledge.");
    }

    await logAuditEvent({
      userId: identity.profile?.id ?? null,
      action: "alert.bulk_acknowledged",
      resourceType: "alert",
      resourceId: rows[0]!.id,
      details: {
        count: rows.length,
        ids: rows.map((row) => row.id),
      },
    });

    await revalidateAlertViews();
    return ok({ count: rows.length });
  } catch (error) {
    return toActionResult(error);
  }
}
