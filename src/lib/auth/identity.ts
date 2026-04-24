import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, roles } from "@/db/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getPermissionsForRole,
  normalizeRoleName,
  type AppPermission,
  type AppRoleName,
} from "@/lib/permissions";

type ProfileRecord = typeof profiles.$inferSelect;
type RoleRecord = typeof roles.$inferSelect;

type AdminIdentityRow = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role_id: string | null;
  status: ProfileRecord["status"];
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
  roles: null | {
    id: string;
    name: string;
    description: string | null;
    permissions: Record<string, boolean>;
    created_at: string;
  };
};

export type IdentityStatus =
  | "anonymous"
  | "authenticated"
  | "missing_profile"
  | "missing_role"
  | "disabled"
  | "suspended"
  | "db_unavailable";

export interface VerifiedAuthUser {
  id: string;
  email: string | null;
}

export interface CurrentIdentity {
  user: VerifiedAuthUser | null;
  profile: ProfileRecord | null;
  role: RoleRecord | null;
  roleName: AppRoleName | null;
  permissions: readonly AppPermission[];
  status: IdentityStatus;
  aal: string | null;
  nextAal: string | null;
}

const getAssuranceLevel = cache(async function getAssuranceLevel() {
  return {
    aal: null,
    nextAal: null,
  };
});

function readStringClaim(
  claims: Record<string, unknown>,
  key: string
): string | null {
  const value = claims[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export const getCurrentUser = cache(async function getCurrentUser() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error || !data?.claims?.sub) {
      return null;
    }

    const claims = data.claims as Record<string, unknown>;

    return {
      id: data.claims.sub,
      email: readStringClaim(claims, "email"),
    } satisfies VerifiedAuthUser;
  } catch {
    return null;
  }
});

function mapAdminIdentityRow(row: AdminIdentityRow) {
  return {
    profile: {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      roleId: row.role_id,
      status: row.status,
      mfaEnabled: row.mfa_enabled,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    } satisfies ProfileRecord,
    role: row.roles
      ? ({
          id: row.roles.id,
          name: row.roles.name,
          description: row.roles.description,
          permissions: row.roles.permissions,
          createdAt: new Date(row.roles.created_at),
        } satisfies RoleRecord)
      : null,
  };
}

const getIdentityRow = cache(async function getIdentityRow(userId: string) {
  const db = getDb();

  if (db) {
    try {
      const rows = await db
        .select({
          profile: profiles,
          role: roles,
        })
        .from(profiles)
        .leftJoin(roles, eq(profiles.roleId, roles.id))
        .where(eq(profiles.id, userId))
        .limit(1);

      return rows[0] ?? null;
    } catch {
      // Fall through to the Supabase admin client when raw Postgres is unreachable.
    }
  }

  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, avatar_url, role_id, status, mfa_enabled, created_at, updated_at, roles(id, name, description, permissions, created_at)"
    )
    .eq("id", userId)
    .maybeSingle<AdminIdentityRow>();

  if (error || !data) {
    return null;
  }

  return mapAdminIdentityRow(data);
});

export const getCurrentIdentity = cache(async function getCurrentIdentity(): Promise<CurrentIdentity> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      role: null,
      roleName: null,
      permissions: [],
      status: "anonymous",
      aal: null,
      nextAal: null,
    };
  }

  const [assurance, identityRow] = await Promise.all([
    getAssuranceLevel(),
    getIdentityRow(user.id),
  ]);

  if (!identityRow) {
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
});

export async function getCurrentProfile() {
  const identity = await getCurrentIdentity();
  return identity.profile;
}

export async function getCurrentRole() {
  const identity = await getCurrentIdentity();
  return identity.role;
}
