import "server-only";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetVulnerabilities,
  assets,
  businessApplications,
  cves,
} from "@/db/schema";
import {
  calculateBusinessPriority,
  calculateRankV2,
  normalizeCvssScore,
  normalizeEpssScore,
  resolveGabCidtContext,
  type BusinessPriorityResult,
  type GabCidtTemplate,
  type RankV2Result,
} from "./business-priority";
import { ensureGabCidtTemplates } from "./gab-business-context";

type AssetVulnerabilityRow = typeof assetVulnerabilities.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type CveRow = typeof cves.$inferSelect;
type BusinessApplicationRow = typeof businessApplications.$inferSelect;

export interface CanonicalRankV2Input {
  av: AssetVulnerabilityRow;
  asset: AssetRow;
  cve: CveRow;
  application?: BusinessApplicationRow | null;
  templates?: GabCidtTemplate[];
  hasCisaKevSource?: boolean | null;
  epssScore?: number | string | null;
  trustedSourceCount?: number | null;
  scannerEvidenceCount?: number | null;
  scannerEvidenceQuality?: number | null;
}

export interface CanonicalRankV2Result {
  rank: RankV2Result;
  priority: BusinessPriorityResult;
}

const fallbackApplication = {
  cidtConfidentiality: 4,
  cidtIntegrity: 4,
  cidtAvailability: 4,
  cidtTraceability: 4,
  isInternetExposed: false,
};

export function sourceBackedExploitMaturity(
  exploitMaturity: string | null | undefined,
  hasCisaKevSource: boolean
) {
  if (hasCisaKevSource) {
    return "active_in_wild";
  }

  return exploitMaturity === "active_in_wild" ? "poc_available" : exploitMaturity;
}

export function calculateCanonicalRankV2(
  input: CanonicalRankV2Input
): CanonicalRankV2Result {
  const app = input.application ?? fallbackApplication;
  const applicationCidt = {
    confidentiality: app.cidtConfidentiality,
    integrity: app.cidtIntegrity,
    availability: app.cidtAvailability,
    traceability: app.cidtTraceability,
  };
  const resolvedAssetCidt = resolveGabCidtContext({
    assetCidt: {
      confidentiality: input.asset.cidtConfidentiality,
      integrity: input.asset.cidtIntegrity,
      availability: input.asset.cidtAvailability,
      traceability: input.asset.cidtTraceability,
    },
    cidtOverrideEnabled: input.asset.cidtOverrideEnabled,
    cidtTemplateKey: input.asset.cidtTemplateKey,
    gabExposureType: input.asset.gabExposureType,
    templates: input.templates ?? [],
    applicationCidt,
  });
  const knownExploitation = Boolean(input.hasCisaKevSource);
  const epssScore = normalizeEpssScore(input.epssScore);
  const exploitMaturity = sourceBackedExploitMaturity(
    input.cve.exploitMaturity,
    knownExploitation
  );
  const priority = calculateBusinessPriority({
    severity: input.cve.severity,
    cvssScore: normalizeCvssScore(input.cve.cvssScore),
    exploitMaturity,
    knownExploitation,
    epssScore,
    assetCidt: resolvedAssetCidt.cidt,
    assetCidtSource: resolvedAssetCidt.source,
    assetCidtSourceLabel: resolvedAssetCidt.sourceLabel,
    assetCidtMissingContext: resolvedAssetCidt.missingContext,
    applicationCidt,
    applicationInternetExposed: app.isInternetExposed,
    gabExposureType: input.asset.gabExposureType,
    slaDue: input.av.slaDue,
    slaStatus: input.av.slaStatus,
    lifecycleStatus: input.av.status,
    scannerEvidenceCount: input.scannerEvidenceCount,
    scannerEvidenceQuality: input.scannerEvidenceQuality,
    trustedSourceCount: input.trustedSourceCount,
    firstSeen: input.av.firstSeen,
    assetCode: input.asset.assetCode,
    cveId: input.cve.cveId,
    id: input.av.id,
  });

  return {
    rank:
      priority.factors.rankV2 ??
      calculateRankV2({
        severity: input.cve.severity,
        cvssScore: normalizeCvssScore(input.cve.cvssScore),
        exploitMaturity,
        knownExploitation,
        epssScore,
        assetCidt: resolvedAssetCidt.cidt,
        applicationCidt,
        applicationInternetExposed: app.isInternetExposed,
        gabExposureType: input.asset.gabExposureType,
        slaDue: input.av.slaDue,
        slaStatus: input.av.slaStatus,
        lifecycleStatus: input.av.status,
        scannerEvidenceCount: input.scannerEvidenceCount,
        scannerEvidenceQuality: input.scannerEvidenceQuality,
        trustedSourceCount: input.trustedSourceCount,
        firstSeen: input.av.firstSeen,
        assetCode: input.asset.assetCode,
        cveId: input.cve.cveId,
        id: input.av.id,
      }),
    priority,
  };
}

