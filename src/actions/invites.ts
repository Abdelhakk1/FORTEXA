"use server";

import { logAuditEvent } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { err, ok, toActionResult, type ActionResult } from "@/lib/errors";
import {
  checkRateLimit,
  getRateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";
import { acceptOrganizationInvite } from "@/lib/services/team-invites";
import { hashInviteToken } from "@/lib/services/team-invite-utils";

export async function acceptOrganizationInviteAction(
  token: string
): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return err("unauthenticated", "Sign in to accept this invite.");
    }

    const rateLimit = checkRateLimit({
      key: `invite-accept:${user.id}:${hashInviteToken(token)}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return err(
        "rate_limited",
        `Too many invite attempts. Try again in ${getRateLimitRetryAfterSeconds(
          rateLimit.resetAt
        )} seconds.`
      );
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
