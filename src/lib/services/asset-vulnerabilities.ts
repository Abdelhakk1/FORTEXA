import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assetVulnerabilities, assets, cves } from "@/db/schema";
import {
  formatDate,
  toUiBusinessPriority,
  toUiSeverity,
  toUiSlaStatus,
} from "./serializers";
import { buildPaginatedResult, desc, getPagination, type SQL } from "./utils";

export interface AssetVulnerabilityFilters {
  status?: string;
  businessPriority?: string;
  slaStatus?: string;
  sortBy?: "riskScore" | "slaDue" | "lastSeen";
  page?: number;
  pageSize?: number;
}

function buildWhere(filters: AssetVulnerabilityFilters) {
  const clauses: SQL[] = [];

  if (filters.status && filters.status !== "all") {
    clauses.push(
      eq(
        assetVulnerabilities.status,
        filters.status as typeof assetVulnerabilities.$inferSelect.status
      )
    );
  }

  if (filters.businessPriority && filters.businessPriority !== "all") {
    clauses.push(
      eq(
        assetVulnerabilities.businessPriority,
        filters.businessPriority as typeof assetVulnerabilities.$inferSelect.businessPriority
      )
    );
  }

  if (filters.slaStatus && filters.slaStatus !== "all") {
    clauses.push(
      eq(
        assetVulnerabilities.slaStatus,
        filters.slaStatus as typeof assetVulnerabilities.$inferSelect.slaStatus
      )
    );
  }

  return clauses.length ? and(...clauses) : undefined;
}

export async function listAssetVulnerabilities(
  filters: AssetVulnerabilityFilters = {}
) {
  const db = getDb();
  const pagination = getPagination({
    page: filters.page,
    pageSize: filters.pageSize ?? 12,
  });

  if (!db) {
    return buildPaginatedResult([], 0, pagination);
  }

  const where = buildWhere(filters);
  const orderBy =
    filters.sortBy === "slaDue"
      ? desc(assetVulnerabilities.slaDue)
      : filters.sortBy === "lastSeen"
        ? desc(assetVulnerabilities.lastSeen)
        : desc(assetVulnerabilities.riskScore);

  const rows = await db
    .select({
      av: assetVulnerabilities,
      assetName: assets.name,
      assetCode: assets.assetCode,
      cveCode: cves.cveId,
      title: cves.title,
      severity: cves.severity,
      cvssScore: cves.cvssScore,
    })
    .from(assetVulnerabilities)
    .leftJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
    .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .where(where)
    .orderBy(orderBy)
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  const total = await db.select({ value: assetVulnerabilities.id }).from(assetVulnerabilities).where(where);

  return buildPaginatedResult(
    rows.map((row) => ({
      id: row.av.id,
      assetId: row.av.assetId,
      assetCode: row.assetCode ?? "—",
      assetName: row.assetName ?? "Unlinked asset",
      cveId: row.cveCode ?? "—",
      title: row.title ?? "Unlinked CVE",
      severity: toUiSeverity(row.severity),
      cvssScore: row.cvssScore ? Number(row.cvssScore) : null,
      status: row.av.status,
      businessPriority: toUiBusinessPriority(row.av.businessPriority),
      riskScore: row.av.riskScore,
      slaDue: formatDate(row.av.slaDue),
      slaStatus: toUiSlaStatus(row.av.slaStatus),
      lastSeen: formatDate(row.av.lastSeen),
      firstSeen: formatDate(row.av.firstSeen),
    })),
    total.length,
    pagination
  );
}
