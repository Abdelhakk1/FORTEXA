export const ATM_PAYMENT_SERVICES_KEY = "monetique";
export const ATM_PAYMENT_SERVICES_LABEL = "ATM Payment Services";
export const DEFAULT_ASSET_CIDT_VALUE = 2;
export const DEFAULT_APPLICATION_CIDT_VALUE = 4;

export type CidtValue = 1 | 2 | 3 | 4;
export type SensitivityLevel = "S1" | "S2" | "S3" | "S4";
export type ApplicationProfile = 1 | 2 | 3 | 4;
export type BusinessPriorityValue = "p1" | "p2" | "p3" | "p4" | "p5";
export type GabCidtTemplateKey =
  | "indoor_agency"
  | "outdoor_agency"
  | "outdoor_public_commercial";
export type GabCidtSource =
  | "custom_override"
  | "exposure_template"
  | "application"
  | "system_default";
export type GabExposureType =
  | "unknown"
  | "indoor_agency"
  | "outdoor_agency"
  | "outdoor_commercial_center"
  | "outdoor_public_street";

export interface CidtVector {
  confidentiality: number | null | undefined;
  integrity: number | null | undefined;
  availability: number | null | undefined;
  traceability: number | null | undefined;
}

export interface ResolvedCidtVector {
  confidentiality: CidtValue;
  integrity: CidtValue;
  availability: CidtValue;
  traceability: CidtValue;
}

export interface GabCidtTemplate {
  templateKey: GabCidtTemplateKey | string;
  label: string;
  cidtConfidentiality: number | null | undefined;
  cidtIntegrity: number | null | undefined;
  cidtAvailability: number | null | undefined;
  cidtTraceability: number | null | undefined;
}

export interface ResolvedGabCidtContext {
  cidt: ResolvedCidtVector;
  sensitivity: CidtValue;
  sensitivityLabel: SensitivityLevel;
  source: GabCidtSource;
  sourceLabel: string;
  templateKey: GabCidtTemplateKey | null;
  isCustomOverride: boolean;
  missingContext: string[];
}

export interface BusinessPriorityFactors {
  applicationLabel: typeof ATM_PAYMENT_SERVICES_LABEL;
  summary: string;
  technicalSeverity: string;
  cvssScore: number | null;
  exploitMaturity: string;
  assetSensitivity: SensitivityLevel;
  assetCidtSource: string;
  assetCidtSourceLabel: string;
  assetCidt: ResolvedCidtVector;
  applicationSensitivity: SensitivityLevel;
  applicationProfile: `Profile ${ApplicationProfile}`;
  gabExposure: string;
  businessImpact: string;
  remediationUrgency: string;
  missingContext: string[];
  scoringInputs: {
    severityScore: number;
    exploitScore: number;
    assetSensitivityScore: number;
    applicationSensitivityScore: number;
    applicationProfileScore: number;
    gabExposureScore: number;
  };
}

export interface BusinessPriorityResult {
  riskScore: number;
  businessPriority: BusinessPriorityValue;
  assetSensitivity: CidtValue;
  applicationSensitivity: CidtValue;
  applicationProfile: ApplicationProfile;
  factors: BusinessPriorityFactors;
}

export const cidtCriterionLabels = {
  confidentiality: "Confidentiality",
  integrity: "Integrity",
  availability: "Availability",
  traceability: "Traceability",
} as const;

export const gabExposureLabels = {
  unknown: "Unknown",
  indoor_agency: "Indoor agency GAB",
  outdoor_agency: "Outdoor agency GAB",
  outdoor_commercial_center: "Outdoor commercial-center GAB",
  outdoor_public_street: "Outdoor public/street GAB",
} as const satisfies Record<GabExposureType, string>;

export const gabCidtTemplateLabels = {
  indoor_agency: "Indoor agency GAB template",
  outdoor_agency: "Outdoor agency GAB template",
  outdoor_public_commercial: "Outdoor public/commercial GAB template",
} as const satisfies Record<GabCidtTemplateKey, string>;

export const defaultGabCidtTemplates = [
  {
    templateKey: "indoor_agency",
    label: gabCidtTemplateLabels.indoor_agency,
    cidtConfidentiality: 3,
    cidtIntegrity: 3,
    cidtAvailability: 3,
    cidtTraceability: 3,
  },
  {
    templateKey: "outdoor_agency",
    label: gabCidtTemplateLabels.outdoor_agency,
    cidtConfidentiality: 3,
    cidtIntegrity: 3,
    cidtAvailability: 4,
    cidtTraceability: 3,
  },
  {
    templateKey: "outdoor_public_commercial",
    label: gabCidtTemplateLabels.outdoor_public_commercial,
    cidtConfidentiality: 3,
    cidtIntegrity: 3,
    cidtAvailability: 4,
    cidtTraceability: 4,
  },
] as const satisfies readonly GabCidtTemplate[];

