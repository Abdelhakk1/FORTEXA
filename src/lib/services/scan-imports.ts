import "server-only";

import { z } from "zod";
import { desc as drizzleDesc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alerts,
  assets,
  cves,
  profiles,
  scanFindings,
  scanImports,
} from "@/db/schema";
import type { ScanImport } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatFileSize,
  toUiAlertStatus,
  toUiImportStatus,
  toUiScannerSource,
  toUiSeverity,
} from "./serializers";
import { buildPaginatedResult, count, desc, getPagination, sql } from "./utils";
import { createSignedStorageUrl, getFortexaStorageBuckets } from "./storage";

export interface ScanImportListItem extends ScanImport {
  dbId: string;
  importedById: string | null;
}

export interface ScanImportDetailData {
  scanImport: ScanImportListItem;
  downloadUrl: string | null;
  severityDistribution: Array<{
    label: "Critical" | "High" | "Medium" | "Low" | "Info";
    count: number;
    color: string;
  }>;
  findings: Array<{
    id: string;
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    host: string;
    port: number | null;
    protocol: string | null;
    matchedAssetCode: string | null;
    matchedCveCode: string | null;
    status: string;
    lastSeen: string;
  }>;
  steps: Array<{
    label: string;
    status: "complete" | "warning" | "pending";
    detail: string;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    createdAt: string;
    status: string;
  }>;
  timeline: Array<{
    time: string;
    event: string;
    user: string;
    level: "INFO" | "WARN";
  }>;
}

type ScanImportErrorDetails = NonNullable<ScanImport["errorDetails"]>;

export const createScanImportRecordSchema = z.object({
  name: z.string().trim().min(3).max(255),
  scannerSource: z.literal("nessus"),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().nonnegative().optional(),
  storagePath: z.string().trim().min(1).max(1024).nullable().optional(),
  importedBy: z.string().uuid().nullable().optional(),
});

function mapScanImportRow(row: {
  scanImport: typeof scanImports.$inferSelect;
  importedByName: string | null;
}) {
  const errorDetails = normalizeScanImportErrorDetails(
    row.scanImport.errorDetails
  );

  return {
    dbId: row.scanImport.id,
    id: row.scanImport.id,
    name: row.scanImport.name,
    scannerSource: toUiScannerSource(row.scanImport.scannerSource),
    importDate: formatDate(row.scanImport.importDate),
    importedBy: row.importedByName ?? "System",
    importedById: row.scanImport.importedBy ?? null,
    fileName: row.scanImport.fileName,
    fileSize: formatFileSize(row.scanImport.fileSize),
    assetsFound: row.scanImport.assetsFound,
    findingsFound: row.scanImport.findingsFound,
    cvesLinked: row.scanImport.cvesLinked,
    newAssets: row.scanImport.newAssets,
    matchedAssets: row.scanImport.matchedAssets,
    newFindings: row.scanImport.newFindings,
    fixedFindings: row.scanImport.fixedFindings,
    reopenedFindings: row.scanImport.reopenedFindings,
    unchangedFindings: row.scanImport.unchangedFindings,
    lowConfidenceMatches: row.scanImport.lowConfidenceMatches,
    newVulnerabilities: row.scanImport.newVulnerabilities,
    closedVulnerabilities: row.scanImport.closedVulnerabilities,
    errors: row.scanImport.errors,
    warnings: row.scanImport.warnings,
    errorDetails,
    status: toUiImportStatus(row.scanImport.status),
    processingTime: formatDuration(row.scanImport.processingTimeMs),
  } satisfies ScanImportListItem;
}

function toStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : undefined;
}

function normalizeScanImportErrorDetails(
  value: Record<string, unknown> | null | undefined
): ScanImportErrorDetails | null {
  if (!value) {
    return null;
  }

  return {
    message: typeof value.message === "string" ? value.message : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    errorName:
      typeof value.errorName === "string" ? value.errorName : undefined,
    causeCode:
      typeof value.causeCode === "string" || value.causeCode === null
        ? value.causeCode
        : undefined,
    errors: toStringList(value.errors),
    warnings: toStringList(value.warnings),
  };
}

