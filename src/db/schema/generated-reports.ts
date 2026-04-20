import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { reportFormatEnum } from "./enums";
import { reportDefinitions } from "./report-definitions";
import { profiles } from "./profiles";

/**
 * Generated Reports (Late Tier 2 — defined early, implemented in Phase 6)
 *
 * Tracks generated report instances (PDF exports, scheduled runs).
 * Each row is one run/export of a report definition.
 *
 * MVP approach: Include the table definition in the schema from day one
 * so migrations exist, but defer CRUD actions, RLS policies, and Inngest
 * jobs until Phase 6. On-the-fly PDF generation covers early usage.
 *
 * This table becomes critical when implementing:
 *   - Scheduled reports via Inngest cron
 *   - Report history with download links
 *   - Audit trail for report generation
 */
export const generatedReports = pgTable("generated_reports", {
  id: uuid("id").primaryKey().defaultRandom(),

  /**
   * FK → report_definitions.id — which template produced this report.
   * onDelete: cascade — if the definition is deleted, its generated
   * instances are meaningless.
   */
  reportDefinitionId: uuid("report_definition_id")
    .notNull()
    .references(() => reportDefinitions.id, { onDelete: "cascade" }),

  /**
   * FK → profiles.id — who triggered the generation.
   * Null for scheduled/automated runs.
   * onDelete: set null — generated report survives user removal.
   */
  generatedBy: uuid("generated_by").references(() => profiles.id, {
    onDelete: "set null",
  }),

  /** Supabase Storage path, e.g. "reports/2024/01/compliance-report.pdf" */
  storagePath: text("storage_path").notNull(),

  fileFormat: reportFormatEnum("file_format").notNull(),

  /**
   * Snapshot of the filters/parameters used for this specific generation.
   * Preserved here because the report_definition config may change over time,
   * but the generated output is immutable.
   */
  parameters: jsonb("parameters").$type<Record<string, unknown>>(),

  generatedAt: timestamp("generated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
