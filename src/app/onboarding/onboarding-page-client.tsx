"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Info, Lock } from "lucide-react";
import {
  completeOnboardingAction,
  saveOnboardingEnvironmentAction,
  saveOnboardingRemediationPolicyAction,
  saveOnboardingWorkspaceAction,
  seedSampleAssetsAction,
} from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FIRST_DATA_OPTIONS,
  OPERATIONAL_CONSTRAINT_OPTIONS,
  ONBOARDING_STEPS,
  PRIMARY_ENVIRONMENT_OPTIONS,
  REMEDIATION_OWNERSHIP_OPTIONS,
  REMEDIATION_POLICY_PRESETS,
  TEAM_TYPE_OPTIONS,
  normalizeOnboardingStep,
  type FirstDataChoice,
  type OnboardingStepId,
  type RemediationPolicyPresetId,
} from "@/lib/onboarding-flow";
import type {
  OrganizationRecord,
  OrganizationSettingsRecord,
} from "@/lib/services/organizations";

const commonTimezones = [
  "Africa/Algiers",
  "UTC",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "Asia/Dubai",
];

const fieldClass =
  "h-[46px] rounded-[9px] border-[#CAD6E4] bg-white px-4 text-[14px] text-[#071633] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-[#7B88A2] focus-visible:border-[#1677FF] focus-visible:ring-3 focus-visible:ring-[#1677FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#64748B] dark:border-[#CAD6E4] dark:bg-white dark:text-[#071633] dark:placeholder:text-[#7B88A2]";
const selectClass =
  "h-[46px] w-full rounded-[9px] border border-[#CAD6E4] bg-white px-4 text-[14px] text-[#071633] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-colors focus:border-[#1677FF] focus:ring-3 focus:ring-[#1677FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#64748B] dark:border-[#CAD6E4] dark:bg-white dark:text-[#071633]";
const labelClass = "text-[12px] font-medium leading-none text-[#071633]";
const fieldHelpClass = "mt-1 text-[12px] leading-[1.45] text-[#66738D]";
const fieldErrorClass = "text-xs font-medium text-red-600";
const primaryButtonClass =
  "h-[46px] rounded-[8px] border-0 bg-[#0D6BFF] px-5 text-[14px] font-medium text-white shadow-[0_10px_22px_rgba(13,107,255,0.2)] transition-all hover:bg-[#075BD9] focus-visible:ring-3 focus-visible:ring-[#0D6BFF]/20 disabled:bg-[#8DBBFF] disabled:text-white dark:bg-[#0D6BFF] dark:text-white dark:hover:bg-[#075BD9]";
const cardSelectClass =
  "flex min-h-[82px] cursor-pointer items-start gap-3 rounded-[10px] border bg-white p-4 text-left transition-all hover:border-[#9AC3FF] hover:bg-[#F6FAFF] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D6BFF]/15 disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white dark:hover:bg-[#F6FAFF]";

type OnboardingActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p className={fieldErrorClass} role="alert">
      {messages[0]}
    </p>
  );
}

function normalizeTeamType(value: string | null | undefined) {
  return TEAM_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof TEAM_TYPE_OPTIONS)[number]["value"])
    : "atm_operator";
}

function normalizePrimaryEnvironment(value: unknown) {
  return PRIMARY_ENVIRONMENT_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof PRIMARY_ENVIRONMENT_OPTIONS)[number]["value"])
    : "atm_gab_devices";
}

function normalizeRemediationOwnership(value: unknown) {
  return REMEDIATION_OWNERSHIP_OPTIONS.some((option) => option.value === value)
    ? (value as (typeof REMEDIATION_OWNERSHIP_OPTIONS)[number]["value"])
    : "we_remediate_directly";
}

function normalizeConstraints(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  const allowed = new Set(OPERATIONAL_CONSTRAINT_OPTIONS.map((option) => option.value));

  return values
    .filter((entry): entry is (typeof OPERATIONAL_CONSTRAINT_OPTIONS)[number]["value"] =>
      typeof entry === "string" && allowed.has(entry as never)
    )
    .slice(0, 3);
}

