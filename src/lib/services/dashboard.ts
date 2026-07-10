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
  toUiGabExposureType,
  toUiImportStatus,
  toUiScannerSource,
  toUiSeverity,
  toUiSlaStatus,
} from "./serializers";
import {
  ATM_PAYMENT_SERVICES_LABEL,
  applicationProfileExplanation,
  calculateApplicationProfile,
  calculateCidtSensitivity,
  normalizeCvssScore,
  prioritySummaryFromFactors,
  resolveGabCidtContext,
  toSensitivityLevel,
} from "./business-priority";

export interface DashboardSummaryData {
  totals: {
    totalAssets: number;
    atmGabCount: number;
    unclassifiedGabCount: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    openAlerts: number;
    overdueTasks: number;
  };
  hasOperationalData: boolean;
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  exposureTrend: DashboardExposureTrendPoint[];
  remediationTrend: DashboardRemediationTrendPoint[];
}

export interface DashboardExposureTrendPoint {
  scanId: string;
  scanName: string;
  scanDate: string;
  month: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  newFindings: number;
  fixedFindings: number;
  reopenedFindings: number;
}

export interface DashboardRemediationTrendPoint {
  periodStart: string;
  month: string;
  opened: number;
  closed: number;
  overdue: number;
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
  unclassifiedGabCount: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  openAlerts: number;
  overdueTasks: number;
};

type SeverityRow = {
  severity: string | null;
  total: number;
};

export type DashboardScanTrendRow = {
  id: string;
  name: string;
  importDate: Date | string;
  critical: number | string | null;
  high: number | string | null;
  medium: number | string | null;
  low: number | string | null;
  newFindings: number | string | null;
  fixedFindings: number | string | null;
  reopenedFindings: number | string | null;
};

export type DashboardRemediationTrendRow = {
  periodStart: Date | string;
  opened: number | string | null;
  closed: number | string | null;
  overdue: number | string | null;
};

type RiskyAssetRow = {
  id: string;
  name: string;
  type: string;
  model: string | null;
  branch: string | null;
  region: string | null;
  exposureLevel: string;
  gabExposureType: string;
  cidtConfidentiality: number | null;
  cidtIntegrity: number | null;
  cidtAvailability: number | null;
  cidtTraceability: number | null;
  cidtOverrideEnabled: boolean;
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
  priorityFactors: Record<string, unknown> | null;
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

function count(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function validDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
}

export function buildDashboardExposureTrend(
  rows: DashboardScanTrendRow[]
): DashboardExposureTrendPoint[] {
  return rows
    .map((row) => ({ row, date: validDate(row.importDate) }))
    .filter(
      (entry): entry is { row: DashboardScanTrendRow; date: Date } =>
        entry.date !== null
    )
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(-6)
    .map(({ row, date }) => ({
      scanId: row.id,
      scanName: row.name,
      scanDate: date.toISOString(),
      month: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date),
      critical: count(row.critical),
      high: count(row.high),
      medium: count(row.medium),
      low: count(row.low),
      newFindings: count(row.newFindings),
      fixedFindings: count(row.fixedFindings),
      reopenedFindings: count(row.reopenedFindings),
    }));
}

export function buildDashboardRemediationTrend(
  rows: DashboardRemediationTrendRow[],
  now = new Date()
): DashboardRemediationTrendPoint[] {
  if (rows.length === 0) {
    return [];
  }

  const anchor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const rowsByMonth = new Map(
    rows.flatMap((row) => {
      const date = validDate(row.periodStart);
      return date ? [[monthKey(date), row] as const] : [];
    })
  );

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 5 + index, 1)
    );
    const row = rowsByMonth.get(monthKey(date));

    return {
      periodStart: dateKey(date),
      month: new Intl.DateTimeFormat("en-US", {
        month: "short",
        timeZone: "UTC",
      }).format(date),
      opened: count(row?.opened ?? 0),
      closed: count(row?.closed ?? 0),
      overdue: count(row?.overdue ?? 0),
    };
  });
}

