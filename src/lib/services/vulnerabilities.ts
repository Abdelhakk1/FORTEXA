import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetVulnerabilityEnrichments,
  assetVulnerabilities,
  cveEnrichments,
  cves,
  assets,
  scanFindings,
} from "@/db/schema";
import type { Asset, RemediationCampaign, Vulnerability } from "@/lib/types";
import { measureServerTiming } from "@/lib/observability/timing";
import { buildAssetBusinessContext } from "./assets";
import {
  calculateRankV2,
  compareRankV2,
  getRankV2SlaState,
  prioritySummaryFromFactors,
  normalizeEpssScore,
} from "./business-priority";
import {
  formatDate,
  toUiAssetType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiExploitMaturity,
  toUiExposureLevel,
  toUiSeverity,
  toUiVulnerabilityStatus as toUiLifecycleStatus,
} from "./serializers";
import { buildRemediationCampaignSignature } from "./remediation-campaigns";

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

function isOutdoorGab(exposure: string | null | undefined) {
  return /outdoor/i.test(exposure ?? "");
}

function majorPriorityProfileKey(rankV2: ReturnType<typeof calculateRankV2>) {
  return [
    rankV2.score,
    rankV2.businessPriority,
    rankV2.factorScores.severity,
    rankV2.factorScores.threat,
    rankV2.factorScores.business,
    rankV2.factorScores.urgency,
    rankV2.sortKey.cisaKev,
    rankV2.sortKey.exploitMaturity,
    rankV2.sortKey.epss,
    rankV2.sortKey.slaUrgency,
    rankV2.sortKey.slaDayBucket,
    rankV2.sortKey.exposure,
    rankV2.sortKey.maxCi,
    rankV2.sortKey.maxDt,
    rankV2.sortKey.lifecycle,
  ].join("|");
}

function buildListTieBreakReason(
  vulnerability: Vulnerability,
  options?: {
    sameCveTiedGroup?: boolean;
    stablePriorityTie?: boolean;
  }
) {
  if (options?.sameCveTiedGroup) {
    return "Same-CVE campaign • remediate together";
  }

  if (options?.stablePriorityTie) {
    return "Tied priority • stable display order";
  }

  const topSignals =
    vulnerability.tieBreakReason || vulnerability.rankBucket || "deterministic factors";

  if ((vulnerability.sameScoreCount ?? 0) > 0) {
    return `Wins same-score tie on ${topSignals}.`;
  }

  if (vulnerability.fixRank === 1) {
    return `Recommended first because of ${topSignals}.`;
  }

  return `Ranked by ${topSignals}.`;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right));
}

function summarizeCampaignExposure(
  vulnerabilities: Array<Vulnerability & { assetCode?: string; gabExposureType?: string }>
) {
  const exposureByAsset = new Map<string, string>();

  for (const vulnerability of vulnerabilities) {
    const assetCode = vulnerability.assetCode ?? vulnerability.id;
    exposureByAsset.set(assetCode, vulnerability.gabExposureType ?? "Unknown");
  }

  const counts = new Map<string, number>();

  for (const exposure of exposureByAsset.values()) {
    counts.set(exposure, (counts.get(exposure) ?? 0) + 1);
  }

  const ordered = ["Outdoor GAB", "Indoor GAB", "Unknown"];
  const parts = ordered.flatMap((exposure) => {
    const count = counts.get(exposure) ?? 0;

    if (count === 0) {
      return [];
    }

    return [`${count} ${exposure}${count === 1 ? "" : "s"}`];
  });

  return parts.join(", ") || "GAB exposure unknown";
}

