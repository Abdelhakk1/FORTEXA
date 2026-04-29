"use server";

import { revalidatePath } from "next/cache";
import { logAuditEvent } from "@/lib/audit";
import { requireActiveOrganization, requirePermission } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
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
  return measureServerTiming(
    "action.alerts.acknowledge",
    async () => {
      try {
        const identity = await requirePermission("alerts.acknowledge");
        const activeOrganization = await requireActiveOrganization();
        const row = await updateAlertStatus(
          activeOrganization.organization.id,
          alertId,
          "acknowledged"
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function resolveAlertAction(
  alertId: string
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.alerts.resolve",
    async () => {
      try {
        const identity = await requirePermission("alerts.resolve");
        const activeOrganization = await requireActiveOrganization();
        const row = await updateAlertStatus(
          activeOrganization.organization.id,
          alertId,
          "resolved",
          identity.profile?.id ?? null
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function dismissAlertAction(
  alertId: string
): Promise<ActionResult<{ id: string }>> {
  return measureServerTiming(
    "action.alerts.dismiss",
    async () => {
      try {
        const identity = await requirePermission("alerts.resolve");
        const activeOrganization = await requireActiveOrganization();
        const row = await updateAlertStatus(
          activeOrganization.organization.id,
          alertId,
          "dismissed"
        );

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}

export async function acknowledgeAllAlertsAction(): Promise<
  ActionResult<{ count: number }>
> {
  return measureServerTiming(
    "action.alerts.acknowledgeAll",
    async () => {
      try {
        const identity = await requirePermission("alerts.acknowledge");
        const activeOrganization = await requireActiveOrganization();
        const rows = await acknowledgeAllNewAlerts(activeOrganization.organization.id);

        if (!rows.length) {
          return err("not_found", "There are no new alerts to acknowledge.");
        }

        await logAuditEvent({
          organizationId: activeOrganization.organization.id,
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
    },
    undefined,
    (result) => ({ ok: result.ok, code: result.ok ? "ok" : result.code })
  );
}
