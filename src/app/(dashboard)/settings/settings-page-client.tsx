"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  createTeamInviteAction,
  getSettingsTeamSnapshotAction,
  resendTeamInviteAction,
  revokeTeamInviteAction,
  updateAiSettingsAction,
  updateAtmPaymentServicesAction,
  updateAssetClassificationRulesAction,
  updateGabCidtTemplatesAction,
  updateNotificationSettingsAction,
  updateOperatingContextAction,
  updateOrganizationProfileAction,
  updateSlaPolicyAction,
  upsertSiteAction,
} from "@/actions/settings";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  OrganizationRecord,
  OrganizationSettingsRecord,
  SiteRecord,
} from "@/lib/services/organizations";
import {
  applicationProfileExplanation,
  calculateApplicationProfile,
  calculateCidtSensitivity,
  toSensitivityLevel,
} from "@/lib/services/business-priority";

type MemberRow = {
  id: string;
  profileId: string;
  role: string;
  status: string;
  fullName: string | null;
  email: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  role: string;
  roleLabel: string;
  status: "pending" | "expired" | "accepted" | "revoked";
  expiresAt: Date;
  createdAt: Date;
  lastSentAt: Date | null;
  invitedByName: string | null;
  invitedByEmail: string | null;
};

type AuditEventRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
};

type AtmPaymentServicesRow = {
  cidtConfidentiality: number;
  cidtIntegrity: number;
  cidtAvailability: number;
  cidtTraceability: number;
  isInternetExposed: boolean;
} | null;

type GabCidtTemplateRow = {
  id: string;
  templateKey: string;
  label: string;
  description: string | null;
  isDefault: boolean;
  cidtConfidentiality: number;
  cidtIntegrity: number;
  cidtAvailability: number;
  cidtTraceability: number;
  sensitivity: "S1" | "S2" | "S3" | "S4";
};

type AssetClassificationRuleRow = {
  id: string;
  name: string;
  field: string;
  matchValue: string;
  gabExposureType: string;
  enabled: boolean;
};

type AssetClassificationRulesSaveData = {
  classifiedAssets: number;
  rules: AssetClassificationRuleRow[];
};

type SaveState = {
  section: string;
  status: "saved" | "error";
  message: string;
} | null;

const fieldClass =
  "h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]";
const fieldHelpClass = "text-xs leading-5 text-[#6B7280] dark:text-[#94A3B8]";
const gabExposureOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "indoor_agency", label: "Indoor GAB" },
  { value: "outdoor_agency", label: "Outdoor GAB" },
];