const severityScores = {
  critical: 95,
  high: 80,
  medium: 55,
  low: 28,
  info: 8,
} as const;

const exploitScores = {
  active_in_wild: 100,
  poc_available: 78,
  theoretical: 45,
  none: 10,
} as const;

const gabExposureScores = {
  unknown: 45,
  indoor_agency: 50,
  outdoor_agency: 70,
  outdoor_commercial_center: 85,
  outdoor_public_street: 95,
} as const satisfies Record<GabExposureType, number>;

const gabExposureOrder = {
  unknown: 0,
  indoor_agency: 1,
  outdoor_agency: 2,
  outdoor_commercial_center: 3,
  outdoor_public_street: 4,
} as const satisfies Record<GabExposureType, number>;

const businessPriorityOrder = {
  p1: 5,
  p2: 4,
  p3: 3,
  p4: 2,
  p5: 1,
} as const satisfies Record<BusinessPriorityValue, number>;

const slaUrgencyOrder = {
  overdue: 3,
  at_risk: 2,
  on_track: 1,
  not_applicable: 0,
} as const;

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isCidtValue(value: number | null | undefined): value is CidtValue {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function normalizeCidtValue(
  value: number | null | undefined,
  fallback: CidtValue
): CidtValue {
  if (isCidtValue(value)) {
    return value;
  }

  return fallback;
}

export function hasCompleteCidt(vector: CidtVector) {
  return (
    isCidtValue(vector.confidentiality) &&
    isCidtValue(vector.integrity) &&
    isCidtValue(vector.availability) &&
    isCidtValue(vector.traceability)
  );
}

function toResolvedCidtVector(
  vector: CidtVector,
  fallback: CidtValue
): ResolvedCidtVector {
  return {
    confidentiality: normalizeCidtValue(vector.confidentiality, fallback),
    integrity: normalizeCidtValue(vector.integrity, fallback),
    availability: normalizeCidtValue(vector.availability, fallback),
    traceability: normalizeCidtValue(vector.traceability, fallback),
  };
}

export function calculateCidtSensitivity(
  vector: CidtVector,
  fallback: CidtValue = DEFAULT_ASSET_CIDT_VALUE
): CidtValue {
  return Math.max(
    normalizeCidtValue(vector.confidentiality, fallback),
    normalizeCidtValue(vector.integrity, fallback),
    normalizeCidtValue(vector.availability, fallback),
    normalizeCidtValue(vector.traceability, fallback)
  ) as CidtValue;
}

export function toSensitivityLevel(value: CidtValue): SensitivityLevel {
  return `S${value}` as SensitivityLevel;
}

export function calculateApplicationProfile(input: {
  isInternetExposed: boolean;
  confidentiality: number | null | undefined;
  integrity: number | null | undefined;
}): ApplicationProfile {
  if (input.isInternetExposed) {
    return 4;
  }

  const confidentiality = normalizeCidtValue(
    input.confidentiality,
    DEFAULT_APPLICATION_CIDT_VALUE
  );
  const integrity = normalizeCidtValue(input.integrity, DEFAULT_APPLICATION_CIDT_VALUE);

  if (confidentiality === 4 || integrity === 4) {
    return 3;
  }

  if (confidentiality === 3 || integrity === 3) {
    return 2;
  }

  return 1;
}

export function applicationProfileExplanation(profile: ApplicationProfile) {
  switch (profile) {
    case 4:
      return "Profile 4: application exposed to internet";
    case 3:
      return "Profile 3: confidentiality or integrity equals 4";
    case 2:
      return "Profile 2: confidentiality or integrity equals 3";
    default:
      return "Profile 1: confidentiality and integrity are lower or equal to 2";
  }
}

export function normalizeGabExposureType(
  value: string | null | undefined
): GabExposureType {
  return value === "indoor_agency" ||
    value === "outdoor_agency" ||
    value === "outdoor_commercial_center" ||
    value === "outdoor_public_street"
    ? value
    : "unknown";
}

export function isGabCidtTemplateKey(
  value: string | null | undefined
): value is GabCidtTemplateKey {
  return (
    value === "indoor_agency" ||
    value === "outdoor_agency" ||
    value === "outdoor_public_commercial"
  );
}

export function gabCidtTemplateKeyForExposure(
  value: string | null | undefined
): GabCidtTemplateKey | null {
  const normalized = normalizeGabExposureType(value);

  if (normalized === "indoor_agency") {
    return "indoor_agency";
  }

  if (normalized === "outdoor_agency") {
    return "outdoor_agency";
  }

  if (
    normalized === "outdoor_commercial_center" ||
    normalized === "outdoor_public_street"
  ) {
    return "outdoor_public_commercial";
  }

  return null;
}

function templateMapFromInput(templates: readonly GabCidtTemplate[] | undefined) {
  const map = new Map<GabCidtTemplateKey, GabCidtTemplate>();

  for (const template of defaultGabCidtTemplates) {
    map.set(template.templateKey, template);
  }

  for (const template of templates ?? []) {
    if (isGabCidtTemplateKey(template.templateKey)) {
      map.set(template.templateKey, template);
    }
  }

  return map;
}

export function resolveGabCidtContext(input: {
  assetCidt?: CidtVector | null;
  cidtOverrideEnabled?: boolean | null;
  gabExposureType?: string | null;
  templates?: readonly GabCidtTemplate[];
  applicationCidt?: CidtVector | null;
}): ResolvedGabCidtContext {
  const missingContext: string[] = [];
  const assetCidt = input.assetCidt ?? {
    confidentiality: null,
    integrity: null,
    availability: null,
    traceability: null,
  };

  if (input.cidtOverrideEnabled && hasCompleteCidt(assetCidt)) {
    const cidt = toResolvedCidtVector(assetCidt, DEFAULT_ASSET_CIDT_VALUE);
    const sensitivity = calculateCidtSensitivity(cidt);

    return {
      cidt,
      sensitivity,
      sensitivityLabel: toSensitivityLevel(sensitivity),
      source: "custom_override",
      sourceLabel: "Custom CIDT override",
      templateKey: null,
      isCustomOverride: true,
      missingContext,
    };
  }

  if (input.cidtOverrideEnabled && !hasCompleteCidt(assetCidt)) {
    missingContext.push(
      "Custom GAB CIDT override is enabled but incomplete; inherited CIDT was used."
    );
  }

  const templateKey = gabCidtTemplateKeyForExposure(input.gabExposureType);
  if (templateKey) {
    const template = templateMapFromInput(input.templates).get(templateKey);

    if (template) {
      const cidt = toResolvedCidtVector(
        {
          confidentiality: template.cidtConfidentiality,
          integrity: template.cidtIntegrity,
          availability: template.cidtAvailability,
          traceability: template.cidtTraceability,
        },
        DEFAULT_ASSET_CIDT_VALUE
      );
      const sensitivity = calculateCidtSensitivity(cidt);

      return {
        cidt,
        sensitivity,
        sensitivityLabel: toSensitivityLevel(sensitivity),
        source: "exposure_template",
        sourceLabel: `Inherited from ${template.label}`,
        templateKey,
        isCustomOverride: false,
        missingContext,
      };
    }
  }

  const applicationCidt = input.applicationCidt ?? {
    confidentiality: null,
    integrity: null,
    availability: null,
    traceability: null,
  };
  if (hasCompleteCidt(applicationCidt)) {
    const cidt = toResolvedCidtVector(applicationCidt, DEFAULT_APPLICATION_CIDT_VALUE);
    const sensitivity = calculateCidtSensitivity(cidt, DEFAULT_APPLICATION_CIDT_VALUE);

    if (normalizeGabExposureType(input.gabExposureType) === "unknown") {
      missingContext.push(
        "GAB exposure is unknown; CIDT was inherited from ATM Payment Services."
      );
    }

    return {
      cidt,
      sensitivity,
      sensitivityLabel: toSensitivityLevel(sensitivity),
      source: "application",
      sourceLabel: "Inherited from ATM Payment Services",
      templateKey: null,
      isCustomOverride: false,
      missingContext,
    };
  }

  const cidt = toResolvedCidtVector(
    {
      confidentiality: DEFAULT_ASSET_CIDT_VALUE,
      integrity: DEFAULT_ASSET_CIDT_VALUE,
      availability: DEFAULT_ASSET_CIDT_VALUE,
      traceability: DEFAULT_ASSET_CIDT_VALUE,
    },
    DEFAULT_ASSET_CIDT_VALUE
  );
  const sensitivity = calculateCidtSensitivity(cidt);

  missingContext.push(
    "Using system default because business context is incomplete."
  );

  if (normalizeGabExposureType(input.gabExposureType) === "unknown") {
    missingContext.push("GAB exposure is unknown; it was not treated as outdoor.");
  }

  return {
    cidt,
    sensitivity,
    sensitivityLabel: toSensitivityLevel(sensitivity),
    source: "system_default",
    sourceLabel: "Using system default because business context is incomplete",
    templateKey: null,
    isCustomOverride: false,
    missingContext,
  };
}

export function isOutdoorGabExposure(value: string | null | undefined) {
  const normalized = normalizeGabExposureType(value);
  return (
    normalized === "outdoor_agency" ||
    normalized === "outdoor_commercial_center" ||
    normalized === "outdoor_public_street"
  );
}

export function businessPriorityFromRiskScore(
  riskScore: number
): BusinessPriorityValue {
  if (riskScore >= 90) return "p1";
  if (riskScore >= 75) return "p2";
  if (riskScore >= 60) return "p3";
  if (riskScore >= 40) return "p4";
  return "p5";
}

function scoreFromSensitivity(value: CidtValue) {
  return value * 25;
}

function scoreFromProfile(value: ApplicationProfile) {
  return value * 25;
}

function technicalSeverityScore(input: {
  severity: string | null | undefined;
  cvssScore?: number | null;
}) {
  if (typeof input.cvssScore === "number" && Number.isFinite(input.cvssScore)) {
    return clampScore(input.cvssScore * 10);
  }

  return severityScores[input.severity as keyof typeof severityScores] ?? severityScores.info;
}

function exploitScore(value: string | null | undefined) {
  return exploitScores[value as keyof typeof exploitScores] ?? exploitScores.none;
}

function normalizeBusinessPriority(
  value: string | null | undefined
): BusinessPriorityValue {
  const normalized = value?.toLowerCase();

  return normalized === "p1" ||
    normalized === "p2" ||
    normalized === "p3" ||
    normalized === "p4" ||
    normalized === "p5"
    ? normalized
    : "p5";
}

function sensitivityRank(value: string | null | undefined) {
  const match = value?.match(/^S([1-4])$/i);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function applicationProfileRank(value: string | number | null | undefined) {
  if (typeof value === "number" && value >= 1 && value <= 4) {
    return value;
  }

  const match = String(value ?? "").match(/([1-4])/);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

function slaUrgencyRank(value: string | null | undefined) {
  const normalized = value?.toLowerCase().replaceAll(" ", "_");
  return slaUrgencyOrder[normalized as keyof typeof slaUrgencyOrder] ?? 0;
}

export function recommendedFixOrderScore(input: {
  businessPriority: string | null | undefined;
  gabExposureType: string | null | undefined;
  applicationSensitivity?: string | null;
  applicationProfile?: string | number | null;
  severity: string | null | undefined;
  cvssScore?: number | null;
  exploitMaturity?: string | null;
  slaStatus?: string | null;
  riskScore?: number | null;
}) {
  const priorityScore =
    businessPriorityOrder[normalizeBusinessPriority(input.businessPriority)];
  const exposureScore = gabExposureOrder[normalizeGabExposureType(input.gabExposureType)];
  const applicationImpactScore = Math.max(
    sensitivityRank(input.applicationSensitivity),
    applicationProfileRank(input.applicationProfile)
  );
  const severityScore = technicalSeverityScore({
    severity: input.severity,
    cvssScore: input.cvssScore,
  });
  const exploitabilityScore = Math.round(exploitScore(input.exploitMaturity) / 10);
  const slaScore = slaUrgencyRank(input.slaStatus);
  const riskScore =
    typeof input.riskScore === "number" && Number.isFinite(input.riskScore)
      ? clampScore(input.riskScore)
      : 0;

  return (
    priorityScore * 1_000_000_000 +
    exposureScore * 10_000_000 +
    applicationImpactScore * 1_000_000 +
    exploitabilityScore * 100_000 +
    severityScore * 1_000 +
    slaScore * 100 +
    riskScore
  );
}

function remediationUrgency(priority: BusinessPriorityValue) {
  switch (priority) {
    case "p1":
      return "Fix immediately under the emergency or accelerated change process.";
    case "p2":
      return "Fix in the next approved change window with active follow-up.";
    case "p3":
      return "Schedule remediation promptly and track it through the normal SLA.";
    case "p4":
      return "Plan remediation after higher-priority ATM Payment Services risks.";
    default:
      return "Monitor and remediate when bundled with routine maintenance.";
  }
}

export function calculateBusinessPriority(input: {
  severity: string | null | undefined;
  cvssScore?: number | null;
  exploitMaturity: string | null | undefined;
  assetCidt: CidtVector;
  applicationCidt: CidtVector;
  applicationInternetExposed: boolean;
  gabExposureType: string | null | undefined;
  assetCidtSource?: GabCidtSource;
  assetCidtSourceLabel?: string;
  assetCidtMissingContext?: string[];
}): BusinessPriorityResult {
  const assetSensitivity = calculateCidtSensitivity(
    input.assetCidt,
    DEFAULT_ASSET_CIDT_VALUE
  );
  const applicationSensitivity = calculateCidtSensitivity(
    input.applicationCidt,
    DEFAULT_APPLICATION_CIDT_VALUE
  );
  const applicationProfile = calculateApplicationProfile({
    isInternetExposed: input.applicationInternetExposed,
    confidentiality: input.applicationCidt.confidentiality,
    integrity: input.applicationCidt.integrity,
  });
  const gabExposureType = normalizeGabExposureType(input.gabExposureType);
  const severityScore = technicalSeverityScore({
    severity: input.severity,
    cvssScore: input.cvssScore,
  });
  const exploitabilityScore = exploitScore(input.exploitMaturity);
  const assetSensitivityScore = scoreFromSensitivity(assetSensitivity);
  const applicationSensitivityScore = scoreFromSensitivity(applicationSensitivity);
  const applicationProfileScore = scoreFromProfile(applicationProfile);
  const gabExposureScore = gabExposureScores[gabExposureType];
  const riskScore = clampScore(
    severityScore * 0.32 +
      exploitabilityScore * 0.13 +
      assetSensitivityScore * 0.15 +
      applicationSensitivityScore * 0.16 +
      applicationProfileScore * 0.12 +
      gabExposureScore * 0.12
  );
  const businessPriority = businessPriorityFromRiskScore(riskScore);
  const missingContext: string[] = [];

  if (input.assetCidtMissingContext?.length) {
    missingContext.push(...input.assetCidtMissingContext);
  } else if (!input.assetCidtSource && !hasCompleteCidt(input.assetCidt)) {
    missingContext.push("GAB CIDT is incomplete; neutral S2 defaults were used.");
  }

  if (
    gabExposureType === "unknown" &&
    !missingContext.some((message) => message.includes("GAB exposure is unknown"))
  ) {
    missingContext.push("GAB exposure is unknown; it was not treated as outdoor.");
  }

  const summary = [
    `${input.severity ?? "unknown"} severity`,
    `${toSensitivityLevel(assetSensitivity)} GAB sensitivity`,
    `${toSensitivityLevel(applicationSensitivity)} ATM Payment Services sensitivity`,
    `Profile ${applicationProfile}`,
    gabExposureLabels[gabExposureType],
  ].join(" + ");

  return {
    riskScore,
    businessPriority,
    assetSensitivity,
    applicationSensitivity,
    applicationProfile,
    factors: {
      applicationLabel: ATM_PAYMENT_SERVICES_LABEL,
      summary,
      technicalSeverity: input.severity ?? "unknown",
      cvssScore:
        typeof input.cvssScore === "number" && Number.isFinite(input.cvssScore)
          ? input.cvssScore
          : null,
      exploitMaturity: input.exploitMaturity ?? "none",
      assetSensitivity: toSensitivityLevel(assetSensitivity),
      assetCidtSource: input.assetCidtSource ?? "direct",
      assetCidtSourceLabel:
        input.assetCidtSourceLabel ??
        (hasCompleteCidt(input.assetCidt)
          ? "Custom CIDT override"
          : "Using neutral S2 defaults"),
      assetCidt: toResolvedCidtVector(input.assetCidt, DEFAULT_ASSET_CIDT_VALUE),
      applicationSensitivity: toSensitivityLevel(applicationSensitivity),
      applicationProfile: `Profile ${applicationProfile}`,
      gabExposure: gabExposureLabels[gabExposureType],
      businessImpact:
        "This GAB supports ATM Payment Services. CIDT and physical exposure influence the business impact of exploitation or outage.",
      remediationUrgency: remediationUrgency(businessPriority),
      missingContext,
      scoringInputs: {
        severityScore,
        exploitScore: exploitabilityScore,
        assetSensitivityScore,
        applicationSensitivityScore,
        applicationProfileScore,
        gabExposureScore,
      },
    },
  };
}

export function prioritySummaryFromFactors(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Priority combines scanner severity, GAB CIDT, ATM Payment Services CIDT/profile, and GAB exposure.";
  }

  const factors = value as Partial<BusinessPriorityFactors>;
  return (
    factors.summary ??
    "Priority combines scanner severity, GAB CIDT, ATM Payment Services CIDT/profile, and GAB exposure."
  );
}
