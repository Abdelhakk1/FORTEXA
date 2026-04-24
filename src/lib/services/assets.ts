import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilities,
  assets,
  cves,
  profiles,
  regions,
  remediationTasks,
  scanFindings,
  scanImports,
} from "@/db/schema";
import type { Alert, Asset, RemediationTask, Vulnerability } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  formatDate,
  toUiAlertStatus,
  toUiAlertType,
  toUiAssetStatus,
  toUiAssetType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiExposureLevel,
  toUiRemediationStatus,
  toUiSeverity,
  toUiSlaStatus,
  toUiExploitMaturity,
  toUiImportStatus,
  toUiScannerSource,
} from "./serializers";
import {
  buildPaginatedResult,
  count,
  desc,
  getPagination,
  ilike,
  or,
  searchTerm,
  sql,
  type SQL,
} from "./utils";
import { inferAssetContext } from "./asset-inference";

const priorityRank = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
} as const;

const severityRank = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

export interface AssetListFilters {
  search?: string;
  regionId?: string;
  type?: string;
  status?: string;
  criticality?: string;
  exposureLevel?: string;
  page?: number;
  pageSize?: number;
}

export interface AssetListItem extends Asset {
  dbId: string;
  regionId: string | null;
  ownerId: string | null;
}

export interface AssetsPageData {
  assets: ReturnType<typeof buildPaginatedResult<AssetListItem>>;
  regionOptions: Array<{ id: string; name: string; code: string }>;
  summary: {
    totalAssets: number;
    atmCount: number;
    gabCount: number;
    internetFacing: number;
  };
}

export interface AssetDetailData {
  asset: AssetListItem;
  riskTrend: Array<{ month: string; value: number }>;
  vulnerabilities: Vulnerability[];
  remediationTasks: RemediationTask[];
  scanHistory: Array<{
    id: string;
    name: string;
    scannerSource: string;
    importDate: string;
    findingsFound: number;
    status: string;
  }>;
  alerts: Alert[];
}

export const createAssetSchema = z.object({
  assetCode: z.string().trim().min(2).max(64),
  name: z.string().trim().min(2).max(255),
  type: z.enum([
    "atm",
    "gab",
    "kiosk",
    "server",
    "network_device",
    "workstation",
    "other",
  ]),
  model: z.string().trim().max(255).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(255).optional().or(z.literal("")),
  branch: z.string().trim().max(255).optional().or(z.literal("")),
  regionId: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(255).optional().or(z.literal("")),
  ipAddress: z.string().trim().max(64).optional().or(z.literal("")),
  osVersion: z.string().trim().max(255).optional().or(z.literal("")),
  criticality: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  exposureLevel: z.enum(["internet_facing", "internal", "isolated"]).default("internal"),
  status: z
    .enum(["active", "inactive", "maintenance", "decommissioned"])
    .default("active"),
  ownerId: z.string().uuid().nullable().optional(),
});

function buildAssetWhere(filters: AssetListFilters) {
  const clauses: SQL[] = [];
  const search = searchTerm(filters.search);

  if (search) {
    clauses.push(
      or(
        ilike(assets.assetCode, search),
        ilike(assets.name, search),
        ilike(assets.ipAddress, search),
        ilike(assets.branch, search)
      )!
    );
  }

  if (filters.regionId && filters.regionId !== "all") {
    clauses.push(eq(assets.regionId, filters.regionId));
  }

  if (filters.type && filters.type !== "all") {
    clauses.push(eq(assets.type, filters.type as typeof assets.$inferSelect.type));
  }

  if (filters.status && filters.status !== "all") {
    clauses.push(eq(assets.status, filters.status as typeof assets.$inferSelect.status));
  }

  if (filters.criticality && filters.criticality !== "all") {
    clauses.push(
      eq(
        assets.criticality,
        filters.criticality as typeof assets.$inferSelect.criticality
      )
    );
  }

  if (filters.exposureLevel && filters.exposureLevel !== "all") {
    clauses.push(
      eq(
        assets.exposureLevel,
        filters.exposureLevel as typeof assets.$inferSelect.exposureLevel
      )
    );
  }

  return clauses.length ? and(...clauses) : undefined;
}

