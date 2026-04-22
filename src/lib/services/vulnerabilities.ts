import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetVulnerabilities,
  assets,
  cveEnrichments,
  cveRecommendedControls,
  cveSourceReferences,
  cves,
} from "@/db/schema";
import type { Asset, Vulnerability } from "@/lib/types";
import {
  formatDate,
  toUiAssetType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiExploitMaturity,
  toUiExposureLevel,
  toUiSeverity,
  toUiSlaStatus,
} from "./serializers";

const severityRank = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

const priorityRank = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
} as const;

const slaRank = {
  overdue: 3,
  at_risk: 2,
  on_track: 1,
} as const;

interface AggregatedCve {
  vulnerability: Vulnerability;
  sourceTypeIcons: Record<string, string>;
}

export interface VulnerabilityOverviewData {
  vulnerabilities: Vulnerability[];
  assets: Asset[];
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  topVulnerableModels: Array<{ name: string; value: number }>;
}

export interface VulnerabilityDetailData {
  vulnerabilityDbId: string;
  vulnerability: Vulnerability;
  impactedAssets: Asset[];
}

function toSourceIcon(sourceType: string | null | undefined) {
  switch (sourceType) {
    case "cisa_kev":
      return "alert-triangle";
    case "vendor":
      return "shield";
    case "nvd":
      return "database";
    default:
      return "book-open";
  }
}

function toUiVulnerabilityStatus(
  value: string | null | undefined
): Vulnerability["status"] {
  switch (value) {
    case "closed":
      return "Closed";
    case "mitigated":
      return "Mitigated";
    default:
      return "Open";
  }
}

function buildBaseVulnerability(row: {
  cve: typeof cves.$inferSelect;
  enrichment: typeof cveEnrichments.$inferSelect | null;
}): Vulnerability {
  const enrichmentStatus =
    row.enrichment?.enrichmentStatus === "completed"
      ? "Completed"
      : row.enrichment?.enrichmentStatus === "processing"
        ? "Processing"
        : row.enrichment?.enrichmentStatus === "failed"
          ? "Failed"
          : "Pending";

  return {
    id: row.cve.cveId,
    cveId: row.cve.cveId,
    title: row.cve.title,
    description: row.cve.description ?? "",
    severity: toUiSeverity(row.cve.severity),
    cvssScore: row.cve.cvssScore ? Number(row.cve.cvssScore) : 0,
    cvssVector: row.cve.cvssVector ?? "—",
    businessPriority: "P5",
    exploitMaturity: toUiExploitMaturity(row.cve.exploitMaturity),
    affectedAssetsCount: 0,
    patchAvailable: row.cve.patchAvailable,
    aiRemediationAvailable: row.enrichment?.aiRemediationAvailable ?? false,
    status: "Open",
    firstSeen: "—",
    lastSeen: "—",
    slaDue: "—",
    slaStatus: "On Track",
    affectedProducts: row.cve.affectedProducts ?? [],
    impactAnalysis: row.enrichment?.impactAnalysis ?? "",
    exploitConditions: row.enrichment?.exploitConditions ?? "",
    trustedSources: [],
    primaryRemediation: row.enrichment?.primaryRemediation ?? "",
    compensatingControls: [],
    confidenceScore: row.enrichment?.confidenceScore ?? 0,
    contextReason: row.enrichment?.contextReason ?? "",
    aiSummary: row.enrichment?.summary ?? "",
    enrichmentStatus,
    enrichmentError: row.enrichment?.aiError ?? "",
    enrichmentModel: row.enrichment?.aiModel ?? "",
    aiEnrichedAt: formatDate(row.enrichment?.enrichedAt ?? null),
    aiTags: row.enrichment?.tags ?? [],
  };
}

