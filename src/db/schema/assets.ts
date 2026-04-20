import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import {
  assetTypeEnum,
  assetStatusEnum,
  assetCriticalityEnum,
  exposureLevelEnum,
} from "./enums";
import { regions } from "./regions";
import { profiles } from "./profiles";

/**
 * Assets
 *
 * Central asset inventory — the backbone of Fortexa.
 * Every vulnerability, scan finding, alert, and remediation task
 * ultimately relates to an asset.
 *
 * DESIGN NOTE: vulnerability_count, max_severity, contextual_priority,
 * and risk_score are NOT stored here. They are computed aggregates
 * from asset_vulnerabilities, calculated at query time or cached
 * via Inngest background jobs for performance at scale.
 *
 * Soft-delete strategy: set status to 'decommissioned'.
 * Historical vulnerability data still references the asset.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Business identifier, e.g. "ATM-001". Must be unique. */
    assetCode: text("asset_code").notNull().unique(),
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull(),

    model: text("model"),
    manufacturer: text("manufacturer"),
    branch: text("branch"),

    /**
     * FK → regions.id
     * onDelete: restrict — cannot delete a region with associated assets.
     */
    regionId: uuid("region_id").references(() => regions.id, {
      onDelete: "restrict",
    }),

    location: text("location"),
    ipAddress: text("ip_address"),
    osVersion: text("os_version"),

    criticality: assetCriticalityEnum("criticality")
      .notNull()
      .default("medium"),
    exposureLevel: exposureLevelEnum("exposure_level")
      .notNull()
      .default("internal"),
    status: assetStatusEnum("status").notNull().default("active"),

    /**
     * FK → profiles.id
     * onDelete: set null — if the owner is disabled/deleted, the asset
     * remains but becomes unowned.
     */
    ownerId: uuid("owner_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    lastScanDate: timestamp("last_scan_date", { withTimezone: true }),

    /**
     * Extensible metadata for fields that don't warrant their own column.
     * Example: { "firmware_version": "3.2.1", "enclosure_type": "indoor" }
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    // ─── Operational indexes ──────────────────────────────────────────
    index("idx_assets_region").on(table.regionId),
    index("idx_assets_type").on(table.type),
    index("idx_assets_status").on(table.status),
    index("idx_assets_criticality").on(table.criticality),
    index("idx_assets_ip").on(table.ipAddress),
    index("idx_assets_owner").on(table.ownerId),
  ]
);
