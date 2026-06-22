import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilities,
  assets,
  businessApplications,
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
  toUiGabExposureType,
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
import {
  ATM_PAYMENT_SERVICES_LABEL,
  applicationProfileExplanation,
  calculateApplicationProfile,
  calculateCidtSensitivity,
  gabCidtTemplateKeyForExposure,
  hasCompleteCidt,
  normalizeGabExposureClass,
  normalizeGabExposureType,
  normalizeCvssScore,
  resolveGabCidtContext,
  toSensitivityLevel,
  type GabCidtTemplate,
} from "./business-priority";
import {
  ensureAtmPaymentServicesApplication,
  recalculateBusinessPrioritiesForOrganization,
} from "./business-applications";
import { ensureGabCidtTemplates, templateDisplayRows } from "./gab-business-context";

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

const cidtInputSchema = z.preprocess(
  (value) => (value === "" || value === "missing" ? null : value),
  z.coerce.number().int().min(1).max(4).nullable()
).optional();

export function buildAssetBusinessContext(
  asset: typeof assets.$inferSelect,
  application: typeof businessApplications.$inferSelect | null,
  templates: GabCidtTemplate[] = []
) {
  const app = application ?? {
    label: ATM_PAYMENT_SERVICES_LABEL,
    cidtConfidentiality: 4,
    cidtIntegrity: 4,
    cidtAvailability: 4,
    cidtTraceability: 4,
    isInternetExposed: false,
  };
  const assetCidt = {
    confidentiality: asset.cidtConfidentiality,
    integrity: asset.cidtIntegrity,
    availability: asset.cidtAvailability,
    traceability: asset.cidtTraceability,
  };
  const appCidt = {
    confidentiality: app.cidtConfidentiality,
    integrity: app.cidtIntegrity,
    availability: app.cidtAvailability,
    traceability: app.cidtTraceability,
  };
  const resolvedAssetCidt = resolveGabCidtContext({
    assetCidt,
    cidtOverrideEnabled: asset.cidtOverrideEnabled,
    cidtTemplateKey: asset.cidtTemplateKey,
    gabExposureType: asset.gabExposureType,
    templates,
    applicationCidt: appCidt,
  });
  const appSensitivity = calculateCidtSensitivity(appCidt, 4);
  const appProfile = calculateApplicationProfile({
    isInternetExposed: app.isInternetExposed,
    confidentiality: app.cidtConfidentiality,
    integrity: app.cidtIntegrity,
  });

  return {
    gabExposureType: toUiGabExposureType(asset.gabExposureType),
    gabExposureTypeDb: asset.gabExposureType,
    cidtTemplateKey:
      asset.cidtTemplateKey ?? gabCidtTemplateKeyForExposure(asset.gabExposureType),
    cidt: {
      ...resolvedAssetCidt.cidt,
      sensitivity: resolvedAssetCidt.sensitivityLabel,
      isComplete: resolvedAssetCidt.source !== "system_default",
      source: resolvedAssetCidt.source,
      sourceLabel: resolvedAssetCidt.sourceLabel,
      templateKey: resolvedAssetCidt.templateKey,
      templateLabel: resolvedAssetCidt.templateLabel,
      isCustomOverride: resolvedAssetCidt.isCustomOverride,
    },
    businessApplication: {
      label: ATM_PAYMENT_SERVICES_LABEL as typeof ATM_PAYMENT_SERVICES_LABEL,
      cidt: {
        ...appCidt,
        sensitivity: toSensitivityLevel(appSensitivity),
        isComplete: true,
      },
      profile: `Profile ${appProfile}` as const,
      profileExplanation: applicationProfileExplanation(appProfile),
      isInternetExposed: app.isInternetExposed,
    },
  };
}