function buildRemediationCampaigns(
  vulnerabilities: Array<
    Vulnerability & {
      assetCode?: string;
      assetName?: string;
      scannerFindingCode?: string | null;
      scannerFindingTitle?: string | null;
      remediationText?: string | null;
      rankV2?: ReturnType<typeof calculateRankV2>;
    }
  >
) {
  const campaignMap = new Map<
    string,
    {
      signature: ReturnType<typeof buildRemediationCampaignSignature>;
      vulnerabilities: typeof vulnerabilities;
    }
  >();

  for (const vulnerability of vulnerabilities) {
    const signature = buildRemediationCampaignSignature({
      cveId: vulnerability.cveId,
      cveTitle: vulnerability.title.replace(/^.+? · /, ""),
      scannerFindingCode: vulnerability.scannerFindingCode,
      scannerFindingTitle: vulnerability.scannerFindingTitle,
      remediationText: vulnerability.remediationText,
    });
    const existing = campaignMap.get(signature.key);

    if (existing) {
      existing.vulnerabilities.push(vulnerability);
      continue;
    }

    campaignMap.set(signature.key, {
      signature,
      vulnerabilities: [vulnerability],
    });
  }

  const campaigns = Array.from(campaignMap.values()).map(
    ({ signature, vulnerabilities: campaignVulnerabilities }) => {
      const orderedVulnerabilities = [...campaignVulnerabilities].sort((left, right) => {
        if (left.rankV2 && right.rankV2) {
          const rankDelta = compareRankV2(left.rankV2, right.rankV2);

          if (rankDelta !== 0) {
            return rankDelta;
          }
        }

        return left.id.localeCompare(right.id);
      });
      const representative = orderedVulnerabilities[0];
      const cveIds = uniqueSorted(orderedVulnerabilities.map((item) => item.cveId));
      const affectedAssetCodes = uniqueSorted(
        orderedVulnerabilities.map((item) => item.assetCode)
      );
      const groupedCvesText = cveIds.join(", ");
      const isGroupedCampaign =
        cveIds.length > 1 || affectedAssetCodes.length > 1 || orderedVulnerabilities.length > 1;
      const campaignRationale =
        signature.basis === "ms17_010"
          ? "Fix together: same Microsoft MS17-010 update, same remediation path."
          : `Fix together: ${signature.rationale}.`;

      return {
        id: signature.key,
        representativeVulnerabilityId: representative.id,
        title: signature.title,
        description: isGroupedCampaign
          ? `Covers ${groupedCvesText} across ${affectedAssetCodes.length} GAB${affectedAssetCodes.length === 1 ? "" : "s"}.`
          : "Single finding campaign retained for operator queue consistency.",
        cveIds,
        affectedAssetCodes,
        affectedAssetsCount: affectedAssetCodes.length,
        cveCount: cveIds.length,
        findingCount: orderedVulnerabilities.length,
        severity: representative.severity,
        cvssScore: representative.cvssScore,
        businessPriority: representative.businessPriority,
        riskScore: representative.rankScore ?? representative.riskScore ?? 0,
        rankScore: representative.rankScore ?? representative.riskScore ?? 0,
        rankBucket: representative.rankBucket ?? "Routine",
        recommendedFixOrder:
          representative.recommendedFixOrder ?? representative.rankScore ?? representative.riskScore ?? 0,
        fixRank: 0,
        exploitMaturity: representative.exploitMaturity,
        hasCisaKevSource: orderedVulnerabilities.some((item) => item.hasCisaKevSource),
        epssScore: Math.max(
          ...orderedVulnerabilities.map((item) => item.epssScore ?? 0)
        ),
        slaDue: representative.slaDue,
        slaStatus: representative.slaStatus,
        firstSeen: representative.firstSeen,
        lastSeen: representative.lastSeen,
        exposureSummary: summarizeCampaignExposure(orderedVulnerabilities),
        campaignRationale,
        tieBreakReason: campaignRationale,
        groupedCvesText,
        rawFindingIds: orderedVulnerabilities.map((item) => item.id),
        rankV2: representative.rankV2,
      };
    }
  );

  return campaigns
    .sort((left, right) => {
      if (left.rankV2 && right.rankV2) {
        const rankDelta = compareRankV2(left.rankV2, right.rankV2);

        if (rankDelta !== 0) {
          return rankDelta;
        }
      }

      return left.title.localeCompare(right.title);
    })
    .map(({ rankV2, ...campaign }, index) => ({
      ...campaign,
      fixRank: index + 1,
    })) satisfies RemediationCampaign[];
}

