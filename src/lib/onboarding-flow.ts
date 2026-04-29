import {
  BriefcaseBusiness,
  Building2,
  Clock,
  Database,
  ShieldCheck,
  Upload,
} from "lucide-react";

export const ONBOARDING_STEPS = [
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "environment", label: "Environment", icon: ShieldCheck },
  { id: "remediation", label: "Remediation policy", icon: Clock },
  { id: "data", label: "First data", icon: Upload },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export const TEAM_TYPE_VALUES = [
  "atm_operator",
  "bank_security",
  "managed_security_provider",
  "internal_security",
  "other",
] as const;

export const TEAM_TYPE_OPTIONS = [
  { value: "atm_operator", label: "ATM/GAB operator" },
  { value: "bank_security", label: "Bank security team" },
  { value: "managed_security_provider", label: "Managed security provider" },
  { value: "internal_security", label: "Internal security team" },
  { value: "other", label: "Other" },
] as const;

export const PRIMARY_ENVIRONMENT_VALUES = [
  "atm_gab_devices",
  "atm_gab_branch_systems",
  "back_office_servers_endpoints",
  "mixed_infrastructure",
  "customer_managed_environments",
  "other",
] as const;

export const PRIMARY_ENVIRONMENT_OPTIONS = [
  { value: "atm_gab_devices", label: "ATM/GAB devices" },
  { value: "atm_gab_branch_systems", label: "ATM/GAB + branch systems" },
  {
    value: "back_office_servers_endpoints",
    label: "Back-office servers and endpoints",
  },
  { value: "mixed_infrastructure", label: "Mixed infrastructure" },
  {
    value: "customer_managed_environments",
    label: "Customer-managed environments",
  },
  { value: "other", label: "Other" },
] as const;

export const REMEDIATION_OWNERSHIP_VALUES = [
  "we_remediate_directly",
  "coordinate_field_operations",
  "vendor_remediates",
  "shared_internal_vendor",
  "triage_and_handoff",
] as const;

export const REMEDIATION_OWNERSHIP_OPTIONS = [
  { value: "we_remediate_directly", label: "We remediate directly" },
  { value: "coordinate_field_operations", label: "We coordinate field operations" },
  { value: "vendor_remediates", label: "A vendor usually remediates" },
  {
    value: "shared_internal_vendor",
    label: "Internal team and vendor share ownership",
  },
  { value: "triage_and_handoff", label: "We triage and hand off" },
] as const;

export const OPERATIONAL_CONSTRAINT_VALUES = [
  "after_hours_only",
  "formal_change_approval",
  "field_visit_required",
  "prefer_compensating_controls",
] as const;

export const OPERATIONAL_CONSTRAINT_OPTIONS = [
  { value: "after_hours_only", label: "After-hours changes only" },
  { value: "formal_change_approval", label: "Formal change approval required" },
  { value: "field_visit_required", label: "Field visit often required" },
  {
    value: "prefer_compensating_controls",
    label: "Prefer compensating controls first",
  },
] as const;

export const REMEDIATION_POLICY_VALUES = [
  "standard",
  "aggressive",
  "conservative",
] as const;

export const REMEDIATION_POLICY_PRESETS = [
  {
    id: "standard",
    label: "Standard",
    description: "Balanced remediation windows for normal vulnerability operations.",
    dueDays: { critical: 7, high: 14, medium: 30, low: 90 },
  },
  {
    id: "aggressive",
    label: "Aggressive",
    description: "Shorter windows for high-pressure security operations.",
    dueDays: { critical: 3, high: 7, medium: 21, low: 60 },
  },
  {
    id: "conservative",
    label: "Conservative",
    description: "Longer windows for constrained or change-controlled environments.",
    dueDays: { critical: 14, high: 30, medium: 60, low: 120 },
  },
] as const;

export type RemediationPolicyPresetId =
  (typeof REMEDIATION_POLICY_PRESETS)[number]["id"];

export const REMEDIATION_POLICY_PRESET_MAP = Object.fromEntries(
  REMEDIATION_POLICY_PRESETS.map((preset) => [preset.id, preset])
) as Record<RemediationPolicyPresetId, (typeof REMEDIATION_POLICY_PRESETS)[number]>;

export const FIRST_DATA_VALUES = [
  "nessus_upload",
  "sample_data",
  "csv_assets",
  "skip",
] as const;

export const FIRST_DATA_OPTIONS = [
  {
    value: "nessus_upload",
    label: "Upload Nessus file",
    description:
      "Best first step. Import scanner evidence to create assets, findings, prioritization, reports, and playbooks.",
    href: "/scan-import",
    icon: Upload,
    priority: "primary",
  },
  {
    value: "sample_data",
    label: "Use sample data",
    description: "Explore Fortexa with safe demo assets and findings.",
    href: "/dashboard",
    icon: Database,
    priority: "secondary",
  },
  {
    value: "csv_assets",
    label: "Import CSV assets",
    description: "Inventory only. Findings and playbooks require scanner evidence.",
    href: "/assets",
    icon: BriefcaseBusiness,
    priority: "tertiary",
  },
  {
    value: "skip",
    label: "Skip for now",
    description: "Go to dashboard and finish setup later.",
    href: "/dashboard",
    icon: Clock,
    priority: "quiet",
  },
] as const;

export type FirstDataChoice = (typeof FIRST_DATA_VALUES)[number];

export function normalizeOnboardingStep(
  value: string | null | undefined
): OnboardingStepId {
  if (ONBOARDING_STEPS.some((step) => step.id === value)) {
    return value as OnboardingStepId;
  }

  if (value === "context" || value === "site") {
    return "environment";
  }

  if (value === "sla") {
    return "remediation";
  }

  if (value === "ai" || value === "data" || value === "complete") {
    return "data";
  }

  return "workspace";
}
