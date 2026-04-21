import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { assetVulnerabilities, assets, cves, profiles, regions } from "@/db/schema";
import type { Asset } from "@/lib/types";
import { AppError } from "@/lib/errors";
import {
  formatDate,
  toUiAssetStatus,
  toUiAssetType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiExposureLevel,
  toUiSeverity,
} from "./serializers";
import {
  buildPaginatedResult,
  count,
  desc,
  getPagination,
  ilike,
  or,
  searchTerm,
  type SQL,
} from "./utils";

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

  const where = buildAssetWhere(filters);

  const [regionRows, summaryRows, totalRows, assetRows] = await Promise.all([
    db.select().from(regions).orderBy(regions.name),
    db
      .select({
        totalAssets: count(assets.id),
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

  const allAssets = await db
    .select({
      type: assets.type,
      exposureLevel: assets.exposureLevel,
    })
    .from(assets);

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
      totalAssets: summaryRows[0]?.totalAssets ?? 0,
      atmCount: allAssets.filter((asset) => asset.type === "atm").length,
      gabCount: allAssets.filter((asset) => asset.type === "gab").length,
      internetFacing: allAssets.filter(
        (asset) => asset.exposureLevel === "internet_facing"
      ).length,
    },
  };
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
    })
    .returning();

  return row;
}
