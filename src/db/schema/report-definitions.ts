import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { reportTypeEnum, reportStatusEnum } from "./enums";
import { profiles } from "./profiles";

/**
 * Report Definitions
 *
 * Stores report template configurations and schedules.
 * These are persistent configuration objects — not generated report instances.
 *
 * The config JSONB column holds report-specific parameters:
 *   - Filters (region, severity, date range)
 *   - Format preferences (sections to include, chart types)
 *   - Schedule configuration (used with Inngest cron)
 *
 * Generated report instances (PDFs, CSVs) are tracked in the
 * generated_reports table (defined early, implemented in Phase 6).
 */
export const reportDefinitions = pgTable("report_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  description: text("description"),

  type: reportTypeEnum("type").notNull(),

  /**
   * Schedule expression. Can be:
   *   - Cron expression: "0 8 * * 1" (every Monday at 8am)
   *   - Human-readable: "Weekly", "Monthly", "Quarterly"
   *   - null for on-demand reports
   */
  schedule: text("schedule"),

  /**
   * Report configuration parameters. Shape varies by report type.
   * Example: {
   *   regions: ["casablanca", "rabat"],
   *   severities: ["critical", "high"],
   *   dateRange: "last_30_days",
   *   includeSections: ["executive_summary", "risk_matrix", "remediation_status"],
   *   format: "pdf"
   * }
   */
  config: jsonb("config")
    .$type<Record<string, unknown>>()
    .default({}),

  status: reportStatusEnum("status").notNull().default("draft"),

  lastRunAt: timestamp("last_run_at", { withTimezone: true }),

  /**
   * FK → profiles.id — who created this report definition.
   * onDelete: set null — report definition survives creator removal.
   */
  createdBy: uuid("created_by").references(() => profiles.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});
