import { requireActiveOrganization, requireAuth } from "@/lib/auth";
import { serverEnv } from "@/lib/env/server";
import { isResendEmailConfigured } from "@/lib/services/resend";
import {
  listOrganizationAuditEvents,
  listOrganizationMembers,
  listOrganizationSites,
} from "@/lib/services/organizations";
import {
  canManageOrganizationTeam,
  listOrganizationInvites,
} from "@/lib/services/team-invites";
import { SettingsPageClient } from "./settings-page-client";

export default async function SettingsPage() {
  const [identity, activeOrganization] = await Promise.all([
    requireAuth(),
    requireActiveOrganization(),
  ]);
  const organizationId = activeOrganization.organization.id;
  const canManageSettings = identity.permissions.includes("settings.manage");
  const canViewAudit = identity.permissions.includes("audit.read");
  const canManageTeam = canManageOrganizationTeam({
    membershipRole: activeOrganization.membership.role,
    permissions: identity.permissions,
  });
  const [sites, members, invites, auditEvents] = await Promise.all([
    listOrganizationSites(organizationId),
    listOrganizationMembers(organizationId),
    canManageTeam ? listOrganizationInvites(organizationId) : Promise.resolve([]),
    canViewAudit
      ? listOrganizationAuditEvents(organizationId, 8)
      : Promise.resolve([]),
  ]);

  return (
    <SettingsPageClient
      organization={activeOrganization.organization}
      settings={activeOrganization.settings}
      sites={sites}
      members={members}
      invites={invites}
      auditEvents={auditEvents}
      canManageSettings={canManageSettings}
      canManageTeam={canManageTeam}
      canViewAudit={canViewAudit}
      emailDeliveryConfigured={isResendEmailConfigured()}
      aiProvider={{
        provider: "OpenRouter",
        model: serverEnv.openrouterModel,
        baseUrl: serverEnv.openrouterBaseUrl,
        configured: Boolean(serverEnv.openrouterApiKey),
      }}
    />
  );
}
