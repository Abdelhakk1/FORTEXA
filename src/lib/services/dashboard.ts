import "server-only";

import { sql } from "drizzle-orm";
import type { Alert, Asset, Vulnerability } from "@/lib/types";
import { getDb } from "@/db";
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
  toUiImportStatus,
  toUiScannerSource,
  toUiSeverity,
  toUiSlaStatus,
} from "./serializers";

export interface DashboardSummaryData {
  totals: {
    totalAssets: number;
    atmGabCount: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    openAlerts: number;
    overdueTasks: number;
  };
  hasOperationalData: boolean;
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  exposureTrend: Array<{ month: string; critical: number; high: number; medium: number; low: number }>;
  remediationTrend: Array<{ month: string; opened: number; closed: number; overdue: number }>;
}

export interface DashboardRiskData {
  topRiskyAssets: Asset[];
  prioritizedVulnerabilities: Vulnerability[];
}

export interface DashboardActivityData {
  latestAlerts: Alert[];
  latestScanImports: Array<{
    id: string;
    name: string;
    scannerSource: string;
    importDate: string;
    findingsFound: number;
    status: string;
  }>;
}

type DashboardTotalsRow = {
  totalAssets: number;
  atmGabCount: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  openAlerts: number;
  overdueTasks: number;
};

type SeverityRow = {
  severity: string | null;
  total: number;
};

type RiskyAssetRow = {
  id: string;
  name: string;
  type: string;
  model: string | null;
  branch: string | null;
  region: string | null;
  exposureLevel: string;
  status: string;
  criticality: string;
  vulnerabilityCount: number;
  maxSeverity: string;
  contextualPriority: string;
  riskScore: number;
};

type PrioritizedVulnerabilityRow = {
  id: string;
  cveCode: string;
  title: string;
  description: string | null;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  businessPriority: string;
  affectedAssetsCount: number;
  patchAvailable: boolean;
  firstSeen: Date | string | null;
  lastSeen: Date | string | null;
  slaDue: Date | string | null;
  slaStatus: string;
  affectedProducts: string[] | null;
  riskScore: number;
};

type LatestAlertRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  type: string;
  relatedAsset: string | null;
  createdAt: Date | string | null;
  status: string;
};

type LatestScanImportRow = {
  id: string;
  name: string;
  scannerSource: string;
  importDate: Date | string | null;
  findingsFound: number;
  status: string;
};

function asRows<T>(value: unknown) {
  return value as T[];
}

function buildEmptyTrend(months: string[]) {
  return months.map((month) => ({
    month,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }));
}

function buildEmptyRemediationTrend(months: string[]) {
  return months.map((month) => ({
    month,
    opened: 0,
    closed: 0,
    overdue: 0,
  }));
}

function emptySummaryData(): DashboardSummaryData {
  const monthLabels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

  return {
    totals: {
      totalAssets: 0,
      atmGabCount: 0,
      totalVulnerabilities: 0,
      criticalVulnerabilities: 0,
      openAlerts: 0,
      overdueTasks: 0,
    },
    hasOperationalData: false,
    severityDistribution: [
      { name: "Critical", value: 0, color: "#EF4444" },
      { name: "High", value: 0, color: "#F59E0B" },
      { name: "Medium", value: 0, color: "#3B82F6" },
      { name: "Low", value: 0, color: "#10B981" },
    ],
    exposureTrend: buildEmptyTrend(monthLabels),
    remediationTrend: buildEmptyRemediationTrend(monthLabels),
  };
}

function emptyRiskData(): DashboardRiskData {
  return {
    topRiskyAssets: [],
    prioritizedVulnerabilities: [],
  };
}

function emptyActivityData(): DashboardActivityData {
  return {
    latestAlerts: [],
    latestScanImports: [],
  };
}

