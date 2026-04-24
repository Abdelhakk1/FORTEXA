import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

/**
 * Audit Logs
 *
 * Tracks all significant actions for compliance and auditing.
 * Banking compliance requires full write-operation traceability.
 *
 * CRITICAL RULES:
 *   1. APPEND-ONLY — enforced by a database trigger that blocks
 *      UPDATE and DELETE operations (see migration SQL below).
 *   2. Consider partitioning by created_at if the table grows large
 *      (PostgreSQL native partitioning).
 *   3. The details JSONB column should contain before/after diffs
 *      for mutation operations.
 *
 * APPEND-ONLY ENFORCEMENT (apply in migration):
 * ```sql
 * CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   RAISE EXCEPTION 'audit_logs is append-only: UPDATE and DELETE are prohibited';
 *   RETURN NULL;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER trg_audit_logs_immutable
 *   BEFORE UPDATE OR DELETE ON audit_logs
 *   FOR EACH ROW
 *   EXECUTE FUNCTION prevent_audit_log_modification();
 * ```
 *
 * Implementation: Use a Drizzle middleware/wrapper or Next.js server
 * action helper to log all write operations automatically.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * FK → profiles.id — who performed the action.
     * Nullable for system-generated actions (cron jobs, Inngest workers).
     * onDelete: set null — audit log survives user removal. The action
     * still happened; we just lose the link to who did it.
     */
    userId: uuid("user_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /**
     * Dot-notated action identifier.
     * Convention: {resource}.{verb}
     * Examples: "asset.created", "remediation_task.status_changed",
     *           "scan_import.uploaded", "cve_enrichment.regenerated"
     */
    action: text("action").notNull(),

    /** The type of resource affected, e.g. "asset", "cve", "alert". */
    resourceType: text("resource_type").notNull(),

    /** Resource identifier. UUIDs are common, but import and system events may use stable text IDs. */
    resourceId: text("resource_id").notNull(),

    /**
     * Flexible payload for additional context.
     * For mutations: { before: {...}, after: {...} }
     * For reads/exports: { filters: {...}, resultCount: N }
     * For auth events: { method: "password", mfaUsed: true }
     */
    details: jsonb("details").$type<Record<string, unknown>>(),

    /** Client IP address for security audit. */
    ipAddress: text("ip_address"),

    /** Client user agent string for security audit. */
    userAgent: text("user_agent"),

    /** Append-only — no updatedAt column by design. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // ─── Operational indexes ──────────────────────────────────────────
    index("idx_audit_user").on(table.userId),
    index("idx_audit_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_action").on(table.action),
    index("idx_audit_created").on(table.createdAt),
  ]
);