export async function listScanImports(page = 1, pageSize = 10) {
  const db = getDb();
  const pagination = getPagination({ page, pageSize });

  if (!db) {
    return {
      imports: buildPaginatedResult<ScanImportListItem>([], 0, pagination),
      summary: {
        totalImports: 0,
        totalFindings: 0,
        totalAssetsMapped: 0,
        averageProcessingTime: "0s",
      },
    };
  }

  try {
    return await measureServerTiming(
      "scanImports.list",
      async () => {
        const [totalRows, rows, summaryRows] = await Promise.all([
          db.select({ total: count(scanImports.id) }).from(scanImports),
          db
            .select({
              scanImport: scanImports,
              importedByName: profiles.fullName,
            })
            .from(scanImports)
            .leftJoin(profiles, eq(scanImports.importedBy, profiles.id))
            .orderBy(desc(scanImports.importDate))
            .limit(pagination.pageSize)
            .offset(pagination.offset),
          db
            .select({
              totalImports: sql<number>`count(*)::int`,
              totalFindings: sql<number>`coalesce(sum(${scanImports.findingsFound}), 0)::int`,
              totalAssetsMapped: sql<number>`coalesce(sum(${scanImports.assetsFound}), 0)::int`,
              averageProcessingTimeMs:
                sql<number>`coalesce(avg(${scanImports.processingTimeMs}), 0)::int`,
            })
            .from(scanImports),
        ]);

        const summary = summaryRows[0];

        return {
          imports: buildPaginatedResult(
            rows.map(mapScanImportRow),
            totalRows[0]?.total ?? 0,
            pagination
          ),
          summary: {
            totalImports: summary?.totalImports ?? 0,
            totalFindings: summary?.totalFindings ?? 0,
            totalAssetsMapped: summary?.totalAssetsMapped ?? 0,
            averageProcessingTime: formatDuration(
              summary?.averageProcessingTimeMs ?? 0
            ),
          },
        };
      },
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
      (result) => ({
        total: result.imports.total,
      })
    );
  } catch {
    return {
      imports: buildPaginatedResult<ScanImportListItem>([], 0, pagination),
      summary: {
        totalImports: 0,
        totalFindings: 0,
        totalAssetsMapped: 0,
        averageProcessingTime: "0s",
      },
    };
  }
}

export async function createScanImportRecord(
  input: z.input<typeof createScanImportRecordSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Scan import writes are disabled until the database connection is configured."
    );
  }

  const parsed = createScanImportRecordSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(
      "validation_error",
      "Please correct the scan import fields.",
      parsed.error.flatten().fieldErrors
    );
  }

  const [row] = await db
    .insert(scanImports)
    .values({
      ...parsed.data,
      fileSize: parsed.data.fileSize ?? null,
      storagePath: parsed.data.storagePath ?? null,
      importedBy: parsed.data.importedBy ?? null,
      status: "processing",
    })
    .returning();

  return row;
}

