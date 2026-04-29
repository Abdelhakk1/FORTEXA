import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetVulnerabilityEnrichments,
  assetVulnerabilities,
  cveEnrichments,
  cves,
  assets,
} from "@/db/schema";
import type { Asset, Vulnerability } from "@/lib/types";
import { measureServerTiming } from "@/lib/observability/timing";
import {
  formatDate,
  toUiAssetType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiExploitMaturity,
  toUiExposureLevel,
  toUiSeverity,
  toUiSlaStatus,
  toUiVulnerabilityStatus as toUiLifecycleStatus,
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

export interface VulnerabilityOverviewData {
  vulnerabilities: Vulnerability[];
  assets: Asset[];
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  topVulnerableModels: Array<{ name: string; value: number }>;
}

function toUiEnrichmentStatus(
  status:
    | typeof cveEnrichments.$inferSelect.enrichmentStatus
    | typeof assetVulnerabilityEnrichments.$inferSelect.enrichmentStatus
    | null
    | undefined
) {
  switch (status) {
    case "completed":
      return "Completed" as const;
    case "processing":
      return "Processing" as const;
    case "failed":
      return "Failed" as const;
    default:
      return "Pending" as const;
  }
}

export async function getVulnerabilityOverviewData(
  organizationId: string
): Promise<VulnerabilityOverviewData> {
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

  return measureServerTiming(
    "vulnerabilities.overview",
    async () => {
      const avDetailRows = await db
        .select({
          av: assetVulnerabilities,
          asset: assets,
          cve: cves,
          enrichment: cveEnrichments,
          avEnrichment: assetVulnerabilityEnrichments,
        })
        .from(assetVulnerabilities)
        .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
        .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
        .leftJoin(cveEnrichments, eq(cves.id, cveEnrichments.cveId))
        .leftJoin(
          assetVulnerabilityEnrichments,
          eq(assetVulnerabilities.id, assetVulnerabilityEnrichments.assetVulnerabilityId)
        )
        .where(eq(assetVulnerabilities.organizationId, organizationId));

      const vulnerabilities = avDetailRows
        .map((row) => ({
          id: row.av.id,
          cveId: row.cve.cveId,
          title: `${row.asset.assetCode} · ${row.cve.title}`,
          description: row.cve.description ?? "",
          severity: toUiSeverity(row.cve.severity),
          cvssScore: row.cve.cvssScore ? Number(row.cve.cvssScore) : 0,
          cvssVector: row.cve.cvssVector ?? "—",
          businessPriority: toUiBusinessPriority(row.av.businessPriority),
          exploitMaturity: toUiExploitMaturity(row.cve.exploitMaturity),
          affectedAssetsCount: 1,
          patchAvailable: row.cve.patchAvailable,
          aiRemediationAvailable:
            row.avEnrichment?.enrichmentStatus === "completed" ||
            row.enrichment?.aiRemediationAvailable ||
            false,
          status: toUiLifecycleStatus(row.av.status),
          firstSeen: formatDate(row.av.firstSeen),
          lastSeen: formatDate(row.av.lastSeen),
          slaDue: formatDate(row.av.slaDue),
          slaStatus: toUiSlaStatus(row.av.slaStatus),
          affectedProducts: row.cve.affectedProducts ?? [],
          impactAnalysis: row.enrichment?.impactAnalysis ?? "",
          exploitConditions: row.enrichment?.exploitConditions ?? "",
          trustedSources: [],
          primaryRemediation:
            row.avEnrichment?.recommendedActions?.join("\n") ||
            row.enrichment?.primaryRemediation ||
            "",
          compensatingControls: [],
          confidenceScore:
            row.avEnrichment?.confidenceScore ?? row.enrichment?.confidenceScore ?? 0,
          contextReason:
            row.avEnrichment?.businessRationale ??
            row.enrichment?.contextReason ??
            "",
          aiSummary: row.avEnrichment?.summary ?? row.enrichment?.summary ?? "",
          enrichmentStatus: toUiEnrichmentStatus(
            row.avEnrichment?.enrichmentStatus ?? row.enrichment?.enrichmentStatus
          ),
          enrichmentError:
            row.avEnrichment?.aiError ?? row.enrichment?.aiError ?? "",
          enrichmentModel:
            row.avEnrichment?.aiModel ?? row.enrichment?.aiModel ?? "",
          aiEnrichedAt: formatDate(
            row.avEnrichment?.enrichedAt ?? row.enrichment?.enrichedAt ?? null
          ),
          aiTags: row.enrichment?.tags ?? [],
        }))
        .sort((left, right) => {
          const leftPriority =
            priorityRank[left.businessPriority.toLowerCase() as keyof typeof priorityRank] ?? 99;
          const rightPriority =
            priorityRank[right.businessPriority.toLowerCase() as keyof typeof priorityRank] ?? 99;

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }

          return right.affectedAssetsCount - left.affectedAssetsCount;
        });

      const assetStats = new Map<
        string,
        {
          asset: typeof assets.$inferSelect;
          count: number;
          maxSeverity: keyof typeof severityRank | null;
          maxRisk: number;
          topPriority: keyof typeof priorityRank | null;
        }
      >();

      for (const row of avDetailRows) {
        const current = assetStats.get(row.asset.id) ?? {
          asset: row.asset,
          count: 0,
          maxSeverity: null,
          maxRisk: 0,
          topPriority: null,
        };

        current.count += 1;
        current.maxRisk = Math.max(current.maxRisk, row.av.riskScore);
        if (
          !current.maxSeverity ||
          severityRank[row.cve.severity] > severityRank[current.maxSeverity]
        ) {
          current.maxSeverity = row.cve.severity;
        }
        if (
          !current.topPriority ||
          priorityRank[row.av.businessPriority] < priorityRank[current.topPriority]
        ) {
          current.topPriority = row.av.businessPriority;
        }

        assetStats.set(row.asset.id, current);
      }

      const assetsData = Array.from(assetStats.values()).map(({ asset, count, maxSeverity, maxRisk, topPriority }) => ({
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
        vulnerabilityCount: count,
        maxSeverity: toUiSeverity(maxSeverity ?? "info"),
        contextualPriority: toUiBusinessPriority(topPriority ?? "p5"),
        riskScore: maxRisk,
      })) satisfies Asset[];

      const modelCounts = assetsData.reduce<Record<string, number>>((acc, asset) => {
        acc[asset.model] = (acc[asset.model] ?? 0) + asset.vulnerabilityCount;
        return acc;
      }, {});

      return {
        vulnerabilities,
        assets: assetsData,
        severityDistribution: [
          {
            name: "Critical",
            value: vulnerabilities.filter((row) => row.severity === "CRITICAL").length,
            color: "#EF4444",
          },
          {
            name: "High",
            value: vulnerabilities.filter((row) => row.severity === "HIGH").length,
            color: "#F59E0B",
          },
          {
            name: "Medium",
            value: vulnerabilities.filter((row) => row.severity === "MEDIUM").length,
            color: "#3B82F6",
          },
          {
            name: "Low",
            value: vulnerabilities.filter((row) => row.severity === "LOW").length,
            color: "#10B981",
          },
        ],
        topVulnerableModels: Object.entries(modelCounts)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 5)
          .map(([name, value]) => ({ name, value })),
      };
    },
    undefined,
    (result) => ({
      assets: result.assets.length,
      vulnerabilities: result.vulnerabilities.length,
    })
  );
}