export interface VulnerabilityOverviewData {
  remediationCampaigns: RemediationCampaign[];
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
      remediationCampaigns: [],
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
          hasCisaKevSource: sql<boolean>`coalesce((
            select true
            from cve_source_references source
            where source.cve_id = ${cves.id}
              and source.source_type = 'cisa_kev'
            limit 1
          ), false)`,
          epssScore: sql<number | null>`(
            select max(
              case
                when (source.retrieval_metadata->>'epss') ~ '^[0-9]+(\\.[0-9]+)?$'
                  then (source.retrieval_metadata->>'epss')::double precision
                else null
              end
            )
            from cve_source_references source
            where source.cve_id = ${cves.id}
              and (
                source.name ilike '%EPSS%'
                or source.retrieval_metadata->>'retrievalMethod' = 'first_epss_api'
              )
          )`,
          trustedSourceCount: sql<number>`(
            select count(*)::int
            from cve_source_references source
            where source.cve_id = ${cves.id}
          )`,
          scannerEvidenceCount: sql<number>`(
            select count(*)::int
            from scan_findings finding
            where finding.organization_id = ${assetVulnerabilities.organizationId}
              and finding.matched_asset_id = ${assets.id}
              and finding.matched_cve_id = ${cves.id}
          )`,
          scannerEvidenceQuality: sql<number | null>`(
            select avg(finding.match_confidence)::double precision
            from scan_findings finding
            where finding.organization_id = ${assetVulnerabilities.organizationId}
              and finding.matched_asset_id = ${assets.id}
              and finding.matched_cve_id = ${cves.id}
          )`,
          scannerFindingCode: sql<string | null>`(
            select finding.finding_code
            from scan_findings finding
            where finding.organization_id = ${assetVulnerabilities.organizationId}
              and finding.matched_asset_id = ${assets.id}
              and finding.matched_cve_id = ${cves.id}
            order by finding.last_seen desc
            limit 1
          )`,
          scannerFindingTitle: sql<string | null>`(
            select finding.title
            from scan_findings finding
            where finding.organization_id = ${assetVulnerabilities.organizationId}
              and finding.matched_asset_id = ${assets.id}
              and finding.matched_cve_id = ${cves.id}
            order by finding.last_seen desc
            limit 1
          )`,
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

      const vulnerabilityRows = avDetailRows
        .map((row) => {
          const assetBusinessContext = buildAssetBusinessContext(row.asset, null);
          const priorityFactors =
            typeof row.av.priorityFactors === "object" && row.av.priorityFactors
              ? {
                  summary: String(row.av.priorityFactors.summary ?? ""),
                  businessImpact: String(row.av.priorityFactors.businessImpact ?? ""),
                  remediationUrgency: String(row.av.priorityFactors.remediationUrgency ?? ""),
                  missingContext: Array.isArray(row.av.priorityFactors.missingContext)
                    ? row.av.priorityFactors.missingContext.map(String)
                    : [],
                  applicationSensitivity: String(
                    row.av.priorityFactors.applicationSensitivity ?? ""
                  ),
                  applicationProfile: String(row.av.priorityFactors.applicationProfile ?? ""),
                  gabExposure: String(row.av.priorityFactors.gabExposure ?? ""),
                }
              : undefined;
          const cvssScore = row.cve.cvssScore ? Number(row.cve.cvssScore) : 0;
          const hasCisaKevSource = Boolean(row.hasCisaKevSource);
          const epssScore = normalizeEpssScore(row.epssScore);
          const slaState = getRankV2SlaState({
            slaDue: row.av.slaDue,
            slaStatus: row.av.slaStatus,
          });
          const rankV2 = calculateRankV2({
            severity: row.cve.severity,
            cvssScore,
            exploitMaturity: row.cve.exploitMaturity,
            knownExploitation: hasCisaKevSource,
            epssScore,
            assetCidt: assetBusinessContext.cidt,
            applicationCidt: assetBusinessContext.businessApplication.cidt,
            applicationInternetExposed:
              assetBusinessContext.businessApplication.isInternetExposed,
            gabExposureType: row.asset.gabExposureType,
            slaDue: row.av.slaDue,
            slaStatus: row.av.slaStatus,
            lifecycleStatus: row.av.status,
            scannerEvidenceCount: row.scannerEvidenceCount,
            scannerEvidenceQuality: row.scannerEvidenceQuality,
            trustedSourceCount: row.trustedSourceCount,
            firstSeen: row.av.firstSeen,
            assetCode: row.asset.assetCode,
            cveId: row.cve.cveId,
            id: row.av.id,
          });

          return {
            id: row.av.id,
            cveId: row.cve.cveId,
            assetCode: row.asset.assetCode,
            assetName: row.asset.name,
            scannerFindingCode: row.scannerFindingCode,
            scannerFindingTitle: row.scannerFindingTitle,
            remediationText: row.av.notes,
            title: `${row.asset.assetCode} · ${row.cve.title}`,
            description: row.cve.description ?? "",
            severity: toUiSeverity(row.cve.severity),
            cvssScore,
            cvssVector: row.cve.cvssVector ?? "—",
            businessPriority: toUiBusinessPriority(rankV2.businessPriority),
            riskScore: rankV2.score,
            rankScore: rankV2.score,
            rankBucket: rankV2.bucketLabel,
            rankAlgorithmVersion: rankV2.algorithmVersion,
            rankFactors: rankV2.factorScores,
            missingRankEvidence: rankV2.missingEvidence,
            recommendedFixOrder: rankV2.score,
            tieBreakReason: rankV2.shortReason,
            rankV2,
            gabExposureType: assetBusinessContext.gabExposureType,
            gabExposureTypeDb: assetBusinessContext.gabExposureTypeDb,
            assetSensitivity: assetBusinessContext.cidt.sensitivity,
            applicationSensitivity:
              priorityFactors?.applicationSensitivity ||
              assetBusinessContext.businessApplication.cidt.sensitivity,
            applicationProfile:
              priorityFactors?.applicationProfile ||
              assetBusinessContext.businessApplication.profile,
            exploitMaturity: toUiExploitMaturity(row.cve.exploitMaturity, {
              confirmedCisaKev: hasCisaKevSource,
            }),
            hasCisaKevSource,
            epssScore,
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
            slaStatus: slaState.displayLabel as Vulnerability["slaStatus"],
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
              prioritySummaryFromFactors(row.av.priorityFactors),
            priorityFactors,
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
          };
        })
        .sort((left, right) => {
          const orderDelta = compareRankV2(left.rankV2, right.rankV2);

          if (orderDelta !== 0) {
            return orderDelta;
          }

          return left.id.localeCompare(right.id);
        });
      const scoreCounts = new Map<number, number>();
      const bucketCounts = new Map<string, number>();

