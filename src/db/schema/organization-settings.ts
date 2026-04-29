import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const organizationSettings = pgTable(
  "organization_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    operatingContext: jsonb("operating_context")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    slaCriticalDays: integer("sla_critical_days").notNull().default(7),
    slaHighDays: integer("sla_high_days").notNull().default(14),
    slaMediumDays: integer("sla_medium_days").notNull().default(30),
    slaLowDays: integer("sla_low_days").notNull().default(90),
    aiEnabled: boolean("ai_enabled").notNull().default(false),
    aiConsentAccepted: boolean("ai_consent_accepted").notNull().default(false),
    aiDataPolicy: text("ai_data_policy").notNull().default("minimal_evidence"),
    notifications: jsonb("notifications")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    scannerSettings: jsonb("scanner_settings")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [unique("uq_org_settings_org").on(table.organizationId)]
);