function normalizePolicyPreset(value: unknown): RemediationPolicyPresetId {
  return REMEDIATION_POLICY_PRESETS.some((preset) => preset.id === value)
    ? (value as RemediationPolicyPresetId)
    : "standard";
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function OnboardingPageClient({
  organization,
  settings,
}: {
  organization: OrganizationRecord | null;
  settings: OrganizationSettingsRecord | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<OnboardingStepId>(
    normalizeOnboardingStep(organization?.onboardingStep)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [workspace, setWorkspace] = useState({
    name: organization?.name ?? "",
    teamType: normalizeTeamType(organization?.companyType),
    timezone: organization?.timezone ?? getBrowserTimezone(),
  });
  const operatingContext = settings?.operatingContext ?? {};
  const [environment, setEnvironment] = useState({
    primaryEnvironment: normalizePrimaryEnvironment(
      operatingContext.primaryEnvironment
    ),
    remediationOwnership: normalizeRemediationOwnership(
      operatingContext.remediationOwnership
    ),
    operationalConstraints: normalizeConstraints(
      operatingContext.operationalConstraints
    ),
  });
  const [policy, setPolicy] = useState({
    preset: normalizePolicyPreset(operatingContext.remediationPolicyPreset),
    slaBreachAlertsEnabled:
      settings?.notifications?.slaBreaches === false ? false : true,
  });

  const stepIndex = useMemo(
    () => Math.max(0, ONBOARDING_STEPS.findIndex((item) => item.id === step)),
    [step]
  );
  const stepCopy: Record<OnboardingStepId, { title: string; description: string }> = {
    workspace: {
      title: "Workspace",
      description:
        "Create the active Fortexa workspace and defaults used for imports, reports, alerts, audit events, and due dates.",
    },
    environment: {
      title: "Environment",
      description:
        "Capture only the operating context that changes prioritization and remediation playbooks.",
    },
    remediation: {
      title: "Remediation policy",
      description:
        "Choose a simple default due-date posture for scanner-validated vulnerabilities.",
    },
    data: {
      title: "First data",
      description:
        "Start with scanner evidence, explore with sample data, import inventory, or continue to an empty dashboard.",
    },
  };

  function submit(
    nextStep: OnboardingStepId,
    action: () => Promise<OnboardingActionResult>
  ) {
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setStep(nextStep);
        router.refresh();
      } else {
        setMessage(result.message ?? "This setup step could not be saved.");
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  function finish(firstDataChoice: FirstDataChoice, redirectTo = "/dashboard") {
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await completeOnboardingAction({ firstDataChoice });
      if (result.ok) {
        router.push(redirectTo);
      } else {
        setMessage(result.message ?? "Onboarding could not be completed.");
      }
    });
  }

  function seedSampleData() {
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const seeded = await seedSampleAssetsAction();
      if (!seeded.ok) {
        setMessage(seeded.message);
        return;
      }
      const completed = await completeOnboardingAction({
        firstDataChoice: "sample_data",
      });
      if (completed.ok) {
        router.push("/dashboard");
      } else {
        setMessage(completed.message);
      }
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#071633] dark:bg-[#F8FAFC] dark:text-[#071633] lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <header className="shrink-0 border-b border-[#E1E7F0] bg-white/95 dark:border-[#E1E7F0] dark:bg-white/95">
        <div className="mx-auto flex h-[70px] w-full max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:h-[72px] lg:px-12 xl:px-14 2xl:px-16">
          <div className="relative h-[42px] w-[160px] overflow-hidden sm:h-[46px] sm:w-[180px]">
            <Image
              src="/pics/logo.png"
              alt="Fortexa"
              fill
              sizes="180px"
              className="object-cover object-center"
              priority
            />
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#22324E]">
              SECURE. STRONG. FORWARD.
            </span>
            <div className="h-8 w-px bg-[#1677FF]" aria-hidden="true" />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-5 pb-6 pt-5 sm:px-8 lg:min-h-0 lg:px-12 lg:pb-4 lg:pt-4 xl:px-14 2xl:px-16">
        <div className="shrink-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#006DFF]">
            FORTEXA FIRST-RUN SETUP
          </p>
          <h1 className="mt-3 max-w-[1040px] text-[27px] font-bold leading-[1.15] tracking-normal text-[#071633] sm:text-[31px] lg:text-[32px]">
            Configure vulnerability operations from scanner evidence
          </h1>
          <p className="mt-2.5 max-w-[980px] text-[14px] leading-5 text-[#6B7894]">
            Four focused setup steps. Advanced regions, vendors, AI policy, and custom SLA matrices stay in Settings.
          </p>
        </div>

        <div className="mt-4 grid flex-1 gap-5 lg:min-h-0 lg:grid-cols-[314px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-6">
          <aside className="flex min-h-0 flex-col rounded-[16px] border border-[#DDE6F2] bg-white p-4 shadow-[0_16px_36px_rgba(16,31,55,0.055)] dark:border-[#DDE6F2] dark:bg-white">
            <nav
              aria-label="Onboarding progress"
              className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible"
            >
              {ONBOARDING_STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = item.id === step;
                const completed = index < stepIndex;

                return (
                  <div
                    key={item.id}
                    aria-current={active ? "step" : undefined}
                    className={`flex h-[50px] min-w-[172px] items-center gap-4 rounded-[10px] border px-4 text-[14px] transition-colors lg:min-w-0 ${
                      active
                        ? "border-[#82B6FF] bg-[#F3F8FF] text-[#006DFF] shadow-[0_8px_20px_rgba(13,107,255,0.08)]"
                        : completed
                          ? "border-[#E1E8F2] bg-white text-[#17233B]"
                          : "border-[#E1E8F2] bg-white text-[#2B3854]"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-[#006DFF]" : "text-[#45526B]"}`} />
                    <span className="font-medium whitespace-nowrap">{item.label}</span>
                    {completed && (
                      <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-[#10B981]" />
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="mt-auto hidden border-t border-[#E8EEF6] pt-5 lg:flex lg:items-start lg:gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#9AC3FF] bg-[#F5F9FF] text-[#006DFF]">
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-[12px] leading-5 text-[#8390A8]">
                Imports remain scoped to this workspace. Scanner payloads are only parsed after an explicit upload.
              </p>
            </div>
          </aside>

          <section className="min-w-0 lg:flex lg:min-h-0 lg:flex-col">
            {message && (
              <div className="mb-3 shrink-0 rounded-[10px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
                {message}
              </div>
            )}

            <div className="flex-1 rounded-[16px] border border-[#DDE6F2] bg-white px-6 py-6 shadow-[0_16px_36px_rgba(16,31,55,0.05)] dark:border-[#DDE6F2] dark:bg-white sm:px-7 lg:min-h-0 lg:overflow-y-auto lg:px-9 lg:py-7">
              <div className="mb-5">
                <h2 className="text-[21px] font-bold leading-tight tracking-normal text-[#071633]">
                  {stepCopy[step].title}
                </h2>
                <p className="mt-3 max-w-[880px] text-[13px] leading-5 text-[#66738D]">
                  {stepCopy[step].description}
                </p>
              </div>

              <div className="max-w-[1030px]">
                {step === "workspace" && (
                  <form
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit("environment", () =>
                        saveOnboardingWorkspaceAction(workspace)
                      );
                    }}
                  >
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <Label htmlFor="org-name" className={labelClass}>
                          Organization name
                        </Label>
                        <Input
                          id="org-name"
                          placeholder="Example: Atlas ATM Security"
                          value={workspace.name}
                          onChange={(event) =>
                            setWorkspace((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          className={fieldClass}
                          required
                        />
                        <p className={fieldHelpClass}>
                          The workspace that owns scanner imports, findings, reports, and audit events.
                        </p>
                        <FieldError messages={fieldErrors.name} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="timezone" className={labelClass}>
                          Timezone
                        </Label>
                        <Input
                          id="timezone"
                          list="fortexa-timezones"
                          placeholder="Africa/Algiers"
                          value={workspace.timezone}
                          onChange={(event) =>
                            setWorkspace((current) => ({
                              ...current,
                              timezone: event.target.value,
                            }))
                          }
                          className={fieldClass}
                          required
                        />
                        <datalist id="fortexa-timezones">
                          {commonTimezones.map((timezone) => (
                            <option key={timezone} value={timezone} />
                          ))}
                        </datalist>
                        <p className={fieldHelpClass}>
                          Used for SLA dates, audit events, and report timestamps.
                        </p>
                        <FieldError messages={fieldErrors.timezone} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {TEAM_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={workspace.teamType === option.value}
                          onClick={() =>
                            setWorkspace((current) => ({
                              ...current,
                              teamType: option.value,
                            }))
                          }
                          className={`${cardSelectClass} ${
                            workspace.teamType === option.value
                              ? "border-[#0D6BFF] bg-[#F3F8FF]"
                              : "border-[#E1E8F2]"
                          }`}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#B8C7DC]">
                            {workspace.teamType === option.value && (
                              <span className="h-2.5 w-2.5 rounded-full bg-[#0D6BFF]" />
                            )}
                          </span>
                          <span className="text-[14px] font-semibold text-[#071633]">
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <FieldError messages={fieldErrors.teamType} />
                    <Button type="submit" disabled={isPending} className={primaryButtonClass}>
                      {isPending ? "Saving..." : "Save and continue"}
                      {!isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </form>
                )}

                {step === "environment" && (
                  <form
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit("remediation", () =>
                        saveOnboardingEnvironmentAction(environment)
                      );
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {PRIMARY_ENVIRONMENT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={environment.primaryEnvironment === option.value}
                          onClick={() =>
                            setEnvironment((current) => ({
                              ...current,
                              primaryEnvironment: option.value,
                            }))
                          }
                          className={`${cardSelectClass} ${
                            environment.primaryEnvironment === option.value
                              ? "border-[#0D6BFF] bg-[#F3F8FF]"
                              : "border-[#E1E8F2]"
                          }`}
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#B8C7DC]">
                            {environment.primaryEnvironment === option.value && (
                              <span className="h-2.5 w-2.5 rounded-full bg-[#0D6BFF]" />
                            )}
                          </span>
                          <span className="text-[14px] font-semibold text-[#071633]">
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <FieldError messages={fieldErrors.primaryEnvironment} />

                    <div className="grid gap-1">
                      <Label htmlFor="remediation-ownership" className={labelClass}>
                        Remediation ownership
                      </Label>
                      <select
                        id="remediation-ownership"
                        value={environment.remediationOwnership}
                        onChange={(event) =>
                          setEnvironment((current) => ({
                            ...current,
                            remediationOwnership: event.target.value as typeof environment.remediationOwnership,
                          }))
                        }
                        className={selectClass}
                      >
                        {REMEDIATION_OWNERSHIP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <FieldError messages={fieldErrors.remediationOwnership} />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className={labelClass}>Operational constraints</Label>
                        <span className="text-[12px] text-[#66738D]">Optional, choose up to 3</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {OPERATIONAL_CONSTRAINT_OPTIONS.map((option) => {
                          const selected = environment.operationalConstraints.includes(option.value);

                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setEnvironment((current) => {
                                  if (selected) {
                                    return {
                                      ...current,
                                      operationalConstraints:
                                        current.operationalConstraints.filter(
                                          (value) => value !== option.value
                                        ),
                                    };
                                  }

                                  if (current.operationalConstraints.length >= 3) {
                                    return current;
                                  }

                                  return {
                                    ...current,
                                    operationalConstraints: [
                                      ...current.operationalConstraints,
                                      option.value,
                                    ],
                                  };
                                })
                              }
                              className={`min-h-[42px] rounded-full border px-4 text-[13px] font-medium transition-colors ${
                                selected
                                  ? "border-[#0D6BFF] bg-[#EFF6FF] text-[#0C5CAB]"
                                  : "border-[#DCE5F2] bg-white text-[#2B3854] hover:border-[#9AC3FF]"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <FieldError messages={fieldErrors.operationalConstraints} />
                    </div>

                    <Button type="submit" disabled={isPending} className={primaryButtonClass}>
                      {isPending ? "Saving..." : "Save and continue"}
                      {!isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </form>
                )}

                {step === "remediation" && (
                  <form
                    className="space-y-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit("data", () =>
                        saveOnboardingRemediationPolicyAction(policy)
                      );
                    }}
                  >
                    <div className="grid gap-3 lg:grid-cols-3">
                      {REMEDIATION_POLICY_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          aria-pressed={policy.preset === preset.id}
                          onClick={() =>
                            setPolicy((current) => ({ ...current, preset: preset.id }))
                          }
                          className={`${cardSelectClass} min-h-[192px] flex-col ${
                            policy.preset === preset.id
                              ? "border-[#0D6BFF] bg-[#F3F8FF]"
                              : "border-[#E1E8F2]"
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="text-[15px] font-bold text-[#071633]">
                              {preset.label}
                            </span>
                            {policy.preset === preset.id && (
                              <CheckCircle2 className="h-5 w-5 text-[#0D6BFF]" />
                            )}
                          </span>
                          <span className="text-[12px] leading-5 text-[#66738D]">
                            {preset.description}
                          </span>
                          <span className="mt-auto grid w-full grid-cols-2 gap-2 text-[12px] text-[#24324A]">
                            <span>Critical: {preset.dueDays.critical}d</span>
                            <span>High: {preset.dueDays.high}d</span>
                            <span>Medium: {preset.dueDays.medium}d</span>
                            <span>Low: {preset.dueDays.low}d</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <FieldError messages={fieldErrors.preset} />

                    <label className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] border border-[#E1E8F2] bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={policy.slaBreachAlertsEnabled}
                        onChange={(event) =>
                          setPolicy((current) => ({
                            ...current,
                            slaBreachAlertsEnabled: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-[#0D6BFF]"
                      />
                      <span className="text-[14px] font-medium text-[#071633]">
                        Alert me when critical or high findings pass their target date.
                      </span>
                    </label>

                    <Button type="submit" disabled={isPending} className={primaryButtonClass}>
                      {isPending ? "Saving..." : "Save and continue"}
                      {!isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </form>
                )}

                {step === "data" && (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {FIRST_DATA_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const primary = option.priority === "primary";
                        const quiet = option.priority === "quiet";
                        const onClick =
                          option.value === "sample_data"
                            ? seedSampleData
                            : () => finish(option.value, option.href);

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={onClick}
                            disabled={isPending}
                            className={`flex min-h-[106px] cursor-pointer items-start gap-3 rounded-[12px] border p-4 text-left transition-all hover:border-[#9AC3FF] hover:bg-[#F6FAFF] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#0D6BFF]/15 disabled:cursor-not-allowed disabled:opacity-55 ${
                              primary
                                ? "border-[#0D6BFF] bg-[#F3F8FF] shadow-[0_12px_26px_rgba(13,107,255,0.10)] sm:col-span-2"
                                : quiet
                                  ? "border-[#E6EBF3] bg-white opacity-85"
                                  : "border-[#E1E8F2] bg-white"
                            }`}
                          >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                              primary
                                ? "bg-[#0D6BFF] text-white"
                                : "bg-[#F5F9FF] text-[#0D6BFF]"
                            }`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="block text-[15px] font-bold text-[#071633]">
                                {option.label}
                              </span>
                              <span className="mt-1.5 block text-[12px] leading-5 text-[#66738D]">
                                {option.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-start gap-2 rounded-[10px] border border-[#D8E6F8] bg-[#F6FAFF] px-4 py-3 text-[12px] leading-5 text-[#526078]">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0D6BFF]" />
                      <p>
                        AI playbooks are enabled later, just in time, from the first AI action. Scan import succeeds even when AI stays disabled.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