export async function getDashboardSummaryData(
  organizationId: string
): Promise<DashboardSummaryData> {
  const db = getDb();

  if (!db) {
    return emptySummaryData();
  }

  return measureServerTiming(
    "dashboard.summary",
    async () => {
      const monthLabels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

      const totalsRows = asRows<DashboardTotalsRow>(
        await db.execute(sql`
          select
            (select count(*)::int from assets where organization_id = ${organizationId}) as "totalAssets",
            (select count(*)::int from assets where organization_id = ${organizationId} and type in ('atm', 'gab')) as "atmGabCount",
            (select count(*)::int from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed') as "totalVulnerabilities",
            (
              select count(*)::int
              from asset_vulnerabilities av
              inner join cves c on c.id = av.cve_id
              where av.organization_id = ${organizationId} and av.status <> 'closed' and c.severity = 'critical'
            ) as "criticalVulnerabilities",
            (select count(*)::int from alerts where organization_id = ${organizationId} and status in ('new', 'acknowledged')) as "openAlerts",
            (select count(*)::int from remediation_tasks where organization_id = ${organizationId} and sla_status = 'overdue') as "overdueTasks"
        `)
      );
      const severityRows = asRows<SeverityRow>(
        await db.execute(sql`
          select c.severity as severity, count(*)::int as total
          from asset_vulnerabilities av
          inner join cves c on c.id = av.cve_id
          where av.organization_id = ${organizationId} and av.status <> 'closed'
          group by c.severity
        `)
      );

      const totals = totalsRows[0] ?? emptySummaryData().totals;
      const countsBySeverity = new Map(
        severityRows.map((row) => [row.severity ?? "info", row.total])
      );

      return {
        totals,
        hasOperationalData:
          totals.totalAssets > 0 ||
          totals.totalVulnerabilities > 0 ||
          totals.openAlerts > 0,
        severityDistribution: [
          {
            name: "Critical",
            value: countsBySeverity.get("critical") ?? 0,
            color: "#EF4444",
          },
          {
            name: "High",
            value: countsBySeverity.get("high") ?? 0,
            color: "#F59E0B",
          },
          {
            name: "Medium",
            value: countsBySeverity.get("medium") ?? 0,
            color: "#3B82F6",
          },
          {
            name: "Low",
            value: countsBySeverity.get("low") ?? 0,
            color: "#10B981",
          },
        ],
        exposureTrend: buildEmptyTrend(monthLabels),
        remediationTrend: buildEmptyRemediationTrend(monthLabels),
      };
    },
    undefined,
    (result) => ({
      totalAssets: result.totals.totalAssets,
      totalVulnerabilities: result.totals.totalVulnerabilities,
    })
  );
}

export async function getDashboardRiskData(
  organizationId: string
): Promise<DashboardRiskData> {
  const db = getDb();

  if (!db) {
    return emptyRiskData();
  }

  return measureServerTiming(
    "dashboard.risk",
    async () => {
      const [riskyAssetRows, vulnerabilityRows] = await Promise.all([
        asRows<RiskyAssetRow>(
          await db.execute(sql`
            select
              a.asset_code as id,
              a.name as name,
              a.type as type,
              a.model as model,
              a.branch as branch,
              a.region_id::text as region,
              a.exposure_level as "exposureLevel",
              a.status as status,
              a.criticality as criticality,
              count(av.id)::int as "vulnerabilityCount",
              case
                when bool_or(c.severity = 'critical') then 'critical'
                when bool_or(c.severity = 'high') then 'high'
                when bool_or(c.severity = 'medium') then 'medium'
                when bool_or(c.severity = 'low') then 'low'
                else 'info'
              end as "maxSeverity",
              case
                when bool_or(av.business_priority = 'p1') then 'p1'
                when bool_or(av.business_priority = 'p2') then 'p2'
                when bool_or(av.business_priority = 'p3') then 'p3'
                when bool_or(av.business_priority = 'p4') then 'p4'
                else 'p5'
              end as "contextualPriority",
              coalesce(max(av.risk_score), 0)::int as "riskScore"
            from asset_vulnerabilities av
            inner join assets a on a.id = av.asset_id
            left join cves c on c.id = av.cve_id
            where av.organization_id = ${organizationId} and av.status <> 'closed'
            group by a.id
            order by max(av.risk_score) desc, a.asset_code asc
            limit 5
          `)
        ),
        asRows<PrioritizedVulnerabilityRow>(
          await db.execute(sql`
            select
              min((av.id)::text) as id,
              c.cve_id as "cveCode",
              c.title as title,
              c.description as description,
              c.severity as severity,
              c.cvss_score::text as "cvssScore",
              c.cvss_vector as "cvssVector",
              case
                when bool_or(av.business_priority = 'p1') then 'p1'
                when bool_or(av.business_priority = 'p2') then 'p2'
                when bool_or(av.business_priority = 'p3') then 'p3'
                when bool_or(av.business_priority = 'p4') then 'p4'
                else 'p5'
              end as "businessPriority",
              count(distinct av.asset_id)::int as "affectedAssetsCount",
              c.patch_available as "patchAvailable",
              min(av.first_seen) as "firstSeen",
              max(av.last_seen) as "lastSeen",
              min(av.sla_due) as "slaDue",
              case
                when bool_or(av.sla_status = 'overdue') then 'overdue'
                when bool_or(av.sla_status = 'at_risk') then 'at_risk'
                else 'on_track'
              end as "slaStatus",
              c.affected_products as "affectedProducts",
              coalesce(max(av.risk_score), 0)::int as "riskScore"
            from asset_vulnerabilities av
            inner join cves c on c.id = av.cve_id
            where av.organization_id = ${organizationId} and av.status <> 'closed'
            group by c.id
            order by max(av.risk_score) desc, c.cvss_score desc nulls last, c.cve_id asc
            limit 5
          `)
        ),
      ]);

      return {
        topRiskyAssets: riskyAssetRows.map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: toUiAssetType(asset.type),
          model: asset.model ?? "—",
          manufacturer: "—",
          branch: asset.branch ?? "—",
          region: asset.region ?? "Unassigned",
          location: "—",
          ipAddress: "—",
          osVersion: "—",
          criticality: toUiCriticality(asset.criticality),
          exposureLevel: toUiExposureLevel(asset.exposureLevel),
          status: toUiAssetStatus(asset.status),
          owner: "Unassigned",
          lastScanDate: "—",
          vulnerabilityCount: asset.vulnerabilityCount,
          maxSeverity: toUiSeverity(asset.maxSeverity),
          contextualPriority: toUiBusinessPriority(asset.contextualPriority),
          riskScore: asset.riskScore,
        })),
        prioritizedVulnerabilities: vulnerabilityRows.map((row) => ({
          id: row.id,
          cveId: row.cveCode,
          title: row.title,
          description: row.description ?? "",
          severity: toUiSeverity(row.severity),
          cvssScore: row.cvssScore ? Number(row.cvssScore) : 0,
          cvssVector: row.cvssVector ?? "—",
          businessPriority: toUiBusinessPriority(row.businessPriority),
          exploitMaturity: "None",
          affectedAssetsCount: row.affectedAssetsCount,
          patchAvailable: row.patchAvailable,
          aiRemediationAvailable: false,
          status: "Open",
          firstSeen: formatDate(row.firstSeen),
          lastSeen: formatDate(row.lastSeen),
          slaDue: formatDate(row.slaDue),
          slaStatus: toUiSlaStatus(row.slaStatus),
          affectedProducts: row.affectedProducts ?? [],
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
        })),
      };
    },
    undefined,
    (result) => ({
      riskyAssets: result.topRiskyAssets.length,
      prioritized: result.prioritizedVulnerabilities.length,
    })
  );
}

