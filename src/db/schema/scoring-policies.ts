import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./profiles";

/**
 * Scoring Policies
 *
 * Configurable risk scoring weights. The actual scoring formula lives
 * in service logic (calculateRiskScore); this table stores the weights.
 *
 * Only one policy can be active at a time — enforced by a partial unique
 * index on (is_active) WHERE is_active = true. This makes it impossible
 * to have two active policies simultaneously at the DB level.
 *
 * Expected volume: 3-10 rows total (very small reference data).
 */
export const scoringPolicies = pgTable(
  "scoring_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(),

    /** Weight for CVE severity in risk calculation (0-100). */
    severityWeight: integer("severity_weight").notNull().default(30),

    /** Weight for exploit maturity / exploitability (0-100). */
    exploitabilityWeight: integer("exploitability_weight")
      .notNull()
      .default(25),

    /** Weight for asset criticality level (0-100). */
    assetCriticalityWeight: integer("asset_criticality_weight")
      .notNull()
      .default(25),

    /** Weight for asset exposure level (0-100). */
    exposureWeight: integer("exposure_weight").notNull().default(20),

    /** Only one policy should be active at a time (enforced by partial unique index). */
    isActive: boolean("is_active").notNull().default(false),

    /**
     * FK → profiles.id — who created/configured this policy.
     * onDelete: set null — policy survives even if creator is removed.
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
  },
  (table) => [
    /**
     * Partial unique index: only one row can have is_active = true.
     * If you try to INSERT or UPDATE a second row to is_active = true,
     * PostgreSQL will reject it with a unique constraint violation.
     *
     * This is the DB-level enforcement we agreed on with ChatGPT.
     */
    uniqueIndex("uq_scoring_policy_active")
      .on(table.isActive)
      .where(sql`${table.isActive} = true`),
  ]
);
