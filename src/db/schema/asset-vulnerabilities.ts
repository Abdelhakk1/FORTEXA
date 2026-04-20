import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  vulnerabilityStatusEnum,
  businessPriorityEnum,
  slaStatusEnum,
} from "./enums";
import { assets } from "./assets";
import { cves } from "./cves";
import { scoringPolicies } from "./scoring-policies";
import { scanImports } from "./scan-imports";

/**
 * Asset Vulnerabilities
 *
 * THE MOST IMPORTANT TABLE IN FORTEXA.
 *
 * Tracks that a specific asset is affected by a specific CVE,
 * with contextual risk data. This is the rich many-to-many junction
 * between assets and CVEs — not a thin junction, but a first-class
 * entity with its own lifecycle, state, and business logic.
 *
 * The same CVE-2021-34527 has different urgency on:
 *   ATM-001 (critical, internet-facing, risk=92)
 *   ATM-006 (medium, internal, risk=45)
 *
 * Without this table, Fortexa is just a CVE database.
 * With it, Fortexa is a vulnerability management platform.
 *
 * Soft-delete strategy: use status = 'closed'. Never hard-delete —
 * lifecycle tracking requires full history.
 */
export const assetVulnerabilities = pgTable(
  "asset_vulnerabilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * FK → assets.id
     * onDelete: restrict — cannot delete an asset that has vulnerability records.
     * The asset should be set to 'decommissioned' status instead.
     */
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),

    /**
     * FK → cves.id
     * onDelete: restrict — cannot delete a CVE that has asset associations.
     * CVEs should never be deleted anyway.
     */
    cveId: uuid("cve_id")
      .notNull()
      .references(() => cves.id, { onDelete: "restrict" }),

    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),

    status: vulnerabilityStatusEnum("status").notNull().default("open"),
    businessPriority: businessPriorityEnum("business_priority")
      .notNull()
      .default("p3"),

    /**
     * Contextual risk score (0-100). Computed by the scoring engine
     * using the active scoring policy's weights + asset/CVE attributes.
     * Stored here for fast querying and filtering.
     */
    riskScore: integer("risk_score").notNull().default(0),

    slaDue: timestamp("sla_due", { withTimezone: true }),
    slaStatus: slaStatusEnum("sla_status").notNull().default("on_track"),

    /**
     * FK → scoring_policies.id — which policy was used to compute the risk score.
     * Nullable because early records may not have a policy associated.
     * onDelete: set null — if a policy is deleted, the score remains
     * but loses its policy reference (will be re-scored with current policy).
     */
    scoringPolicyId: uuid("scoring_policy_id").references(
      () => scoringPolicies.id,
      { onDelete: "set null" }
    ),

    /**
     * FK → scan_imports.id — which import first discovered this AV.
     * Nullable for manually created records.
     * onDelete: set null — if a scan import is deleted (rare), the AV
     * survives but loses traceability to its discovery source.
     */
    sourceScanImportId: uuid("source_scan_import_id").references(
      () => scanImports.id,
      { onDelete: "set null" }
    ),

    notes: text("notes"),

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
     * Composite unique constraint: one record per asset-CVE pair.
     * This is the fundamental invariant of the vulnerability tracking model.
     */
    unique("uq_asset_vulnerability").on(table.assetId, table.cveId),

    // ─── Operational indexes ──────────────────────────────────────────
    index("idx_av_asset").on(table.assetId),
    index("idx_av_cve").on(table.cveId),
    index("idx_av_status").on(table.status),
    index("idx_av_risk").on(table.riskScore),
    index("idx_av_priority").on(table.businessPriority),
    index("idx_av_sla_status").on(table.slaStatus),

    /**
     * Partial index: only index sla_due for open vulnerabilities.
     * Used by the SLA breach detection Inngest job and dashboard filters.
     */
    index("idx_av_sla_open")
      .on(table.slaDue)
      .where(sql`${table.status} = 'open'`),
  ]
);