export async function getDashboardActivityData(
  organizationId: string
): Promise<DashboardActivityData> {
  const db = getDb();

  if (!db) {
    return emptyActivityData();
  }

  return measureServerTiming(
    "dashboard.activity",
    async () => {
      const [alertRows, importRows] = await Promise.all([
        asRows<LatestAlertRow>(
          await db.execute(sql`
            select
              a.id as id,
              a.title as title,
              a.description as description,
              a.severity as severity,
              a.type as type,
              coalesce(asset.asset_code, asset.name, 'Linked entity') as "relatedAsset",
              a.created_at as "createdAt",
              a.status as status
            from alerts a
            left join assets asset on asset.id = a.related_asset_id
            where a.organization_id = ${organizationId}
            order by a.created_at desc
            limit 5
          `)
        ),
        asRows<LatestScanImportRow>(
          await db.execute(sql`
            select
              id as id,
              name as name,
              scanner_source as "scannerSource",
              import_date as "importDate",
              findings_found as "findingsFound",
              status as status
            from scan_imports
            where organization_id = ${organizationId}
            order by import_date desc
            limit 5
          `)
        ),
      ]);

      return {
        latestAlerts: alertRows.map((alert) => ({
          id: alert.id,
          title: alert.title,
          description: alert.description ?? "",
          severity: toUiSeverity(alert.severity),
          type: toUiAlertType(alert.type),
          relatedAsset: alert.relatedAsset ?? "Linked entity",
          relatedCve: "N/A",
          createdAt: formatDate(alert.createdAt),
          owner: "Unassigned",
          status: toUiAlertStatus(alert.status),
        })),
        latestScanImports: importRows.map((scanImport) => ({
          id: scanImport.id,
          name: scanImport.name,
          scannerSource: toUiScannerSource(scanImport.scannerSource),
          importDate: formatDate(scanImport.importDate),
          findingsFound: scanImport.findingsFound,
          status: toUiImportStatus(scanImport.status),
        })),
      };
    },
    undefined,
    (result) => ({
      alerts: result.latestAlerts.length,
      imports: result.latestScanImports.length,
    })
  );
}
