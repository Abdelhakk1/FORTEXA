import {
  pgTable,
  uuid,
  text,
  decimal,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { severityEnum, exploitMaturityEnum } from "./enums";

/**
 * CVEs
 *
 * CVE knowledge base — stores vulnerability intelligence independent
 * of which assets are affected. A CVE is a universal identifier.
 *
 * DESIGN NOTE: This table contains FACTUAL, EXTERNAL data from NVD/CISA/vendors.
 * Internal analysis and AI-generated insights belong in cve_enrichments.
 * Asset-level tracking (status, SLA, risk score) belongs in asset_vulnerabilities.
 *
 * The frontend Vulnerability type conflates CVE data with asset-level data.
 * That conflation must NOT carry into the database.
 *     CVE = knowledge.
 *     AssetVulnerability = instance.
 *
 * Never delete CVE rows — CVE data is permanent public knowledge.
 */
export const cves = pgTable("cves", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** Standard CVE identifier, e.g. "CVE-2021-34527". Globally unique. */
  cveId: text("cve_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),

  severity: severityEnum("severity").notNull(),
  cvssScore: decimal("cvss_score", { precision: 3, scale: 1 }),
  cvssVector: text("cvss_vector"),

  exploitMaturity: exploitMaturityEnum("exploit_maturity")
    .notNull()
    .default("none"),
  patchAvailable: boolean("patch_available").notNull().default(false),

  /**
   * List of affected products/platforms. Stored as JSONB (simple string array)
   * rather than a normalized table — this is display data, not relational.
   */
  affectedProducts: jsonb("affected_products")
    .$type<string[]>()
    .default([]),

  publishedDate: timestamp("published_date", { withTimezone: true }),
  lastModifiedDate: timestamp("last_modified_date", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});
