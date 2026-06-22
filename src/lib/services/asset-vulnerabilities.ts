import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilityEnrichments,
  assetVulnerabilityEvents,
  assetVulnerabilities,
  assets,
  cveSourceReferences,
  cves,
  profiles,
  remediationTasks,
  scanFindings,
  scanImports,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { Asset } from "@/lib/types";
import { buildAssetBusinessContext } from "./assets";
import {
  calculateRankV2,
  compareRankV2,
  formatPriorityFactorSummary,
  getRankV2SlaState,
  normalizeCvssScore,
  normalizeSeverity,
  prioritySummaryFromFactors,
  simplifyGabExposureText,
} from "./business-priority";
import { ensureGabCidtTemplates } from "./gab-business-context";
import {
  formatDate,
  formatDateTime,
  toUiAlertStatus,
  toUiBusinessPriority,
  toUiExploitMaturity,
  toUiRemediationStatus,
  toUiSeverity,
  toUiSlaStatus,
  toUiVulnerabilityStatus,
} from "./serializers";
import {
  isCisaKevSource,
  strongestEpssScoreFromSources,
} from "./trusted-vulnerability-sources";
import { buildRemediationCampaignSignature } from "./remediation-campaigns";
import { recalculateRankV2ForAssetVulnerabilities } from "./rank-v2";
import { buildPaginatedResult, desc, getPagination, sql, type SQL } from "./utils";

export interface AssetVulnerabilityFilters {
  status?: string;
  businessPriority?: string;
  slaStatus?: string;
  sortBy?: "riskScore" | "slaDue" | "lastSeen";
  page?: number;
  pageSize?: number;
}

export interface AssetVulnerabilityDetailData {
  id: string;
  asset: {
    id: string;
    assetCode: string;
    name: string;
    type: string;
    branch: string;
    location: string;
    ipAddress: string;
    criticality: string;
    exposureLevel: string;
    gabExposureType: string;
    gabExposureTypeDb: string;
    cidt: Asset["cidt"];
    businessApplication: Asset["businessApplication"];
    inferredRole: string;
    siteArchetype: string;
    inferenceConfidence: number;
    inferenceReasons: string[];
  };
  vulnerability: {
    dbId: string;
    cveId: string;
    title: string;
    description: string;
    severity: string;
    cvssScore: number | null;
    cvssVector: string;
    status: string;
    statusDb: typeof assetVulnerabilities.$inferSelect.status;
    riskScore: number;
    businessPriority: string;
    firstSeen: string;
    lastSeen: string;
    slaDue: string;
    slaStatus: string;
    patchAvailable: boolean;
    exploitMaturity: string;
    notes: string;
    priorityFactors?: {
      summary: string;
      businessImpact: string;
      remediationUrgency: string;
      missingContext: string[];
    };
    lastImport: {
      id: string;
      name: string;
      importDate: string;
      status: string;
    } | null;
  };
  scannerEvidence: Array<{
    id: string;
    title: string;
    severity: string;
    host: string;
    port: number | null;
    protocol: string | null;
    rawEvidence: string | null;
    matchConfidence: number | null;
    matchNotes: string | null;
    lastSeen: string;
    scanImportId: string;
    scanImportName: string;
  }>;
  lifecycle: Array<{
    id: string;
    eventType: string;
    label: string;
    createdAt: string;
    beforeStatus: string | null;
    afterStatus: string | null;
    riskScore: number | null;
    note: string | null;
  }>;
  fixOrder: {
    rankPosition: number;
    totalOpen: number;
    priorityBucket: string;
    rankScore: number;
    rankAlgorithmVersion: string;
    rankFactors: {
      severity: number;
      threat: number;
      business: number;
      urgency: number;
    };
    severitySource: string;
    slaState: {
      state: string;
      label: string;
      displayLabel: string;
      reason: string;
      remainingDays: number | null;
    };
    explanation: string;
    sameRiskExplanation: string;
    sameRiskCount: number;
    sameScorePosition: number;
    sameScoreTotal: number;
    isFirstWithinSameScore: boolean;
    samePriorityCount: number;
    missingEvidence: string[];
    tieBreakerSummary: string;
    whyThisWins: string;
    whyRankedHere: string;
    whyBeatsSimilar: string;
    whyNotHigher: string | null;
    sameRemediationGroup: {
      cveId: string;
      openCount: number;
      peerCount: number;
      explanation: string;
    } | null;
    remediationCampaign: {
      title: string;
      scannerTitle: string;
      rankPosition: number;
      totalCampaigns: number;
      priorityBucket: string;
      rankScore: number;
      highestFindingRankPosition: number;
      totalOpenFindings: number;
      cveIds: string[];
      affectedAssets: string[];
      openCount: number;
      exposureSummary: string;
      slaStatus: string;
      explanation: string;
      rationale: string;
      whyRankedHere: string;
      whyBeatsSimilar: string;
      whyNotHigher: string | null;
    } | null;
    comparison: {
      current: string;
      peers: string;
      tieBreaker: string;
      notHigher: string;
    };
    factors: string[];
  };
  relatedExposure: Array<{
    id: string;
    assetCode: string;
    assetName: string;
    status: string;
    riskScore: number;
    businessPriority: string;
  }>;
  remediationTasks: Array<{
    id: string;
    title: string;
    status: string;
    assignedOwner: string;
    dueDate: string;
    progress: number;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  trustedSources: Array<{
    id: string;
    label: string;
    url: string;
    sourceType: string;
    supportedFacts: string[];
    retrievedAt: string;
    updatedAt: string;
  }>;
  ai: {
    status: string;
    summary: string;
    technicalRationale: string;
    businessRationale: string;
    primaryMitigation: string;
    recommendedActions: string[];
    validationSteps: string[];
    compensatingControls: string[];
    rollbackCaution: string;
    maintenanceWindowNote: string;
    citations: Array<{
      id: string;
      label: string;
      kind: string;
      url?: string | null;
    }>;
    unsupportedClaims: string[];
    trustLabels: string[];
    confidenceScore: number;
    model: string;
    provider: string;
    error: string;
    enrichedAt: string;
    updatedAt: string;
    processingStartedAt: string;
    attemptCount: number;
    provenance: string;
    validationPassed: boolean;
  };
}

function buildWhere(organizationId: string, filters: AssetVulnerabilityFilters) {
  const clauses: SQL[] = [eq(assetVulnerabilities.organizationId, organizationId)];

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
  organizationId: string,
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

  const where = buildWhere(organizationId, filters);
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
      cvssScore: normalizeCvssScore(row.cvssScore),
      status: row.av.status,
      businessPriority: toUiBusinessPriority(row.av.businessPriority),
      riskScore: row.av.riskScore,
      contextReason: prioritySummaryFromFactors(row.av.priorityFactors),
      priorityFactors:
        typeof row.av.priorityFactors === "object" && row.av.priorityFactors
          ? {
              summary: String(row.av.priorityFactors.summary ?? ""),
              businessImpact: String(row.av.priorityFactors.businessImpact ?? ""),
              remediationUrgency: String(row.av.priorityFactors.remediationUrgency ?? ""),
              missingContext: Array.isArray(row.av.priorityFactors.missingContext)
                ? row.av.priorityFactors.missingContext.map(String)
                : [],
            }
          : undefined,
      slaDue: formatDate(row.av.slaDue),
      slaStatus: toUiSlaStatus(row.av.slaStatus),
      lastSeen: formatDate(row.av.lastSeen),
      firstSeen: formatDate(row.av.firstSeen),
    })),
    total.length,
    pagination
  );
}

