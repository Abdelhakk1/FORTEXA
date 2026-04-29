import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assetVulnerabilities,
  assets,
  cves,
  generatedReports,
  profiles,
  remediationTasks,
  reportDefinitions,
  scanImports,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { createSignedStorageUrl, getFortexaStorageBuckets, uploadTextToStorage } from "./storage";
import { ensureDefaultReportDefinitions } from "./ingestion";
import {
  formatDate,
  toUiReportStatus,
  toUiReportType,
} from "./serializers";

export type ReportKind =
  | "executive_exposure"
  | "scan_delta"
  | "remediation_backlog";

export interface ReportSection {
  title: string;
  rows: Array<Record<string, string | number | null>>;
}

export interface BuiltReport {
  definitionId: string;
  name: string;
  description: string;
  kind: ReportKind;
  generatedAt: Date;
  sections: ReportSection[];
}

const validKinds = new Set<ReportKind>([
  "executive_exposure",
  "scan_delta",
  "remediation_backlog",
]);

function asRows<T>(value: unknown) {
  return value as T[];
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(report: BuiltReport) {
  const lines = [
    ["Report", report.name],
    ["Generated At", report.generatedAt.toISOString()],
    ["Report Type", report.kind],
    [],
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const sections = report.sections.map((section) => {
    const headers = Array.from(
      section.rows.reduce<Set<string>>((acc, row) => {
        Object.keys(row).forEach((key) => acc.add(key));
        return acc;
      }, new Set())
    );
    const rows = section.rows.length
      ? section.rows
      : [{ status: "No data available for this section." }];
    const sectionHeaders = headers.length ? headers : Object.keys(rows[0] ?? {});

    return [
      csvEscape(section.title),
      sectionHeaders.map(csvEscape).join(","),
      ...rows.map((row) =>
        sectionHeaders.map((key) => csvEscape(row[key] ?? null)).join(",")
      ),
    ].join("\n");
  });

  return [lines, ...sections].join("\n\n");
}

function reportKindForDefinition(definition: typeof reportDefinitions.$inferSelect): ReportKind {
  const configKind = definition.config?.reportKind;
  if (typeof configKind === "string" && validKinds.has(configKind as ReportKind)) {
    return configKind as ReportKind;
  }

  if (definition.type === "remediation") {
    return "remediation_backlog";
  }

  if (
    definition.name.toLowerCase().includes("scan") ||
    definition.name.toLowerCase().includes("import") ||
    definition.type === "compliance"
  ) {
    return "scan_delta";
  }

  return "executive_exposure";
}

function buildStoragePath(organizationId: string, reportName: string) {
  const now = new Date();
  const safeName = reportName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    organizationId,
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${now.getTime()}-${safeName || "report"}.csv`,
  ].join("/");
}

async function buildExecutiveExposureReport(
  organizationId: string
): Promise<ReportSection[]> {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [totalsRows, siteRows, roleRows] = await Promise.all([
    asRows<{
      totalAssets: number;
      openVulnerabilities: number;
      criticalVulnerabilities: number;
      highVulnerabilities: number;
      overdueTasks: number;
    }>(
      await db.execute(sql`
        select
          (select count(*)::int from assets where organization_id = ${organizationId}) as "totalAssets",
          (select count(*)::int from asset_vulnerabilities where organization_id = ${organizationId} and status <> 'closed') as "openVulnerabilities",
          (
            select count(*)::int
            from asset_vulnerabilities av
            inner join cves c on c.id = av.cve_id
            where av.organization_id = ${organizationId} and av.status <> 'closed' and c.severity = 'critical'
          ) as "criticalVulnerabilities",
          (
            select count(*)::int
            from asset_vulnerabilities av
            inner join cves c on c.id = av.cve_id
            where av.organization_id = ${organizationId} and av.status <> 'closed' and c.severity = 'high'
          ) as "highVulnerabilities",
          (select count(*)::int from remediation_tasks where organization_id = ${organizationId} and sla_status = 'overdue') as "overdueTasks"
      `)
    ),
    db
      .select({
        site: sql<string>`coalesce(${assets.branch}, ${assets.location}, 'Unassigned')`,
        assets: sql<number>`count(distinct ${assets.id})::int`,
        openVulnerabilities: sql<number>`count(${assetVulnerabilities.id}) filter (where ${assetVulnerabilities.status} <> 'closed')::int`,
      })
      .from(assets)
      .leftJoin(assetVulnerabilities, eq(assetVulnerabilities.assetId, assets.id))
      .where(eq(assets.organizationId, organizationId))
      .groupBy(sql`coalesce(${assets.branch}, ${assets.location}, 'Unassigned')`)
      .orderBy(sql`count(${assetVulnerabilities.id}) desc`)
      .limit(8),
    db
      .select({
        role: assets.type,
        assets: sql<number>`count(distinct ${assets.id})::int`,
        openVulnerabilities: sql<number>`count(${assetVulnerabilities.id}) filter (where ${assetVulnerabilities.status} <> 'closed')::int`,
      })
      .from(assets)
      .leftJoin(assetVulnerabilities, eq(assetVulnerabilities.assetId, assets.id))
      .where(eq(assets.organizationId, organizationId))
      .groupBy(assets.type)
      .orderBy(sql`count(${assetVulnerabilities.id}) desc`)
      .limit(8),
  ]);
  const totals = totalsRows[0] ?? {
    totalAssets: 0,
    openVulnerabilities: 0,
    criticalVulnerabilities: 0,
    highVulnerabilities: 0,
    overdueTasks: 0,
  };

  return [
    {
      title: "Executive exposure summary",
      rows: [
        {
          total_assets: totals.totalAssets,
          open_vulnerabilities: totals.openVulnerabilities,
          critical_vulnerabilities: totals.criticalVulnerabilities,
          high_vulnerabilities: totals.highVulnerabilities,
          overdue_remediation_tasks: totals.overdueTasks,
        },
      ],
    },
    {
      title: "Top affected sites / regions",
      rows: siteRows.map((row) => ({
        site_or_region: row.site,
        assets: row.assets,
        open_vulnerabilities: row.openVulnerabilities,
      })),
    },
    {
      title: "Top affected asset roles",
      rows: roleRows.map((row) => ({
        asset_role: row.role,
        assets: row.assets,
        open_vulnerabilities: row.openVulnerabilities,
      })),
    },
  ];
}

async function buildScanDeltaReport(organizationId: string): Promise<ReportSection[]> {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [latestImport] = await db
    .select()
    .from(scanImports)
    .where(eq(scanImports.organizationId, organizationId))
    .orderBy(desc(scanImports.importDate))
    .limit(1);

  if (!latestImport) {
    return [
      {
        title: "Latest scan delta",
        rows: [
          {
            status: "No scan imports found.",
            new_findings: 0,
            fixed_findings: 0,
            reopened_findings: 0,
            unchanged_findings: 0,
            low_confidence_matches: 0,
          },
        ],
      },
    ];
  }

  return [
    {
      title: "Latest import",
      rows: [
        {
          import_name: latestImport.name,
          scanner: latestImport.scannerSource,
          imported_at: formatDate(latestImport.importDate),
          status: latestImport.status,
          assets_found: latestImport.assetsFound,
          findings_found: latestImport.findingsFound,
          cves_linked: latestImport.cvesLinked,
        },
      ],
    },
    {
      title: "Delta",
      rows: [
        {
          new_findings: latestImport.newFindings,
          fixed_findings: latestImport.fixedFindings,
          reopened_findings: latestImport.reopenedFindings,
          unchanged_findings: latestImport.unchangedFindings,
          low_confidence_matches: latestImport.lowConfidenceMatches,
          warnings: latestImport.warnings,
          errors: latestImport.errors,
        },
      ],
    },
  ];
}

async function buildRemediationBacklogReport(
  organizationId: string
): Promise<ReportSection[]> {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const taskRows = await db
    .select({
      task: remediationTasks,
      assignee: profiles.fullName,
      cveCode: cves.cveId,
      assetCode: assets.assetCode,
      assetName: assets.name,
    })
    .from(remediationTasks)
    .leftJoin(profiles, eq(remediationTasks.assignedTo, profiles.id))
    .leftJoin(assetVulnerabilities, eq(remediationTasks.assetVulnerabilityId, assetVulnerabilities.id))
    .leftJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
    .leftJoin(cves, eq(remediationTasks.cveId, cves.id))
    .where(
      and(
        eq(remediationTasks.organizationId, organizationId),
        sql`${remediationTasks.status} <> 'closed'`
      )
    )
    .orderBy(desc(remediationTasks.slaStatus), desc(remediationTasks.updatedAt))
    .limit(200);

  return [
    {
      title: "Remediation backlog",
      rows: taskRows.map((row) => ({
        title: row.task.title,
        status: row.task.status,
        priority: row.task.priority,
        business_priority: row.task.businessPriority,
        assignee: row.assignee ?? "Unassigned",
        due_date: formatDate(row.task.dueDate),
        sla_status: row.task.slaStatus,
        progress: row.task.progress,
        related_asset: row.assetCode ?? row.assetName ?? "N/A",
        related_cve: row.cveCode ?? "N/A",
      })),
    },
  ];
}

export async function buildReport(
  organizationId: string,
  definitionId: string
): Promise<BuiltReport> {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  await ensureDefaultReportDefinitions(organizationId, null);
  const [definition] = await db
    .select()
    .from(reportDefinitions)
    .where(
      and(
        eq(reportDefinitions.organizationId, organizationId),
        eq(reportDefinitions.id, definitionId)
      )
    )
    .limit(1);

  if (!definition) {
    throw new AppError("not_found", "Report definition not found.");
  }

  const kind = reportKindForDefinition(definition);
  const sections =
    kind === "scan_delta"
      ? await buildScanDeltaReport(organizationId)
      : kind === "remediation_backlog"
        ? await buildRemediationBacklogReport(organizationId)
        : await buildExecutiveExposureReport(organizationId);

  return {
    definitionId: definition.id,
    name: definition.name,
    description: definition.description ?? "Generated Fortexa report",
    kind,
    generatedAt: new Date(),
    sections,
  };
}

export async function generateReportCsv(params: {
  organizationId: string;
  definitionId: string;
  generatedBy: string | null;
}) {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const report = await buildReport(params.organizationId, params.definitionId);
  const csv = toCsv(report);
  const storagePath = buildStoragePath(params.organizationId, report.name);
  const upload = await uploadTextToStorage({
    bucket: getFortexaStorageBuckets().reports,
    path: storagePath,
    text: csv,
    contentType: "text/csv; charset=utf-8",
  });

  if (!upload.ok) {
    throw new AppError(upload.code, upload.message);
  }

  const [generated] = await db
    .insert(generatedReports)
    .values({
      organizationId: params.organizationId,
      reportDefinitionId: params.definitionId,
      generatedBy: params.generatedBy,
      storagePath,
      fileFormat: "csv",
      parameters: {
        reportKind: report.kind,
        generatedAt: report.generatedAt.toISOString(),
      },
    })
    .returning();

  await db
    .update(reportDefinitions)
    .set({ lastRunAt: report.generatedAt, updatedAt: new Date() })
    .where(
      and(
        eq(reportDefinitions.organizationId, params.organizationId),
        eq(reportDefinitions.id, params.definitionId)
      )
    );

  const signedUrl = await createSignedStorageUrl({
    bucket: getFortexaStorageBuckets().reports,
    path: storagePath,
  });

  return {
    report,
    generated,
    signedUrl: signedUrl.ok ? signedUrl.data.signedUrl : null,
  };
}

export async function createReportDownloadUrl(
  organizationId: string,
  generatedReportId: string
) {
  const db = getDb();
  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [report] = await db
    .select()
    .from(generatedReports)
    .where(
      and(
        eq(generatedReports.organizationId, organizationId),
        eq(generatedReports.id, generatedReportId)
      )
    )
    .limit(1);

  if (!report) {
    throw new AppError("not_found", "Generated report not found.");
  }

  const signed = await createSignedStorageUrl({
    bucket: getFortexaStorageBuckets().reports,
    path: report.storagePath,
  });

  if (!signed.ok) {
    throw new AppError(signed.code, signed.message);
  }

  return signed.data.signedUrl;
}

export async function listReports(organizationId: string) {
  const db = getDb();

  if (!db) {
    return {
      summary: {
        reportsGenerated: 0,
        scheduledReports: 0,
        totalTemplates: 0,
        activeViewers: 0,
      },
      recentReports: [],
      templates: [],
    };
  }

  try {
    await ensureDefaultReportDefinitions(organizationId, null);

    const [definitionRows, generatedRows] = await Promise.all([
      db
        .select()
        .from(reportDefinitions)
        .where(eq(reportDefinitions.organizationId, organizationId))
        .orderBy(reportDefinitions.createdAt)
        .limit(20),
      db
        .select({
          report: generatedReports,
          reportName: reportDefinitions.name,
          reportDescription: reportDefinitions.description,
          authorName: profiles.fullName,
        })
        .from(generatedReports)
        .leftJoin(
          reportDefinitions,
          eq(generatedReports.reportDefinitionId, reportDefinitions.id)
        )
        .leftJoin(profiles, eq(generatedReports.generatedBy, profiles.id))
        .where(eq(generatedReports.organizationId, organizationId))
        .orderBy(desc(generatedReports.generatedAt))
        .limit(12),
    ]);

    return {
      summary: {
        reportsGenerated: generatedRows.length,
        scheduledReports: definitionRows.filter((row) => Boolean(row.schedule && row.schedule !== "On demand")).length,
        totalTemplates: definitionRows.length,
        activeViewers: 0,
      },
      recentReports: generatedRows.map((row) => ({
        id: row.report.id,
        name: row.reportName ?? "Untitled report",
        description: row.reportDescription ?? "Generated report artifact",
        generatedAt: formatDate(row.report.generatedAt),
        author: row.authorName ?? "System",
        storagePath: row.report.storagePath,
        fileFormat: row.report.fileFormat.toUpperCase(),
      })),
      templates: definitionRows.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description ?? "Saved report definition",
        type: toUiReportType(definition.type),
        kind: reportKindForDefinition(definition),
        schedule: definition.schedule ?? "On demand",
        lastRun: formatDate(definition.lastRunAt),
        status: toUiReportStatus(definition.status),
      })),
    };
  } catch {
    return {
      summary: {
        reportsGenerated: 0,
        scheduledReports: 0,
        totalTemplates: 0,
        activeViewers: 0,
      },
      recentReports: [],
      templates: [],
    };
  }
}
