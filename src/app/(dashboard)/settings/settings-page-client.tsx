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

type SaveState = {
  section: string;
  status: "saved" | "error";
  message: string;
} | null;

const fieldClass =
  "h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]";
const fieldHelpClass = "text-xs leading-5 text-[#6B7280] dark:text-[#94A3B8]";

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

  function runAction(
    section: string,
    action: () => Promise<{ ok: boolean; message?: string }>
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
      setSaveState({
        section,
        status: result.ok ? "saved" : "error",
        message: result.ok
          ? `${section} saved.`
          : result.message ?? `${section} could not be saved.`,
      });
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
        description="Persisted operating settings for ATM/GAB vulnerability operations"
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
                  The company or ATM/GAB operations team that owns this workspace.
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
                  <option value="atm_operator">ATM/GAB operator</option>
                  <option value="bank_security">Bank security team</option>
                  <option value="managed_security_provider">Managed security provider</option>
                  <option value="internal_security">Internal security team</option>
                  <option value="bank">Bank</option>
                  <option value="mssp">MSSP</option>
                  <option value="other">Other</option>
                </select>
                <p className={fieldHelpClass}>
                  Pick the closest ATM/GAB operating model.
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
                  placeholder="Example: Algiers ATM/GAB operations"
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
                  Default ATM/GAB area for reports and new records.
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
          description="Fortexa keeps scanner findings tied to ATM/GAB fleet operations."
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
            {[
              ["atmGabFleet", "ATM/GAB fleet"],
              ["vendorManagedSystems", "Vendor-managed systems"],
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
          icon={MapPin}
          title="ATM/GAB Coverage Areas"
          description="Create the default ATM/GAB fleet area used by reports and remediation context."
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
                  placeholder="Example: Algiers ATM/GAB fleet"
                  value={site.name}
                  onChange={(event) =>
                    setSite((current) => ({ ...current, name: event.target.value }))
                  }
                  className={fieldClass}
                />
                <p className={fieldHelpClass}>
                  A city, operating zone, or fleet group used by your ATM/GAB team.
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
                  <option value="atm_fleet">ATM/GAB fleet</option>
                  <option value="regional_group">ATM/GAB area group</option>
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
                Vendor-managed systems present
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
          <div className="grid gap-3">
            {[
              ["Nessus", "Active", true],
              ["OpenVAS", "Not implemented", false],
              ["Nmap", "Not implemented", false],
              ["Qualys", "Not implemented", false],
            ].map(([name, status, active]) => (
              <div
                key={name as string}
                className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]"
              >
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">
                    {name}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                    {status}
                  </p>
                </div>
                {active ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Button disabled variant="outline" size="sm">
                    Disabled
                  </Button>
                )}
              </div>
            ))}
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
