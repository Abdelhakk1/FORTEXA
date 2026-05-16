import {
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
import { organizations } from "./organizations";

export const gabCidtTemplates = pgTable(
  "gab_cidt_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    label: text("label").notNull(),
    cidtConfidentiality: integer("cidt_confidentiality").notNull().default(3),
    cidtIntegrity: integer("cidt_integrity").notNull().default(3),
    cidtAvailability: integer("cidt_availability").notNull().default(3),
    cidtTraceability: integer("cidt_traceability").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    unique("uq_gab_cidt_templates_org_key").on(
      table.organizationId,
      table.templateKey
    ),
    check(
      "chk_gab_cidt_templates_key",
      sql`${table.templateKey} in ('indoor_agency', 'outdoor_agency', 'outdoor_public_commercial')`
    ),
    check(
      "chk_gab_cidt_templates_cidt_range",
      sql`${table.cidtConfidentiality} between 1 and 4
        and ${table.cidtIntegrity} between 1 and 4
        and ${table.cidtAvailability} between 1 and 4
        and ${table.cidtTraceability} between 1 and 4`
    ),
    index("idx_gab_cidt_templates_org").on(table.organizationId),
  ]
);