function mapAssets(
  rows: Array<{
    asset: typeof assets.$inferSelect;
    regionName: string | null;
    ownerName: string | null;
  }>,
  vulnerabilityRows: Array<{
    assetId: string;
    riskScore: number;
    businessPriority: string;
    severity: string | null;
  }>
): AssetListItem[] {
  const grouped = new Map<
    string,
    {
      vulnerabilityCount: number;
      riskScore: number;
      priority: keyof typeof priorityRank | null;
      severity: keyof typeof severityRank | null;
    }
  >();

  for (const row of vulnerabilityRows) {
    const current =
      grouped.get(row.assetId) ??
      {
        vulnerabilityCount: 0,
        riskScore: 0,
        priority: null,
        severity: null,
      };

    current.vulnerabilityCount += 1;
    current.riskScore = Math.max(current.riskScore, row.riskScore ?? 0);

    const nextPriority = row.businessPriority as keyof typeof priorityRank;
    if (
      nextPriority &&
      (!current.priority ||
        priorityRank[nextPriority] < priorityRank[current.priority])
    ) {
      current.priority = nextPriority;
    }

    const nextSeverity = row.severity as keyof typeof severityRank;
    if (
      nextSeverity &&
      (!current.severity ||
        severityRank[nextSeverity] > severityRank[current.severity])
    ) {
      current.severity = nextSeverity;
    }

    grouped.set(row.assetId, current);
  }

  return rows.map(({ asset, regionName, ownerName }) => {
    const stats = grouped.get(asset.id);

    return {
      dbId: asset.id,
      id: asset.assetCode,
      name: asset.name,
      type: toUiAssetType(asset.type),
      model: asset.model ?? "—",
      manufacturer: asset.manufacturer ?? "—",
      branch: asset.branch ?? "—",
      region: regionName ?? "Unassigned",
      regionId: asset.regionId ?? null,
      location: asset.location ?? "—",
      ipAddress: asset.ipAddress ?? "—",
      osVersion: asset.osVersion ?? "—",
      criticality: toUiCriticality(asset.criticality),
      exposureLevel: toUiExposureLevel(asset.exposureLevel),
      status: toUiAssetStatus(asset.status),
      owner: ownerName ?? "Unassigned",
      ownerId: asset.ownerId ?? null,
      lastScanDate: formatDate(asset.lastScanDate),
      vulnerabilityCount: stats?.vulnerabilityCount ?? 0,
      maxSeverity: toUiSeverity(stats?.severity ?? "info"),
      contextualPriority: toUiBusinessPriority(stats?.priority ?? "p5"),
      riskScore: stats?.riskScore ?? 0,
    };
  });
}

export async function listAssets(filters: AssetListFilters = {}): Promise<AssetsPageData> {
  const db = getDb();
  const pagination = getPagination(filters);

  if (!db) {
    return {
      assets: buildPaginatedResult([], 0, pagination),
      regionOptions: [],
      summary: {
        totalAssets: 0,
        atmCount: 0,
        gabCount: 0,
        internetFacing: 0,
      },
    };
  }

  try {
    return await measureServerTiming(
      "assets.list",
      async () => {
        const where = buildAssetWhere(filters);

        const [regionRows, summaryRows, totalRows, assetRows] = await Promise.all([
          db.select().from(regions).orderBy(regions.name),
          db
            .select({
              totalAssets: sql<number>`count(*)::int`,
              atmCount:
                sql<number>`count(*) filter (where ${assets.type} = 'atm')::int`,
              gabCount:
                sql<number>`count(*) filter (where ${assets.type} = 'gab')::int`,
              internetFacing:
                sql<number>`count(*) filter (where ${assets.exposureLevel} = 'internet_facing')::int`,
            })
            .from(assets),
          db.select({ total: count(assets.id) }).from(assets).where(where),
          db
            .select({
              asset: assets,
              regionName: regions.name,
              ownerName: profiles.fullName,
            })
            .from(assets)
            .leftJoin(regions, eq(assets.regionId, regions.id))
            .leftJoin(profiles, eq(assets.ownerId, profiles.id))
            .where(where)
            .orderBy(desc(assets.createdAt), assets.assetCode)
            .limit(pagination.pageSize)
            .offset(pagination.offset),
        ]);

        const assetIds = assetRows.map((row) => row.asset.id);
        const vulnerabilityRows =
          assetIds.length > 0
            ? await db
                .select({
                  assetId: assetVulnerabilities.assetId,
                  riskScore: assetVulnerabilities.riskScore,
                  businessPriority: assetVulnerabilities.businessPriority,
                  severity: cves.severity,
                })
                .from(assetVulnerabilities)
                .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
                .where(
                  and(
                    inArray(assetVulnerabilities.assetId, assetIds),
                    ne(assetVulnerabilities.status, "closed")
                  )
                )
            : [];

        const summary = summaryRows[0];

        return {
          assets: buildPaginatedResult(
            mapAssets(assetRows, vulnerabilityRows),
            totalRows[0]?.total ?? 0,
            pagination
          ),
          regionOptions: regionRows.map((region) => ({
            id: region.id,
            name: region.name,
            code: region.code,
          })),
          summary: {
            totalAssets: summary?.totalAssets ?? 0,
            atmCount: summary?.atmCount ?? 0,
            gabCount: summary?.gabCount ?? 0,
            internetFacing: summary?.internetFacing ?? 0,
          },
        };
      },
      {
        page: pagination.page,
        pageSize: pagination.pageSize,
      },
      (result) => ({
        total: result.assets.total,
        regions: result.regionOptions.length,
      })
    );
  } catch {
    return {
      assets: buildPaginatedResult([], 0, pagination),
      regionOptions: [],
      summary: {
        totalAssets: 0,
        atmCount: 0,
        gabCount: 0,
        internetFacing: 0,
      },
    };
  }
}