export interface AssetListFilters {
  search?: string;
  regionId?: string;
  type?: string;
  status?: string;
  criticality?: string;
  exposureLevel?: string;
  gabExposureType?: string;
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
  gabCidtTemplates: Array<{
    templateKey: string;
    label: string;
    description: string | null;
    isDefault: boolean;
    cidtConfidentiality: number;
    cidtIntegrity: number;
    cidtAvailability: number;
    cidtTraceability: number;
    sensitivity: string;
  }>;
  atmPaymentServicesCidt: {
    cidtConfidentiality: number;
    cidtIntegrity: number;
    cidtAvailability: number;
    cidtTraceability: number;
    sensitivity: string;
  };
  summary: {
    totalAssets: number;
    atmCount: number;
    gabCount: number;
    outdoorGabs: number;
    unknownGabExposureCount: number;
  };
}

export interface AssetDetailData {
  asset: AssetListItem;
  gabCidtTemplates: AssetsPageData["gabCidtTemplates"];
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
  type: z.enum(["atm", "gab"]).default("gab"),
  model: z.string().trim().max(255).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(255).optional().or(z.literal("")),
  branch: z.string().trim().max(255).optional().or(z.literal("")),
  regionId: z.string().uuid().nullable().optional(),
  location: z.string().trim().max(255).optional().or(z.literal("")),
  ipAddress: z.string().trim().max(64).optional().or(z.literal("")),
  osVersion: z.string().trim().max(255).optional().or(z.literal("")),
  criticality: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  exposureLevel: z.enum(["internet_facing", "internal", "isolated"]).default("internal"),
  gabExposureType: z
    .enum([
      "unknown",
      "indoor_agency",
      "outdoor_agency",
      "outdoor_commercial_center",
      "outdoor_public_street",
    ])
    .transform((value) => normalizeGabExposureType(value))
    .default("unknown"),
  cidtTemplateKey: z.string().trim().max(120).optional().or(z.literal("")),
  cidtConfidentiality: cidtInputSchema,
  cidtIntegrity: cidtInputSchema,
  cidtAvailability: cidtInputSchema,
  cidtTraceability: cidtInputSchema,
  status: z
    .enum(["active", "inactive", "maintenance", "decommissioned"])
    .default("active"),
  ownerId: z.string().uuid().nullable().optional(),
});

export const updateAssetBusinessContextSchema = z
  .object({
    assetCode: z.string().trim().min(2).max(64),
    cidtOverrideEnabled: z.boolean().default(false),
    cidtConfidentiality: cidtInputSchema,
    cidtIntegrity: cidtInputSchema,
    cidtAvailability: cidtInputSchema,
    cidtTraceability: cidtInputSchema,
    gabExposureType: z.enum([
      "unknown",
      "indoor_agency",
      "outdoor_agency",
      "outdoor_commercial_center",
      "outdoor_public_street",
    ]).transform((value) => normalizeGabExposureType(value)),
    cidtTemplateKey: z.string().trim().max(120).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (!value.cidtOverrideEnabled) {
      return;
    }

    if (
      !hasCompleteCidt({
        confidentiality: value.cidtConfidentiality,
        integrity: value.cidtIntegrity,
        availability: value.cidtAvailability,
        traceability: value.cidtTraceability,
      })
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cidtOverrideEnabled"],
        message: "Custom CIDT override requires all four CIDT values.",
      });
    }
  });

function buildAssetWhere(organizationId: string, filters: AssetListFilters) {
  const clauses: SQL[] = [eq(assets.organizationId, organizationId)];
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

  if (filters.gabExposureType && filters.gabExposureType !== "all") {
    const exposureClass = normalizeGabExposureClass(filters.gabExposureType);
    if (exposureClass === "outdoor") {
      clauses.push(
        inArray(assets.gabExposureType, [
          "outdoor_agency",
          "outdoor_commercial_center",
          "outdoor_public_street",
        ])
      );
    } else {
      clauses.push(
        eq(
          assets.gabExposureType,
          normalizeGabExposureType(
            filters.gabExposureType
          ) as typeof assets.$inferSelect.gabExposureType
        )
      );
    }
  }

  return clauses.length ? and(...clauses) : undefined;
}

