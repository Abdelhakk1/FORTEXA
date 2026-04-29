"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { logAuditEvent } from "@/lib/audit";
import { serverEnv } from "@/lib/env/server";
import {
  requireAuth,
  requireActiveOrganization,
  requireSettingsPermission,
} from "@/lib/auth";
import { ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  aiSettingsSchema,
  notificationSettingsSchema,
  operatingContextSchema,
  organizationProfileSchema,
  siteSchema,
  slaPolicySchema,
  listOrganizationMembers,
  updateAiSettings,
  updateNotificationSettings,
  updateOperatingContext,
  updateOrganizationProfile,
  updateSlaPolicy,
  upsertSite,
} from "@/lib/services/organizations";
import {
  assertCanManageOrganizationTeam,
  buildInviteLink,
  canManageOrganizationTeam,
  createOrganizationInvite,
  listOrganizationInvites,
  markOrganizationInviteSent,
  refreshOrganizationInvite,
  revokeOrganizationInvite,
  teamInviteRoleLabels,
} from "@/lib/services/team-invites";
import {
  isResendEmailConfigured,
  sendTeamInviteEmail,
} from "@/lib/services/resend";

async function getSettingsActionContext() {
  const [identity, active] = await Promise.all([
    requireSettingsPermission(),
    requireActiveOrganization(),
  ]);

  return { identity, active };
}

async function getTeamActionContext() {
  const [identity, active] = await Promise.all([
    requireAuth(),
    requireActiveOrganization(),
  ]);

  return { identity, active };
}

