import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Roles
 *
 * Reference table for RBAC roles. Permissions are stored as JSONB
 * for flexibility — normalize into a separate permissions table
 * only if RBAC becomes complex enough to warrant it.
 *
 * Expected seed data: "Super Admin", "SOC Analyst", "IT Manager",
 * "Auditor", "Viewer"
 */
export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull().unique(),
  description: text("description"),

  /**
   * Flexible permission map. Shape:
   * { "assets.read": true, "assets.write": true, "reports.export": false, ... }
   *
   * Queried infrequently (only on auth/middleware checks), so JSONB is fine.
   */
  permissions: jsonb("permissions")
    .notNull()
    .$type<Record<string, boolean>>()
    .default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