export async function createAsset(
  input: z.input<typeof createAssetSchema>,
  createdByUserId?: string | null
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Asset writes are disabled until the database connection is configured."
    );
  }

  const parsed = createAssetSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(
      "validation_error",
      "Please correct the asset form fields.",
      parsed.error.flatten().fieldErrors
    );
  }

  const [row] = await db
    .insert(assets)
    .values({
      ...parsed.data,
      model: parsed.data.model || null,
      manufacturer: parsed.data.manufacturer || null,
      branch: parsed.data.branch || null,
      location: parsed.data.location || null,
      ipAddress: parsed.data.ipAddress || null,
      osVersion: parsed.data.osVersion || null,
      ownerId: parsed.data.ownerId ?? createdByUserId ?? null,
      regionId: parsed.data.regionId ?? null,
      metadata: {
        inference: inferAssetContext({
          name: parsed.data.name,
          type: parsed.data.type,
          manufacturer: parsed.data.manufacturer || null,
          model: parsed.data.model || null,
          osVersion: parsed.data.osVersion || null,
          metadata: null,
        }),
      },
    })
    .returning();

  return row;
}

export async function getAssetDetail(
  assetCode: string
): Promise<AssetDetailData | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [assetRow] = await db
    .select({
      asset: assets,
      regionName: regions.name,
      ownerName: profiles.fullName,
    })
    .from(assets)
    .leftJoin(regions, eq(assets.regionId, regions.id))
    .leftJoin(profiles, eq(assets.ownerId, profiles.id))
    .where(eq(assets.assetCode, assetCode))
    .limit(1);

  if (!assetRow) {
    return null;
  }

  const vulnerabilityRows = await db
    .select({
      av: assetVulnerabilities,
      cve: cves,
    })
    .from(assetVulnerabilities)
    .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .where(eq(assetVulnerabilities.assetId, assetRow.asset.id))
    .orderBy(desc(assetVulnerabilities.riskScore), desc(assetVulnerabilities.lastSeen));

  const statsRows = vulnerabilityRows.map((row) => ({
    assetId: assetRow.asset.id,
    riskScore: row.av.riskScore,
    businessPriority: row.av.businessPriority,
    severity: row.cve?.severity ?? null,
  }));

  const [mappedAsset] = mapAssets([assetRow], statsRows);

  const vulnerabilities = vulnerabilityRows.map(({ av, cve }) => ({
    id: av.id,
    cveId: cve?.cveId ?? "—",
    title: cve?.title ?? "Unlinked CVE",
    description: cve?.description ?? "",
    severity: toUiSeverity(cve?.severity),
    cvssScore: cve?.cvssScore ? Number(cve.cvssScore) : 0,
    cvssVector: cve?.cvssVector ?? "—",
    businessPriority: toUiBusinessPriority(av.businessPriority),
    exploitMaturity: toUiExploitMaturity(cve?.exploitMaturity),
    affectedAssetsCount: 1,
    patchAvailable: cve?.patchAvailable ?? false,
    aiRemediationAvailable: false,
    status:
      av.status === "closed"
        ? "Closed"
        : av.status === "mitigated"
          ? "Mitigated"
          : "Open",
    firstSeen: formatDate(av.firstSeen),
    lastSeen: formatDate(av.lastSeen),
    slaDue: formatDate(av.slaDue),
    slaStatus: toUiSlaStatus(av.slaStatus),
    affectedProducts: cve?.affectedProducts ?? [],
    impactAnalysis: "",
    exploitConditions: "",
    trustedSources: [],
    primaryRemediation: "",
    compensatingControls: [],
    confidenceScore: 0,
    contextReason: "",
    aiSummary: "",
    enrichmentStatus: "Pending",
    enrichmentError: "",
    enrichmentModel: "",
    aiEnrichedAt: "—",
    aiTags: [],
  } satisfies Vulnerability));

  const remediationRows =
    vulnerabilityRows.length > 0
      ? await db
          .select({
            task: remediationTasks,
            assignedName: profiles.fullName,
            cveCode: cves.cveId,
          })
          .from(remediationTasks)
          .leftJoin(profiles, eq(remediationTasks.assignedTo, profiles.id))
          .leftJoin(cves, eq(remediationTasks.cveId, cves.id))
          .where(
            or(
              inArray(
                remediationTasks.assetVulnerabilityId,
                vulnerabilityRows.map((row) => row.av.id)
              ),
              inArray(
                remediationTasks.cveId,
                vulnerabilityRows.map((row) => row.av.cveId)
              )
            )!
          )
          .orderBy(desc(remediationTasks.updatedAt))
          .limit(5)
      : [];

  const remediationTasksData = remediationRows.map(({ task, assignedName, cveCode }) => ({
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    relatedCve: cveCode ?? "—",
    relatedAsset: mappedAsset.id,
    assignedOwner: assignedName ?? "Unassigned",
    assignedAvatar: (assignedName ?? "UN").slice(0, 2).toUpperCase(),
    dueDate: formatDate(task.dueDate),
    slaStatus: toUiSlaStatus(task.slaStatus),
    status: toUiRemediationStatus(task.status),
    priority: toUiSeverity(task.priority),
    businessPriority: toUiBusinessPriority(task.businessPriority),
    affectedAssetsCount: task.assetVulnerabilityId ? 1 : mappedAsset.vulnerabilityCount,
    progress: task.progress,
    notes: task.notes ?? "",
    createdAt: formatDate(task.createdAt),
    updatedAt: formatDate(task.updatedAt),
    changeRequest: task.changeRequest ?? undefined,
  } satisfies RemediationTask));

  const scanHistoryRows = await db
    .select({
      scanImport: scanImports,
    })
    .from(scanFindings)
    .innerJoin(scanImports, eq(scanFindings.scanImportId, scanImports.id))
    .where(eq(scanFindings.matchedAssetId, assetRow.asset.id))
    .orderBy(desc(scanImports.importDate))
    .limit(5);

  const uniqueImports = Array.from(
    new Map(scanHistoryRows.map((row) => [row.scanImport.id, row.scanImport])).values()
  );

  const scanHistory = uniqueImports.map((scanImport) => ({
    id: scanImport.id,
    name: scanImport.name,
    scannerSource: toUiScannerSource(scanImport.scannerSource),
    importDate: formatDate(scanImport.importDate),
    findingsFound: scanImport.findingsFound,
    status: toUiImportStatus(scanImport.status),
  }));

  const alertRows = await db
    .select({
      alert: alerts,
      cveCode: cves.cveId,
    })
    .from(alerts)
    .leftJoin(cves, eq(alerts.relatedCveId, cves.id))
    .where(
      vulnerabilityRows.length > 0
        ? or(
            eq(alerts.relatedAssetId, assetRow.asset.id),
            inArray(
              alerts.relatedAssetVulnerabilityId,
              vulnerabilityRows.map((row) => row.av.id)
            )
          )!
        : eq(alerts.relatedAssetId, assetRow.asset.id)
    )
    .orderBy(desc(alerts.createdAt))
    .limit(5);

  const alertsData = alertRows.map(({ alert, cveCode }) => ({
    id: alert.id,
    title: alert.title,
    description: alert.description ?? "No alert details available.",
    severity: toUiSeverity(alert.severity),
    type: toUiAlertType(alert.type),
    relatedAsset: mappedAsset.id,
    relatedCve: cveCode ?? "N/A",
    createdAt: formatDate(alert.createdAt),
    owner: "Unassigned",
    status: toUiAlertStatus(alert.status),
  } satisfies Alert));

  const riskTrend = ["Jan", "Feb", "Mar", "Apr"].map((month) => ({
    month,
    // We do not have historical score snapshots yet, so keep the chart honest
    // by reflecting the current score consistently until time-series data exists.
    value: mappedAsset.riskScore,
  }));

  return {
    asset: mappedAsset,
    riskTrend,
    vulnerabilities,
    remediationTasks: remediationTasksData,
    scanHistory,
    alerts: alertsData,
  };
}