async function getRequestOrigin() {
  if (serverEnv.nextPublicAppUrl) {
    return serverEnv.nextPublicAppUrl;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

async function deliverInviteEmail(input: {
  inviteId: string;
  email: string;
  organizationName: string;
  roleLabel: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  if (!isResendEmailConfigured()) {
    return {
      delivery: "manual" as const,
      message:
        "Invite created. Email delivery is not configured, so use the manual invite link.",
      inviteLink: input.inviteLink,
      emailMessageId: null,
    };
  }

  const sent = await sendTeamInviteEmail({
    to: input.email,
    organizationName: input.organizationName,
    roleLabel: input.roleLabel,
    inviteLink: input.inviteLink,
    expiresAt: input.expiresAt,
  });

  if (!sent.ok) {
    return {
      delivery: "manual" as const,
      message: `Invite created, but email delivery failed: ${sent.message} Use the manual invite link.`,
      inviteLink: input.inviteLink,
      emailMessageId: null,
    };
  }

  await markOrganizationInviteSent({
    inviteId: input.inviteId,
    emailMessageId: sent.data.id,
  });

  return {
    delivery: "sent" as const,
    message: "Invite email sent.",
    inviteLink: null,
    emailMessageId: sent.data.id,
  };
}

export async function getSettingsTeamSnapshotAction(): Promise<
  ActionResult<{
    members: Awaited<ReturnType<typeof listOrganizationMembers>>;
    invites: Awaited<ReturnType<typeof listOrganizationInvites>>;
    canManageTeam: boolean;
  }>
> {
  try {
    const { identity, active } = await getTeamActionContext();
    const canManageTeam = canManageOrganizationTeam({
      membershipRole: active.membership.role,
      permissions: identity.permissions,
    });
    const [members, invites] = await Promise.all([
      listOrganizationMembers(active.organization.id),
      canManageTeam
        ? listOrganizationInvites(active.organization.id)
        : Promise.resolve([]),
    ]);

    return ok({ members, invites, canManageTeam });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateOrganizationProfileAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = organizationProfileSchema.parse(input);
    const row = await updateOrganizationProfile(active.organization.id, parsed);

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.organization_profile_updated",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: { name: row.name, companyType: row.companyType },
    });
    revalidatePath("/settings");
    revalidatePath("/onboarding");
    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateOperatingContextAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = operatingContextSchema.parse(input);
    await updateOperatingContext(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.operating_context_updated",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: parsed,
    });
    revalidatePath("/settings");
    return ok({ id: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function upsertSiteAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = siteSchema.parse(input);
    const row = await upsertSite(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.site_upserted",
      resourceType: "site",
      resourceId: row.id,
      details: { code: row.code, siteType: row.siteType },
    });
    revalidatePath("/settings");
    return ok({ id: row.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateSlaPolicyAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = slaPolicySchema.parse(input);
    await updateSlaPolicy(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.sla_policy_updated",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: parsed,
    });
    revalidatePath("/settings");
    return ok({ id: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateAiSettingsAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = aiSettingsSchema.parse(input);
    await updateAiSettings(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.ai_updated",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: {
        enabled: parsed.enabled && parsed.consentAccepted,
        dataPolicy: parsed.dataPolicy,
      },
    });
    revalidatePath("/settings");
    return ok({ id: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateNotificationSettingsAction(input: unknown) {
  try {
    const { identity, active } = await getSettingsActionContext();
    const parsed = notificationSettingsSchema.parse(input);
    await updateNotificationSettings(active.organization.id, parsed);
    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "settings.notifications_updated",
      resourceType: "organization",
      resourceId: active.organization.id,
      details: parsed,
    });
    revalidatePath("/settings");
    return ok({ id: active.organization.id });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createTeamInviteAction(input: unknown): Promise<
  ActionResult<{
    id: string;
    email: string;
    role: string;
    delivery: "sent" | "manual";
    message: string;
    inviteLink: string | null;
    emailMessageId: string | null;
  }>
> {
  try {
    const { identity, active } = await getTeamActionContext();
    assertCanManageOrganizationTeam(identity, active);
    const payload = typeof input === "object" && input !== null ? input : {};

    const result = await createOrganizationInvite({
      ...payload,
      organizationId: active.organization.id,
      invitedBy: identity.profile?.id ?? null,
    } as Parameters<typeof createOrganizationInvite>[0]);
    const role = result.invite.role as keyof typeof teamInviteRoleLabels;
    const inviteLink = buildInviteLink(await getRequestOrigin(), result.token);
    const delivery = await deliverInviteEmail({
      inviteId: result.invite.id,
      email: result.invite.email,
      organizationName: active.organization.name,
      roleLabel: teamInviteRoleLabels[role] ?? result.invite.role,
      inviteLink,
      expiresAt: result.invite.expiresAt,
    });

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: result.duplicateRenewed
        ? "team_invite.renewed"
        : "team_invite.created",
      resourceType: "organization_invite",
      resourceId: result.invite.id,
      details: {
        email: result.invite.email,
        role: result.invite.role,
        delivery: delivery.delivery,
      },
    });
    revalidatePath("/settings");

    return ok({
      id: result.invite.id,
      email: result.invite.email,
      role: result.invite.role,
      delivery: delivery.delivery,
      message: delivery.message,
      inviteLink: delivery.inviteLink,
      emailMessageId: delivery.emailMessageId,
    });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function resendTeamInviteAction(inviteId: string): Promise<
  ActionResult<{
    id: string;
    delivery: "sent" | "manual";
    message: string;
    inviteLink: string | null;
    emailMessageId: string | null;
  }>
> {
  try {
    const { identity, active } = await getTeamActionContext();
    assertCanManageOrganizationTeam(identity, active);

    const result = await refreshOrganizationInvite({
      organizationId: active.organization.id,
      inviteId,
    });
    const role = result.invite.role as keyof typeof teamInviteRoleLabels;
    const inviteLink = buildInviteLink(await getRequestOrigin(), result.token);
    const delivery = await deliverInviteEmail({
      inviteId: result.invite.id,
      email: result.invite.email,
      organizationName: active.organization.name,
      roleLabel: teamInviteRoleLabels[role] ?? result.invite.role,
      inviteLink,
      expiresAt: result.invite.expiresAt,
    });

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "team_invite.resent",
      resourceType: "organization_invite",
      resourceId: result.invite.id,
      details: {
        email: result.invite.email,
        role: result.invite.role,
        delivery: delivery.delivery,
      },
    });
    revalidatePath("/settings");

    return ok({
      id: result.invite.id,
      delivery: delivery.delivery,
      message: delivery.message,
      inviteLink: delivery.inviteLink,
      emailMessageId: delivery.emailMessageId,
    });
  } catch (error) {
    return toActionResult(error);
  }
}

export async function revokeTeamInviteAction(
  inviteId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const { identity, active } = await getTeamActionContext();
    assertCanManageOrganizationTeam(identity, active);
    const revoked = await revokeOrganizationInvite({
      organizationId: active.organization.id,
      inviteId,
    });

    await logAuditEvent({
      organizationId: active.organization.id,
      userId: identity.profile?.id ?? null,
      action: "team_invite.revoked",
      resourceType: "organization_invite",
      resourceId: revoked.id,
      details: {
        email: revoked.email,
        role: revoked.role,
      },
    });
    revalidatePath("/settings");

    return ok({ id: revoked.id });
  } catch (error) {
    return toActionResult(error);
  }
}
