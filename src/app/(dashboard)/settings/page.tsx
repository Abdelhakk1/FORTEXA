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
import { getAtmPaymentServicesApplication } from "@/lib/services/business-applications";
import {
  ensureGabCidtTemplates,
  listAssetClassificationRules,
  templateDisplayRows,
} from "@/lib/services/gab-business-context";
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
  const [
    sites,
    members,
    invites,
    auditEvents,
    atmPaymentServices,
    gabCidtTemplates,
    assetClassificationRules,
  ] = await Promise.all([
    listOrganizationSites(organizationId),
    listOrganizationMembers(organizationId),
    canManageTeam ? listOrganizationInvites(organizationId) : Promise.resolve([]),
    canViewAudit
      ? listOrganizationAuditEvents(organizationId, 8)
      : Promise.resolve([]),
    getAtmPaymentServicesApplication(organizationId),
    ensureGabCidtTemplates(organizationId),
    listAssetClassificationRules(organizationId),
  ]);

  return (
    <SettingsPageClient
      organization={activeOrganization.organization}
      settings={activeOrganization.settings}
      sites={sites}
      members={members}
      invites={invites}
      auditEvents={auditEvents}
      atmPaymentServices={atmPaymentServices}
      gabCidtTemplates={templateDisplayRows(gabCidtTemplates).map((template) => ({
        id: template.id,
        templateKey: template.templateKey,
        label: template.label,
        cidtConfidentiality: template.cidtConfidentiality,
        cidtIntegrity: template.cidtIntegrity,
        cidtAvailability: template.cidtAvailability,
        cidtTraceability: template.cidtTraceability,
        sensitivity: template.sensitivity,
      }))}
      assetClassificationRules={assetClassificationRules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        field: rule.field,
        matchValue: rule.matchValue,
        gabExposureType: rule.gabExposureType,
        enabled: rule.enabled,
      }))}
      canManageSettings={canManageSettings}
      canManageTeam={canManageTeam}
      canViewAudit={canViewAudit}
      emailDeliveryConfigured={isResendEmailConfigured()}
      aiProvider={{
        provider: "DigitalOcean Gradient",
        model: serverEnv.digitalOceanGradientModel,
        baseUrl: serverEnv.digitalOceanGradientBaseUrl,
        configured: Boolean(serverEnv.digitalOceanGradientApiKey),
      }}
    />
  );
}
