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
import { prioritySummaryFromFactors } from "./business-priority";
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
import { buildPaginatedResult, desc, getPagination, type SQL } from "./utils";

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
    cvssScore: number;
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
    explanation: string;
    sameRiskExplanation: string;
    sameRiskCount: number;
    tieBreakerSummary: string;
    whyThisWins: string;
    comparison: {
      current: string;
      peers: string;
      tieBreaker: string;
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
      cvssScore: row.cvssScore ? Number(row.cvssScore) : null,
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

function isOutdoorGab(exposure: string | null | undefined) {
  return /outdoor/i.test(exposure ?? "");
}

function compactJoin(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
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
    sameRiskRows,
    taskRows,
    alertRows,
    sourceRows,
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
          av: assetVulnerabilities,
          asset: assets,
          cve: cves,
        })
        .from(assetVulnerabilities)
        .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
        .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
        .where(
          and(
            eq(assetVulnerabilities.organizationId, organizationId),
            eq(assetVulnerabilities.riskScore, row.av.riskScore),
            ne(assetVulnerabilities.id, assetVulnerabilityId)
          )
        )
        .orderBy(desc(assetVulnerabilities.lastSeen))
        .limit(5),
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
    ]);

  const inference = (row.asset.metadata?.inference ?? {}) as {
    role?: string;
    siteArchetype?: string;
    confidence?: number;
    reasons?: string[];
  };
  const lastImport = lastImportRows[0] ?? null;
  const businessContext = buildAssetBusinessContext(row.asset, null);
  const hasCisaKevSource = sourceRows.some(
    (source) => source.sourceType === "cisa_kev"
  );
  const hasEpssSource = sourceRows.some((source) =>
    /epss/i.test(`${source.name} ${source.retrievalMetadata?.retrievalMethod ?? ""}`)
  );
  const knownExploitation = hasCisaKevSource || row.cve.exploitMaturity === "active_in_wild";
  const peerKnownExploitationCount = sameRiskRows.filter(
    (peer) => peer.cve.exploitMaturity === "active_in_wild"
  ).length;
  const peerOutdoorCount = sameRiskRows.filter((peer) =>
    isOutdoorGab(buildAssetBusinessContext(peer.asset, null).gabExposureType)
  ).length;
  const peerUrgentSlaCount = sameRiskRows.filter(
    (peer) => peer.av.slaStatus !== "on_track"
  ).length;
  const tieBreakerSignals = [
    knownExploitation
      ? "known exploitation"
      : null,
    isOutdoorGab(businessContext.gabExposureType) ? "exposed GAB context" : null,
    "ATM Payment Services impact",
    `${businessContext.cidt.sensitivity} GAB sensitivity`,
    `${businessContext.businessApplication.profile} application profile`,
    row.av.slaStatus !== "on_track" ? "SLA urgency" : null,
    inference.role && inference.role !== "unknown" ? `${inference.role} asset role` : null,
    evidenceRows.length > 0 ? "scanner evidence quality" : null,
    sourceRows.length > 0 ? "trusted source support" : null,
  ].filter(Boolean) as string[];
  const primaryTieBreakers = tieBreakerSignals.slice(0, 4);
  const sameScorePeerSummary =
    sameRiskRows.length > 0
      ? compactJoin([
          `${sameRiskRows.length} loaded peer${sameRiskRows.length === 1 ? "" : "s"} with score ${row.av.riskScore}`,
          peerKnownExploitationCount
            ? `${peerKnownExploitationCount} known exploited`
            : "no loaded peer has confirmed KEV",
          peerOutdoorCount
            ? `${peerOutdoorCount} outdoor GAB${peerOutdoorCount === 1 ? "" : "s"}`
            : "loaded peers are less exposed or unknown",
          peerUrgentSlaCount
            ? `${peerUrgentSlaCount} with SLA pressure`
            : "no loaded peer has SLA pressure",
        ])
      : `No other loaded finding has score ${row.av.riskScore}.`;
  const whyThisWins =
    sameRiskRows.length > 0
      ? `This finding is ranked above same-score findings because it combines ${buildReadableSignalList(
          primaryTieBreakers
        )}. The score is tied, so Fortexa uses deterministic tie-breakers: exploitation, GAB exposure, ATM Payment Services CIDT/profile, SLA urgency, scanner evidence, and trusted source strength.`
      : `This finding is high in the queue because it combines ${buildReadableSignalList(
          primaryTieBreakers
        )}. Fortexa's order is deterministic and does not depend on AI deciding the rank.`;
  const priorityFactors =
    typeof row.av.priorityFactors === "object" && row.av.priorityFactors
      ? {
          summary: String(row.av.priorityFactors.summary ?? ""),
          businessImpact: String(row.av.priorityFactors.businessImpact ?? ""),
          remediationUrgency: String(row.av.priorityFactors.remediationUrgency ?? ""),
          missingContext: Array.isArray(row.av.priorityFactors.missingContext)
            ? row.av.priorityFactors.missingContext.map(String)
            : [],
        }
      : undefined;

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
      cvssScore: row.cve.cvssScore ? Number(row.cve.cvssScore) : 0,
      cvssVector: row.cve.cvssVector ?? "—",
      status: toUiVulnerabilityStatus(row.av.status),
      statusDb: row.av.status,
      riskScore: row.av.riskScore,
      businessPriority: toUiBusinessPriority(row.av.businessPriority),
      firstSeen: formatDate(row.av.firstSeen),
      lastSeen: formatDate(row.av.lastSeen),
      slaDue: formatDate(row.av.slaDue),
      slaStatus: toUiSlaStatus(row.av.slaStatus),
      patchAvailable: row.cve.patchAvailable,
      exploitMaturity: toUiExploitMaturity(row.cve.exploitMaturity),
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
      explanation: [
        `Fortexa ranks this item by deterministic recommended fix order, not by AI alone.`,
        `${toUiBusinessPriority(row.av.businessPriority)} business priority and score ${row.av.riskScore}.`,
        `${businessContext.gabExposureType} supporting ATM Payment Services.`,
        `${toUiSeverity(row.cve.severity)} technical severity${row.cve.cvssScore ? ` with CVSS ${Number(row.cve.cvssScore)}` : ""}.`,
        `${toUiExploitMaturity(row.cve.exploitMaturity)} exploit maturity.`,
        `${toUiSlaStatus(row.av.slaStatus)} SLA status.`,
      ].join(" "),
      sameRiskExplanation:
        sameRiskRows.length > 0
          ? `There are ${sameRiskRows.length} other vulnerability record(s) with the same risk score. Fortexa breaks ties using GAB exposure, ATM Payment Services CIDT/profile, known exploitation, technical severity, SLA urgency, and scanner evidence quality.`
          : "No other vulnerability currently has the same risk score in this workspace.",
      sameRiskCount: sameRiskRows.length,
      tieBreakerSummary:
        sameRiskRows.length > 0
          ? `There are ${sameRiskRows.length} other vulnerabilities with the same score. Fortexa ranks this one using ${primaryTieBreakers.join(", ")}.`
          : "No same-score tie-breaker is currently needed.",
      whyThisWins,
      comparison: {
        current: compactJoin([
          `${toUiBusinessPriority(row.av.businessPriority)} / score ${row.av.riskScore}`,
          `${businessContext.gabExposureType}`,
          `${knownExploitation ? "CISA KEV or active exploitation" : toUiExploitMaturity(row.cve.exploitMaturity)}`,
          `${businessContext.cidt.sensitivity} GAB / ${businessContext.businessApplication.profile}`,
          `${evidenceRows.length} scanner evidence record${evidenceRows.length === 1 ? "" : "s"}`,
          `${sourceRows.length} trusted source${sourceRows.length === 1 ? "" : "s"}`,
        ]),
        peers: sameScorePeerSummary,
        tieBreaker: buildReadableSignalList(primaryTieBreakers),
      },
      factors: [
        priorityFactors?.summary ??
          prioritySummaryFromFactors(row.av.priorityFactors),
        hasCisaKevSource
          ? "CISA KEV source retrieved; known exploitation increases urgency."
          : "No CISA KEV source is linked yet.",
        hasEpssSource
          ? "EPSS likelihood source retrieved for exploit probability context."
          : "No EPSS source is linked yet.",
        `${evidenceRows.length} scanner evidence record(s) support this asset-vulnerability match.`,
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
    afterStatus: row.status,
    riskScore: row.riskScore,
    businessPriority: row.businessPriority,
    actorProfileId: input.actorProfileId ?? null,
    note: input.note ?? null,
    details: {
      previousStatus: current.status,
      nextStatus: row.status,
    },
  });

  return row;
}
