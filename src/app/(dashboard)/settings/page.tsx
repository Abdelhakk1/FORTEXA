"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Save, User, Shield, Bell, Database, Key, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared/page-header";

type SettingsTab = "profile" | "security" | "notifications" | "integrations" | "api-keys";
type SaveState = "idle" | "saving" | "saved";

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof User }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Database },
  { id: "api-keys", label: "API Keys", icon: Key },
];

const fieldClassName = "h-10 border-[#E9ECEF] bg-[#F9FAFB] text-[#1A1A2E] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#fafafa]";

const initialProfile = {
  fullName: "Admin User",
  email: "admin@fortexa.com",
  title: "Security Operations Lead",
  timezone: "Africa/Algiers (UTC+01:00)",
};

const initialSecurity = {
  mfaRequired: true,
  sessionTimeout: "30 minutes",
  ipAllowlist: "10.0.0.0/8, 172.16.0.0/12",
  loginDigest: true,
};

const initialNotifications = {
  criticalAlerts: true,
  dailyDigest: true,
  scanImportErrors: true,
  remediationDigest: false,
};

const initialIntegrations = {
  siemEndpoint: "https://siem.fortexa.internal/ingest",
  ticketingProject: "SECOPS",
  defaultScanner: "Nessus",
  autoMapAssets: true,
};

const initialApiPreferences = {
  allowPersonalTokens: false,
  requireRotationNotice: true,
};

const initialApiKeys = [
  { id: "key-1", name: "SOC automation", scope: "Read / alerts / reports", preview: "ftx_live_9d82••••••a4c1", lastUsed: "2026-04-18", status: "Active" },
  { id: "key-2", name: "GRC reporting", scope: "Read / exports", preview: "ftx_live_1f23••••••b884", lastUsed: "2026-04-12", status: "Active" },
];

function getUrlTab(): SettingsTab {
  if (typeof window === "undefined") {
    return "profile";
  }

  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  return tabs.some((tab) => tab.id === requestedTab) ? (requestedTab as SettingsTab) : "profile";
}

