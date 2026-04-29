import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { alerts, assets, cves, profiles } from "@/db/schema";
import type { Alert } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  formatDate,
  toUiAlertStatus,
  toUiAlertType,
  toUiSeverity,
} from "./serializers";
import { buildPaginatedResult, count, desc, getPagination, ilike, or, searchTerm, sql, type SQL } from "./utils";

export interface AlertListFilters {
  search?: string;
  severity?: string;
  type?: string;
  status?: string;
  ownerId?: string;
  page?: number;
  pageSize?: number;
}

export interface AlertListItem extends Alert {
  dbId: string;
  ownerId: string | null;
}

export const updateAlertStatusSchema = z.object({
  id: z.string().uuid(),
});

function buildAlertWhere(organizationId: string, filters: AlertListFilters) {
  const clauses: SQL[] = [eq(alerts.organizationId, organizationId)];
  const search = searchTerm(filters.search);

  if (search) {
    clauses.push(
      or(
        ilike(alerts.title, search),
        ilike(alerts.description, search),
        ilike(assets.name, search),
        ilike(assets.assetCode, search)
      )!
    );
  }

  if (filters.severity && filters.severity !== "all") {
    clauses.push(eq(alerts.severity, filters.severity as typeof alerts.$inferSelect.severity));
  }

  if (filters.type && filters.type !== "all") {
    clauses.push(eq(alerts.type, filters.type as typeof alerts.$inferSelect.type));
  }

  if (filters.status && filters.status !== "all") {
    clauses.push(eq(alerts.status, filters.status as typeof alerts.$inferSelect.status));
  }

  if (filters.ownerId && filters.ownerId !== "all") {
    clauses.push(eq(alerts.ownerId, filters.ownerId));
  }

  return clauses.length ? and(...clauses) : undefined;
}

function mapAlertRow(row: {
  alert: typeof alerts.$inferSelect;
  assetName: string | null;
  assetCode: string | null;
  cveCode: string | null;
  ownerName: string | null;
}) {
  return {
    dbId: row.alert.id,
    id: row.alert.id,
    title: row.alert.title,
    description: row.alert.description ?? "No alert details available.",
    severity: toUiSeverity(row.alert.severity),
    type: toUiAlertType(row.alert.type),
    relatedAsset: row.assetCode ?? row.assetName ?? "Unlinked",
    relatedCve: row.cveCode ?? "N/A",
    createdAt: formatDate(row.alert.createdAt),
    owner: row.ownerName ?? "Unassigned",
    ownerId: row.alert.ownerId ?? null,
    status: toUiAlertStatus(row.alert.status),
  } satisfies AlertListItem;
}

