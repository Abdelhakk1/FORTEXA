import "server-only";

import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, roles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPermissionsForRole,
  normalizeRoleName,
  type AppPermission,
  type AppRoleName,
} from "@/lib/permissions";

type ProfileRecord = typeof profiles.$inferSelect;
type RoleRecord = typeof roles.$inferSelect;

export type IdentityStatus =
  | "anonymous"
  | "authenticated"
  | "missing_profile"
  | "missing_role"
  | "disabled"
  | "suspended"
  | "db_unavailable";

export interface CurrentIdentity {
  user: User | null;
  profile: ProfileRecord | null;
  role: RoleRecord | null;
  roleName: AppRoleName | null;
  permissions: readonly AppPermission[];
  status: IdentityStatus;
  aal: string | null;
  nextAal: string | null;
}

async function getAssuranceLevel() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    return {
      aal: data?.currentLevel ?? null,
      nextAal: data?.nextLevel ?? null,
    };
  } catch {
    return {
      aal: null,
      nextAal: null,
    };
  }
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function getCurrentIdentity(): Promise<CurrentIdentity> {
  const user = await getCurrentUser();
  const assurance = await getAssuranceLevel();

  if (!user) {
    return {
      user: null,
      profile: null,
      role: null,
      roleName: null,
      permissions: [],
      status: "anonymous",
      ...assurance,
    };
  }

  const db = getDb();

  if (!db) {
    return {
      user,
      profile: null,
      role: null,
      roleName: null,
      permissions: [],
      status: "db_unavailable",
      ...assurance,
    };
  }

  const row = await db
    .select({
      profile: profiles,
      role: roles,
    })
    .from(profiles)
    .leftJoin(roles, eq(profiles.roleId, roles.id))
    .where(eq(profiles.id, user.id))
    .limit(1);

  const identityRow = row[0];

  if (!identityRow?.profile) {
    return {
      user,
      profile: null,
      role: null,
      roleName: null,
      permissions: [],
      status: "missing_profile",
      ...assurance,
    };
  }

  if (identityRow.profile.status === "disabled") {
    return {
      user,
      profile: identityRow.profile,
      role: identityRow.role ?? null,
      roleName: normalizeRoleName(identityRow.role?.name),
      permissions: [],
      status: "disabled",
      ...assurance,
    };
  }

  if (identityRow.profile.status === "suspended") {
    return {
      user,
      profile: identityRow.profile,
      role: identityRow.role ?? null,
      roleName: normalizeRoleName(identityRow.role?.name),
      permissions: [],
      status: "suspended",
      ...assurance,
    };
  }

  const roleName = normalizeRoleName(identityRow.role?.name);

  if (!roleName) {
    return {
      user,
      profile: identityRow.profile,
      role: identityRow.role ?? null,
      roleName: null,
      permissions: [],
      status: "missing_role",
      ...assurance,
    };
  }

  return {
    user,
    profile: identityRow.profile,
    role: identityRow.role!,
    roleName,
    permissions: getPermissionsForRole(roleName),
    status: "authenticated",
    ...assurance,
  };
}

export async function getCurrentProfile() {
  const identity = await getCurrentIdentity();
  return identity.profile;
}

export async function getCurrentRole() {
  const identity = await getCurrentIdentity();
  return identity.role;
}
