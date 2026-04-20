import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  remediationStatusEnum,
  severityEnum,
  businessPriorityEnum,
  slaStatusEnum,
} from "./enums";
import { assetVulnerabilities } from "./asset-vulnerabilities";
import { cves } from "./cves";
import { profiles } from "./profiles";

/**
 * Remediation Tasks
 *
 * Work items for vulnerability remediation. Links to either a specific
 * asset_vulnerability (individual remediation) OR a cve (bulk remediation
 * across many assets). At least one must be set — enforced by CHECK constraint.
 *
 * Soft-delete strategy: set status to 'closed'. Never hard-delete —
 * historical tracking and audit trail required.
 */
export const remediationTasks = pgTable(
  "remediation_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    title: text("title").notNull(),
    description: text("description"),

    /**
     * FK → asset_vulnerabilities.id — for individual remediation of one
     * asset-CVE pair. Nullable when the task targets a CVE across all assets.
     * onDelete: set null — if the AV record is closed/removed, the task
     * remains for historical tracking.
     */
    assetVulnerabilityId: uuid("asset_vulnerability_id").references(
      () => assetVulnerabilities.id,
      { onDelete: "set null" }
    ),

    /**
     * FK → cves.id — for bulk remediation across many assets.
     * Nullable when the task targets a specific asset-vulnerability.
     * onDelete: restrict — cannot delete a CVE with active remediation tasks.
     */
    cveId: uuid("cve_id").references(() => cves.id, {
      onDelete: "restrict",
    }),

    /**
     * FK → profiles.id — who is assigned to this task.
     * onDelete: set null — task survives if assignee is removed.
     */
    assignedTo: uuid("assigned_to").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /**
     * FK → profiles.id — who created this task.
     * onDelete: restrict — cannot delete a user who created tasks.
     * Users should be soft-deleted (status = 'disabled'), not hard-deleted.
     * This is intentionally non-nullable + restrict: every task must have
     * a traceable creator for audit compliance.
     */
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),

    dueDate: timestamp("due_date", { withTimezone: true }),
    slaStatus: slaStatusEnum("sla_status").notNull().default("on_track"),

    status: remediationStatusEnum("status").notNull().default("open"),
    priority: severityEnum("priority").notNull().default("medium"),
    businessPriority: businessPriorityEnum("business_priority")
      .notNull()
      .default("p3"),

    /** Completion percentage 0-100. */
    progress: integer("progress").notNull().default(0),

    notes: text("notes"),

    /** Optional external change request reference, e.g. "CR-7821". */
    changeRequest: text("change_request"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    /**
     * CHECK: At least one target must be set.
     * A remediation task must link to either a specific asset-vulnerability
     * or a CVE (for bulk remediation). Both being null is invalid.
     */
    check(
      "chk_remediation_has_target",
      sql`${table.assetVulnerabilityId} IS NOT NULL OR ${table.cveId} IS NOT NULL`
    ),

    // ─── Operational indexes ──────────────────────────────────────────
    index("idx_rem_status").on(table.status),
    index("idx_rem_assigned").on(table.assignedTo),
    index("idx_rem_due").on(table.dueDate),
    index("idx_rem_priority").on(table.priority),
  ]
);
