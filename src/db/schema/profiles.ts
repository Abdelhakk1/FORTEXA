import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { roles } from "./roles";
import { userStatusEnum } from "./enums";

/**
 * Profiles
 *
 * Extends Supabase Auth users (auth.users) with application-specific data.
 * The `id` column references auth.users.id — it is NOT auto-generated.
 *
 * A database trigger (see migration SQL) auto-creates a profile row
 * when a new user signs up via Supabase Auth.
 *
 * Soft-delete strategy: set status to 'disabled'. Never hard-delete
 * because audit_logs and remediation_tasks reference this table.
 */
export const profiles = pgTable("profiles", {
  /**
   * PK — matches auth.users.id exactly.
   * onDelete: cascade — if the auth user is deleted, the profile goes too.
   * In practice you should rarely delete auth users; use status = 'disabled'.
   */
  id: uuid("id").primaryKey(),

  fullName: text("full_name").notNull(),

  /**
   * Intentional copy of auth.users.email for query convenience.
   * Source of truth: auth.users. Synced by the on_auth_user_created trigger
   * (and should be synced on email change via a Supabase Auth hook).
   * Stored here to avoid joining auth.users on every profile query.
   */
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),

  /**
   * FK → roles.id
   * onDelete: restrict — cannot delete a role that has users assigned to it.
   * Nullable during initial signup; assigned by admin afterward.
   */
  roleId: uuid("role_id").references(() => roles.id, {
    onDelete: "restrict",
  }),

  status: userStatusEnum("status").notNull().default("active"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
});
