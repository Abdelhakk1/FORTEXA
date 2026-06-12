import "server-only";

import { z } from "zod";
import { and, desc as drizzleDesc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilityEnrichments,
  assetVulnerabilities,
  assets,
  cves,
  organizationSettings,
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
  aiEnrichment: ScanImportAiEnrichmentSummary;
}

export interface ScanImportAiEnrichmentSummary {
  enabled: boolean;
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  missing: number;
}

export interface ScanImportDetailData {
  scanImport: ScanImportListItem;
  aiEnrichment: ScanImportAiEnrichmentSummary;
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
  organizationId: z.string().uuid(),
});

const emptyAiEnrichmentSummary: ScanImportAiEnrichmentSummary = {
  enabled: false,
  total: 0,
  queued: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  missing: 0,
};

function mapScanImportRow(
  row: {
  scanImport: typeof scanImports.$inferSelect;
  importedByName: string | null;
  },
  aiEnrichment: ScanImportAiEnrichmentSummary = emptyAiEnrichmentSummary
) {
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
    aiEnrichment,
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

async function listScanImportAiEnrichmentSummaries(
  db: NonNullable<ReturnType<typeof getDb>>,
  organizationId: string,
  importIds: string[]
) {
  const uniqueImportIds = Array.from(new Set(importIds)).filter(Boolean);
  const summaries = new Map<string, ScanImportAiEnrichmentSummary>();

  if (uniqueImportIds.length === 0) {
    return summaries;
  }

  const [settings] = await db
    .select({
      aiEnabled: organizationSettings.aiEnabled,
      aiConsentAccepted: organizationSettings.aiConsentAccepted,
    })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);
  const enabled = Boolean(settings?.aiEnabled && settings.aiConsentAccepted);

  const rows = await db
    .select({
      importId: assetVulnerabilities.sourceScanImportId,
      total: sql<number>`count(*)::int`,
      queued: sql<number>`count(*) filter (where ${assetVulnerabilityEnrichments.enrichmentStatus} = 'pending')::int`,
      processing: sql<number>`count(*) filter (where ${assetVulnerabilityEnrichments.enrichmentStatus} = 'processing')::int`,
      completed: sql<number>`count(*) filter (where ${assetVulnerabilityEnrichments.enrichmentStatus} = 'completed')::int`,
      failed: sql<number>`count(*) filter (where ${assetVulnerabilityEnrichments.enrichmentStatus} = 'failed')::int`,
      missing: sql<number>`count(*) filter (where ${assetVulnerabilityEnrichments.id} is null)::int`,
    })
    .from(assetVulnerabilities)
    .leftJoin(
      assetVulnerabilityEnrichments,
      eq(
        assetVulnerabilities.id,
        assetVulnerabilityEnrichments.assetVulnerabilityId
      )
    )
    .where(
      and(
        eq(assetVulnerabilities.organizationId, organizationId),
        inArray(assetVulnerabilities.sourceScanImportId, uniqueImportIds)
      )
    )
    .groupBy(assetVulnerabilities.sourceScanImportId);

  for (const importId of uniqueImportIds) {
    summaries.set(importId, {
      ...emptyAiEnrichmentSummary,
      enabled,
    });
  }

  for (const row of rows) {
    if (!row.importId) {
      continue;
    }

    summaries.set(row.importId, {
      enabled,
      total: Number(row.total ?? 0),
      queued: Number(row.queued ?? 0),
      processing: Number(row.processing ?? 0),
      completed: Number(row.completed ?? 0),
      failed: Number(row.failed ?? 0),
      missing: Number(row.missing ?? 0),
    });
  }

  return summaries;
}

export async function listScanImports(organizationId: string, page = 1, pageSize = 10) {
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
          db
            .select({ total: count(scanImports.id) })
            .from(scanImports)
            .where(eq(scanImports.organizationId, organizationId)),
          db
            .select({
              scanImport: scanImports,
              importedByName: profiles.fullName,
            })
            .from(scanImports)
            .leftJoin(profiles, eq(scanImports.importedBy, profiles.id))
            .where(eq(scanImports.organizationId, organizationId))
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
            .from(scanImports)
            .where(eq(scanImports.organizationId, organizationId)),
        ]);

        const summary = summaryRows[0];
        const aiSummaries = await listScanImportAiEnrichmentSummaries(
          db,
          organizationId,
          rows.map((row) => row.scanImport.id)
        );

        return {
          imports: buildPaginatedResult(
            rows.map((row) =>
              mapScanImportRow(
                row,
                aiSummaries.get(row.scanImport.id) ?? emptyAiEnrichmentSummary
              )
            ),
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
  organizationId: string,
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
    .where(
      and(eq(scanImports.organizationId, organizationId), eq(scanImports.id, importId))
    )
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
    .where(
      and(
        eq(scanFindings.organizationId, organizationId),
        eq(scanFindings.scanImportId, importId)
      )
    )
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
    .where(
      and(
        eq(alerts.organizationId, organizationId),
        eq(alerts.relatedScanImportId, importId)
      )
    )
    .orderBy(desc(alerts.createdAt))
    .limit(10);

  const alertsData = alertRows.map(({ alert }) => ({
    id: alert.id,
    title: alert.title,
    severity: toUiSeverity(alert.severity),
    createdAt: formatDateTime(alert.createdAt),
    status: toUiAlertStatus(alert.status),
  }));

  const aiSummaries = await listScanImportAiEnrichmentSummaries(
    db,
    organizationId,
    [importId]
  );
  const aiEnrichment =
    aiSummaries.get(importId) ?? emptyAiEnrichmentSummary;
  const aiEnrichmentStepDetail =
    aiEnrichment.total === 0
      ? aiEnrichment.enabled
        ? "No linked GAB vulnerabilities required AI playbook queueing."
        : "AI enrichment is disabled; import processing still completed."
      : aiEnrichment.enabled
        ? `${aiEnrichment.completed}/${aiEnrichment.total} completed, ${aiEnrichment.processing} processing, ${aiEnrichment.queued} queued, ${aiEnrichment.failed} failed.`
        : "AI enrichment skipped because organization AI settings or consent are disabled.";

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
    {
      label: "AI Playbook Queue",
      status:
        aiEnrichment.failed > 0 || (!aiEnrichment.enabled && aiEnrichment.total > 0)
          ? "warning"
          : aiEnrichment.total > 0 &&
              aiEnrichment.completed === aiEnrichment.total
            ? "complete"
            : aiEnrichment.total > 0
              ? "pending"
              : "complete",
      detail: aiEnrichmentStepDetail,
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
    scanImport: { ...mappedImport, aiEnrichment },
    aiEnrichment,
    downloadUrl,
    severityDistribution: [...severityDistribution],
    findings,
    steps,
    alerts: alertsData,
    timeline,
  };
}
