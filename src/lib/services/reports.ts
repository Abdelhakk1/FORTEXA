import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { generatedReports, profiles, reportDefinitions } from "@/db/schema";
import {
  formatDate,
  toUiReportStatus,
  toUiReportType,
} from "./serializers";

export async function listReports() {
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

  const [definitionRows, generatedRows] = await Promise.all([
    db.select().from(reportDefinitions),
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
      .orderBy(generatedReports.generatedAt),
  ]);

  return {
    summary: {
      reportsGenerated: generatedRows.length,
      scheduledReports: definitionRows.filter((row) => Boolean(row.schedule)).length,
      totalTemplates: definitionRows.length,
      activeViewers: 0,
    },
    recentReports: generatedRows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.report.id,
        name: row.reportName ?? "Untitled report",
        description: row.reportDescription ?? "Generated report artifact",
        generatedAt: formatDate(row.report.generatedAt),
        author: row.authorName ?? "System",
        storagePath: row.report.storagePath,
      })),
    templates: definitionRows.map((definition) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description ?? "Saved report definition",
      type: toUiReportType(definition.type),
      schedule: definition.schedule ?? "On demand",
      lastRun: formatDate(definition.lastRunAt),
      status: toUiReportStatus(definition.status),
    })),
  };
}
