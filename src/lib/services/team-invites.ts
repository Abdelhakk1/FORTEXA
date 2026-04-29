import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  organizationInvites,
  organizationMembers,
  organizations,
  profiles,
  roles,
} from "@/db/schema";
import type { CurrentIdentity, VerifiedAuthUser } from "@/lib/auth/identity";
import type { ActiveOrganizationContext } from "@/lib/services/organizations";
import {
  ensureProfileForUser,
  getActiveOrganizationForUser,
} from "@/lib/services/organizations";
import { AppError } from "@/lib/errors";
import {
  SECOND_ORGANIZATION_MESSAGE,
  canManageOrganizationTeam,
  coerceInviteRole,
  createInviteToken,
  createTeamInviteSchema,
  getInviteAcceptanceError,
  getInviteDisplayStatus,
  hashInviteToken,
  teamInviteRoleLabels,
  type OrganizationInviteDisplayStatus,
  type TeamInviteRole,
} from "./team-invite-utils";

export {
  SECOND_ORGANIZATION_MESSAGE,
  buildInviteLink,
  canManageOrganizationTeam,
  createTeamInviteSchema,
  getInviteAcceptanceError,
  getInviteDisplayStatus,
  hashInviteToken,
  teamInviteRoleLabels,
  teamInviteRoleValues,
  type TeamInviteRole,
} from "./team-invite-utils";

export type OrganizationInviteRecord = typeof organizationInvites.$inferSelect;

const roleDescriptions: Record<TeamInviteRole, string> = {
  administrator: "Full Fortexa administrator",
  security_manager: "Security lead with settings and reporting access",
  security_analyst: "Security analyst with import and remediation access",
  remediation_owner: "Remediation owner with task execution access",
};

export interface OrganizationInviteListItem {
  id: string;
  email: string;
  role: TeamInviteRole;
  roleLabel: string;
  status: OrganizationInviteDisplayStatus;
  expiresAt: Date;
  createdAt: Date;
  lastSentAt: Date | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
}

export interface OrganizationInvitePreview {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: TeamInviteRole;
  roleLabel: string;
  status: OrganizationInviteDisplayStatus;
  expiresAt: Date;
}

export interface AcceptedOrganizationInvite {
  inviteId: string;
  organizationId: string;
  organizationName: string;
  profileId: string;
  role: TeamInviteRole;
}

export function assertCanManageOrganizationTeam(
  identity: CurrentIdentity,
  active: ActiveOrganizationContext
) {
  if (
    !canManageOrganizationTeam({
      membershipRole: active.membership.role,
      permissions: identity.permissions,
    })
  ) {
    throw new AppError(
      "forbidden",
      "You do not have permission to manage team invites."
    );
  }
}

function mapInviteRow(row: {
  invite: OrganizationInviteRecord;
  invitedByName: string | null;
  invitedByEmail: string | null;
}): OrganizationInviteListItem {
  const role = coerceInviteRole(row.invite.role);

  return {
    id: row.invite.id,
    email: row.invite.email,
    role,
    roleLabel: teamInviteRoleLabels[role],
    status: getInviteDisplayStatus(row.invite),
    expiresAt: row.invite.expiresAt,
    createdAt: row.invite.createdAt,
    lastSentAt: row.invite.lastSentAt,
    invitedByName: row.invitedByName,
    invitedByEmail: row.invitedByEmail,
  };
}

function mapInvitePreview(row: {
  invite: OrganizationInviteRecord;
  organizationName: string;
}): OrganizationInvitePreview {
  const role = coerceInviteRole(row.invite.role);

  return {
    id: row.invite.id,
    organizationId: row.invite.organizationId,
    organizationName: row.organizationName,
    email: row.invite.email,
    role,
    roleLabel: teamInviteRoleLabels[role],
    status: getInviteDisplayStatus(row.invite),
    expiresAt: row.invite.expiresAt,
  };
}

function getInviteExpiration(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

async function ensureAppRole(roleName: TeamInviteRole) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [existing] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(roles)
    .values({
      name: roleName,
      description: roleDescriptions[roleName],
      permissions: {},
    })
    .returning();

  return created;
}

async function findActiveMemberByEmail(organizationId: string, email: string) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [member] = await db
    .select({
      membership: organizationMembers,
      profile: profiles,
    })
    .from(organizationMembers)
    .innerJoin(profiles, eq(organizationMembers.profileId, profiles.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
        sql`lower(${profiles.email}) = ${email.trim().toLowerCase()}`
      )
    )
    .limit(1);

  return member ?? null;
}

export async function listOrganizationInvites(organizationId: string) {
  const db = getDb();

  if (!db) {
    return [] as OrganizationInviteListItem[];
  }

  const rows = await db
    .select({
      invite: organizationInvites,
      invitedByName: profiles.fullName,
      invitedByEmail: profiles.email,
    })
    .from(organizationInvites)
    .leftJoin(profiles, eq(organizationInvites.invitedBy, profiles.id))
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        eq(organizationInvites.status, "pending")
      )
    )
    .orderBy(desc(organizationInvites.createdAt))
    .limit(25);

  return rows.map(mapInviteRow);
}

