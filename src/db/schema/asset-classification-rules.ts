import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { gabExposureTypeEnum } from "./enums";
import { organizations } from "./organizations";

export const assetClassificationRules = pgTable(
  "asset_classification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    field: text("field").notNull().default("hostname"),
    matchOperator: text("match_operator").notNull().default("contains"),
    matchValue: text("match_value").notNull(),
    gabExposureType: gabExposureTypeEnum("gab_exposure_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    unique("uq_asset_classification_rules_org_name").on(
      table.organizationId,
      table.name
    ),
    check(
      "chk_asset_classification_rules_field",
      sql`${table.field} in ('hostname', 'name', 'asset_code', 'branch', 'location')`
    ),
    check(
      "chk_asset_classification_rules_operator",
      sql`${table.matchOperator} = 'contains'`
    ),
    check("chk_asset_classification_rules_match_value", sql`length(trim(${table.matchValue})) > 0`),
    index("idx_asset_classification_rules_org_enabled_order").on(
      table.organizationId,
      table.enabled,
      table.sortOrder
    ),
  ]
);