function mapAssets(
  rows: Array<{
    asset: typeof assets.$inferSelect;
    application: typeof businessApplications.$inferSelect | null;
    regionName: string | null;
    ownerName: string | null;
  }>,
  templates: GabCidtTemplate[],
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

  return rows.map(({ asset, application, regionName, ownerName }) => {
    const stats = grouped.get(asset.id);
    const businessContext = buildAssetBusinessContext(asset, application, templates);

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
      ...businessContext,
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

export async function listAssets(
  organizationId: string,
  filters: AssetListFilters = {}
): Promise<AssetsPageData> {
  const db = getDb();
  const pagination = getPagination(filters);

  if (!db) {
    return {
      assets: buildPaginatedResult([], 0, pagination),
      regionOptions: [],
      gabCidtTemplates: [],
      atmPaymentServicesCidt: {
        cidtConfidentiality: 4,
        cidtIntegrity: 4,
        cidtAvailability: 4,
        cidtTraceability: 4,
        sensitivity: "S4",
      },
      summary: {
        totalAssets: 0,
        atmCount: 0,
        gabCount: 0,
        outdoorGabs: 0,
        unknownGabExposureCount: 0,
      },
    };
  }

  try {
    return await measureServerTiming(
      "assets.list",
      async () => {
        const where = buildAssetWhere(organizationId, filters);

        const [
          regionRows,
          summaryRows,
          totalRows,
          assetRows,
          templates,
          atmPaymentServices,
        ] = await Promise.all([
          db.select().from(regions).orderBy(regions.name),
          db
            .select({
              totalAssets: sql<number>`count(*)::int`,
              atmCount:
                sql<number>`count(*) filter (where ${assets.type} = 'atm')::int`,
              gabCount:
                sql<number>`count(*) filter (where ${assets.type} = 'gab')::int`,
              outdoorGabs:
                sql<number>`count(*) filter (where ${assets.gabExposureType} in ('outdoor_agency', 'outdoor_commercial_center', 'outdoor_public_street'))::int`,
              unknownGabExposureCount:
                sql<number>`count(*) filter (where ${assets.gabExposureType} = 'unknown')::int`,
            })
            .from(assets)
            .where(eq(assets.organizationId, organizationId)),
          db.select({ total: count(assets.id) }).from(assets).where(where),
          db
            .select({
              asset: assets,
              application: businessApplications,
              regionName: regions.name,
              ownerName: profiles.fullName,
            })
            .from(assets)
            .leftJoin(
              businessApplications,
              eq(assets.businessApplicationId, businessApplications.id)
            )
            .leftJoin(regions, eq(assets.regionId, regions.id))
            .leftJoin(profiles, eq(assets.ownerId, profiles.id))
            .where(where)
            .orderBy(desc(assets.createdAt), assets.assetCode)
            .limit(pagination.pageSize)
            .offset(pagination.offset),
          ensureGabCidtTemplates(organizationId),
          ensureAtmPaymentServicesApplication(organizationId),
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
                    eq(assetVulnerabilities.organizationId, organizationId),
                    inArray(assetVulnerabilities.assetId, assetIds),
                    ne(assetVulnerabilities.status, "closed")
                  )
                )
            : [];

        const summary = summaryRows[0];

        return {
          assets: buildPaginatedResult(
            mapAssets(assetRows, templates, vulnerabilityRows),
            totalRows[0]?.total ?? 0,
            pagination
          ),
          regionOptions: regionRows.map((region) => ({
            id: region.id,
            name: region.name,
            code: region.code,
          })),
          gabCidtTemplates: templateDisplayRows(templates).map((template) => ({
            templateKey: template.templateKey,
            label: template.label,
            description: template.description,
            isDefault: template.isDefault,
            cidtConfidentiality: template.cidtConfidentiality,
            cidtIntegrity: template.cidtIntegrity,
            cidtAvailability: template.cidtAvailability,
            cidtTraceability: template.cidtTraceability,
            sensitivity: template.sensitivity,
          })),
          atmPaymentServicesCidt: {
            cidtConfidentiality: atmPaymentServices.cidtConfidentiality,
            cidtIntegrity: atmPaymentServices.cidtIntegrity,
            cidtAvailability: atmPaymentServices.cidtAvailability,
            cidtTraceability: atmPaymentServices.cidtTraceability,
            sensitivity: toSensitivityLevel(
              calculateCidtSensitivity(
                {
                  confidentiality: atmPaymentServices.cidtConfidentiality,
                  integrity: atmPaymentServices.cidtIntegrity,
                  availability: atmPaymentServices.cidtAvailability,
                  traceability: atmPaymentServices.cidtTraceability,
                },
                4
              )
            ),
          },
          summary: {
            totalAssets: summary?.totalAssets ?? 0,
            atmCount: summary?.atmCount ?? 0,
            gabCount: summary?.gabCount ?? 0,
            outdoorGabs: summary?.outdoorGabs ?? 0,
            unknownGabExposureCount: summary?.unknownGabExposureCount ?? 0,
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
      gabCidtTemplates: [],
      atmPaymentServicesCidt: {
        cidtConfidentiality: 4,
        cidtIntegrity: 4,
        cidtAvailability: 4,
        cidtTraceability: 4,
        sensitivity: "S4",
      },
      summary: {
        totalAssets: 0,
        atmCount: 0,
        gabCount: 0,
        outdoorGabs: 0,
        unknownGabExposureCount: 0,
      },
    };
  }
}

export async function createAsset(
  input: z.input<typeof createAssetSchema>,
  createdByUserId: string | null,
  organizationId: string
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

  const application = await ensureAtmPaymentServicesApplication(organizationId);
  const hasCustomCidt = hasCompleteCidt({
    confidentiality: parsed.data.cidtConfidentiality,
    integrity: parsed.data.cidtIntegrity,
    availability: parsed.data.cidtAvailability,
    traceability: parsed.data.cidtTraceability,
  });
  const [row] = await db
    .insert(assets)
    .values({
      ...parsed.data,
      organizationId,
      model: parsed.data.model || null,
      manufacturer: parsed.data.manufacturer || null,
      branch: parsed.data.branch || null,
      location: parsed.data.location || null,
      ipAddress: parsed.data.ipAddress || null,
      osVersion: parsed.data.osVersion || null,
      businessApplicationId: application.id,
      gabExposureType: parsed.data.gabExposureType,
      cidtTemplateKey: parsed.data.cidtTemplateKey || null,
      cidtOverrideEnabled: hasCustomCidt,
      cidtConfidentiality: hasCustomCidt
        ? parsed.data.cidtConfidentiality ?? null
        : null,
      cidtIntegrity: hasCustomCidt ? parsed.data.cidtIntegrity ?? null : null,
      cidtAvailability: hasCustomCidt
        ? parsed.data.cidtAvailability ?? null
        : null,
      cidtTraceability: hasCustomCidt
        ? parsed.data.cidtTraceability ?? null
        : null,
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

export async function updateAssetBusinessContext(
  organizationId: string,
  input: z.input<typeof updateAssetBusinessContextSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Asset writes are disabled."
    );
  }

  const parsed = updateAssetBusinessContextSchema.parse(input);
  const application = await ensureAtmPaymentServicesApplication(organizationId);
  const customOverride = parsed.cidtOverrideEnabled;
  const [row] = await db
    .update(assets)
    .set({
      businessApplicationId: application.id,
      gabExposureType: parsed.gabExposureType,
      cidtTemplateKey: parsed.cidtTemplateKey || null,
      cidtOverrideEnabled: customOverride,
      cidtConfidentiality: customOverride
        ? parsed.cidtConfidentiality ?? null
        : null,
      cidtIntegrity: customOverride ? parsed.cidtIntegrity ?? null : null,
      cidtAvailability: customOverride ? parsed.cidtAvailability ?? null : null,
      cidtTraceability: customOverride ? parsed.cidtTraceability ?? null : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(assets.organizationId, organizationId),
        eq(assets.assetCode, parsed.assetCode)
      )
    )
    .returning();

  if (!row) {
    throw new AppError("not_found", "Asset not found.");
  }

  await recalculateBusinessPrioritiesForOrganization(organizationId, {
    assetId: row.id,
  });

  return row;
}

export async function getAssetDetail(
  organizationId: string,
  assetCode: string
): Promise<AssetDetailData | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [assetRow] = await db
    .select({
      asset: assets,
      application: businessApplications,
      regionName: regions.name,
      ownerName: profiles.fullName,
    })
    .from(assets)
    .leftJoin(
      businessApplications,
      eq(assets.businessApplicationId, businessApplications.id)
    )
    .leftJoin(regions, eq(assets.regionId, regions.id))
    .leftJoin(profiles, eq(assets.ownerId, profiles.id))
    .where(and(eq(assets.organizationId, organizationId), eq(assets.assetCode, assetCode)))
    .limit(1);

  if (!assetRow) {
    return null;
  }

  const templates = await ensureGabCidtTemplates(organizationId);

  const vulnerabilityRows = await db
    .select({
      av: assetVulnerabilities,
      cve: cves,
    })
    .from(assetVulnerabilities)
    .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .where(
      and(
        eq(assetVulnerabilities.organizationId, organizationId),
        eq(assetVulnerabilities.assetId, assetRow.asset.id)
      )
    )
    .orderBy(desc(assetVulnerabilities.riskScore), desc(assetVulnerabilities.lastSeen));

  const statsRows = vulnerabilityRows.map((row) => ({
    assetId: assetRow.asset.id,
    riskScore: row.av.riskScore,
    businessPriority: row.av.businessPriority,
    severity: row.cve?.severity ?? null,
  }));

  const [mappedAsset] = mapAssets([assetRow], templates, statsRows);
  const gabCidtTemplateRows = templateDisplayRows(templates).map((template) => ({
    templateKey: template.templateKey,
    label: template.label,
    description: template.description,
    isDefault: template.isDefault,
    cidtConfidentiality: template.cidtConfidentiality,
    cidtIntegrity: template.cidtIntegrity,
    cidtAvailability: template.cidtAvailability,
    cidtTraceability: template.cidtTraceability,
    sensitivity: template.sensitivity,
  }));

  const vulnerabilities = vulnerabilityRows.map(({ av, cve }) => ({
    id: av.id,
    cveId: cve?.cveId ?? "—",
    title: cve?.title ?? "Unlinked CVE",
    description: cve?.description ?? "",
    severity: toUiSeverity(cve?.severity),
    cvssScore: normalizeCvssScore(cve?.cvssScore),
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
    contextReason:
      typeof av.priorityFactors === "object" && av.priorityFactors
        ? String(av.priorityFactors.summary ?? "")
        : "",
    priorityFactors:
      typeof av.priorityFactors === "object" && av.priorityFactors
        ? {
            summary: String(av.priorityFactors.summary ?? ""),
            businessImpact: String(av.priorityFactors.businessImpact ?? ""),
            remediationUrgency: String(av.priorityFactors.remediationUrgency ?? ""),
            missingContext: Array.isArray(av.priorityFactors.missingContext)
              ? av.priorityFactors.missingContext.map(String)
              : [],
          }
        : undefined,
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
            and(
              eq(remediationTasks.organizationId, organizationId),
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
    .where(
      and(
        eq(scanFindings.organizationId, organizationId),
        eq(scanFindings.matchedAssetId, assetRow.asset.id)
      )
    )
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
        ? and(
            eq(alerts.organizationId, organizationId),
            or(
              eq(alerts.relatedAssetId, assetRow.asset.id),
              inArray(
                alerts.relatedAssetVulnerabilityId,
                vulnerabilityRows.map((row) => row.av.id)
              )
            )!
          )!
        : and(
            eq(alerts.organizationId, organizationId),
            eq(alerts.relatedAssetId, assetRow.asset.id)
          )
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
    gabCidtTemplates: gabCidtTemplateRows,
    riskTrend,
    vulnerabilities,
    remediationTasks: remediationTasksData,
    scanHistory,
    alerts: alertsData,
  };
}