export async function getScanImportDetail(
  importId: string
): Promise<ScanImportDetailData | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [scanImportRow] = await db
    .select({
      scanImport: scanImports,
      importedByName: profiles.fullName,
    })
    .from(scanImports)
    .leftJoin(profiles, eq(scanImports.importedBy, profiles.id))
    .where(eq(scanImports.id, importId))
    .limit(1);

  if (!scanImportRow) {
    return null;
  }

  const mappedImport = mapScanImportRow(scanImportRow);

  const findingRows = await db
    .select({
      finding: scanFindings,
      matchedAssetCode: assets.assetCode,
      matchedCveCode: cves.cveId,
    })
    .from(scanFindings)
    .leftJoin(assets, eq(scanFindings.matchedAssetId, assets.id))
    .leftJoin(cves, eq(scanFindings.matchedCveId, cves.id))
    .where(eq(scanFindings.scanImportId, importId))
    .orderBy(drizzleDesc(scanFindings.severity), drizzleDesc(scanFindings.lastSeen))
    .limit(100);

  const findings = findingRows.map(({ finding, matchedAssetCode, matchedCveCode }) => ({
    id: finding.id,
    title: finding.title,
    severity: toUiSeverity(finding.severity),
    host: finding.host,
    port: finding.port ?? null,
    protocol: finding.protocol ?? null,
    matchedAssetCode: matchedAssetCode ?? null,
    matchedCveCode: matchedCveCode ?? null,
    status: finding.status,
    lastSeen: formatDate(finding.lastSeen),
  }));

  const severityDistribution = [
    { label: "Critical", count: findings.filter((row) => row.severity === "CRITICAL").length, color: "#EF4444" },
    { label: "High", count: findings.filter((row) => row.severity === "HIGH").length, color: "#F59E0B" },
    { label: "Medium", count: findings.filter((row) => row.severity === "MEDIUM").length, color: "#3B82F6" },
    { label: "Low", count: findings.filter((row) => row.severity === "LOW").length, color: "#10B981" },
    { label: "Info", count: findings.filter((row) => row.severity === "INFO").length, color: "#94A3B8" },
  ] as const;

  const alertRows = await db
    .select({
      alert: alerts,
    })
    .from(alerts)
    .where(eq(alerts.relatedScanImportId, importId))
    .orderBy(desc(alerts.createdAt))
    .limit(10);

  const alertsData = alertRows.map(({ alert }) => ({
    id: alert.id,
    title: alert.title,
    severity: toUiSeverity(alert.severity),
    createdAt: formatDateTime(alert.createdAt),
    status: toUiAlertStatus(alert.status),
  }));

  const steps: ScanImportDetailData["steps"] = [
    {
      label: "File Upload",
      status: "complete" as const,
      detail: `${mappedImport.fileName} (${mappedImport.fileSize})`,
    },
    {
      label: "Parsing",
      status:
        scanImportRow.scanImport.status === "failed" ? "warning" : "complete",
      detail: `${mappedImport.scannerSource} parsing handled server-side`,
    },
    {
      label: "Normalization",
      status:
        scanImportRow.scanImport.status === "processing" ? "pending" : "complete",
      detail: `${mappedImport.findingsFound} findings normalized`,
    },
    {
      label: "Asset Mapping",
      status:
        scanImportRow.scanImport.errors > 0 ||
        scanImportRow.scanImport.lowConfidenceMatches > 0
          ? "warning"
          : "complete",
      detail: `${mappedImport.newAssets} new assets, ${mappedImport.matchedAssets} matched assets, ${mappedImport.lowConfidenceMatches} low-confidence match(es)`,
    },
    {
      label: "CVE Linking",
      status:
        scanImportRow.scanImport.status === "processing" ? "pending" : "complete",
      detail: `${mappedImport.cvesLinked} CVEs linked`,
    },
    {
      label: "Delta Analysis",
      status:
        scanImportRow.scanImport.status === "processing" ? "pending" : "complete",
      detail: `${mappedImport.newFindings} new, ${mappedImport.reopenedFindings} reopened, ${mappedImport.fixedFindings} fixed, ${mappedImport.unchangedFindings} unchanged`,
    },
  ];

  const timeline = [
    {
      time: formatDateTime(scanImportRow.scanImport.createdAt),
      event: "Import record created",
      user: mappedImport.importedBy,
      level: "INFO" as const,
    },
    {
      time: formatDateTime(scanImportRow.scanImport.updatedAt),
      event: `Import status is ${mappedImport.status}`,
      user: mappedImport.importedBy,
      level: scanImportRow.scanImport.errors > 0 ? "WARN" as const : "INFO" as const,
    },
  ];

  let downloadUrl: string | null = null;
  if (scanImportRow.scanImport.storagePath) {
    const signedUrl = await createSignedStorageUrl({
      bucket: getFortexaStorageBuckets().scanImports,
      path: scanImportRow.scanImport.storagePath,
    });
    if (signedUrl.ok) {
      downloadUrl = signedUrl.data.signedUrl;
    }
  }

  return {
    scanImport: mappedImport,
    downloadUrl,
    severityDistribution: [...severityDistribution],
    findings,
    steps,
    alerts: alertsData,
    timeline,
  };
}
