"use server";

import { logAuditEvent } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import { acceptOrganizationInvite } from "@/lib/services/team-invites";

export async function acceptOrganizationInviteAction(
  token: string
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return err("unauthenticated", "Sign in to accept this invite.");
    }

    const accepted = await acceptOrganizationInvite(token, user);

    await logAuditEvent({
      organizationId: accepted.organizationId,
      userId: accepted.profileId,
      action: "team_invite.accepted",
      resourceType: "organization_invite",
      resourceId: accepted.inviteId,
      details: {
        organizationName: accepted.organizationName,
        role: accepted.role,
      },
    });

    return ok({ redirectTo: "/dashboard" });
  } catch (error) {
    return toActionResult(error);
  }
}
