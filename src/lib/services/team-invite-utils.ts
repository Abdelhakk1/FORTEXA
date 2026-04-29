import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { AppPermission, AppRoleName } from "@/lib/permissions";

export const SECOND_ORGANIZATION_MESSAGE =
  "This Fortexa MVP supports one organization per account. Please use a separate account or contact support.";

export const teamInviteRoleValues = [
  "administrator",
  "security_manager",
  "security_analyst",
  "remediation_owner",
] as const satisfies readonly AppRoleName[];

export type TeamInviteRole = (typeof teamInviteRoleValues)[number];
export type OrganizationInviteDisplayStatus =
  | "pending"
  | "expired"
  | "accepted"
  | "revoked";

export const teamInviteRoleLabels: Record<TeamInviteRole, string> = {
  administrator: "Administrator",
  security_manager: "Security manager",
  security_analyst: "Security analyst",
  remediation_owner: "Remediation owner",
};

export const createTeamInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid teammate email.")
    .max(320, "Email address is too long.")
    .transform((value) => value.toLowerCase()),
  role: z.enum(teamInviteRoleValues),
});

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function coerceInviteRole(value: string): TeamInviteRole {
  return teamInviteRoleValues.includes(value as TeamInviteRole)
    ? (value as TeamInviteRole)
    : "security_analyst";
}

export function createInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function buildInviteLink(origin: string, token: string) {
  return new URL(`/invite/${encodeURIComponent(token)}`, origin).toString();
}

export function getInviteDisplayStatus(
  invite: { status: string; expiresAt: Date },
  now = new Date()
): OrganizationInviteDisplayStatus {
  if (invite.status === "accepted" || invite.status === "revoked") {
    return invite.status;
  }

  if (invite.expiresAt <= now) {
    return "expired";
  }

  return "pending";
}

export function getInviteAcceptanceError(input: {
  invite: {
    email: string;
    organizationId: string;
    status: string;
    expiresAt: Date;
  };
  userEmail: string | null;
  activeOrganizationId: string | null;
  now?: Date;
}) {
  const status = getInviteDisplayStatus(input.invite, input.now ?? new Date());

  if (status === "accepted") {
    return "This invite has already been accepted.";
  }

  if (status === "revoked") {
    return "This invite has been revoked.";
  }

  if (status === "expired") {
    return "This invite has expired. Ask an administrator to resend it.";
  }

  if (
    input.userEmail &&
    normalizeEmail(input.userEmail) !== normalizeEmail(input.invite.email)
  ) {
    return `This invite was sent to ${input.invite.email}. Sign in with that email to accept it.`;
  }

  if (
    input.activeOrganizationId &&
    input.activeOrganizationId !== input.invite.organizationId
  ) {
    return SECOND_ORGANIZATION_MESSAGE;
  }

  return null;
}

export function canManageOrganizationTeam(input: {
  membershipRole: string | null | undefined;
  permissions: readonly AppPermission[];
}) {
  void input.permissions;

  return input.membershipRole === "owner" || input.membershipRole === "administrator";
}
