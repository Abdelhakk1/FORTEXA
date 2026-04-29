import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    companyType: text("company_type").notNull().default("other"),
    defaultRegion: text("default_region"),
    defaultCountry: text("default_country"),
    timezone: text("timezone").notNull().default("UTC"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    onboardingStep: text("onboarding_step").notNull().default("organization"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index("idx_organizations_onboarding").on(table.onboardingCompleted),
  ]
);