function buildDashboardAssetBusinessContext(asset: RiskyAssetRow) {
  const assetCidt = {
    confidentiality: asset.cidtConfidentiality,
    integrity: asset.cidtIntegrity,
    availability: asset.cidtAvailability,
    traceability: asset.cidtTraceability,
  };
  const appCidt = {
    confidentiality: 4,
    integrity: 4,
    availability: 4,
    traceability: 4,
  };
  const appSensitivity = calculateCidtSensitivity(appCidt, 4);
  const appProfile = calculateApplicationProfile({
    isInternetExposed: false,
    confidentiality: appCidt.confidentiality,
    integrity: appCidt.integrity,
  });
  const resolvedAssetCidt = resolveGabCidtContext({
    assetCidt,
    cidtOverrideEnabled: asset.cidtOverrideEnabled,
    gabExposureType: asset.gabExposureType,
    applicationCidt: appCidt,
  });

  return {
    gabExposureType: toUiGabExposureType(asset.gabExposureType),
    gabExposureTypeDb: asset.gabExposureType,
    cidt: {
      confidentiality: resolvedAssetCidt.cidt.confidentiality,
      integrity: resolvedAssetCidt.cidt.integrity,
      availability: resolvedAssetCidt.cidt.availability,
      traceability: resolvedAssetCidt.cidt.traceability,
      sensitivity: resolvedAssetCidt.sensitivityLabel,
      isComplete: resolvedAssetCidt.source !== "system_default",
      source: resolvedAssetCidt.source,
      sourceLabel: resolvedAssetCidt.sourceLabel,
      templateKey: resolvedAssetCidt.templateKey,
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
      isInternetExposed: false,
    },
  };
}

