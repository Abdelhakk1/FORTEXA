import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  assetTypeEnum,
  assetStatusEnum,
  assetCriticalityEnum,
  exposureLevelEnum,
  gabExposureTypeEnum,
} from "./enums";
import { regions } from "./regions";
import { profiles } from "./profiles";
import { organizations } from "./organizations";
import { businessApplications } from "./business-applications";

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
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Business identifier, e.g. "ATM-001". Unique within a workspace. */
    assetCode: text("asset_code").notNull(),
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
    gabExposureType: gabExposureTypeEnum("gab_exposure_type")
      .notNull()
      .default("unknown"),
    cidtOverrideEnabled: boolean("cidt_override_enabled").notNull().default(false),
    cidtConfidentiality: integer("cidt_confidentiality"),
    cidtIntegrity: integer("cidt_integrity"),
    cidtAvailability: integer("cidt_availability"),
    cidtTraceability: integer("cidt_traceability"),
    businessApplicationId: uuid("business_application_id").references(
      () => businessApplications.id,
      { onDelete: "set null" }
    ),
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
    unique("uq_assets_org_asset_code").on(table.organizationId, table.assetCode),
    check(
      "chk_assets_cidt_range",
      sql`(${table.cidtConfidentiality} is null or ${table.cidtConfidentiality} between 1 and 4)
        and (${table.cidtIntegrity} is null or ${table.cidtIntegrity} between 1 and 4)
        and (${table.cidtAvailability} is null or ${table.cidtAvailability} between 1 and 4)
        and (${table.cidtTraceability} is null or ${table.cidtTraceability} between 1 and 4)`
    ),
    index("idx_assets_org").on(table.organizationId),
    index("idx_assets_org_asset_code").on(table.organizationId, table.assetCode),
    index("idx_assets_org_gab_exposure").on(table.organizationId, table.gabExposureType),
    index("idx_assets_org_cidt_override").on(
      table.organizationId,
      table.cidtOverrideEnabled
    ),
    index("idx_assets_business_application").on(table.businessApplicationId),
    index("idx_assets_org_ip_not_null")
      .on(table.organizationId, table.ipAddress)
      .where(sql`${table.ipAddress} is not null`),
    index("idx_assets_region").on(table.regionId),
    index("idx_assets_type").on(table.type),
    index("idx_assets_status").on(table.status),
    index("idx_assets_criticality").on(table.criticality),
    index("idx_assets_ip").on(table.ipAddress),
    index("idx_assets_owner").on(table.ownerId),
  ]
);