function subscribeToLocation(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

export default function SettingsPage() {
  const activeTab = useSyncExternalStore<SettingsTab>(subscribeToLocation, getUrlTab, () => "profile");

  const [profile, setProfile] = useState(initialProfile);
  const [security, setSecurity] = useState(initialSecurity);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [apiPreferences, setApiPreferences] = useState(initialApiPreferences);
  const [apiKeys, setApiKeys] = useState(initialApiKeys);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<SettingsTab, SaveState>>({
    profile: "idle",
    security: "idle",
    notifications: "idle",
    integrations: "idle",
    "api-keys": "idle",
  });

  const dirtyMap = useMemo<Record<SettingsTab, boolean>>(
    () => ({
      profile: JSON.stringify(profile) !== JSON.stringify(initialProfile),
      security: JSON.stringify(security) !== JSON.stringify(initialSecurity),
      notifications: JSON.stringify(notifications) !== JSON.stringify(initialNotifications),
      integrations: JSON.stringify(integrations) !== JSON.stringify(initialIntegrations),
      "api-keys": JSON.stringify(apiPreferences) !== JSON.stringify(initialApiPreferences),
    }),
    [apiPreferences, integrations, notifications, profile, security]
  );

  const currentTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const currentSaveState = saveState[activeTab];
  const currentIsDirty = dirtyMap[activeTab];

  const switchTab = (tab: SettingsTab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    window.history.replaceState(null, "", `/settings?${params.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const saveCurrentTab = () => {
    if (!currentIsDirty) return;

    setSaveState((current) => ({ ...current, [activeTab]: "saving" }));
    window.setTimeout(() => {
      setSaveState((current) => ({ ...current, [activeTab]: "saved" }));
    }, 700);
  };

  const resetCurrentTab = () => {
    if (activeTab === "profile") setProfile(initialProfile);
    if (activeTab === "security") setSecurity(initialSecurity);
    if (activeTab === "notifications") setNotifications(initialNotifications);
    if (activeTab === "integrations") setIntegrations(initialIntegrations);
    if (activeTab === "api-keys") setApiPreferences(initialApiPreferences);
    setSaveState((current) => ({ ...current, [activeTab]: "idle" }));
  };

  const copyKey = async (id: string, preview: string) => {
    await navigator.clipboard.writeText(preview);
    setCopiedKey(id);
    window.setTimeout(() => setCopiedKey(null), 1200);
  };

  const rotateKey = (id: string) => {
    setApiKeys((currentKeys) =>
      currentKeys.map((key) =>
        key.id === id
          ? { ...key, preview: `${key.preview.slice(0, 12)}••••rot`, lastUsed: "Just now" }
          : key
      )
    );
  };

  return (
    <div>
      <PageHeader
        title="Settings & Configurations"
        description="Manage your account, organization preferences, and platform integrations"
        actions={
          <Button
            onClick={saveCurrentTab}
            disabled={!currentIsDirty || currentSaveState === "saving"}
            className="gradient-accent border-0 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="mr-2 h-4 w-4" />
            {currentSaveState === "saving" ? "Saving..." : `Save ${currentTabMeta.label}`}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                onClick={() => switchTab(tab.id)}
                aria-pressed={isActive}
                className={`w-full justify-start ${isActive ? "bg-[#EFF6FF] font-semibold text-[#0C5CAB] dark:bg-[#1a1a22] dark:text-[#60A5FA]" : "text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:text-[#94A3B8] dark:hover:bg-[#1a1a22] dark:hover:text-[#60A5FA]"}`}
              >
                <Icon className="mr-2 h-4 w-4" /> {tab.label}
              </Button>
            );
          })}
        </div>

        <div className="space-y-6 md:col-span-3">
          <Card className="border border-[#E9ECEF] bg-white p-6 dark:border-[#27272a] dark:bg-[#141419]">
            <div className="mb-6 flex flex-col gap-3 border-b border-[#F3F4F6] pb-4 dark:border-[#27272a] sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1A1A2E] dark:text-[#fafafa]">{currentTabMeta.label}</h3>
                <p className="mt-1 text-sm text-[#6B7280] dark:text-[#94A3B8]">
                  {activeTab === "profile" && "Keep your identity and contact details accurate for notifications and audit trails."}
                  {activeTab === "security" && "Control session, MFA, and trusted access policies for the platform."}
                  {activeTab === "notifications" && "Decide which events should interrupt the team and which should roll up into digests."}
                  {activeTab === "integrations" && "Review external system connections and default automation behavior."}
                  {activeTab === "api-keys" && "Manage service credentials and token issuance preferences for secure automation."}
                </p>
              </div>
              <div className="text-xs">
                <p className={`${currentIsDirty ? "text-amber-600 dark:text-amber-400" : "text-[#6B7280] dark:text-[#94A3B8]"}`}>
                  {currentSaveState === "saved"
                    ? "Saved locally for this session"
                    : currentIsDirty
                      ? "Unsaved changes"
                      : "Up to date"}
                </p>
              </div>
            </div>

            {activeTab === "profile" && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="full-name" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Full Name</Label>
                  <Input id="full-name" value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} className={fieldClassName} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email-address" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Email Address</Label>
                  <Input id="email-address" type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} className={fieldClassName} />
                </div>
                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Job Title</Label>
                    <Input id="title" value={profile.title} onChange={(event) => setProfile((current) => ({ ...current, title: event.target.value }))} className={fieldClassName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="timezone" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Timezone</Label>
                    <Input id="timezone" value={profile.timezone} onChange={(event) => setProfile((current) => ({ ...current, timezone: event.target.value }))} className={fieldClassName} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Role</Label>
                  <Input value="Administrator" disabled className="h-10 cursor-not-allowed border-[#E9ECEF] bg-[#F3F4F6] text-[#9CA3AF] dark:border-[#27272a] dark:bg-[#0f0f13] dark:text-[#64748B]" />
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
                  <div>
                    <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Require MFA for all privileged logins</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Applies to administrators and remediation owners.</p>
                  </div>
                  <Switch checked={security.mfaRequired} onCheckedChange={(checked) => setSecurity((current) => ({ ...current, mfaRequired: checked }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="session-timeout" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Session Timeout</Label>
                  <Input id="session-timeout" value={security.sessionTimeout} onChange={(event) => setSecurity((current) => ({ ...current, sessionTimeout: event.target.value }))} className={fieldClassName} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="allowlist" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Trusted Network Ranges</Label>
                  <Input id="allowlist" value={security.ipAllowlist} onChange={(event) => setSecurity((current) => ({ ...current, ipAllowlist: event.target.value }))} className={fieldClassName} />
                  <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Comma-separated CIDR ranges for privileged access monitoring.</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
                  <div>
                    <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Daily login digest</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Send a daily recap of authentication anomalies.</p>
                  </div>
                  <Switch checked={security.loginDigest} onCheckedChange={(checked) => setSecurity((current) => ({ ...current, loginDigest: checked }))} />
                </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-4">
                {[
                  {
                    id: "criticalAlerts",
                    label: "Critical and KEV alerts",
                    description: "Instant notification for active exploitation and critical platform risk.",
                    checked: notifications.criticalAlerts,
                  },
                  {
                    id: "dailyDigest",
                    label: "Daily posture digest",
                    description: "Roll up posture trends, imports, and remediation drift into one summary.",
                    checked: notifications.dailyDigest,
                  },
                  {
                    id: "scanImportErrors",
                    label: "Scan import failures",
                    description: "Alert when imports produce parsing errors or unmatched assets.",
                    checked: notifications.scanImportErrors,
                  },
                  {
                    id: "remediationDigest",
                    label: "Weekly remediation digest",
                    description: "Send overdue and at-risk task summaries to remediation owners.",
                    checked: notifications.remediationDigest,
                  },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
                    <div className="pr-4">
                      <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">{item.label}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">{item.description}</p>
                    </div>
                    <Switch
                      checked={item.checked}
                      onCheckedChange={(checked) => setNotifications((current) => ({ ...current, [item.id]: checked }))}
                    />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="siem-endpoint" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">SIEM Endpoint</Label>
                  <Input id="siem-endpoint" value={integrations.siemEndpoint} onChange={(event) => setIntegrations((current) => ({ ...current, siemEndpoint: event.target.value }))} className={fieldClassName} />
                </div>
                <div className="grid gap-2 md:grid-cols-2 md:gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ticketing-project" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Ticketing Project</Label>
                    <Input id="ticketing-project" value={integrations.ticketingProject} onChange={(event) => setIntegrations((current) => ({ ...current, ticketingProject: event.target.value }))} className={fieldClassName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="default-scanner" className="text-sm font-medium text-[#1A1A2E] dark:text-[#fafafa]">Default Scanner Source</Label>
                    <Input id="default-scanner" value={integrations.defaultScanner} onChange={(event) => setIntegrations((current) => ({ ...current, defaultScanner: event.target.value }))} className={fieldClassName} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] px-4 py-3 dark:border-[#27272a] dark:bg-[#1a1a22]">
                  <div>
                    <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Automatically map matched assets</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Auto-link normalized findings to known assets when identifiers align.</p>
                  </div>
                  <Switch checked={integrations.autoMapAssets} onCheckedChange={(checked) => setIntegrations((current) => ({ ...current, autoMapAssets: checked }))} />
                </div>
              </div>
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#DBEAFE] text-[#0C5CAB] dark:bg-[#0A1A2D] dark:text-[#60A5FA]">
                        <Key className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Token Policies</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Local preferences for issuing and rotating service credentials.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="personal-tokens" className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">Allow personal access tokens</Label>
                        <Switch id="personal-tokens" checked={apiPreferences.allowPersonalTokens} onCheckedChange={(checked) => setApiPreferences((current) => ({ ...current, allowPersonalTokens: checked }))} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="rotation-notice" className="text-sm text-[#1A1A2E] dark:text-[#fafafa]">Require rotation reminder</Label>
                        <Switch id="rotation-notice" checked={apiPreferences.requireRotationNotice} onCheckedChange={(checked) => setApiPreferences((current) => ({ ...current, requireRotationNotice: checked }))} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E9ECEF] bg-[#F9FAFB] p-4 dark:border-[#27272a] dark:bg-[#1a1a22]">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">Governance</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">Keys are scoped to read-only integrations by default in this mock environment.</p>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-[#6B7280] dark:text-[#94A3B8]">
                      Rotate any long-lived token before handing the project to the backend team so the final API service can own issuance and audit logging cleanly.
                    </p>
                  </div>
                </div>

                <Separator className="bg-[#F3F4F6] dark:bg-[#27272a]" />

                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="rounded-xl border border-[#E9ECEF] p-4 dark:border-[#27272a]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[#1A1A2E] dark:text-[#fafafa]">{key.name}</p>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{key.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-[#6B7280] dark:text-[#94A3B8]">{key.scope}</p>
                          <p className="mt-2 font-mono text-xs text-[#1A1A2E] dark:text-[#fafafa]">{key.preview}</p>
                          <p className="mt-1 text-xs text-[#9CA3AF] dark:text-[#64748B]">Last used: {key.lastUsed}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => copyKey(key.id, key.preview)}
                            className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            {copiedKey === key.id ? "Copied" : "Copy"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => rotateKey(key.id)}
                            className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rotate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#F3F4F6] pt-4 dark:border-[#27272a]">
              <p className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
                {currentIsDirty ? "You have unsaved local changes in this section." : "No pending changes in this section."}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetCurrentTab}
                  disabled={!currentIsDirty}
                  className="border-[#E9ECEF] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#0C5CAB] dark:border-[#27272a] dark:bg-[#1a1a22] dark:text-[#94A3B8] dark:hover:bg-[#27272a] dark:hover:text-[#60A5FA]"
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  onClick={saveCurrentTab}
                  disabled={!currentIsDirty || currentSaveState === "saving"}
                  className="gradient-accent border-0 text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {currentSaveState === "saving" ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