export async function getVulnerabilityOverviewData(): Promise<VulnerabilityOverviewData> {
  const db = getDb();

  if (!db) {
    return {
      vulnerabilities: [],
      assets: [],
      severityDistribution: [
        { name: "Critical", value: 0, color: "#EF4444" },
        { name: "High", value: 0, color: "#F59E0B" },
        { name: "Medium", value: 0, color: "#3B82F6" },
        { name: "Low", value: 0, color: "#10B981" },
      ],
      topVulnerableModels: [],
    };
  }

  const [assetRows, cveRows, avRows] = await Promise.all([
    db.select().from(assets),
    db
      .select({
        cve: cves,
        enrichment: cveEnrichments,
      })
      .from(cves)
      .leftJoin(cveEnrichments, eq(cves.id, cveEnrichments.cveId)),
    db.select().from(assetVulnerabilities),
  ]);

  const vulnerabilitiesMap = new Map<string, AggregatedCve>();

  for (const row of cveRows) {
    vulnerabilitiesMap.set(row.cve.id, {
      vulnerability: buildBaseVulnerability(row),
      sourceTypeIcons: {},
    });
  }

  for (const row of avRows) {
    const current = vulnerabilitiesMap.get(row.cveId);

    if (!current) {
      continue;
    }

    current.vulnerability.affectedAssetsCount += 1;
    current.vulnerability.status = toUiVulnerabilityStatus(row.status);
    current.vulnerability.firstSeen =
      current.vulnerability.firstSeen === "—" ||
      new Date(row.firstSeen) < new Date(current.vulnerability.firstSeen)
        ? formatDate(row.firstSeen)
        : current.vulnerability.firstSeen;
    current.vulnerability.lastSeen =
      current.vulnerability.lastSeen === "—" ||
      new Date(row.lastSeen) > new Date(current.vulnerability.lastSeen)
        ? formatDate(row.lastSeen)
        : current.vulnerability.lastSeen;

    if (
      priorityRank[row.businessPriority] <
      priorityRank[current.vulnerability.businessPriority.toLowerCase() as keyof typeof priorityRank]
    ) {
      current.vulnerability.businessPriority = toUiBusinessPriority(row.businessPriority);
    }

    const currentSlaRank =
      slaRank[
        current.vulnerability.slaStatus.toLowerCase().replace(" ", "_") as keyof typeof slaRank
      ] ?? 0;
    if (slaRank[row.slaStatus] > currentSlaRank) {
      current.vulnerability.slaStatus = toUiSlaStatus(row.slaStatus);
    }

    if (
      row.slaDue &&
      (current.vulnerability.slaDue === "—" ||
        new Date(row.slaDue) < new Date(current.vulnerability.slaDue))
    ) {
      current.vulnerability.slaDue = formatDate(row.slaDue);
    }
  }

  const vulnerabilities = Array.from(vulnerabilitiesMap.values())
    .map((entry) => entry.vulnerability)
    .sort((left, right) => {
      const leftPriority = priorityRank[left.businessPriority.toLowerCase() as keyof typeof priorityRank] ?? 99;
      const rightPriority = priorityRank[right.businessPriority.toLowerCase() as keyof typeof priorityRank] ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return right.affectedAssetsCount - left.affectedAssetsCount;
    });

  const assetStats = new Map<
    string,
    { count: number; maxSeverity: keyof typeof severityRank | null; maxRisk: number; topPriority: keyof typeof priorityRank | null }
  >();

  for (const row of avRows) {
    const current = assetStats.get(row.assetId) ?? {
      count: 0,
      maxSeverity: null,
      maxRisk: 0,
      topPriority: null,
    };
    const cveRow = cveRows.find((entry) => entry.cve.id === row.cveId)?.cve;

    current.count += 1;
    current.maxRisk = Math.max(current.maxRisk, row.riskScore);
    if (
      cveRow?.severity &&
      (!current.maxSeverity || severityRank[cveRow.severity] > severityRank[current.maxSeverity])
    ) {
      current.maxSeverity = cveRow.severity;
    }
    if (
      !current.topPriority ||
      priorityRank[row.businessPriority] < priorityRank[current.topPriority]
    ) {
      current.topPriority = row.businessPriority;
    }
    assetStats.set(row.assetId, current);
  }

  const assetsData = assetRows
    .map((asset) => {
      const stats = assetStats.get(asset.id);

      return {
        id: asset.assetCode,
        name: asset.name,
        type: toUiAssetType(asset.type),
        model: asset.model ?? "—",
        manufacturer: asset.manufacturer ?? "—",
        branch: asset.branch ?? "—",
        region: "Unassigned",
        location: asset.location ?? "—",
        ipAddress: asset.ipAddress ?? "—",
        osVersion: asset.osVersion ?? "—",
        criticality: toUiCriticality(asset.criticality),
        exposureLevel: toUiExposureLevel(asset.exposureLevel),
        status:
          asset.status === "active"
            ? "Active"
            : asset.status === "maintenance"
              ? "Maintenance"
              : asset.status === "decommissioned"
                ? "Decommissioned"
                : "Inactive",
        owner: "Unassigned",
        lastScanDate: formatDate(asset.lastScanDate),
        vulnerabilityCount: stats?.count ?? 0,
        maxSeverity: toUiSeverity(stats?.maxSeverity ?? "info"),
        contextualPriority: toUiBusinessPriority(stats?.topPriority ?? "p5"),
        riskScore: stats?.maxRisk ?? 0,
      } satisfies Asset;
    })
    .filter((asset) => asset.vulnerabilityCount > 0);

  const modelCounts = assetsData.reduce<Record<string, number>>((acc, asset) => {
    acc[asset.model] = (acc[asset.model] ?? 0) + asset.vulnerabilityCount;
    return acc;
  }, {});

  return {
    vulnerabilities,
    assets: assetsData,
    severityDistribution: [
      { name: "Critical", value: vulnerabilities.filter((row) => row.severity === "CRITICAL").length, color: "#EF4444" },
      { name: "High", value: vulnerabilities.filter((row) => row.severity === "HIGH").length, color: "#F59E0B" },
      { name: "Medium", value: vulnerabilities.filter((row) => row.severity === "MEDIUM").length, color: "#3B82F6" },
      { name: "Low", value: vulnerabilities.filter((row) => row.severity === "LOW").length, color: "#10B981" },
    ],
    topVulnerableModels: Object.entries(modelCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value })),
  };
}

