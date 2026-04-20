import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Regions
 *
 * Small reference table for geographic regions.
 * Expected seed data: Algerian banking regions (~7-12 rows).
 * Both name and code are unique — no duplicates allowed.
 */
export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