export async function listAlerts(
  organizationId: string,
  filters: AlertListFilters = {}
) {
  const db = getDb();
  const pagination = getPagination({
    page: filters.page,
    pageSize: filters.pageSize ?? 12,
  });

  if (!db) {
    return {
      alerts: buildPaginatedResult<AlertListItem>([], 0, pagination),
      owners: [],
      summary: {
        total: 0,
        newCount: 0,
        criticalCount: 0,
        triagedCount: 0,
        resolvedCount: 0,
      },
    };
  }

  return measureServerTiming(
    "alerts.list",
    async () => {
      const where = buildAlertWhere(organizationId, filters);

      const [ownerRows, totalRows, alertRows, summaryRows] = await Promise.all([
        db
          .select({
            id: profiles.id,
            fullName: profiles.fullName,
          })
          .from(profiles)
          .orderBy(profiles.fullName),
        db
          .select({ total: count(alerts.id) })
          .from(alerts)
          .leftJoin(assets, eq(alerts.relatedAssetId, assets.id))
          .where(where),
        db
          .select({
            alert: alerts,
            assetName: assets.name,
            assetCode: assets.assetCode,
            cveCode: cves.cveId,
            ownerName: profiles.fullName,
          })
          .from(alerts)
          .leftJoin(assets, eq(alerts.relatedAssetId, assets.id))
          .leftJoin(cves, eq(alerts.relatedCveId, cves.id))
          .leftJoin(profiles, eq(alerts.ownerId, profiles.id))
          .where(where)
          .orderBy(desc(alerts.createdAt))
          .limit(pagination.pageSize)
          .offset(pagination.offset),
        db
          .select({
            total: sql<number>`count(*)::int`,
            newCount:
              sql<number>`count(*) filter (where ${alerts.status} = 'new')::int`,
            criticalCount:
              sql<number>`count(*) filter (where ${alerts.severity} = 'critical')::int`,
            triagedCount:
              sql<number>`count(*) filter (where ${alerts.status} in ('acknowledged', 'in_progress'))::int`,
            resolvedCount:
              sql<number>`count(*) filter (where ${alerts.status} = 'resolved')::int`,
          })
          .from(alerts)
          .where(eq(alerts.organizationId, organizationId)),
      ]);

      const mapped = alertRows.map(mapAlertRow);
      const summary = summaryRows[0];

      return {
        alerts: buildPaginatedResult(
          mapped,
          totalRows[0]?.total ?? 0,
          pagination
        ),
        owners: ownerRows,
        summary: {
          total: summary?.total ?? 0,
          newCount: summary?.newCount ?? 0,
          criticalCount: summary?.criticalCount ?? 0,
          triagedCount: summary?.triagedCount ?? 0,
          resolvedCount: summary?.resolvedCount ?? 0,
        },
      };
    },
    {
      page: pagination.page,
      pageSize: pagination.pageSize,
    },
    (result) => ({
      total: result.alerts.total,
      owners: result.owners.length,
    })
  );
}

export async function listRecentAlertActivity(organizationId: string, limit = 3) {
  const db = getDb();

  if (!db) {
    return {
      unreadCount: 0,
      alerts: [] as AlertListItem[],
    };
  }

  try {
    return await measureServerTiming(
      "alerts.recentActivity",
      async () => {
        const [rows, unreadRows] = await Promise.all([
          db
            .select({
              alert: alerts,
              assetName: assets.name,
              assetCode: assets.assetCode,
              cveCode: cves.cveId,
              ownerName: profiles.fullName,
            })
            .from(alerts)
            .leftJoin(assets, eq(alerts.relatedAssetId, assets.id))
            .leftJoin(cves, eq(alerts.relatedCveId, cves.id))
            .leftJoin(profiles, eq(alerts.ownerId, profiles.id))
            .where(eq(alerts.organizationId, organizationId))
            .orderBy(desc(alerts.createdAt))
            .limit(limit),
          db
            .select({
              unreadCount:
                sql<number>`count(*) filter (where ${alerts.status} = 'new')::int`,
            })
            .from(alerts)
            .where(eq(alerts.organizationId, organizationId)),
        ]);

        return {
          unreadCount: unreadRows[0]?.unreadCount ?? 0,
          alerts: rows.map(mapAlertRow),
        };
      },
      { limit },
      (result) => ({
        unreadCount: result.unreadCount,
        alerts: result.alerts.length,
      })
    );
  } catch {
    return {
      unreadCount: 0,
      alerts: [] as AlertListItem[],
    };
  }
}

export async function updateAlertStatus(
  organizationId: string,
  alertId: string,
  status: "acknowledged" | "resolved" | "dismissed",
  resolvedBy?: string | null
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Alert writes are disabled until the database connection is configured."
    );
  }

  const now = new Date();
  const [row] = await db
    .update(alerts)
    .set({
      status,
      acknowledgedAt: status === "acknowledged" ? now : undefined,
      resolvedAt: status === "resolved" ? now : undefined,
      resolvedBy: status === "resolved" ? resolvedBy ?? null : undefined,
    })
    .where(and(eq(alerts.organizationId, organizationId), eq(alerts.id, alertId)))
    .returning();

  if (!row) {
    throw new AppError("not_found", "Alert not found.");
  }

  return row;
}

export async function acknowledgeAllNewAlerts(organizationId: string) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Alert writes are disabled until the database connection is configured."
    );
  }

  return db
    .update(alerts)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
    })
    .where(and(eq(alerts.organizationId, organizationId), eq(alerts.status, "new")))
    .returning();
}