const lifecycleLabels: Record<string, string> = {
  introduced: "Introduced by import",
  unchanged: "Observed again",
  fixed: "No longer observed",
  reopened: "Observed after closure",
  status_changed: "Lifecycle status changed",
  task_linked: "Remediation linked",
  task_completed: "Remediation completed",
};

function compactJoin(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

function summarizeExposureByAsset(
  rows: Array<{ asset: typeof assets.$inferSelect; context: { gabExposureType: string } }>
) {
  const exposureByAsset = new Map<string, string>();

  for (const row of rows) {
    exposureByAsset.set(row.asset.assetCode, row.context.gabExposureType);
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

function buildReadableSignalList(signals: string[]) {
  if (signals.length <= 1) {
    return signals[0] ?? "deterministic Fortexa risk signals";
  }

  if (signals.length === 2) {
    return `${signals[0]} and ${signals[1]}`;
  }

  return `${signals.slice(0, -1).join(", ")}, and ${signals[signals.length - 1]}`;
}

export async function getAssetVulnerabilityDetail(
  organizationId: string,
  assetVulnerabilityId: string
): Promise<AssetVulnerabilityDetailData | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [row] = await db
    .select({
      av: assetVulnerabilities,
      asset: assets,
      cve: cves,
      enrichment: assetVulnerabilityEnrichments,
    })
    .from(assetVulnerabilities)
    .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
    .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .leftJoin(
      assetVulnerabilityEnrichments,
      eq(assetVulnerabilities.id, assetVulnerabilityEnrichments.assetVulnerabilityId)
    )
    .where(
      and(
        eq(assetVulnerabilities.organizationId, organizationId),
        eq(assetVulnerabilities.id, assetVulnerabilityId)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [
    lastImportRows,
    evidenceRows,
    eventRows,
    relatedRows,
    taskRows,
    alertRows,
    sourceRows,
    templates,
  ] =
    await Promise.all([
      db
        .select({
          id: scanImports.id,
          name: scanImports.name,
          importDate: scanImports.importDate,
          status: scanImports.status,
        })
        .from(assetVulnerabilityEvents)
        .innerJoin(scanImports, eq(assetVulnerabilityEvents.scanImportId, scanImports.id))
        .where(
          and(
            eq(assetVulnerabilityEvents.organizationId, organizationId),
            eq(assetVulnerabilityEvents.assetVulnerabilityId, assetVulnerabilityId)
          )
        )
        .orderBy(desc(assetVulnerabilityEvents.createdAt))
        .limit(1),
      db
        .select({
          id: scanFindings.id,
          findingCode: scanFindings.findingCode,
          title: scanFindings.title,
          severity: scanFindings.severity,
          host: scanFindings.host,
          port: scanFindings.port,
          protocol: scanFindings.protocol,
          rawEvidence: scanFindings.rawEvidence,
          matchConfidence: scanFindings.matchConfidence,
          matchNotes: scanFindings.matchNotes,
          lastSeen: scanFindings.lastSeen,
          scanImportId: scanImports.id,
          scanImportName: scanImports.name,
        })
        .from(scanFindings)
        .innerJoin(scanImports, eq(scanFindings.scanImportId, scanImports.id))
        .where(
          and(
            eq(scanFindings.matchedAssetId, row.asset.id),
            eq(scanFindings.matchedCveId, row.cve.id),
            eq(scanFindings.organizationId, organizationId)
          )
        )
        .orderBy(desc(scanFindings.lastSeen))
        .limit(5),
      db
        .select()
        .from(assetVulnerabilityEvents)
        .where(
          and(
            eq(assetVulnerabilityEvents.organizationId, organizationId),
            eq(assetVulnerabilityEvents.assetVulnerabilityId, assetVulnerabilityId)
          )
        )
        .orderBy(desc(assetVulnerabilityEvents.createdAt))
        .limit(20),
      db
        .select({
          av: assetVulnerabilities,
          assetCode: assets.assetCode,
          assetName: assets.name,
        })
        .from(assetVulnerabilities)
        .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
        .where(
          and(
            eq(assetVulnerabilities.cveId, row.cve.id),
            eq(assetVulnerabilities.organizationId, organizationId),
            ne(assetVulnerabilities.id, assetVulnerabilityId)
          )
        )
        .orderBy(desc(assetVulnerabilities.riskScore))
        .limit(6),
      db
        .select({
          task: remediationTasks,
          assignedName: profiles.fullName,
        })
        .from(remediationTasks)
        .leftJoin(profiles, eq(remediationTasks.assignedTo, profiles.id))
        .where(
          and(
            eq(remediationTasks.organizationId, organizationId),
            eq(remediationTasks.assetVulnerabilityId, assetVulnerabilityId)
          )
        )
        .orderBy(desc(remediationTasks.updatedAt))
        .limit(10),
      db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.organizationId, organizationId),
            eq(alerts.relatedAssetVulnerabilityId, assetVulnerabilityId)
          )
        )
        .orderBy(desc(alerts.createdAt))
        .limit(10),
      db
        .select()
        .from(cveSourceReferences)
        .where(eq(cveSourceReferences.cveId, row.cve.id)),
      ensureGabCidtTemplates(organizationId),
    ]);

  const inference = (row.asset.metadata?.inference ?? {}) as {
    role?: string;
    siteArchetype?: string;
    confidence?: number;
    reasons?: string[];
  };
  const lastImport = lastImportRows[0] ?? null;
  const businessContext = buildAssetBusinessContext(row.asset, null, templates);
  const hasCisaKevSource = sourceRows.some(isCisaKevSource);
  const epssScore = strongestEpssScoreFromSources(sourceRows);
  const hasEpssSource = epssScore != null;
  const knownExploitation = hasCisaKevSource;
  const priorityFactors =
    typeof row.av.priorityFactors === "object" && row.av.priorityFactors
      ? {
          summary: formatPriorityFactorSummary(
            String(row.av.priorityFactors.summary ?? "")
          ),
          businessImpact: simplifyGabExposureText(
            String(row.av.priorityFactors.businessImpact ?? "")
          ),
          remediationUrgency: simplifyGabExposureText(
            String(row.av.priorityFactors.remediationUrgency ?? "")
          ),
          missingContext: Array.isArray(row.av.priorityFactors.missingContext)
            ? row.av.priorityFactors.missingContext.map((entry) =>
                simplifyGabExposureText(String(entry))
              )
            : [],
        }
      : undefined;
  const rankRows = await db
    .select({
      av: assetVulnerabilities,
      asset: assets,
      cve: cves,
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
    .where(
      and(
        eq(assetVulnerabilities.organizationId, organizationId),
        inArray(assetVulnerabilities.status, ["new", "open", "reopened"])
      )
    );
  const rankedRows = rankRows
    .map((rankRow) => {
      const context = buildAssetBusinessContext(rankRow.asset, null, templates);
      const rankEpssScore =
        strongestEpssScoreFromSources(rankRow.av.id === row.av.id ? sourceRows : []) ??
        rankRow.epssScore;
      const rank = calculateRankV2({
        severity: rankRow.cve.severity,
        cvssScore: normalizeCvssScore(rankRow.cve.cvssScore),
        exploitMaturity: rankRow.cve.exploitMaturity,
        knownExploitation: Boolean(rankRow.hasCisaKevSource),
        epssScore: rankEpssScore,
        assetCidt: context.cidt,
        applicationCidt: context.businessApplication.cidt,
        applicationInternetExposed: context.businessApplication.isInternetExposed,
        gabExposureType: rankRow.asset.gabExposureType,
        slaDue: rankRow.av.slaDue,
        slaStatus: rankRow.av.slaStatus,
        lifecycleStatus: rankRow.av.status,
        scannerEvidenceCount: rankRow.scannerEvidenceCount,
        scannerEvidenceQuality: rankRow.scannerEvidenceQuality,
        trustedSourceCount: rankRow.trustedSourceCount,
        firstSeen: rankRow.av.firstSeen,
        assetCode: rankRow.asset.assetCode,
        cveId: rankRow.cve.cveId,
        id: rankRow.av.id,
      });

      return { ...rankRow, rank, context, rankEpssScore };
    })
    .sort((left, right) => compareRankV2(left.rank, right.rank));
  const currentRankIndex = rankedRows.findIndex(
    (ranked) => ranked.av.id === row.av.id
  );
  const currentRank =
    currentRankIndex >= 0
      ? rankedRows[currentRankIndex].rank
      : calculateRankV2({
          severity: row.cve.severity,
          cvssScore: normalizeCvssScore(row.cve.cvssScore),
          exploitMaturity: row.cve.exploitMaturity,
          knownExploitation: hasCisaKevSource,
          epssScore,
          assetCidt: businessContext.cidt,
          applicationCidt: businessContext.businessApplication.cidt,
          applicationInternetExposed:
            businessContext.businessApplication.isInternetExposed,
          gabExposureType: row.asset.gabExposureType,
          slaDue: row.av.slaDue,
          slaStatus: row.av.slaStatus,
          lifecycleStatus: row.av.status,
          scannerEvidenceCount: evidenceRows.length,
          scannerEvidenceQuality:
            evidenceRows.reduce((sum, evidence) => sum + (evidence.matchConfidence ?? 0), 0) /
              Math.max(1, evidenceRows.length),
          trustedSourceCount: sourceRows.length,
          firstSeen: row.av.firstSeen,
          assetCode: row.asset.assetCode,
          cveId: row.cve.cveId,
          id: row.av.id,
        });
  const rankPosition = currentRankIndex >= 0 ? currentRankIndex + 1 : 1;
  const currentRankedRow =
    currentRankIndex >= 0 ? rankedRows[currentRankIndex] : null;
  const sameScoreRows = rankedRows.filter(
    (ranked) => ranked.rank.score === currentRank.score
  );
  const sameRankScoreCount = Math.max(0, sameScoreRows.length - 1);
  const sameScorePosition =
    currentRankedRow == null
      ? 1
      : Math.max(
          1,
          sameScoreRows.findIndex((ranked) => ranked.av.id === row.av.id) + 1
        );
  const isFirstWithinSameScore = sameScorePosition === 1;
  const samePriorityCount = rankedRows.filter(
    (ranked) =>
      ranked.rank.businessPriority === currentRank.businessPriority &&
      ranked.av.id !== row.av.id
  ).length;
  const slaState = getRankV2SlaState({
    slaDue: row.av.slaDue,
    slaStatus: row.av.slaStatus,
  });
  const formatEpss = (value: number | string | null | undefined) => {
    if (value == null) {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? `EPSS ${parsed.toFixed(2)}` : null;
  };
  const formatEpssValue = (value: number | string | null | undefined) => {
    if (value == null) {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
  };
  const formatComparisonDate = (value: Date | string | null | undefined) => {
    const date = value instanceof Date ? value : value ? new Date(value) : null;

    if (!date || Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  };
  const stableFallbackReason =
    "All major priority factors are equal: same score, same KEV status, same EPSS, same exposure, and same SLA state/day. Fortexa uses a stable fallback order by asset, CVE, and record ID.";
  const stableFallbackOrderReason =
    "all major priority factors are equal, so Fortexa uses a stable fallback order by asset, CVE, and record ID";
  const isStableFallbackOnly = (reasons: string[]) =>
    reasons.length === 1 && reasons[0] === stableFallbackReason;
  const lowerInitialPreservingSla = (value: string) =>
    value.replace(/^\w/, (match) => match.toLowerCase()).replace(/\bsla\b/gi, "SLA");
  const uniqueReasons = (reasons: string[]) =>
    Array.from(new Set(reasons.filter(Boolean)));
  const summarizePeerDifferences = (
    winner: (typeof rankedRows)[number],
    peers: Array<(typeof rankedRows)[number]>,
    includeScore: boolean
  ) =>
    uniqueReasons(
      peers.flatMap((peer) => describeRankAdvantages(winner, peer, includeScore))
    ).slice(0, 5);
  const describeRankAdvantages = (
    winner: (typeof rankedRows)[number],
    loser: (typeof rankedRows)[number],
    includeScore: boolean
  ) => {
    const winnerSla = getRankV2SlaState({
      slaDue: winner.av.slaDue,
      slaStatus: winner.av.slaStatus,
    });
    const loserSla = getRankV2SlaState({
      slaDue: loser.av.slaDue,
      slaStatus: loser.av.slaStatus,
    });
    const winnerEpss = formatEpssValue(winner.rankEpssScore);
    const loserEpss = formatEpssValue(loser.rankEpssScore);
    const winnerFirstSeen = formatComparisonDate(winner.av.firstSeen);
    const loserFirstSeen = formatComparisonDate(loser.av.firstSeen);
    const winnerExposure = winner.context.gabExposureType;
    const loserExposure = loser.context.gabExposureType;
    const winnerExploitMaturity = toUiExploitMaturity(winner.cve.exploitMaturity, {
      confirmedCisaKev: Boolean(winner.hasCisaKevSource),
    });
    const loserExploitMaturity = toUiExploitMaturity(loser.cve.exploitMaturity, {
      confirmedCisaKev: Boolean(loser.hasCisaKevSource),
    });
    const reasons = [
      includeScore && winner.rank.score > loser.rank.score
        ? `a higher total Rank v2 score (${winner.rank.score} vs ${loser.rank.score})`
        : null,
      winner.rank.sortKey.cisaKev > loser.rank.sortKey.cisaKev
        ? "CISA KEV confirmation versus no KEV confirmation"
        : null,
      winner.rank.sortKey.exploitMaturity > loser.rank.sortKey.exploitMaturity &&
      winnerExploitMaturity !== loserExploitMaturity
        ? `stronger exploit maturity (${winnerExploitMaturity} vs ${loserExploitMaturity})`
        : null,
      winner.rank.sortKey.epss > loser.rank.sortKey.epss &&
      winnerEpss != null &&
      loserEpss != null &&
      winnerEpss !== loserEpss
        ? `higher EPSS ${winnerEpss} vs ${loserEpss}`
        : null,
      winner.rank.sortKey.slaUrgency > loser.rank.sortKey.slaUrgency
        ? `${winnerSla.displayLabel} SLA urgency versus ${lowerInitialPreservingSla(loserSla.displayLabel)}`
        : null,
      winner.rank.sortKey.slaUrgency === loser.rank.sortKey.slaUrgency &&
      winner.rank.sortKey.slaDayBucket < loser.rank.sortKey.slaDayBucket &&
      winnerSla.displayLabel !== loserSla.displayLabel
        ? `SLA due sooner (${winnerSla.displayLabel} vs ${loserSla.displayLabel})`
        : null,
      winner.rank.sortKey.exposure > loser.rank.sortKey.exposure &&
      winnerExposure !== loserExposure
        ? `${winnerExposure} exposure vs ${loserExposure}`
        : null,
      winner.rank.sortKey.maxCi > loser.rank.sortKey.maxCi
        ? `higher confidentiality/integrity business impact (${winner.rank.sortKey.maxCi} vs ${loser.rank.sortKey.maxCi})`
        : null,
      winner.rank.sortKey.maxDt > loser.rank.sortKey.maxDt
        ? `higher availability/traceability business impact (${winner.rank.sortKey.maxDt} vs ${loser.rank.sortKey.maxDt})`
        : null,
      winner.rank.sortKey.lifecycle > loser.rank.sortKey.lifecycle &&
      winner.av.status !== loser.av.status
        ? `more urgent lifecycle status (${toUiVulnerabilityStatus(winner.av.status)} vs ${toUiVulnerabilityStatus(loser.av.status)})`
        : null,
      winner.rank.sortKey.firstSeenMs < loser.rank.sortKey.firstSeenMs &&
      winnerFirstSeen != null &&
      loserFirstSeen != null &&
      winnerFirstSeen !== loserFirstSeen
        ? `an older unresolved first-seen date (${winnerFirstSeen} vs ${loserFirstSeen})`
        : null,
    ].filter(Boolean) as string[];

    if (
      reasons.length === 0 &&
      winner.rank.sortKey.stableId.localeCompare(loser.rank.sortKey.stableId) < 0
    ) {
      reasons.push(stableFallbackReason);
    }

    return uniqueReasons(reasons).slice(0, 4);
  };
  const currentStrengths = [
    row.cve.severity === "critical"
      ? "critical severity"
      : `${toUiSeverity(row.cve.severity).toLowerCase()} severity`,
    hasCisaKevSource ? "confirmed CISA KEV exploitation" : null,
    formatEpss(epssScore),
    businessContext.gabExposureType === "Outdoor GAB"
      ? "Outdoor GAB exposure"
      : businessContext.gabExposureType === "Indoor GAB"
        ? "Indoor GAB exposure"
        : null,
    currentRank.factorScores.business >= 16
      ? "high business impact from resolved GAB CIDT and the ATM Payment Services baseline"
      : "ATM Payment Services business context",
    currentRank.factorScores.urgency >= 6
      ? slaState.reason.replace(/^SLA is /, "SLA ")
      : null,
  ].filter(Boolean) as string[];
  const lowerSameScoreRows = sameScoreRows.slice(sameScorePosition);
  const higherSameScoreRows = sameScoreRows.slice(0, sameScorePosition - 1);
  const sameScorePeerAbove =
    currentRankedRow && sameScorePosition > 1
      ? sameScoreRows[sameScorePosition - 2]
      : null;
  const sameScoreWinReasons =
    currentRankedRow && lowerSameScoreRows.length > 0
      ? summarizePeerDifferences(currentRankedRow, lowerSameScoreRows, false)
      : [];
  const sameScoreLossReasons =
    currentRankedRow && sameScorePeerAbove
      ? summarizePeerDifferences(sameScorePeerAbove, [currentRankedRow], false)
      : [];
  const normalizedSameScoreWinReasons = sameScoreWinReasons.length
    ? sameScoreWinReasons
    : [stableFallbackReason];
  const normalizedSameScoreLossReasons = sameScoreLossReasons.length
    ? sameScoreLossReasons
    : [stableFallbackReason];
  const sameCveOpenRows = rankedRows.filter(
    (ranked) => ranked.cve.cveId.toLowerCase() === row.cve.cveId.toLowerCase()
  );
  const sameCvePeerCount = Math.max(0, sameCveOpenRows.length - 1);
  const sameCveExposureLabels = uniqueReasons(
    sameCveOpenRows.map((ranked) => ranked.context.gabExposureType)
  );
  const sameCveGroupScope =
    sameCveExposureLabels.length === 1 && sameCveExposureLabels[0] !== "Unknown"
      ? `multiple ${sameCveExposureLabels[0]}s`
      : "multiple GABs";
  const topRankedRow = rankedRows[0] ?? null;
  const sharesCveWithTopRanked =
    topRankedRow?.cve.cveId.toLowerCase() === row.cve.cveId.toLowerCase();
  const currentCampaignSignature = buildRemediationCampaignSignature({
    cveId: row.cve.cveId,
    cveTitle: row.cve.title,
    scannerFindingCode: evidenceRows[0]?.findingCode ?? null,
    scannerFindingTitle: evidenceRows[0]?.title ?? null,
    remediationText: row.av.notes,
  });
  const campaignGroups = new Map<
    string,
    {
      signature: ReturnType<typeof buildRemediationCampaignSignature>;
      rows: typeof rankedRows;
    }
  >();

  for (const ranked of rankedRows) {
    const signature = buildRemediationCampaignSignature({
      cveId: ranked.cve.cveId,
      cveTitle: ranked.cve.title,
      scannerFindingCode: ranked.scannerFindingCode,
      scannerFindingTitle: ranked.scannerFindingTitle,
      remediationText: ranked.av.notes,
    });
    const existing = campaignGroups.get(signature.key);

    if (existing) {
      existing.rows.push(ranked);
    } else {
      campaignGroups.set(signature.key, { signature, rows: [ranked] });
    }
  }

  const sortedCampaignGroups = Array.from(campaignGroups.values()).sort((left, right) => {
    const leftTop = left.rows[0];
    const rightTop = right.rows[0];

    if (!leftTop || !rightTop) {
      return 0;
    }

    const rankDelta = compareRankV2(leftTop.rank, rightTop.rank);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.signature.title.localeCompare(right.signature.title);
  });
  const currentCampaignGroup =
    campaignGroups.get(currentCampaignSignature.key) ?? null;
  const currentCampaignTop = currentCampaignGroup?.rows[0] ?? currentRankedRow;
  const currentCampaignRankPosition = Math.max(
    1,
    sortedCampaignGroups.findIndex(
      (group) => group.signature.key === currentCampaignSignature.key
    ) + 1
  );
  const immediateHigherCampaignGroup =
    currentCampaignRankPosition > 1
      ? sortedCampaignGroups[currentCampaignRankPosition - 2] ?? null
      : null;
  const immediateLowerCampaignGroup =
    currentCampaignRankPosition < sortedCampaignGroups.length
      ? sortedCampaignGroups[currentCampaignRankPosition] ?? null
      : null;
  const buildCampaignComparison = (
    winner: (typeof sortedCampaignGroups)[number] | null,
    loser: (typeof sortedCampaignGroups)[number] | null,
    includeScore: boolean
  ) => {
    const winnerTop = winner?.rows[0];
    const loserTop = loser?.rows[0];

    if (!winnerTop || !loserTop) {
      return [];
    }

    return describeRankAdvantages(winnerTop, loserTop, includeScore);
  };
  const lowerCampaignReasons =
    currentCampaignGroup && immediateLowerCampaignGroup
      ? buildCampaignComparison(
          currentCampaignGroup,
          immediateLowerCampaignGroup,
          true
        )
      : [];
  const higherCampaignReasons =
    currentCampaignGroup && immediateHigherCampaignGroup
      ? buildCampaignComparison(
          immediateHigherCampaignGroup,
          currentCampaignGroup,
          true
        )
      : [];
  const campaignStableOrder =
    "major campaign priority factors are equal, so Fortexa uses stable display ordering.";
  const campaignWhyBeatsSimilar =
    currentCampaignGroup && immediateLowerCampaignGroup
      ? isStableFallbackOnly(lowerCampaignReasons)
        ? `Compared with the campaign below, ${campaignStableOrder}`
        : lowerCampaignReasons.length > 0
          ? `This campaign stays ahead of the next campaign because it has ${buildReadableSignalList(
              lowerCampaignReasons
            )}.`
          : `Compared with the campaign below, ${campaignStableOrder}`
      : "No lower-ranked remediation campaign follows this one in the current queue.";
  const campaignWhyNotHigher =
    currentCampaignGroup && currentCampaignRankPosition > 1
      ? isStableFallbackOnly(higherCampaignReasons)
        ? `Compared with the campaign above, ${campaignStableOrder}`
        : higherCampaignReasons.length > 0
          ? `It is not ranked higher because the campaign above has ${buildReadableSignalList(
              higherCampaignReasons
            )}.`
          : `Compared with the campaign above, ${campaignStableOrder}`
      : null;
  const remediationCampaign =
    currentCampaignGroup && currentCampaignGroup.rows.length > 1 && currentCampaignTop
      ? {
          title: currentCampaignGroup.signature.title,
          scannerTitle: currentCampaignTop.cve.title,
          rankPosition: currentCampaignRankPosition,
          totalCampaigns: sortedCampaignGroups.length || 1,
          priorityBucket: currentCampaignTop.rank.bucketLabel,
          rankScore: currentCampaignTop.rank.score,
          highestFindingRankPosition:
            rankedRows.findIndex((ranked) => ranked.av.id === currentCampaignTop.av.id) +
              1 || rankPosition,
          totalOpenFindings: rankedRows.length || 1,
          cveIds: uniqueReasons(
            currentCampaignGroup.rows.map((ranked) => ranked.cve.cveId)
          ).sort(),
          affectedAssets: uniqueReasons(
            currentCampaignGroup.rows.map((ranked) => ranked.asset.assetCode)
          ).sort(),
          openCount: currentCampaignGroup.rows.length,
          exposureSummary: summarizeExposureByAsset(currentCampaignGroup.rows),
          slaStatus: getRankV2SlaState({
            slaDue: currentCampaignTop.av.slaDue,
            slaStatus: currentCampaignTop.av.slaStatus,
          }).displayLabel,
          explanation: `This finding belongs to the ${currentCampaignGroup.signature.title}. It covers ${uniqueReasons(
            currentCampaignGroup.rows.map((ranked) => ranked.cve.cveId)
          ).sort().join(", ")} across ${uniqueReasons(
            currentCampaignGroup.rows.map((ranked) => ranked.asset.assetCode)
          ).sort().join(", ")}. These grouped records should be remediated together as one campaign.`,
          rationale:
            currentCampaignGroup.signature.basis === "ms17_010"
              ? "same Microsoft MS17-010 update and remediation path"
              : currentCampaignGroup.signature.rationale,
          whyRankedHere: "",
          whyBeatsSimilar: campaignWhyBeatsSimilar,
          whyNotHigher: campaignWhyNotHigher,
        }
      : null;
  const hasSameMajorPriorityProfile = (ranked: (typeof rankedRows)[number]) => {
    const peerSla = getRankV2SlaState({
      slaDue: ranked.av.slaDue,
      slaStatus: ranked.av.slaStatus,
    });

    return (
      ranked.rank.score === currentRank.score &&
      ranked.rank.businessPriority === currentRank.businessPriority &&
      ranked.rank.factorScores.severity === currentRank.factorScores.severity &&
      ranked.rank.factorScores.threat === currentRank.factorScores.threat &&
      ranked.rank.factorScores.business === currentRank.factorScores.business &&
      ranked.rank.factorScores.urgency === currentRank.factorScores.urgency &&
      ranked.rank.sortKey.cisaKev === currentRank.sortKey.cisaKev &&
      ranked.rank.sortKey.exploitMaturity === currentRank.sortKey.exploitMaturity &&
      ranked.rank.sortKey.epss === currentRank.sortKey.epss &&
      ranked.rank.sortKey.exposure === currentRank.sortKey.exposure &&
      ranked.rank.sortKey.maxCi === currentRank.sortKey.maxCi &&
      ranked.rank.sortKey.maxDt === currentRank.sortKey.maxDt &&
      ranked.rank.sortKey.lifecycle === currentRank.sortKey.lifecycle &&
      peerSla.displayLabel === slaState.displayLabel
    );
  };
  const sameCveMajorFactorsEqual =
    sameCvePeerCount > 0 && sameCveOpenRows.every(hasSameMajorPriorityProfile);
  const sameRemediationGroup =
    sameCvePeerCount > 0
      ? {
          cveId: row.cve.cveId,
          openCount: sameCveOpenRows.length,
          peerCount: sameCvePeerCount,
          explanation: `This is one occurrence of ${row.cve.cveId} across ${sameCveOpenRows.length} open ${sameCveExposureLabels.length === 1 ? `${sameCveExposureLabels[0]} ` : "GAB "}finding${sameCveOpenRows.length === 1 ? "" : "s"}. These findings share the same CVE and likely the same remediation path. Fortexa still orders individual GAB records for deterministic queue display, but they should be handled together as one remediation campaign.`,
        }
      : null;
  const whyBeatsSimilar =
    sameCveMajorFactorsEqual && sameRemediationGroup
      ? "These same-CVE findings share the same major priority profile. Fortexa keeps a deterministic display order, but they should be remediated together as one campaign."
      : sameRankScoreCount === 0
        ? `No other open finding currently has score ${currentRank.score}; similar findings are separated by the total Rank v2 score before tie-breakers are needed.`
        : isFirstWithinSameScore
        ? isStableFallbackOnly(normalizedSameScoreWinReasons)
          ? `Among the ${sameRankScoreCount} other score-${currentRank.score} finding${sameRankScoreCount === 1 ? "" : "s"}, ${stableFallbackOrderReason}.`
          : `Among the ${sameRankScoreCount} other score-${currentRank.score} finding${sameRankScoreCount === 1 ? "" : "s"}, this one is ordered first because it has ${buildReadableSignalList(
              normalizedSameScoreWinReasons
            )}.`
        : `This one is #${sameScorePosition} within the score-${currentRank.score} group. ${
            isStableFallbackOnly(normalizedSameScoreLossReasons)
              ? `The ${higherSameScoreRows.length} same-score finding${higherSameScoreRows.length === 1 ? "" : "s"} above it ${higherSameScoreRows.length === 1 ? "is" : "are"} ordered higher because ${stableFallbackOrderReason}`
              : `The ${higherSameScoreRows.length} same-score finding${higherSameScoreRows.length === 1 ? "" : "s"} above it ${higherSameScoreRows.length === 1 ? "wins" : "win"} on ${buildReadableSignalList(
                  normalizedSameScoreLossReasons
                )}`
          }${lowerSameScoreRows.length > 0 ? `; this finding remains ahead of ${lowerSameScoreRows.length} same-score finding${lowerSameScoreRows.length === 1 ? "" : "s"} below it because ${
            isStableFallbackOnly(normalizedSameScoreWinReasons)
              ? stableFallbackOrderReason
              : `it has ${buildReadableSignalList(
                  normalizedSameScoreWinReasons
                )}`
          }.` : "."}`;
  const higherRankedRows = currentRankIndex > 0 ? rankedRows.slice(0, currentRankIndex) : [];
  const immediateHigher = currentRankIndex > 0 ? rankedRows[currentRankIndex - 1] : null;
  const whyNotHigher =
    rankPosition === 1
      ? null
      : sameCveMajorFactorsEqual && sameRemediationGroup
        ? sharesCveWithTopRanked
          ? "Fortexa orders it after #1 only for deterministic display because the major factors are equal."
          : "This finding has the same priority profile as the top-ranked findings and belongs to its own same-CVE remediation group. Fortexa keeps it after the higher-ranked findings only for deterministic display because the major factors are equal."
      : currentRankedRow && immediateHigher
        ? (() => {
            const reasons = describeRankAdvantages(
              immediateHigher,
              currentRankedRow,
              true
            );
            return isStableFallbackOnly(reasons)
              ? stableFallbackReason
              : reasons.length
                ? `It is not ranked higher because the ${higherRankedRows.length} finding${higherRankedRows.length === 1 ? "" : "s"} above it ${higherRankedRows.length === 1 ? "has" : "have"} ${buildReadableSignalList(
                  reasons
                )}.`
                : stableFallbackReason;
          })()
        : stableFallbackReason;
  const groupStrengths = buildReadableSignalList(currentStrengths.slice(0, 6));
  const remediationCampaignRankedExplanation =
    remediationCampaign
      ? `Campaign ranked #${remediationCampaign.rankPosition} of ${remediationCampaign.totalCampaigns}; highest record #${remediationCampaign.highestFindingRankPosition} of ${remediationCampaign.totalOpenFindings} open grouped records. The ${remediationCampaign.title} is ${remediationCampaign.priorityBucket} with score ${remediationCampaign.rankScore} because it has ${groupStrengths}. It covers ${remediationCampaign.cveIds.join(", ")} on ${remediationCampaign.affectedAssets.length} GAB${remediationCampaign.affectedAssets.length === 1 ? "" : "s"} (${remediationCampaign.exposureSummary}) and should be handled as one remediation campaign.`
      : null;
  const remediationCampaignWithExplanation = remediationCampaign
    ? {
        ...remediationCampaign,
        whyRankedHere:
          remediationCampaignRankedExplanation ??
          remediationCampaign.explanation,
      }
    : null;
  const sameCveTiedExplanation =
    sameRemediationGroup && sameCveMajorFactorsEqual
      ? rankPosition === 1
        ? `Ranked #1 of ${rankedRows.length || 1}. This finding belongs to a same-CVE remediation group affecting ${sameCveGroupScope}. The group is ${currentRank.bucketLabel} because it has ${groupStrengths}. All major priority factors are equal across this group, so Fortexa uses stable fallback ordering for display. These findings should be remediated together.`
        : sharesCveWithTopRanked
          ? `Ranked #${rankPosition} of ${rankedRows.length || 1}. This finding has the same priority profile as the #1 finding and belongs to the same CVE remediation group. It remains ${currentRank.bucketLabel} and should be handled in the same remediation campaign. Fortexa orders it after #1 only for deterministic display because the major factors are equal.`
          : `Ranked #${rankPosition} of ${rankedRows.length || 1}. This finding has the same priority profile as the top-ranked findings and belongs to its own same-CVE remediation group for ${row.cve.cveId} affecting ${sameCveGroupScope}. It remains ${currentRank.bucketLabel} and should be handled in the same remediation campaign. Fortexa keeps it after the higher-ranked findings only for deterministic display because the major factors are equal.`
      : null;
  const whyRankedHere =
    remediationCampaignWithExplanation?.whyRankedHere ??
    sameCveTiedExplanation ??
    [
      `Ranked #${rankPosition} of ${rankedRows.length || 1} open GAB vulnerabilities.`,
      sameRemediationGroup
        ? `It is part of a same-CVE remediation group affecting ${sameRemediationGroup.openCount} open GAB findings.`
        : null,
      `It is in ${currentRank.bucketLabel} because it combines ${groupStrengths}.`,
      sameRankScoreCount > 0 ? whyBeatsSimilar : null,
      whyNotHigher,
    ]
      .filter(Boolean)
      .join(" ");
  const effectiveWhyBeatsSimilar =
    remediationCampaignWithExplanation?.whyBeatsSimilar ?? whyBeatsSimilar;
  const effectiveWhyNotHigher =
    remediationCampaignWithExplanation?.whyNotHigher ?? whyNotHigher;
  const whyThisWins = effectiveWhyBeatsSimilar;
  const severitySource = (() => {
    const normalized = normalizeSeverity({
      cvssBaseScore: row.cve.cvssScore,
      severityLabel: row.cve.severity,
    });

    return normalized.severitySource === "cvss" && normalized.cvssScore != null
      ? `CVSS ${normalized.cvssScore}`
      : `Nessus severity fallback (${normalized.label})`;
  })();

  return {
    id: assetVulnerabilityId,
    asset: {
      id: row.asset.id,
      assetCode: row.asset.assetCode,
      name: row.asset.name,
      type: row.asset.type,
      branch: row.asset.branch ?? "—",
      location: row.asset.location ?? "—",
      ipAddress: row.asset.ipAddress ?? "—",
      criticality: row.asset.criticality,
      exposureLevel: row.asset.exposureLevel,
      ...businessContext,
      inferredRole: inference.role ?? "unknown",
      siteArchetype: inference.siteArchetype ?? "unknown",
      inferenceConfidence: inference.confidence ?? 0,
      inferenceReasons: inference.reasons ?? [],
    },
    vulnerability: {
      dbId: row.cve.id,
      cveId: row.cve.cveId,
      title: row.cve.title,
      description: row.cve.description ?? "",
      severity: toUiSeverity(row.cve.severity),
      cvssScore: normalizeCvssScore(row.cve.cvssScore),
      cvssVector: row.cve.cvssVector ?? "—",
      status: toUiVulnerabilityStatus(row.av.status),
      statusDb: row.av.status,
      riskScore: currentRank.score,
      businessPriority: toUiBusinessPriority(currentRank.businessPriority),
      firstSeen: formatDate(row.av.firstSeen),
      lastSeen: formatDate(row.av.lastSeen),
      slaDue: formatDate(row.av.slaDue),
      slaStatus: toUiSlaStatus(row.av.slaStatus),
      patchAvailable: row.cve.patchAvailable,
      exploitMaturity: toUiExploitMaturity(row.cve.exploitMaturity, {
        confirmedCisaKev: hasCisaKevSource,
      }),
      notes: row.av.notes ?? "",
      priorityFactors,
      lastImport: lastImport
        ? {
            id: lastImport.id,
            name: lastImport.name,
            importDate: formatDateTime(lastImport.importDate),
            status: lastImport.status,
          }
        : null,
    },
    scannerEvidence: evidenceRows.map((evidence) => ({
      id: evidence.id,
      title: evidence.title,
      severity: toUiSeverity(evidence.severity),
      host: evidence.host,
      port: evidence.port,
      protocol: evidence.protocol,
      rawEvidence: evidence.rawEvidence,
      matchConfidence: evidence.matchConfidence,
      matchNotes: evidence.matchNotes,
      lastSeen: formatDateTime(evidence.lastSeen),
      scanImportId: evidence.scanImportId,
      scanImportName: evidence.scanImportName,
    })),
    lifecycle: eventRows.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      label: lifecycleLabels[event.eventType] ?? event.eventType,
      createdAt: formatDateTime(event.createdAt),
      beforeStatus: event.beforeStatus ? toUiVulnerabilityStatus(event.beforeStatus) : null,
      afterStatus: event.afterStatus ? toUiVulnerabilityStatus(event.afterStatus) : null,
      riskScore: event.riskScore ?? null,
      note: event.note ?? null,
    })),
    fixOrder: {
      rankPosition,
      totalOpen: rankedRows.length || 1,
      priorityBucket: currentRank.bucketLabel,
      rankScore: currentRank.score,
      rankAlgorithmVersion: currentRank.algorithmVersion,
      rankFactors: currentRank.factorScores,
      severitySource,
      slaState,
      explanation: remediationCampaignWithExplanation
        ? [
            `Campaign #${remediationCampaignWithExplanation.rankPosition} of ${remediationCampaignWithExplanation.totalCampaigns} remediation campaigns; highest record #${remediationCampaignWithExplanation.highestFindingRankPosition} of ${remediationCampaignWithExplanation.totalOpenFindings} open grouped records.`,
            `${remediationCampaignWithExplanation.priorityBucket} bucket and score ${remediationCampaignWithExplanation.rankScore}.`,
            `${remediationCampaignWithExplanation.exposureSummary} supporting ATM Payment Services.`,
            `${toUiSeverity(row.cve.severity)} technical severity from ${severitySource}.`,
            `${toUiExploitMaturity(row.cve.exploitMaturity, {
              confirmedCisaKev: hasCisaKevSource,
            })} exploit maturity.`,
            `${remediationCampaignWithExplanation.slaStatus} SLA status.`,
          ].join(" ")
        : [
            `Ranked #${rankPosition} of ${rankedRows.length || 1} open GAB vulnerabilities by deterministic Rank v2, not by AI.`,
            `${currentRank.bucketLabel} bucket and score ${currentRank.score}.`,
            `${businessContext.gabExposureType} supporting ATM Payment Services.`,
            `${toUiSeverity(row.cve.severity)} technical severity from ${severitySource}.`,
            `${toUiExploitMaturity(row.cve.exploitMaturity, {
              confirmedCisaKev: hasCisaKevSource,
            })} exploit maturity.`,
            `${slaState.label} SLA status: ${slaState.reason}.`,
          ].join(" "),
      sameRiskExplanation:
        sameRankScoreCount > 0
          ? `There are ${sameRankScoreCount} other vulnerability record(s) with the same Rank v2 score. Fortexa breaks ties using CISA KEV, exploit maturity, EPSS, SLA urgency, exposure, CIDT maxima, lifecycle, age, and stable asset/CVE ID.`
          : "No other open vulnerability currently has the same Rank v2 score.",
      sameRiskCount: sameRankScoreCount,
      sameScorePosition,
      sameScoreTotal: Math.max(1, sameScoreRows.length),
      isFirstWithinSameScore,
      samePriorityCount,
      missingEvidence: currentRank.missingEvidence,
      tieBreakerSummary:
        remediationCampaignWithExplanation
          ? remediationCampaignWithExplanation.whyBeatsSimilar
          : sameRankScoreCount > 0
          ? effectiveWhyBeatsSimilar
          : "No same-score tie-breaker is currently needed.",
      whyThisWins,
      whyRankedHere,
      whyBeatsSimilar: effectiveWhyBeatsSimilar,
      whyNotHigher: effectiveWhyNotHigher,
      sameRemediationGroup,
      remediationCampaign: remediationCampaignWithExplanation,
      comparison: {
        current: remediationCampaignWithExplanation
          ? compactJoin([
              `${remediationCampaignWithExplanation.priorityBucket} / score ${remediationCampaignWithExplanation.rankScore}`,
              remediationCampaignWithExplanation.exposureSummary,
              knownExploitation
                ? "CISA KEV"
                : toUiExploitMaturity(row.cve.exploitMaturity),
              `${businessContext.cidt.sensitivity} GAB / ${businessContext.businessApplication.profile}`,
              `${remediationCampaignWithExplanation.slaStatus} SLA`,
            ])
          : compactJoin([
              `${currentRank.bucketLabel} / score ${currentRank.score}`,
              `${businessContext.gabExposureType}`,
              `${knownExploitation ? "CISA KEV" : toUiExploitMaturity(row.cve.exploitMaturity)}`,
              `${businessContext.cidt.sensitivity} GAB / ${businessContext.businessApplication.profile}`,
              `${slaState.label} SLA`,
            ]),
        peers:
          remediationCampaignWithExplanation
            ? `${remediationCampaignWithExplanation.totalCampaigns} remediation campaign${remediationCampaignWithExplanation.totalCampaigns === 1 ? "" : "s"} in the queue; this campaign covers ${remediationCampaignWithExplanation.openCount} open grouped record${remediationCampaignWithExplanation.openCount === 1 ? "" : "s"}.`
          : samePriorityCount > 0
            ? `${samePriorityCount} peer${samePriorityCount === 1 ? "" : "s"} in ${currentRank.bucketLabel}; ${sameRankScoreCount} exact same-score peer${sameRankScoreCount === 1 ? "" : "s"}; #${sameScorePosition} within score ${currentRank.score}.`
            : `#${sameScorePosition} within score ${currentRank.score}.`,
        tieBreaker: effectiveWhyBeatsSimilar,
        notHigher: effectiveWhyNotHigher ?? (
          remediationCampaignWithExplanation
            ? "This is the top-ranked remediation campaign."
            : "This is the top-ranked open finding."
        ),
      },
      factors: [
        currentRank.explanation,
        priorityFactors?.summary ??
          prioritySummaryFromFactors(row.av.priorityFactors),
        hasCisaKevSource
          ? "CISA KEV source retrieved; known exploitation increases urgency."
          : "No CISA KEV source is linked yet.",
        hasEpssSource
          ? `EPSS likelihood source retrieved${epssScore != null ? ` (${(epssScore * 100).toFixed(2)}%)` : ""}; exploit probability increases fix-order urgency.`
          : "No EPSS source is linked yet.",
      ],
    },
    relatedExposure: relatedRows.map((related) => ({
      id: related.av.id,
      assetCode: related.assetCode ?? "—",
      assetName: related.assetName ?? "Unlinked asset",
      status: toUiVulnerabilityStatus(related.av.status),
      riskScore: related.av.riskScore,
      businessPriority: toUiBusinessPriority(related.av.businessPriority),
    })),
    remediationTasks: taskRows.map((taskRow) => ({
      id: taskRow.task.id,
      title: taskRow.task.title,
      status: toUiRemediationStatus(taskRow.task.status),
      assignedOwner: taskRow.assignedName ?? "Unassigned",
      dueDate: formatDate(taskRow.task.dueDate),
      progress: taskRow.task.progress,
    })),
    alerts: alertRows.map((alert) => ({
      id: alert.id,
      title: alert.title,
      severity: toUiSeverity(alert.severity),
      status: toUiAlertStatus(alert.status),
      createdAt: formatDateTime(alert.createdAt),
    })),
    trustedSources: sourceRows.map((source) => ({
      id: source.id,
      label: source.name,
      url: source.url,
      sourceType: source.sourceType,
      supportedFacts: source.supportedFacts ?? [],
      retrievedAt: formatDateTime(source.retrievedAt ?? null),
      updatedAt: formatDateTime(source.updatedAt),
    })),
    ai: {
      status: row.enrichment?.enrichmentStatus ?? "pending",
      summary: row.enrichment?.summary ?? "",
      technicalRationale: row.enrichment?.technicalRationale ?? "",
      businessRationale: row.enrichment?.businessRationale ?? "",
      primaryMitigation: row.enrichment?.primaryMitigation ?? "",
      recommendedActions: row.enrichment?.recommendedActions ?? [],
      validationSteps: row.enrichment?.validationSteps ?? [],
      compensatingControls: row.enrichment?.compensatingControls ?? [],
      rollbackCaution: row.enrichment?.rollbackCaution ?? "",
      maintenanceWindowNote: row.enrichment?.maintenanceWindowNote ?? "",
      citations: row.enrichment?.citations ?? [],
      unsupportedClaims: row.enrichment?.unsupportedClaims ?? [],
      trustLabels: row.enrichment?.trustLabels ?? [],
      confidenceScore: row.enrichment?.confidenceScore ?? 0,
      model: row.enrichment?.aiModel ?? "",
      provider: row.enrichment?.aiProvider ?? "",
      error: row.enrichment?.aiError ?? "",
      enrichedAt: formatDateTime(row.enrichment?.enrichedAt ?? null),
      updatedAt: formatDateTime(row.enrichment?.updatedAt ?? null),
      processingStartedAt: formatDateTime(row.enrichment?.processingStartedAt ?? null),
      attemptCount: row.enrichment?.attemptCount ?? 0,
      provenance:
        row.enrichment?.trustLabels?.find((label) =>
          /automatic|manual|background/i.test(label)
        ) ?? "Not generated yet",
      validationPassed: row.enrichment?.validationPassed ?? false,
    },
  };
}

export async function resolveAssetVulnerabilityIdFromRoute(
  organizationId: string,
  routeId: string
): Promise<string | null> {
  const db = getDb();

  if (!db) {
    return null;
  }

  const rows = await db
    .select({
      id: assetVulnerabilities.id,
      status: assetVulnerabilities.status,
      riskScore: assetVulnerabilities.riskScore,
      lastSeen: assetVulnerabilities.lastSeen,
    })
    .from(assetVulnerabilities)
    .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .where(
      and(
        eq(assetVulnerabilities.organizationId, organizationId),
        eq(cves.cveId, routeId)
      )
    )
    .orderBy(desc(assetVulnerabilities.riskScore), desc(assetVulnerabilities.lastSeen))
    .limit(25);

  if (rows.length === 0) {
    return null;
  }

  const preferred =
    rows.find((row) => row.status !== "closed") ??
    rows[0];

  return preferred?.id ?? null;
}

export async function updateAssetVulnerabilityStatus(input: {
  organizationId: string;
  id: string;
  status: typeof assetVulnerabilities.$inferSelect.status;
  note?: string | null;
  actorProfileId?: string | null;
}) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Asset-vulnerability writes are disabled."
    );
  }

  const [current] = await db
    .select()
    .from(assetVulnerabilities)
    .where(
      and(
        eq(assetVulnerabilities.organizationId, input.organizationId),
        eq(assetVulnerabilities.id, input.id)
      )
    )
    .limit(1);

  if (!current) {
    throw new AppError("not_found", "Asset vulnerability not found.");
  }

  const [row] = await db
    .update(assetVulnerabilities)
    .set({
      status: input.status,
      notes: input.note === undefined ? current.notes : input.note ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(assetVulnerabilities.organizationId, input.organizationId),
        eq(assetVulnerabilities.id, input.id)
      )
    )
    .returning();

  await recalculateRankV2ForAssetVulnerabilities({
    organizationId: input.organizationId,
    assetVulnerabilityIds: [input.id],
  });

  const [rankedRow] = await db
    .select()
    .from(assetVulnerabilities)
    .where(
      and(
        eq(assetVulnerabilities.organizationId, input.organizationId),
        eq(assetVulnerabilities.id, input.id)
      )
    )
    .limit(1);
  const effectiveRow = rankedRow ?? row;

  await db
    .update(alerts)
    .set({
      status:
        input.status === "closed" || input.status === "mitigated"
          ? "resolved"
          : input.status === "accepted" ||
              input.status === "false_positive" ||
              input.status === "compensating_control"
            ? "dismissed"
            : "acknowledged",
      resolvedAt:
        input.status === "closed" || input.status === "mitigated"
          ? new Date()
          : undefined,
    })
    .where(
      and(
        eq(alerts.relatedAssetVulnerabilityId, input.id),
        eq(alerts.organizationId, input.organizationId),
        inArray(alerts.status, ["new", "acknowledged", "in_progress"])
      )
    );

  await db.insert(assetVulnerabilityEvents).values({
    organizationId: input.organizationId,
    assetVulnerabilityId: input.id,
    eventType: "status_changed",
    beforeStatus: current.status,
    afterStatus: effectiveRow.status,
    riskScore: effectiveRow.riskScore,
    businessPriority: effectiveRow.businessPriority,
    actorProfileId: input.actorProfileId ?? null,
    note: input.note ?? null,
    details: {
      previousStatus: current.status,
      nextStatus: row.status,
    },
  });

  return effectiveRow;
}