export async function createOrganizationInvite(input: {
  organizationId: string;
  email: string;
  role: TeamInviteRole;
  invitedBy: string | null;
}) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const parsed = createTeamInviteSchema.parse(input);
  const existingMember = await findActiveMemberByEmail(
    input.organizationId,
    parsed.email
  );

  if (existingMember) {
    throw new AppError(
      "validation_error",
      "That teammate is already an active member of this organization.",
      { email: ["This teammate is already a member."] }
    );
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = getInviteExpiration();

  const [existingInvite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, input.organizationId),
        eq(organizationInvites.status, "pending"),
        sql`lower(${organizationInvites.email}) = ${parsed.email}`
      )
    )
    .orderBy(desc(organizationInvites.createdAt))
    .limit(1);

  if (existingInvite) {
    const [updated] = await db
      .update(organizationInvites)
      .set({
        role: parsed.role,
        tokenHash,
        invitedBy: input.invitedBy,
        emailMessageId: null,
        expiresAt,
        lastSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(organizationInvites.id, existingInvite.id))
      .returning();

    return {
      invite: updated,
      token,
      duplicateRenewed: true,
    };
  }

  const [created] = await db
    .insert(organizationInvites)
    .values({
      organizationId: input.organizationId,
      email: parsed.email,
      role: parsed.role,
      tokenHash,
      status: "pending",
      invitedBy: input.invitedBy,
      expiresAt,
    })
    .returning();

  return {
    invite: created,
    token,
    duplicateRenewed: false,
  };
}

export async function refreshOrganizationInvite(input: {
  organizationId: string;
  inviteId: string;
}) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, input.organizationId),
        eq(organizationInvites.id, input.inviteId),
        eq(organizationInvites.status, "pending")
      )
    )
    .limit(1);

  if (!invite) {
    throw new AppError("not_found", "Pending invite not found.");
  }

  const existingMember = await findActiveMemberByEmail(
    input.organizationId,
    invite.email
  );

  if (existingMember) {
    throw new AppError(
      "validation_error",
      "That teammate is already an active member of this organization."
    );
  }

  const token = createInviteToken();
  const [updated] = await db
    .update(organizationInvites)
    .set({
      tokenHash: hashInviteToken(token),
      expiresAt: getInviteExpiration(),
      emailMessageId: null,
      lastSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(organizationInvites.id, invite.id))
    .returning();

  return {
    invite: updated,
    token,
  };
}

export async function markOrganizationInviteSent(input: {
  inviteId: string;
  emailMessageId: string | null;
}) {
  const db = getDb();

  if (!db) {
    return null;
  }

  const [updated] = await db
    .update(organizationInvites)
    .set({
      emailMessageId: input.emailMessageId,
      lastSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizationInvites.id, input.inviteId))
    .returning();

  return updated ?? null;
}

export async function revokeOrganizationInvite(input: {
  organizationId: string;
  inviteId: string;
}) {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [revoked] = await db
    .update(organizationInvites)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationInvites.organizationId, input.organizationId),
        eq(organizationInvites.id, input.inviteId),
        eq(organizationInvites.status, "pending")
      )
    )
    .returning();

  if (!revoked) {
    throw new AppError("not_found", "Pending invite not found.");
  }

  return revoked;
}

export async function getOrganizationInvitePreview(token: string) {
  const db = getDb();

  if (!db || !token.trim()) {
    return null;
  }

  const [row] = await db
    .select({
      invite: organizationInvites,
      organizationName: organizations.name,
    })
    .from(organizationInvites)
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .where(eq(organizationInvites.tokenHash, hashInviteToken(token)))
    .limit(1);

  return row ? mapInvitePreview(row) : null;
}

export async function acceptOrganizationInvite(
  token: string,
  user: VerifiedAuthUser
): Promise<AcceptedOrganizationInvite> {
  const db = getDb();

  if (!db) {
    throw new AppError("service_unavailable", "DATABASE_URL is missing.");
  }

  const [row] = await db
    .select({
      invite: organizationInvites,
      organizationName: organizations.name,
    })
    .from(organizationInvites)
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .where(eq(organizationInvites.tokenHash, hashInviteToken(token)))
    .limit(1);

  if (!row) {
    throw new AppError("not_found", "Invite not found.");
  }

  const activeOrganization = await getActiveOrganizationForUser(user.id);
  const acceptanceError = getInviteAcceptanceError({
    invite: row.invite,
    userEmail: user.email,
    activeOrganizationId: activeOrganization?.organization.id ?? null,
  });

  if (acceptanceError) {
    throw new AppError(
      acceptanceError === SECOND_ORGANIZATION_MESSAGE ? "forbidden" : "validation_error",
      acceptanceError
    );
  }

  const role = coerceInviteRole(row.invite.role);
  const profile = await ensureProfileForUser(user);
  const roleRow = await ensureAppRole(role);

  if (!activeOrganization) {
    await db
      .update(profiles)
      .set({
        roleId: roleRow.id,
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profile.id));
  }

  await db
    .insert(organizationMembers)
    .values({
      organizationId: row.invite.organizationId,
      profileId: profile.id,
      role,
      status: "active",
    })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.profileId],
      set: {
        role,
        status: "active",
        updatedAt: new Date(),
      },
    });

  const [accepted] = await db
    .update(organizationInvites)
    .set({
      status: "accepted",
      acceptedBy: profile.id,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(organizationInvites.id, row.invite.id),
        eq(organizationInvites.status, "pending"),
        gt(organizationInvites.expiresAt, new Date())
      )
    )
    .returning();

  if (!accepted) {
    throw new AppError(
      "validation_error",
      "This invite is no longer available. Ask an administrator to resend it."
    );
  }

  return {
    inviteId: accepted.id,
    organizationId: row.invite.organizationId,
    organizationName: row.organizationName,
    profileId: profile.id,
    role,
  };
}