      for (const vulnerability of vulnerabilityRows) {
        const score = vulnerability.rankScore ?? vulnerability.riskScore ?? 0;
        scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
        const bucket = vulnerability.businessPriority;
        bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
      }
      const priorityProfileCounts = new Map<string, number>();
      const sameCvePriorityProfileCounts = new Map<string, number>();

      for (const vulnerability of vulnerabilityRows) {
        const profileKey = majorPriorityProfileKey(vulnerability.rankV2);
        priorityProfileCounts.set(
          profileKey,
          (priorityProfileCounts.get(profileKey) ?? 0) + 1
        );

        const cveProfileKey = `${vulnerability.cveId.toLowerCase()}|${profileKey}`;
        sameCvePriorityProfileCounts.set(
          cveProfileKey,
          (sameCvePriorityProfileCounts.get(cveProfileKey) ?? 0) + 1
        );
      }

      const vulnerabilities = vulnerabilityRows.map((vulnerability, index) => {
        const sameScoreCount = Math.max(
          0,
          (scoreCounts.get(vulnerability.rankScore ?? vulnerability.riskScore ?? 0) ?? 1) - 1
        );
        const samePriorityCount = Math.max(
          0,
          (bucketCounts.get(vulnerability.businessPriority) ?? 1) - 1
        );
        const rankedVulnerability = {
          ...vulnerability,
          fixRank: index + 1,
          sameScoreCount,
          samePriorityCount,
        };
        const profileKey = majorPriorityProfileKey(vulnerability.rankV2);
        const sameCveTiedGroup =
          (sameCvePriorityProfileCounts.get(
            `${vulnerability.cveId.toLowerCase()}|${profileKey}`
          ) ?? 0) > 1;
        const stablePriorityTie =
          !sameCveTiedGroup && (priorityProfileCounts.get(profileKey) ?? 0) > 1;

        return {
          ...rankedVulnerability,
          tieBreakReason: buildListTieBreakReason(rankedVulnerability, {
            sameCveTiedGroup,
            stablePriorityTie,
          }),
        };
      });
      const remediationCampaigns = buildRemediationCampaigns(vulnerabilities);

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
        ...buildAssetBusinessContext(asset, null),
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
        remediationCampaigns,
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
      remediationCampaigns: result.remediationCampaigns.length,
      vulnerabilities: result.vulnerabilities.length,
    })
  );
}
