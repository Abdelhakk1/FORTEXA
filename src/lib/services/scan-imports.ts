import "server-only";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, scanImports } from "@/db/schema";
import type { ScanImport } from "@/lib/types";
import { AppError } from "@/lib/errors";
import {
  formatDate,
  formatDuration,
  formatFileSize,
  toUiImportStatus,
  toUiScannerSource,
} from "./serializers";
import { buildPaginatedResult, count, desc, getPagination } from "./utils";

export interface ScanImportListItem extends ScanImport {
  dbId: string;
  importedById: string | null;
}

export const createScanImportRecordSchema = z.object({
  name: z.string().trim().min(3).max(255),
  scannerSource: z.enum(["nessus", "openvas", "nmap", "qualys", "other"]),
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().nonnegative().optional(),
  storagePath: z.string().trim().min(1).max(1024),
  importedBy: z.string().uuid().nullable().optional(),
});

function mapScanImportRow(row: {
  scanImport: typeof scanImports.$inferSelect;
  importedByName: string | null;
}) {
  return {
    dbId: row.scanImport.id,
    id: row.scanImport.id,
    name: row.scanImport.name,
    scannerSource: toUiScannerSource(row.scanImport.scannerSource),
    importDate: formatDate(row.scanImport.importDate),
    importedBy: row.importedByName ?? "System",
    importedById: row.scanImport.importedBy ?? null,
    fileName: row.scanImport.fileName,
    fileSize: formatFileSize(row.scanImport.fileSize),
    assetsFound: row.scanImport.assetsFound,
    findingsFound: row.scanImport.findingsFound,
    cvesLinked: row.scanImport.cvesLinked,
    newAssets: row.scanImport.newAssets,
    newVulnerabilities: row.scanImport.newVulnerabilities,
    closedVulnerabilities: row.scanImport.closedVulnerabilities,
    errors: row.scanImport.errors,
    warnings: row.scanImport.warnings,
    status: toUiImportStatus(row.scanImport.status),
    processingTime: formatDuration(row.scanImport.processingTimeMs),
  } satisfies ScanImportListItem;
}

export async function listScanImports(page = 1, pageSize = 10) {
  const db = getDb();
  const pagination = getPagination({ page, pageSize });

  if (!db) {
    return {
      imports: buildPaginatedResult<ScanImportListItem>([], 0, pagination),
      summary: {
        totalImports: 0,
        totalFindings: 0,
        totalAssetsMapped: 0,
        averageProcessingTime: "0s",
      },
    };
  }

  const [totalRows, rows, summaryRows] = await Promise.all([
    db.select({ total: count(scanImports.id) }).from(scanImports),
    db
      .select({
        scanImport: scanImports,
        importedByName: profiles.fullName,
      })
      .from(scanImports)
      .leftJoin(profiles, eq(scanImports.importedBy, profiles.id))
      .orderBy(desc(scanImports.importDate))
      .limit(pagination.pageSize)
      .offset(pagination.offset),
    db.select().from(scanImports),
  ]);

  const totalProcessingTime = summaryRows.reduce(
    (sum, row) => sum + (row.processingTimeMs ?? 0),
    0
  );

  return {
    imports: buildPaginatedResult(
      rows.map(mapScanImportRow),
      totalRows[0]?.total ?? 0,
      pagination
    ),
    summary: {
      totalImports: summaryRows.length,
      totalFindings: summaryRows.reduce((sum, row) => sum + row.findingsFound, 0),
      totalAssetsMapped: summaryRows.reduce((sum, row) => sum + row.assetsFound, 0),
      averageProcessingTime: formatDuration(
        summaryRows.length ? Math.round(totalProcessingTime / summaryRows.length) : 0
      ),
    },
  };
}

export async function createScanImportRecord(
  input: z.input<typeof createScanImportRecordSchema>
) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Scan import writes are disabled until the database connection is configured."
    );
  }

  const parsed = createScanImportRecordSchema.safeParse(input);

  if (!parsed.success) {
    throw new AppError(
      "validation_error",
      "Please correct the scan import fields.",
      parsed.error.flatten().fieldErrors
    );
  }

  const [row] = await db
    .insert(scanImports)
    .values({
      ...parsed.data,
      fileSize: parsed.data.fileSize ?? null,
      importedBy: parsed.data.importedBy ?? null,
      status: "processing",
    })
    .returning();

  return row;
}
