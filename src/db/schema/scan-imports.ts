import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { importStatusEnum, scannerSourceEnum } from "./enums";
import { profiles } from "./profiles";

/**
 * Scan Imports
 *
 * Tracks scan file upload and processing sessions.
 * Each row represents one imported scan file and its processing results.
 *
 * Lifecycle:
 *   1. User uploads file → row created with status = 'processing'
 *   2. Inngest job parses file → creates scan_findings rows
 *   3. Job completes → status updated to 'completed'/'failed'/'partial'
 *   4. Summary counters updated (assets_found, findings_found, etc.)
 *
 * Never delete — audit trail for scan history.
 */
export const scanImports = pgTable(
  "scan_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(),
    scannerSource: scannerSourceEnum("scanner_source").notNull(),
    importDate: timestamp("import_date", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * FK → profiles.id — who imported this scan.
     * onDelete: set null — import record survives even if user is removed.
     */
    importedBy: uuid("imported_by").references(() => profiles.id, {
      onDelete: "set null",
    }),

    fileName: text("file_name").notNull(),

    /** File size in bytes. Bigint handles files up to ~9.2 exabytes. */
    fileSize: bigint("file_size", { mode: "number" }),

    /** Supabase Storage path, e.g. "scans/2024/01/scan-file.nessus" */
    storagePath: text("storage_path"),

    status: importStatusEnum("status").notNull().default("processing"),

    // ─── Summary counters (populated after processing) ───────────────
    assetsFound: integer("assets_found").notNull().default(0),
    findingsFound: integer("findings_found").notNull().default(0),
    cvesLinked: integer("cves_linked").notNull().default(0),
    newAssets: integer("new_assets").notNull().default(0),
    matchedAssets: integer("matched_assets").notNull().default(0),
    newFindings: integer("new_findings").notNull().default(0),
    fixedFindings: integer("fixed_findings").notNull().default(0),
    reopenedFindings: integer("reopened_findings").notNull().default(0),
    unchangedFindings: integer("unchanged_findings").notNull().default(0),
    lowConfidenceMatches: integer("low_confidence_matches").notNull().default(0),
    newVulnerabilities: integer("new_vulnerabilities").notNull().default(0),
    closedVulnerabilities: integer("closed_vulnerabilities")
      .notNull()
      .default(0),
    errors: integer("errors").notNull().default(0),
    warnings: integer("warnings").notNull().default(0),

    /**
     * Processing duration in milliseconds.
     * Convert to human-readable format in the presentation layer.
     * Stored as integer for sorting, charting, and threshold comparisons.
     */
    processingTimeMs: integer("processing_time_ms"),

    /**
     * Unstructured error details from the processing pipeline.
     * Only populated when status is 'failed' or 'partial'.
     */
    errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // ─── Operational indexes (imports history list page) ───────────────
    index("idx_imports_status").on(table.status),
    index("idx_imports_date").on(table.importDate),
    index("idx_imports_user").on(table.importedBy),
  ]
);