export async function getVulnerabilityDetail(
  cveCode: string
): Promise<VulnerabilityDetailData | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [cveRow] = await db
    .select({
      cve: cves,
      enrichment: cveEnrichments,
    })
    .from(cves)
    .leftJoin(cveEnrichments, eq(cves.id, cveEnrichments.cveId))
    .where(eq(cves.cveId, cveCode))
    .limit(1);

  if (!cveRow) {
    return null;
  }

  const [assetRows, controls, references] = await Promise.all([
    db
      .select({
        av: assetVulnerabilities,
        asset: assets,
      })
      .from(assetVulnerabilities)
      .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
      .where(eq(assetVulnerabilities.cveId, cveRow.cve.id)),
    db
      .select()
      .from(cveRecommendedControls)
      .where(eq(cveRecommendedControls.cveId, cveRow.cve.id)),
    db
      .select()
      .from(cveSourceReferences)
      .where(eq(cveSourceReferences.cveId, cveRow.cve.id)),
  ]);

  const vulnerability = buildBaseVulnerability(cveRow);

  if (assetRows.length > 0) {
    const topPriority = assetRows.reduce((current, row) => {
      if (!current || priorityRank[row.av.businessPriority] < priorityRank[current]) {
        return row.av.businessPriority;
      }
      return current;
    }, assetRows[0]!.av.businessPriority);

    const worstSla = assetRows.reduce((current, row) => {
      if (slaRank[row.av.slaStatus] > slaRank[current]) {
        return row.av.slaStatus;
      }
      return current;
    }, assetRows[0]!.av.slaStatus);

    vulnerability.affectedAssetsCount = assetRows.length;
    vulnerability.businessPriority = toUiBusinessPriority(topPriority);
    vulnerability.status = assetRows.every((row) => row.av.status === "closed")
      ? "Closed"
      : assetRows.some((row) => row.av.status === "mitigated")
        ? "Mitigated"
        : "Open";
    vulnerability.firstSeen = formatDate(
      assetRows.reduce((current, row) => (row.av.firstSeen < current ? row.av.firstSeen : current), assetRows[0]!.av.firstSeen)
    );
    vulnerability.lastSeen = formatDate(
      assetRows.reduce((current, row) => (row.av.lastSeen > current ? row.av.lastSeen : current), assetRows[0]!.av.lastSeen)
    );
    vulnerability.slaStatus = toUiSlaStatus(worstSla);
    vulnerability.slaDue = formatDate(
      assetRows
        .map((row) => row.av.slaDue)
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null
    );
  }

  vulnerability.trustedSources = references.map((reference) => ({
    name: reference.name,
    url: reference.url,
    updatedAt: formatDate(reference.updatedAt),
    icon: toSourceIcon(reference.sourceType),
  }));
  vulnerability.compensatingControls = controls
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((control) => ({
      title: control.title,
      description: control.description ?? "",
      command: control.command ?? undefined,
    }));

  const impactedAssets = assetRows.map(({ av, asset }) => ({
    id: asset.assetCode,
    name: asset.name,
    type: toUiAssetType(asset.type),
    model: asset.model ?? "—",
    manufacturer: asset.manufacturer ?? "—",
    branch: asset.branch ?? "—",
    region: "Unassigned",
    location: asset.location ?? "—",
    ipAddress: asset.ipAddress ?? "—",
    osVersion: asset.osVersion ?? "—",
    criticality: toUiCriticality(asset.criticality),
    exposureLevel: toUiExposureLevel(asset.exposureLevel),
    status:
      asset.status === "active"
        ? "Active"
        : asset.status === "maintenance"
          ? "Maintenance"
          : asset.status === "decommissioned"
            ? "Decommissioned"
            : "Inactive",
    owner: "Unassigned",
    lastScanDate: formatDate(asset.lastScanDate),
    vulnerabilityCount: 1,
    maxSeverity: vulnerability.severity,
    contextualPriority: toUiBusinessPriority(av.businessPriority),
    riskScore: av.riskScore,
  } satisfies Asset));

  return {
    vulnerabilityDbId: cveRow.cve.id,
    vulnerability,
    impactedAssets,
  };
}