function sensitivityMeaning(sensitivity: string) {
  switch (sensitivity) {
    case "S4":
      return "Critical business impact: outage, integrity loss, or traceability failure may directly disrupt ATM Payment Services.";
    case "S3":
      return "High business impact: strong protection expected for ATM Payment Services continuity and auditability.";
    case "S2":
      return "Moderate business impact: standard GAB protection baseline.";
    default:
      return "Lower business impact: routine controls are usually sufficient.";
  }
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1A1A2E] dark:text-[#fafafa]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280] dark:text-[#94A3B8]">
            {description}
          </p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function SaveButton({
  pending,
  children = "Save",
}: {
  pending: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Button
      type="submit"
      disabled={pending}
      className="gradient-accent border-0 text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Save className="mr-2 h-4 w-4" />
      {pending ? "Saving..." : children}
    </Button>
  );
}

function StatusNotice({ state }: { state: SaveState }) {
  if (!state) {
    return null;
  }

  return (
    <div
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        state.status === "saved"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
      }`}
    >
      {state.message}
    </div>
  );
}

function TeamToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-[#BFDBFE] bg-white px-4 py-3 text-sm text-[#1A1A2E] shadow-[0_12px_36px_rgba(12,92,171,0.16)] dark:border-[#1d4ed8]/60 dark:bg-[#141419] dark:text-[#fafafa]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#DBEAFE] text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
          <Users className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Team update</p>
          <p className="mt-0.5 leading-5 text-[#4B5563] dark:text-[#CBD5E1]">
            {message}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss team update"
          onClick={onDismiss}
          className="ml-1 rounded-md px-2 py-1 text-xs font-semibold text-[#6B7280] hover:bg-[#F3F4F6] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22]"
        >
          OK
        </button>
      </div>
    </div>
  );
}

function normalizeContext(value: Record<string, unknown>) {
  return {
    atmGabFleet: value.atmGabFleet !== false,
    vendorManagedSystems: value.vendorManagedSystems === true,
  };
}

function normalizeSiteType(value: string | null | undefined) {
  return value === "regional_group" ? "regional_group" : "atm_fleet";
}

function normalizeCompanyType(value: string | null | undefined) {
  return value === "bank" ||
    value === "atm_operator" ||
    value === "bank_security" ||
    value === "managed_security_provider" ||
    value === "internal_security" ||
    value === "mssp"
    ? value
    : "other";
}

function normalizeNotifications(value: Record<string, unknown>) {
  return {
    emailEnabled: value.emailEnabled === true,
    importFailures: value.importFailures !== false,
    taskAssignments: value.taskAssignments !== false,
    slaBreaches: value.slaBreaches !== false,
    aiFailures: value.aiFailures !== false,
    dailyDigest: value.dailyDigest === true,
  };
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function SettingsPageClient({
  organization,
  settings,
  sites,
  members,
  invites,
  auditEvents,
  atmPaymentServices,
  gabCidtTemplates,
  assetClassificationRules,
  canManageSettings,
  canManageTeam,
  canViewAudit,
  emailDeliveryConfigured,
  aiProvider,
}: {
  organization: OrganizationRecord;
  settings: OrganizationSettingsRecord;
  sites: SiteRecord[];
  members: MemberRow[];
  invites: InviteRow[];
  auditEvents: AuditEventRow[];
  atmPaymentServices: AtmPaymentServicesRow;
  gabCidtTemplates: GabCidtTemplateRow[];
  assetClassificationRules: AssetClassificationRuleRow[];
  canManageSettings: boolean;
  canManageTeam: boolean;
  canViewAudit: boolean;
  emailDeliveryConfigured: boolean;
  aiProvider: {
    provider: string;
    model: string;
    baseUrl: string;
    configured: boolean;
  };
}) {
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>(null);
  const [profile, setProfile] = useState({
    name: organization.name,
    companyType: normalizeCompanyType(organization.companyType),
    defaultRegion: organization.defaultRegion ?? "",
    defaultCountry: organization.defaultCountry ?? "",
    timezone: organization.timezone,
  });
  const [context, setContext] = useState(normalizeContext(settings.operatingContext));
  const [site, setSite] = useState({
    name: sites[0]?.name ?? "",
    code: sites[0]?.code ?? "",
    siteType: normalizeSiteType(sites[0]?.siteType),
    regionName: sites[0]?.regionName ?? organization.defaultRegion ?? "",
    country: sites[0]?.country ?? organization.defaultCountry ?? "",
    location: sites[0]?.location ?? "",
    timezone: sites[0]?.timezone ?? organization.timezone,
    vendorManaged: sites[0]?.vendorManaged ?? false,
  });
  const [sla, setSla] = useState({
    criticalDays: settings.slaCriticalDays,
    highDays: settings.slaHighDays,
    mediumDays: settings.slaMediumDays,
    lowDays: settings.slaLowDays,
  });
  const [atmPaymentServicesContext, setAtmPaymentServicesContext] = useState({
    cidtConfidentiality: atmPaymentServices?.cidtConfidentiality ?? 4,
    cidtIntegrity: atmPaymentServices?.cidtIntegrity ?? 4,
    cidtAvailability: atmPaymentServices?.cidtAvailability ?? 4,
    cidtTraceability: atmPaymentServices?.cidtTraceability ?? 4,
    isInternetExposed: atmPaymentServices?.isInternetExposed ?? false,
  });
  const [gabTemplates, setGabTemplates] = useState(
    gabCidtTemplates.map((template) => ({
      templateKey: template.templateKey,
      label: template.label,
      description: template.description ?? "",
      isDefault: template.isDefault,
      archived: false,
      cidtConfidentiality: template.cidtConfidentiality,
      cidtIntegrity: template.cidtIntegrity,
      cidtAvailability: template.cidtAvailability,
      cidtTraceability: template.cidtTraceability,
    }))
  );
  const [classificationRules, setClassificationRules] = useState(
    assetClassificationRules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      field: rule.field,
      matchValue: rule.matchValue,
      gabExposureType: rule.gabExposureType,
      enabled: rule.enabled,
    }))
  );
  const [ai, setAi] = useState({
    enabled: settings.aiEnabled,
    consentAccepted: settings.aiConsentAccepted,
    dataPolicy: settings.aiDataPolicy,
  });
  const [notifications, setNotifications] = useState(
    normalizeNotifications(settings.notifications)
  );
  const [teamInvite, setTeamInvite] = useState({
    email: "",
    role: "security_analyst",
  });
  const [manualInviteLink, setManualInviteLink] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState(members);
  const [teamInvites, setTeamInvites] = useState(invites);
  const [teamToast, setTeamToast] = useState<string | null>(null);
  const knownMemberIdsRef = useRef(new Set(members.map((member) => member.id)));

  const siteRows = useMemo(() => sites.slice(0, 6), [sites]);
  const atmPaymentServicesProfile = useMemo(() => {
    const sensitivity = calculateCidtSensitivity(
      {
        confidentiality: atmPaymentServicesContext.cidtConfidentiality,
        integrity: atmPaymentServicesContext.cidtIntegrity,
        availability: atmPaymentServicesContext.cidtAvailability,
        traceability: atmPaymentServicesContext.cidtTraceability,
      },
      4
    );
    const profile = calculateApplicationProfile({
      isInternetExposed: atmPaymentServicesContext.isInternetExposed,
      confidentiality: atmPaymentServicesContext.cidtConfidentiality,
      integrity: atmPaymentServicesContext.cidtIntegrity,
    });

    return {
      sensitivity: toSensitivityLevel(sensitivity),
      profile,
      explanation: applicationProfileExplanation(profile),
    };
  }, [atmPaymentServicesContext]);
  const gabTemplateProfiles = useMemo(
    () =>
      gabTemplates.map((template) => {
        const sensitivity = calculateCidtSensitivity({
          confidentiality: template.cidtConfidentiality,
          integrity: template.cidtIntegrity,
          availability: template.cidtAvailability,
          traceability: template.cidtTraceability,
        });

        return {
          ...template,
          sensitivity: toSensitivityLevel(sensitivity),
        };
      }),
    [gabTemplates]
  );
  const readOnlyNotice = canManageSettings
    ? null
    : "Your role can view these settings, but only an owner or administrator can change them.";

  const refreshTeamSnapshot = useCallback(
    async ({ notify }: { notify: boolean }) => {
      const result = await getSettingsTeamSnapshotAction();

      if (!result.ok) {
        return;
      }

      const previousMemberIds = knownMemberIdsRef.current;
      const joinedMember = result.data.members.find(
        (member) => !previousMemberIds.has(member.id)
      );

      setTeamMembers(result.data.members);
      setTeamInvites(result.data.invites);
      knownMemberIdsRef.current = new Set(
        result.data.members.map((member) => member.id)
      );

      if (notify && joinedMember) {
        const joinedName =
          joinedMember.fullName ?? joinedMember.email ?? "A teammate";
        setTeamToast(`${joinedName} joined your Fortexa organization.`);
      }
    },
    []
  );

  useEffect(() => {
    if (!canManageTeam) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshTeamSnapshot({ notify: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [canManageTeam, refreshTeamSnapshot]);

  useEffect(() => {
    if (!teamToast) {
      return;
    }

    const timer = window.setTimeout(() => setTeamToast(null), 6500);

    return () => window.clearTimeout(timer);
  }, [teamToast]);

  function runAction<T = unknown>(
    section: string,
    action: () => Promise<{ ok: boolean; message?: string; data?: T }>,
    options?: {
      onSuccess?: (data: T) => void;
      successMessage?: (data: T) => string;
    }
  ) {
    if (!canManageSettings) {
      setSaveState({
        section,
        status: "error",
        message: "Only an owner or administrator can change organization settings.",
      });
      return;
    }

    startTransition(async () => {
      const result = await action();
      if (result.ok && result.data && options?.onSuccess) {
        options.onSuccess(result.data);
      }

      setSaveState({
        section,
        status: result.ok ? "saved" : "error",
        message: result.ok
          ? options?.successMessage && result.data
            ? options.successMessage(result.data)
            : `${section} saved.`
          : result.message ?? `${section} could not be saved.`,
      });
    });
  }

  function addClassificationRule(input: {
    name: string;
    matchValue: string;
    gabExposureType: string;
  }) {
    setClassificationRules((current) => {
      const usedNames = new Set(current.map((rule) => rule.name.toLowerCase()));
      let name = input.name;
      let suffix = 2;

      while (usedNames.has(name.toLowerCase())) {
        name = `${input.name} (${suffix})`;
        suffix += 1;
      }

      return [
        ...current,
        {
          id: `draft-${Date.now()}-${current.length + 1}`,
          name,
          field: "hostname",
          matchValue: input.matchValue,
          gabExposureType: input.gabExposureType,
          enabled: true,
        },
      ];
    });
  }

  function runTeamAction(
    action: () => Promise<{
      ok: boolean;
      message?: string;
      data?: Record<string, unknown> & {
        message?: string;
        inviteLink?: string | null;
      };
    }>
  ) {
    startTransition(async () => {
      const result = await action();
      const link = result.ok ? result.data?.inviteLink ?? null : null;

      setManualInviteLink(link);
      setSaveState({
        section: "Team",
        status: result.ok ? "saved" : "error",
        message: result.ok
          ? result.data?.message ?? "Team updated."
          : result.message ?? "Team update failed.",
      });

      if (result.ok && !link) {
        setTeamInvite((current) => ({ ...current, email: "" }));
      }

      if (result.ok) {
        await refreshTeamSnapshot({ notify: false });
      }
    });
  }

  async function copyManualInviteLink() {
    if (!manualInviteLink) {
      return;
    }

    await navigator.clipboard.writeText(manualInviteLink);
    setSaveState({
      section: "Team",
      status: "saved",
      message: "Invite link copied.",
    });
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Persisted operating settings for GAB vulnerability operations"
      />

      <StatusNotice state={saveState} />
      <TeamToast message={teamToast} onDismiss={() => setTeamToast(null)} />
      {readOnlyNotice ? (
        <div className="mb-5 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
          {readOnlyNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          icon={Building2}
          title="Organization Profile"
          description="Workspace identity used for onboarding, reports, and audit context."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              runAction("Organization profile", () =>
                updateOrganizationProfileAction({
                  name: String(formData.get("name") ?? profile.name),
                  companyType: String(formData.get("companyType") ?? profile.companyType),
                  defaultRegion: String(formData.get("defaultRegion") ?? profile.defaultRegion),
                  defaultCountry: String(formData.get("defaultCountry") ?? profile.defaultCountry),
                  timezone: String(formData.get("timezone") ?? profile.timezone),
                })
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  name="name"
                  disabled={!canManageSettings}
                  placeholder="Example: Atlas ATM Security"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  The company or GAB operations team that owns this workspace.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company-type">Company type</Label>
                <select
                  id="company-type"
                  name="companyType"
                  disabled={!canManageSettings}
                  value={profile.companyType}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      companyType: event.target.value,
                    }))
                  }
                  className={`${fieldClass} rounded-md px-3 text-sm`}
                >
                  <option value="atm_operator">GAB operator</option>
                  <option value="bank_security">Bank security team</option>
                  <option value="managed_security_provider">Managed security provider</option>
                  <option value="internal_security">Internal security team</option>
                  <option value="bank">Bank</option>
                  <option value="mssp">MSSP</option>
                  <option value="other">Other</option>
                </select>
                <p className={fieldHelpClass}>
                  Pick the closest GAB operating model.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="default-region">Primary operating area</Label>
                <Input
                  id="default-region"
                  name="defaultRegion"
                  disabled={!canManageSettings}
                  placeholder="Example: Algiers GAB operations"
                  value={profile.defaultRegion}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      defaultRegion: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Default GAB area for reports and new records.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="default-country">Country</Label>
                <Input
                  id="default-country"
                  name="defaultCountry"
                  disabled={!canManageSettings}
                  placeholder="Example: Algeria"
                  value={profile.defaultCountry}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      defaultCountry: event.target.value,
                    }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Optional country label for workspace context.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  name="timezone"
                  disabled={!canManageSettings}
                  placeholder="Example: Africa/Algiers"
                  value={profile.timezone}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, timezone: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Used for SLA dates, reports, and audit timestamps.
                </p>
              </div>
            </div>
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save profile</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="Operating Context"
          description="Fortexa keeps scanner findings tied to GAB fleet operations."
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("Operating context", () =>
                updateOperatingContextAction(context)
              );
            }}
          >
            {[["atmGabFleet", "GAB fleet"]].map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]"
              >
                <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  {label}
                </span>
                <Switch
                  disabled={!canManageSettings}
                  checked={context[key as keyof typeof context]}
                  onCheckedChange={(checked) =>
                    setContext((current) => ({ ...current, [key]: checked }))
                  }
                />
              </div>
            ))}
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save context</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="ATM Payment Services CIDT"
          description="Business sensitivity used to rank vulnerabilities on GABs supporting ATM Payment Services."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("ATM Payment Services CIDT", () =>
                updateAtmPaymentServicesAction(atmPaymentServicesContext)
              );
            }}
          >
            <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <div className="grid gap-2 text-sm text-[#6B7280] dark:text-[#94A3B8] sm:grid-cols-2">
                <p>
                  Application:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    ATM Payment Services
                  </span>
                </p>
                <p>
                  Sensitivity:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {atmPaymentServicesProfile.sensitivity}
                  </span>
                </p>
                <p>
                  ATM Payment Services Profile:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    Profile {atmPaymentServicesProfile.profile}
                  </span>
                </p>
                <p className="sm:col-span-2">
                  {atmPaymentServicesProfile.explanation}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["cidtConfidentiality", "Confidentiality"],
                ["cidtIntegrity", "Integrity"],
                ["cidtAvailability", "Availability"],
                ["cidtTraceability", "Traceability"],
              ].map(([key, label]) => (
                <div key={key} className="grid gap-2">
                  <Label htmlFor={`atm-payment-${key}`}>{label}</Label>
                  <select
                    id={`atm-payment-${key}`}
                    disabled={!canManageSettings}
                    value={
                      atmPaymentServicesContext[
                        key as keyof Omit<
                          typeof atmPaymentServicesContext,
                          "isInternetExposed"
                        >
                      ]
                    }
                    onChange={(event) =>
                      setAtmPaymentServicesContext((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                    className={`${fieldClass} rounded-md px-3 text-sm`}
                  >
                    {[1, 2, 3, 4].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  Application exposed to internet
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  When enabled, the ATM Payment Services Profile becomes Profile 4.
                </p>
              </div>
              <Switch
                disabled={!canManageSettings}
                checked={atmPaymentServicesContext.isInternetExposed}
                onCheckedChange={(checked) =>
                  setAtmPaymentServicesContext((current) => ({
                    ...current,
                    isInternetExposed: checked,
                  }))
                }
              />
            </div>
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save ATM Payment Services</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={ShieldCheck}
          title="GAB CIDT Templates"
          description="Business-impact CIDT presets. Exposure stays only Unknown, Indoor, or Outdoor."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("GAB CIDT templates", () =>
                updateGabCidtTemplatesAction({ templates: gabTemplates })
              );
            }}
          >
            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-xs leading-5 text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
              Templates set business CIDT. Indoor/outdoor exposure is an attack-opportunity factor and is scored separately in Rank v2.
            </div>
            <div className="space-y-3">
              {gabTemplateProfiles
                .filter((template) => !template.archived)
                .map((template) => (
                <div
                  key={template.templateKey}
                  className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {template.isDefault ? (
                        <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                          {template.label}
                        </p>
                      ) : (
                        <Input
                          disabled={!canManageSettings}
                          value={template.label}
                          onChange={(event) =>
                            setGabTemplates((current) =>
                              current.map((row) =>
                                row.templateKey === template.templateKey
                                  ? { ...row, label: event.target.value }
                                  : row
                              )
                            )
                          }
                          placeholder="Template name"
                          className={`${fieldClass} max-w-sm`}
                        />
                      )}
                      <p className={fieldHelpClass}>
                        Sensitivity {template.sensitivity} from C
                        {template.cidtConfidentiality} I{template.cidtIntegrity} D
                        {template.cidtAvailability} T{template.cidtTraceability}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[#6B7280] dark:text-[#94A3B8]">
                        {sensitivityMeaning(template.sensitivity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#1E3A8A] dark:border-[#1d4ed8]/60 dark:bg-[#0A1A2D] dark:text-[#BFDBFE]">
                        {template.isDefault ? "Default" : "Custom"} · {template.sensitivity}
                      </span>
                      {!template.isDefault && canManageSettings ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            setGabTemplates((current) =>
                              current.map((row) =>
                                row.templateKey === template.templateKey
                                  ? { ...row, archived: true }
                                  : row
                              )
                            )
                          }
                          className="h-9 text-[#6B7280] hover:bg-red-50 hover:text-red-600 dark:text-[#94A3B8] dark:hover:bg-red-500/10 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <Input
                    disabled={!canManageSettings}
                    value={template.description ?? ""}
                    onChange={(event) =>
                      setGabTemplates((current) =>
                        current.map((row) =>
                          row.templateKey === template.templateKey
                            ? { ...row, description: event.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="Optional description"
                    className={`${fieldClass} mb-3`}
                  />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["cidtConfidentiality", "C"],
                      ["cidtIntegrity", "I"],
                      ["cidtAvailability", "D"],
                      ["cidtTraceability", "T"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="grid gap-1 text-xs font-medium text-[#6B7280] dark:text-[#94A3B8]"
                      >
                        {label}
                        <select
                          disabled={!canManageSettings}
                          value={
                            template[
                              key as keyof Pick<
                                typeof template,
                                | "cidtConfidentiality"
                                | "cidtIntegrity"
                                | "cidtAvailability"
                                | "cidtTraceability"
                              >
                            ]
                          }
                          onChange={(event) =>
                            setGabTemplates((current) =>
                              current.map((row) =>
                                  row.templateKey === template.templateKey
                                  ? { ...row, [key]: Number(event.target.value) }
                                  : row
                              )
                            )
                          }
                          className={`${fieldClass} rounded-md px-3 text-sm`}
                        >
                          {[1, 2, 3, 4].map((value) => (
                            <option key={value} value={value}>
                              {label}
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {canManageSettings ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setGabTemplates((current) => [
                      ...current,
                      {
                        templateKey: `draft-${current.length + 1}`,
                        label: "Custom GAB CIDT template",
                        description: "",
                        isDefault: false,
                        archived: false,
                        cidtConfidentiality: 3,
                        cidtIntegrity: 3,
                        cidtAvailability: 3,
                        cidtTraceability: 3,
                      },
                    ])
                  }
                  className="border-[#E9ECEF] bg-white text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create template
                </Button>
                <SaveButton pending={isPending}>Save templates</SaveButton>
              </div>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={MapPin}
          title="Asset Classification Rules"
          description="Classify newly imported GABs from simple hostname or location patterns."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction<AssetClassificationRulesSaveData>(
                "Asset classification rules",
                () =>
                  updateAssetClassificationRulesAction({
                    rules: classificationRules.map((rule) => ({
                      name: rule.name,
                      field: rule.field,
                      matchValue: rule.matchValue,
                      gabExposureType: rule.gabExposureType,
                      enabled: rule.enabled,
                    })),
                  }),
                {
                  onSuccess: (data) => {
                    setClassificationRules(data.rules);
                  },
                  successMessage: (data) =>
                    data.classifiedAssets > 0
                      ? `Asset classification rules saved. ${data.classifiedAssets} existing Unknown GAB${data.classifiedAssets === 1 ? "" : "s"} classified.`
                      : "Asset classification rules saved. Future imports will use these rules.",
                }
              );
            }}
          >
            <div className="space-y-3">
              {classificationRules.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280] dark:border-[#3a3a42] dark:bg-[#1a1a22] dark:text-[#94A3B8]">
                  No rules yet. Imports will keep new GABs as Unknown until you classify them.
                </p>
              ) : null}
              {classificationRules.map((rule, index) => (
                <div
                  key={rule.id ?? index}
                  className="grid gap-3 rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-3 dark:border-[#27272a] dark:bg-[#1a1a22] lg:grid-cols-[1fr_130px_1fr_220px_auto]"
                >
                  <Input
                    disabled={!canManageSettings}
                    value={rule.name}
                    onChange={(event) =>
                      setClassificationRules((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, name: event.target.value } : row
                        )
                      )
                    }
                    placeholder="Rule name"
                    className={fieldClass}
                  />
                  <select
                    disabled={!canManageSettings}
                    value={rule.field}
                    onChange={(event) =>
                      setClassificationRules((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, field: event.target.value } : row
                        )
                      )
                    }
                    className={`${fieldClass} rounded-md px-3 text-sm`}
                  >
                    <option value="hostname">Hostname</option>
                    <option value="name">Name</option>
                    <option value="asset_code">Asset code</option>
                    <option value="branch">Coverage area</option>
                    <option value="location">Location</option>
                  </select>
                  <Input
                    disabled={!canManageSettings}
                    value={rule.matchValue}
                    onChange={(event) =>
                      setClassificationRules((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, matchValue: event.target.value }
                            : row
                        )
                      )
                    }
                    placeholder="Contains text"
                    className={fieldClass}
                  />
                  <select
                    disabled={!canManageSettings}
                    value={rule.gabExposureType}
                    onChange={(event) =>
                      setClassificationRules((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, gabExposureType: event.target.value }
                            : row
                        )
                      )
                    }
                    className={`${fieldClass} rounded-md px-3 text-sm`}
                  >
                    {gabExposureOptions.map((option) => (
                      <option key={`${rule.id}-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!canManageSettings}
                    onClick={() =>
                      setClassificationRules((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index)
                      )
                    }
                    className="h-10 text-[#6B7280] hover:bg-red-50 hover:text-red-600 dark:text-[#94A3B8] dark:hover:bg-red-500/10 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {canManageSettings ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    addClassificationRule({
                      name: "Hostname contains GAB-OUT",
                      matchValue: "GAB-OUT",
                      gabExposureType: "outdoor_agency",
                    })
                  }
                  className="border-[#E9ECEF] bg-white text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Outdoor rule
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    addClassificationRule({
                      name: "Hostname contains GAB-IN",
                      matchValue: "GAB-IN",
                      gabExposureType: "indoor_agency",
                    })
                  }
                  className="border-[#E9ECEF] bg-white text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#141419] dark:text-[#fafafa]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Indoor rule
                </Button>
                <SaveButton pending={isPending}>Save rules</SaveButton>
              </div>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={MapPin}
          title="GAB Coverage Areas"
          description="Create the default fleet area used by reports and remediation context."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("Site", () => upsertSiteAction(site));
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="site-name">Coverage area name</Label>
                <Input
                  id="site-name"
                  disabled={!canManageSettings}
                  placeholder="Example: Algiers GAB fleet"
                  value={site.name}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  A city, operating zone, or fleet group used by your GAB team.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-code">Short code</Label>
                <Input
                  id="site-code"
                  disabled={!canManageSettings}
                  placeholder="Example: ALG-ATM"
                  value={site.code}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, code: event.target.value }))
                  }
                  className={fieldClass}
                  minLength={2}
                  maxLength={32}
                />
                <p className={fieldHelpClass}>
                  At least 2 characters. Fortexa normalizes it to uppercase.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="site-type">Coverage type</Label>
                <select
                  id="site-type"
                  disabled={!canManageSettings}
                  value={site.siteType}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, siteType: event.target.value }))
                  }
                  className={`${fieldClass} rounded-md px-3 text-sm`}
                >
                  <option value="atm_fleet">GAB fleet</option>
                  <option value="regional_group">GAB area group</option>
                </select>
                <p className={fieldHelpClass}>
                  Use fleet for one managed group, or area group for a wider area.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-region">Operating area</Label>
                <Input
                  id="site-region"
                  disabled={!canManageSettings}
                  placeholder="Example: North Algeria"
                  value={site.regionName}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, regionName: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Optional grouping used in dashboards and generated reports.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-country">Country</Label>
                <Input
                  id="site-country"
                  disabled={!canManageSettings}
                  placeholder="Example: Algeria"
                  value={site.country}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, country: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Optional country label for filtering and reporting.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="site-location">Location notes</Label>
                <Input
                  id="site-location"
                  disabled={!canManageSettings}
                  placeholder="Example: Production ATMs managed by the Algiers SOC"
                  value={site.location}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, location: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Optional notes for operators. Do not paste scanner evidence here.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-timezone">Timezone</Label>
                <Input
                  id="site-timezone"
                  disabled={!canManageSettings}
                  placeholder="Example: Africa/Algiers"
                  value={site.timezone}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, timezone: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  Optional override if this area uses a different SLA timezone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                GAB maintenance partners tracked
              </span>
              <Switch
                disabled={!canManageSettings}
                checked={site.vendorManaged}
                onCheckedChange={(checked) =>
                  setSite((current) => ({ ...current, vendorManaged: checked }))
                }
              />
            </div>
            {siteRows.length > 0 && (
              <div className="rounded-xl border border-[#E9ECEF] dark:border-[#27272a]">
                {siteRows.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between border-b border-[#F3F4F6] px-4 py-3 text-sm last:border-b-0 dark:border-[#27272a]"
                  >
                    <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                      {row.name}
                    </span>
                    <span className="text-[#6B7280] dark:text-[#94A3B8]">
                      {row.code} · {row.siteType.replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save site</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={Clock}
          title="SLA Policy"
          description="Targets used for new scanner-validated vulnerability due dates."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("SLA policy", () => updateSlaPolicyAction(sla));
            }}
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["criticalDays", "Critical"],
                ["highDays", "High"],
                ["mediumDays", "Medium"],
                ["lowDays", "Low"],
              ].map(([key, label]) => (
                <div key={key} className="grid gap-2">
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    type="number"
                    disabled={!canManageSettings}
                    min={1}
                    max={365}
                    value={sla[key as keyof typeof sla]}
                    onChange={(event) =>
                      setSla((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                    className={fieldClass}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
              Updated values are persisted now and used by newly created remediation/import
              calculations as those workflows adopt org policies.
            </p>
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save SLA</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={Bot}
          title="AI Playbooks"
          description="Controls whether scanner evidence can be sent to the configured AI provider."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("AI settings", () => updateAiSettingsAction(ai));
            }}
          >
            <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <div className="grid gap-2 text-sm text-[#6B7280] dark:text-[#94A3B8] sm:grid-cols-2">
                <p>
                  Provider:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {aiProvider.provider}
                  </span>
                </p>
                <p>
                  Model:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {aiProvider.model}
                  </span>
                </p>
                <p>
                  Endpoint:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {aiProvider.baseUrl}
                  </span>
                </p>
                <p>
                  Status:{" "}
                  <span className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {aiProvider.configured ? "Configured" : "Missing server key"}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  Enable AI playbooks
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  Retry AI and automatic import queueing will skip truthfully when disabled.
                </p>
              </div>
              <Switch
                disabled={!canManageSettings}
                checked={ai.enabled}
                onCheckedChange={(checked) =>
                  setAi((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  I consent to scanner evidence sharing
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  Evidence is bounded before use and remains server-side.
                </p>
              </div>
              <Switch
                disabled={!canManageSettings}
                checked={ai.consentAccepted}
                onCheckedChange={(checked) =>
                  setAi((current) => ({ ...current, consentAccepted: checked }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ai-policy">Data policy</Label>
              <select
                id="ai-policy"
                disabled={!canManageSettings}
                value={ai.dataPolicy}
                onChange={(event) =>
                  setAi((current) => ({ ...current, dataPolicy: event.target.value }))
                }
                className={`${fieldClass} rounded-md px-3 text-sm`}
              >
                <option value="minimal_evidence">Minimal evidence</option>
                <option value="scanner_evidence">Scanner evidence allowed</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save AI settings</SaveButton>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          icon={Database}
          title="Import / Scanner Settings"
          description="Nessus is the active Fortexa MVP scanner path."
        >
          <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  Nessus
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  Active canonical importer for this MVP. Additional scanner formats are planned after the Nessus path stays production-stable.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Team"
          description="Invite teammates into this Fortexa organization and review pending access."
        >
          <div className="space-y-5">
            {canManageTeam ? (
              <form
                className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]"
                onSubmit={(event) => {
                  event.preventDefault();
                  runTeamAction(() => createTeamInviteAction(teamInvite));
                }}
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
                  <div className="grid gap-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={teamInvite.email}
                      onChange={(event) =>
                        setTeamInvite((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      placeholder="teammate@company.com"
                      className={fieldClass}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <select
                      id="invite-role"
                      value={teamInvite.role}
                      onChange={(event) =>
                        setTeamInvite((current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      className={`${fieldClass} rounded-md px-3 text-sm`}
                    >
                      <option value="security_analyst">Security analyst</option>
                      <option value="security_manager">Security manager</option>
                      <option value="remediation_owner">Remediation owner</option>
                      <option value="administrator">Administrator</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="h-10 w-full border-0 bg-[#0C5CAB] text-white hover:bg-[#0a4a8a]"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Invite
                    </Button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#6B7280] dark:text-[#94A3B8]">
                  {emailDeliveryConfigured
                    ? "Fortexa will send this invite by email."
                    : "Email delivery is not configured. Fortexa will create a manual invite link."}
                </p>
                {manualInviteLink ? (
                  <div className="mt-3 grid gap-2 rounded-lg border border-[#BFDBFE] bg-white p-3 dark:border-[#1d4ed8]/60 dark:bg-[#141419]">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0C5CAB] dark:text-[#60A5FA]">
                      Manual invite link
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={manualInviteLink}
                        readOnly
                        className={`${fieldClass} font-mono text-xs`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Copy invite link"
                        title="Copy invite link"
                        onClick={copyManualInviteLink}
                        className="h-10 shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </form>
            ) : (
              <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8]">
                Your role can view team membership, but cannot invite teammates.
              </div>
            )}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                Members
              </h3>
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-xl border border-[#E9ECEF] px-4 py-3 dark:border-[#27272a]"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                        {member.fullName ?? member.email ?? member.profileId}
                      </p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                        {member.email ?? "No email"} · {member.role.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {member.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-[#1A1A2E] dark:text-[#fafafa]">
                Pending invites
              </h3>
              {!canManageTeam ? (
                <div className="rounded-xl border border-[#E9ECEF] px-4 py-5 text-sm text-[#6B7280] dark:border-[#27272a] dark:text-[#94A3B8]">
                  Pending invites are visible to owners and administrators.
                </div>
              ) : teamInvites.length === 0 ? (
                <div className="rounded-xl border border-[#E9ECEF] px-4 py-5 text-sm text-[#6B7280] dark:border-[#27272a] dark:text-[#94A3B8]">
                  No pending invites.
                </div>
              ) : (
                <div className="space-y-3">
                  {teamInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="rounded-xl border border-[#E9ECEF] px-4 py-3 dark:border-[#27272a]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                            {invite.email}
                          </p>
                          <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                            {invite.roleLabel} · expires {formatDate(invite.expiresAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              invite.status === "expired"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                : "bg-blue-50 text-[#0C5CAB] dark:bg-blue-500/10 dark:text-blue-300"
                            }`}
                          >
                            {invite.status}
                          </span>
                          {canManageTeam ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`Resend invite to ${invite.email}`}
                                title="Resend invite"
                                disabled={isPending}
                                onClick={() =>
                                  runTeamAction(() =>
                                    resendTeamInviteAction(invite.id)
                                  )
                                }
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label={`Revoke invite to ${invite.email}`}
                                title="Revoke invite"
                                disabled={isPending}
                                onClick={() =>
                                  runTeamAction(() =>
                                    revokeTeamInviteAction(invite.id)
                                  )
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={Lock}
          title="Notifications / Audit"
          description="Persist alert preferences and review recent configuration events."
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              runAction("Notifications", () =>
                updateNotificationSettingsAction(notifications)
              );
            }}
          >
            {[
              ["emailEnabled", "Enable email notifications"],
              ["importFailures", "Import failure alerts"],
              ["taskAssignments", "Task assignment alerts"],
              ["slaBreaches", "SLA breach alerts"],
              ["aiFailures", "AI failure alerts"],
              ["dailyDigest", "Daily digest"],
            ].map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]"
              >
                <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                  {label}
                </span>
                <Switch
                  disabled={!canManageSettings}
                  checked={notifications[key as keyof typeof notifications]}
                  onCheckedChange={(checked) =>
                    setNotifications((current) => ({ ...current, [key]: checked }))
                  }
                />
              </div>
            ))}
            {canManageSettings ? (
              <SaveButton pending={isPending}>Save notifications</SaveButton>
            ) : null}
          </form>
          <div className="mt-5 rounded-xl border border-[#E9ECEF] dark:border-[#27272a]">
            {!canViewAudit ? (
              <div className="px-4 py-5 text-sm text-[#6B7280] dark:text-[#94A3B8]">
                Audit events are visible to roles with audit access.
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="px-4 py-5 text-sm text-[#6B7280] dark:text-[#94A3B8]">
                No organization-scoped audit events yet.
              </div>
            ) : (
              auditEvents.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-[#F3F4F6] px-4 py-3 text-sm last:border-b-0 dark:border-[#27272a]"
                >
                  <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {event.action}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                    {event.actorName ?? event.actorEmail ?? "System"} ·{" "}
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
