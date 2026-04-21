import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, cves, scanFindings } from "@/db/schema";
import {
  formatDate,
  toUiSeverity,
} from "./serializers";
import { buildPaginatedResult, desc, getPagination, type SQL } from "./utils";

export interface ScanFindingFilters {
  scanImportId?: string;
  status?: string;
  matchedAssetId?: string;
  matchedCveId?: string;
  page?: number;
  pageSize?: number;
}

function buildWhere(filters: ScanFindingFilters) {
  const clauses: SQL[] = [];

  if (filters.scanImportId) {
    clauses.push(eq(scanFindings.scanImportId, filters.scanImportId));
  }

  if (filters.status && filters.status !== "all") {
    clauses.push(
      eq(
        scanFindings.status,
        filters.status as typeof scanFindings.$inferSelect.status
      )
    );
  }

  if (filters.matchedAssetId) {
    clauses.push(eq(scanFindings.matchedAssetId, filters.matchedAssetId));
  }

  if (filters.matchedCveId) {
    clauses.push(eq(scanFindings.matchedCveId, filters.matchedCveId));
  }

  return clauses.length ? and(...clauses) : undefined;
}

export async function listScanFindings(filters: ScanFindingFilters = {}) {
  const db = getDb();
  const pagination = getPagination({
    page: filters.page,
    pageSize: filters.pageSize ?? 20,
  });

  if (!db) {
    return buildPaginatedResult([], 0, pagination);
  }

  const where = buildWhere(filters);

  const rows = await db
    .select({
      finding: scanFindings,
      assetCode: assets.assetCode,
      assetName: assets.name,
      cveCode: cves.cveId,
    })
    .from(scanFindings)
    .leftJoin(assets, eq(scanFindings.matchedAssetId, assets.id))
    .leftJoin(cves, eq(scanFindings.matchedCveId, cves.id))
    .where(where)
    .orderBy(desc(scanFindings.createdAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  const total = await db.select({ value: scanFindings.id }).from(scanFindings).where(where);

  return buildPaginatedResult(
    rows.map((row) => ({
      id: row.finding.id,
      findingCode: row.finding.findingCode,
      title: row.finding.title,
      severity: toUiSeverity(row.finding.severity),
      host: row.finding.host,
      port: row.finding.port,
      protocol: row.finding.protocol,
      matchedAssetId: row.finding.matchedAssetId,
      matchedAssetCode: row.assetCode ?? null,
      matchedAssetName: row.assetName ?? null,
      matchedCveId: row.finding.matchedCveId,
      matchedCveCode: row.cveCode ?? null,
      status: row.finding.status,
      firstSeen: formatDate(row.finding.firstSeen),
      lastSeen: formatDate(row.finding.lastSeen),
    })),
    total.length,
    pagination
  );
}