export async function recalculateRankV2ForAssetVulnerabilities(input: {
  organizationId?: string;
  assetId?: string;
  assetVulnerabilityIds?: string[];
  cveDbIds?: string[];
}) {
  const db = getDb();

  if (!db) {
    return 0;
  }

  if (input.assetVulnerabilityIds && input.assetVulnerabilityIds.length === 0) {
    return 0;
  }

  if (input.cveDbIds && input.cveDbIds.length === 0) {
    return 0;
  }

  if (!input.organizationId && !input.assetVulnerabilityIds?.length && !input.cveDbIds?.length) {
    return 0;
  }

  const clauses: SQL[] = [];

  if (input.organizationId) {
    clauses.push(eq(assetVulnerabilities.organizationId, input.organizationId));
  }

  if (input.assetId) {
    clauses.push(eq(assetVulnerabilities.assetId, input.assetId));
  }

  if (input.assetVulnerabilityIds?.length) {
    clauses.push(inArray(assetVulnerabilities.id, input.assetVulnerabilityIds));
  }

  if (input.cveDbIds?.length) {
    clauses.push(inArray(assetVulnerabilities.cveId, input.cveDbIds));
  }

  const rows = await db
    .select({
      av: assetVulnerabilities,
      asset: assets,
      cve: cves,
      application: businessApplications,
      hasCisaKevSource: sql<boolean>`exists (
        select 1
        from cve_source_references source
        where source.cve_id = ${cves.id}
          and source.source_type = 'cisa_kev'
      )`,
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
    })
    .from(assetVulnerabilities)
    .innerJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
    .innerJoin(cves, eq(assetVulnerabilities.cveId, cves.id))
    .leftJoin(
      businessApplications,
      eq(assets.businessApplicationId, businessApplications.id)
    )
    .where(and(...clauses));

  const templatesByOrg = new Map<string, GabCidtTemplate[]>();

  for (const row of rows) {
    let templates = templatesByOrg.get(row.av.organizationId);

    if (!templates) {
      templates = await ensureGabCidtTemplates(row.av.organizationId);
      templatesByOrg.set(row.av.organizationId, templates);
    }

    const canonical = calculateCanonicalRankV2({
      av: row.av,
      asset: row.asset,
      cve: row.cve,
      application: row.application,
      templates,
      hasCisaKevSource: row.hasCisaKevSource,
      epssScore: row.epssScore,
      trustedSourceCount: row.trustedSourceCount,
      scannerEvidenceCount: row.scannerEvidenceCount,
      scannerEvidenceQuality: row.scannerEvidenceQuality,
    });

    await db
      .update(assetVulnerabilities)
      .set({
        riskScore: canonical.rank.score,
        businessPriority: canonical.rank.businessPriority,
        priorityFactors:
          canonical.priority.factors as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(assetVulnerabilities.organizationId, row.av.organizationId),
          eq(assetVulnerabilities.id, row.av.id)
        )
      );
  }

  return rows.length;
}
