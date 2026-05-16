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
import { organizations } from "./organizations";

export const businessApplications = pgTable(
  "business_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull().default("monetique"),
    label: text("label").notNull().default("ATM Payment Services"),
    cidtConfidentiality: integer("cidt_confidentiality").notNull().default(4),
    cidtIntegrity: integer("cidt_integrity").notNull().default(4),
    cidtAvailability: integer("cidt_availability").notNull().default(4),
    cidtTraceability: integer("cidt_traceability").notNull().default(4),
    isInternetExposed: boolean("is_internet_exposed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    unique("uq_business_applications_org_key").on(table.organizationId, table.key),
    check("chk_business_applications_single_key", sql`${table.key} = 'monetique'`),
    check(
      "chk_business_applications_cidt_range",
      sql`${table.cidtConfidentiality} between 1 and 4
        and ${table.cidtIntegrity} between 1 and 4
        and ${table.cidtAvailability} between 1 and 4
        and ${table.cidtTraceability} between 1 and 4`
    ),
    index("idx_business_applications_org").on(table.organizationId),
  ]
);