export function emptyDashboardSummaryData(): DashboardSummaryData {
  return {
    totals: {
      totalAssets: 0,
      atmGabCount: 0,
      unclassifiedGabCount: 0,
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
    exposureTrend: [],
    remediationTrend: [],
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
    return emptyDashboardSummaryData();
  }

  return measureServerTiming(
    "dashboard.summary",
    async () => {
      const [totalsRows, severityRows, scanTrendRows, remediationTrendRows] =
        await Promise.all([
          asRows<DashboardTotalsRow>(
            await db.execute(sql`
          select
            (select count(*)::int from assets where organization_id = ${organizationId}) as "totalAssets",
            (select count(*)::int from assets where organization_id = ${organizationId} and type in ('atm', 'gab')) as "atmGabCount",
            (select count(*)::int from assets where organization_id = ${organizationId} and type in ('atm', 'gab') and gab_exposure_type = 'unknown') as "unclassifiedGabCount",
            (select count(*)::int from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed') as "totalVulnerabilities",
            (
              select count(*)::int
              from asset_vulnerabilities av
              inner join cves c on c.id = av.cve_id
              where av.organization_id = ${organizationId} and av.status <> 'closed' and c.severity = 'critical'
            ) as "criticalVulnerabilities",
            (select count(*)::int from alerts where organization_id = ${organizationId} and status in ('new', 'acknowledged')) as "openAlerts",
            (
              select count(*)::int
              from remediation_tasks
              where organization_id = ${organizationId}
                and (
                  sla_status = 'overdue'
                  or status = 'overdue'
                  or (
                    due_date < now()
                    and status not in ('mitigated', 'closed')
                  )
                )
            ) as "overdueTasks"
        `)
          ),
          asRows<SeverityRow>(
            await db.execute(sql`
          select c.severity as severity, count(*)::int as total
          from asset_vulnerabilities av
          inner join cves c on c.id = av.cve_id
          where av.organization_id = ${organizationId} and av.status <> 'closed'
          group by c.severity
        `)
          ),
          asRows<DashboardScanTrendRow>(
            await db.execute(sql`
          with recent_scans as (
            select
              id,
              name,
              import_date,
              new_findings,
              fixed_findings,
              reopened_findings
            from scan_imports
            where organization_id = ${organizationId}
              and scanner_source = 'nessus'
              and status in ('completed', 'partial')
            order by import_date desc
            limit 6
          ),
          finding_counts as (
            select
              sf.scan_import_id,
              count(distinct coalesce(
                sf.matched_asset_id::text || ':' || sf.matched_cve_id::text,
                sf.id::text
              )) filter (where sf.severity = 'critical')::int as critical,
              count(distinct coalesce(
                sf.matched_asset_id::text || ':' || sf.matched_cve_id::text,
                sf.id::text
              )) filter (where sf.severity = 'high')::int as high,
              count(distinct coalesce(
                sf.matched_asset_id::text || ':' || sf.matched_cve_id::text,
                sf.id::text
              )) filter (where sf.severity = 'medium')::int as medium,
              count(distinct coalesce(
                sf.matched_asset_id::text || ':' || sf.matched_cve_id::text,
                sf.id::text
              )) filter (where sf.severity = 'low')::int as low
            from scan_findings sf
            inner join recent_scans rs on rs.id = sf.scan_import_id
            where sf.organization_id = ${organizationId}
            group by sf.scan_import_id
          ),
          event_counts as (
            select
              ave.scan_import_id,
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type in ('introduced', 'unchanged', 'reopened')
                  and c.severity = 'critical'
              )::int as critical,
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type in ('introduced', 'unchanged', 'reopened')
                  and c.severity = 'high'
              )::int as high,
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type in ('introduced', 'unchanged', 'reopened')
                  and c.severity = 'medium'
              )::int as medium,
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type in ('introduced', 'unchanged', 'reopened')
                  and c.severity = 'low'
              )::int as low,
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type = 'introduced'
              )::int as "newFindings",
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type = 'fixed'
              )::int as "fixedFindings",
              count(distinct ave.asset_vulnerability_id) filter (
                where ave.event_type = 'reopened'
              )::int as "reopenedFindings"
            from asset_vulnerability_events ave
            inner join recent_scans rs on rs.id = ave.scan_import_id
            inner join asset_vulnerabilities av
              on av.id = ave.asset_vulnerability_id
              and av.organization_id = ${organizationId}
            inner join cves c on c.id = av.cve_id
            where ave.organization_id = ${organizationId}
            group by ave.scan_import_id
          )
          select
            rs.id,
            rs.name,
            rs.import_date as "importDate",
            coalesce(ec.critical, fc.critical, 0)::int as critical,
            coalesce(ec.high, fc.high, 0)::int as high,
            coalesce(ec.medium, fc.medium, 0)::int as medium,
            coalesce(ec.low, fc.low, 0)::int as low,
            coalesce(ec."newFindings", rs.new_findings, 0)::int as "newFindings",
            coalesce(ec."fixedFindings", rs.fixed_findings, 0)::int as "fixedFindings",
            coalesce(ec."reopenedFindings", rs.reopened_findings, 0)::int as "reopenedFindings"
          from recent_scans rs
          left join finding_counts fc on fc.scan_import_id = rs.id
          left join event_counts ec on ec.scan_import_id = rs.id
          order by rs.import_date asc
        `)
          ),
          asRows<DashboardRemediationTrendRow>(
            await db.execute(sql`
          with completion_events as (
            select
              details ->> 'remediationTaskId' as task_id,
              max(created_at) as completed_at
            from asset_vulnerability_events
            where organization_id = ${organizationId}
              and event_type = 'task_completed'
              and details ->> 'remediationTaskId' is not null
            group by details ->> 'remediationTaskId'
          ),
          activity as (
            select
              rt.id::text as task_id,
              rt.created_at as occurred_at,
              'opened'::text as activity_type
            from remediation_tasks rt
            where rt.organization_id = ${organizationId}

            union all

            select
              rt.id::text as task_id,
              coalesce(ce.completed_at, rt.updated_at) as occurred_at,
              'closed'::text as activity_type
            from remediation_tasks rt
            left join completion_events ce on ce.task_id = rt.id::text
            where rt.organization_id = ${organizationId}
              and rt.status in ('mitigated', 'closed')

            union all

            select
              rt.id::text as task_id,
              coalesce(rt.due_date, rt.updated_at) as occurred_at,
              'overdue'::text as activity_type
            from remediation_tasks rt
            where rt.organization_id = ${organizationId}
              and (
                rt.status = 'overdue'
                or rt.sla_status = 'overdue'
                or (
                  rt.due_date < now()
                  and rt.status not in ('mitigated', 'closed')
                )
              )
          )
          select
            date_trunc('month', occurred_at) as "periodStart",
            count(distinct task_id) filter (
              where activity_type = 'opened'
            )::int as opened,
            count(distinct task_id) filter (
              where activity_type = 'closed'
            )::int as closed,
            count(distinct task_id) filter (
              where activity_type = 'overdue'
            )::int as overdue
          from activity
          where occurred_at >= date_trunc('month', current_date) - interval '5 months'
            and occurred_at < date_trunc('month', current_date) + interval '1 month'
          group by date_trunc('month', occurred_at)
          order by date_trunc('month', occurred_at) asc
        `)
          ),
        ]);

      const totals = totalsRows[0] ?? emptyDashboardSummaryData().totals;
      const countsBySeverity = new Map(
        severityRows.map((row) => [row.severity ?? "info", row.total])
      );
      const exposureTrend = buildDashboardExposureTrend(scanTrendRows);
      const remediationTrend = buildDashboardRemediationTrend(
        remediationTrendRows
      );

      return {
        totals,
        hasOperationalData:
          totals.totalAssets > 0 ||
          totals.totalVulnerabilities > 0 ||
          totals.openAlerts > 0 ||
          exposureTrend.length > 0 ||
          remediationTrend.length > 0,
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
        exposureTrend,
        remediationTrend,
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
              a.gab_exposure_type as "gabExposureType",
              a.cidt_confidentiality as "cidtConfidentiality",
              a.cidt_integrity as "cidtIntegrity",
              a.cidt_availability as "cidtAvailability",
              a.cidt_traceability as "cidtTraceability",
              a.cidt_override_enabled as "cidtOverrideEnabled",
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
            order by
              min(case av.business_priority
                when 'p1' then 1
                when 'p2' then 2
                when 'p3' then 3
                when 'p4' then 4
                else 5
              end) asc,
              max(case a.gab_exposure_type
                when 'outdoor_public_street' then 4
                when 'outdoor_commercial_center' then 3
                when 'outdoor_agency' then 2
                when 'indoor_agency' then 1
                else 0
              end) desc,
              max(av.risk_score) desc,
              a.asset_code asc
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
              coalesce(max(av.risk_score), 0)::int as "riskScore",
              (array_agg(av.priority_factors order by av.risk_score desc))[1] as "priorityFactors"
            from asset_vulnerabilities av
            inner join cves c on c.id = av.cve_id
            inner join assets a on a.id = av.asset_id
            where av.organization_id = ${organizationId} and av.status <> 'closed'
            group by c.id
            order by
              min(case av.business_priority
                when 'p1' then 1
                when 'p2' then 2
                when 'p3' then 3
                when 'p4' then 4
                else 5
              end) asc,
              max(case a.gab_exposure_type
                when 'outdoor_public_street' then 4
                when 'outdoor_commercial_center' then 3
                when 'outdoor_agency' then 2
                when 'indoor_agency' then 1
                else 0
              end) desc,
              max(av.risk_score) desc,
              c.cvss_score desc nulls last,
              c.cve_id asc
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
          ...buildDashboardAssetBusinessContext(asset),
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
          cvssScore: normalizeCvssScore(row.cvssScore),
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
          contextReason: prioritySummaryFromFactors(row.priorityFactors),
          priorityFactors:
            row.priorityFactors && typeof row.priorityFactors === "object"
              ? {
                  summary: String(row.priorityFactors.summary ?? ""),
                  businessImpact: String(row.priorityFactors.businessImpact ?? ""),
                  remediationUrgency: String(row.priorityFactors.remediationUrgency ?? ""),
                  missingContext: Array.isArray(row.priorityFactors.missingContext)
                    ? row.priorityFactors.missingContext.map(String)
                    : [],
                }
              : undefined,
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
