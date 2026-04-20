import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import {
  severityEnum,
  scanFindingStatusEnum,
  findingMatchMethodEnum,
} from "./enums";
import { scanImports } from "./scan-imports";
import { assets } from "./assets";
import { cves } from "./cves";

/**
 * Scan Findings
 *
 * Raw, parsed findings from scan files before/after correlation.
 * Each row is one scanner observation — a specific plugin hit on a
 * specific host:port from a specific scan import.
 *
 * Lifecycle:
 *   1. Parser creates findings with status = 'pending'
 *   2. Matching engine resolves host → asset (matched_asset_id)
 *   3. CVE mapper resolves finding → CVE (matched_cve_id)
 *   4. Correlation engine creates/updates asset_vulnerabilities
 *   5. Status updated to 'matched' / 'unmatched' / 'ignored'
 *
 * DESIGN NOTE: The class diagram had a separate FindingCVE junction table.
 * We merge that into matched_cve_id here because a finding typically maps
 * to zero or one CVE. If many-to-many is needed later, add a junction table.
 *
 * Treat findings as IMMUTABLE after creation. Never update the raw data fields.
 * Hard-delete after retention period (12-24 months) via Inngest cron job.
 */
export const scanFindings = pgTable(
  "scan_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * FK → scan_imports.id
     * onDelete: cascade — if the scan import is deleted (rare, admin-only),
     * all its findings go with it.
     */
    scanImportId: uuid("scan_import_id")
      .notNull()
      .references(() => scanImports.id, { onDelete: "cascade" }),

    /** Scanner's internal plugin/check ID, e.g. "nessus-12345". */
    findingCode: text("finding_code"),
    title: text("title").notNull(),
    severity: severityEnum("severity").notNull(),

    /** IP or hostname exactly as found in the scan output. */
    host: text("host").notNull(),
    port: integer("port"),
    protocol: text("protocol"),

    /** Original scanner output snippet for traceability. */
    rawEvidence: text("raw_evidence"),

    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // ─── Matching results (populated by correlation engine) ───────────

    /**
     * FK → assets.id — resolved asset.
     * Nullable because unmatched findings have no asset yet.
     * onDelete: set null — if the asset is removed, the finding remains
     * but loses its match (can be rematched or ignored).
     */
    matchedAssetId: uuid("matched_asset_id").references(() => assets.id, {
      onDelete: "set null",
    }),

    /**
     * FK → cves.id — resolved CVE.
     * Nullable because not all findings map to a known CVE.
     * onDelete: set null — same rationale as matched_asset_id.
     */
    matchedCveId: uuid("matched_cve_id").references(() => cves.id, {
      onDelete: "set null",
    }),

    /** 0-100 confidence in the match quality. */
    matchConfidence: integer("match_confidence"),

    /** How the match was determined. */
    matchMethod: findingMatchMethodEnum("match_method"),

    matchNotes: text("match_notes"),

    status: scanFindingStatusEnum("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // ─── Operational indexes ──────────────────────────────────────────
    index("idx_findings_import").on(table.scanImportId),
    index("idx_findings_status").on(table.status),
    index("idx_findings_asset").on(table.matchedAssetId),
    index("idx_findings_cve").on(table.matchedCveId),
    index("idx_findings_host").on(table.host),
  ]
);
