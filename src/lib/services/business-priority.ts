export const ATM_PAYMENT_SERVICES_KEY = "monetique";
export const ATM_PAYMENT_SERVICES_LABEL = "ATM Payment Services";
export const DEFAULT_ASSET_CIDT_VALUE = 2;
export const DEFAULT_APPLICATION_CIDT_VALUE = 4;

export type CidtValue = 1 | 2 | 3 | 4;
export type SensitivityLevel = "S1" | "S2" | "S3" | "S4";
export type ApplicationProfile = 1 | 2 | 3 | 4;
export type BusinessPriorityValue = "p1" | "p2" | "p3" | "p4" | "p5";
export type DefaultGabCidtTemplateKey = "indoor_agency" | "outdoor_agency";
export type LegacyGabCidtTemplateKey = "outdoor_public_commercial";
export type GabCidtTemplateKey =
  | DefaultGabCidtTemplateKey
  | LegacyGabCidtTemplateKey
  | (string & {});
export type GabCidtSource =
  | "custom_override"
  | "template"
  | "exposure_template"
  | "application"
  | "system_default";
export type GabExposureType =
  | "unknown"
  | "indoor_agency"
  | "outdoor_agency"
  | "outdoor_commercial_center"
  | "outdoor_public_street";
export type GabExposureClass = "unknown" | "indoor" | "outdoor";

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
  templateKey: GabCidtTemplateKey;
  label: string;
  description?: string | null;
  cidtConfidentiality: number | null | undefined;
  cidtIntegrity: number | null | undefined;
  cidtAvailability: number | null | undefined;
  cidtTraceability: number | null | undefined;
  isDefault?: boolean | null;
  archivedAt?: Date | string | null;
}

export interface ResolvedGabCidtContext {
  cidt: ResolvedCidtVector;
  sensitivity: CidtValue;
  sensitivityLabel: SensitivityLevel;
  source: GabCidtSource;
  sourceLabel: string;
  templateKey: GabCidtTemplateKey | null;
  templateLabel: string | null;
  isCustomOverride: boolean;
  missingContext: string[];
}

export interface BusinessPriorityFactors {
  scoringVersion?: string;
  applicationLabel: typeof ATM_PAYMENT_SERVICES_LABEL;
  summary: string;
  technicalSeverity: string;
  cvssScore: number | null;
  exploitMaturity: string;
  knownExploitation: boolean;
  epssScore: number | null;
  assetSensitivity: SensitivityLevel;
  assetCidtSource: string;
  assetCidtSourceLabel: string;
  assetCidt: ResolvedCidtVector;
  applicationSensitivity: SensitivityLevel;
  applicationProfile: `Profile ${ApplicationProfile}`;
  gabExposure: string;
  gabExposureClass?: GabExposureClass;
  cidtTemplateLabel?: string | null;
  rankV2?: RankV2Result;
  businessImpact: string;
  remediationUrgency: string;
  missingContext: string[];
  scoringInputs: {
    severityScore: number;
    exploitScore: number;
    knownExploitationScore: number;
    epssScore: number;
    assetSensitivityScore: number;
    applicationSensitivityScore: number;
    applicationProfileScore: number;
    gabExposureScore: number;
    legacyRiskScore?: number;
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
  indoor_agency: "Indoor GAB",
  outdoor_agency: "Outdoor GAB",
  outdoor_commercial_center: "Outdoor GAB",
  outdoor_public_street: "Outdoor GAB",
} as const satisfies Record<GabExposureType, string>;

export const gabCidtTemplateLabels = {
  indoor_agency: "Default Indoor GAB CIDT template",
  outdoor_agency: "Default Outdoor GAB CIDT template",
} as const satisfies Record<DefaultGabCidtTemplateKey, string>;

export const gabExposureClassLabels = {
  unknown: "Unknown",
  indoor: "Indoor GAB",
  outdoor: "Outdoor GAB",
} as const satisfies Record<GabExposureClass, string>;

const legacyExposureLabelPatterns: Array<[RegExp, string]> = [
  [/\bOutdoor\s+agency\s+GAB\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+public\/commercial\s+GAB\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+commercial[-\s]center\s+GAB\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+public[-\s]street\s+GAB\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+agency\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+public\/commercial\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+commercial[-\s]center\b/gi, "Outdoor GAB"],
  [/\bOutdoor\s+public[-\s]street\b/gi, "Outdoor GAB"],
  [/\bIndoor\s+agency\s+GAB\b/gi, "Indoor GAB"],
  [/\bIndoor\s+agency\b/gi, "Indoor GAB"],
];

export function simplifyGabExposureText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return legacyExposureLabelPatterns.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

export const defaultGabCidtTemplates = [
  {
    templateKey: "indoor_agency",
    label: gabCidtTemplateLabels.indoor_agency,
    description:
      "Default business-impact CIDT preset for GABs classified as indoor.",
    cidtConfidentiality: 3,
    cidtIntegrity: 3,
    cidtAvailability: 3,
    cidtTraceability: 3,
    isDefault: true,
  },
  {
    templateKey: "outdoor_agency",
    label: gabCidtTemplateLabels.outdoor_agency,
    description:
      "Default business-impact CIDT preset for GABs classified as outdoor. Exposure is scored separately.",
    cidtConfidentiality: 3,
    cidtIntegrity: 3,
    cidtAvailability: 3,
    cidtTraceability: 3,
    isDefault: true,
  },
] as const satisfies readonly GabCidtTemplate[];

const severityScores = {
  critical: 95,
  high: 80,
  medium: 55,
  low: 28,
  info: 8,
} as const;

export const NESSUS_SEVERITY_FALLBACK = {
  4: 39,
  3: 32,
  2: 22,
  1: 10,
  0: 0,
} as const;

const severityLevels = {
  critical: 4,
  high: 3,
  medium: 2,
  moderate: 2,
  low: 1,
  info: 0,
  informational: 0,
  none: 0,
} as const;

const severityLabels = {
  4: "Critical",
  3: "High",
  2: "Medium",
  1: "Low",
  0: "Info",
} as const;

const exploitScores = {
  active_in_wild: 100,
  poc_available: 78,
  theoretical: 45,
  none: 10,
} as const;

const gabExposureScores = {
  unknown: 0,
  indoor_agency: 45,
  outdoor_agency: 70,
  outdoor_commercial_center: 70,
  outdoor_public_street: 70,
} as const satisfies Record<GabExposureType, number>;

const gabExposureOrder = {
  unknown: 0,
  indoor_agency: 1,
  outdoor_agency: 2,
  outdoor_commercial_center: 2,
  outdoor_public_street: 2,
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

export function normalizeCvssScore(value: number | string | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const score = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}

function severityLevelFrom(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 && value <= 4 ? (value as keyof typeof severityLabels) : null;
  }

  const normalized = value?.toString().trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^[0-4]$/.test(normalized)) {
    return Number.parseInt(normalized, 10) as keyof typeof severityLabels;
  }

  return severityLevels[normalized as keyof typeof severityLevels] ?? null;
}

export function normalizeSeverity(input: {
  cvssBaseScore?: number | string | null;
  nessusSeverity?: number | string | null;
  severityLabel?: string | null;
}) {
  const cvssScore = normalizeCvssScore(input.cvssBaseScore);
  const nessusLevel = severityLevelFrom(input.nessusSeverity);
  const labelLevel = severityLevelFrom(input.severityLabel);
  const level = nessusLevel ?? labelLevel ?? 0;
  const usesCvss = cvssScore != null && cvssScore > 0;

  return {
    label: severityLabels[level],
    cvssScore,
    severitySource: usesCvss
      ? "cvss"
      : nessusLevel != null
        ? "nessus"
        : labelLevel != null
          ? "scanner"
          : "unknown",
    severityComponent: usesCvss
      ? Math.max(0, Math.min(40, Math.round(cvssScore * 4)))
      : NESSUS_SEVERITY_FALLBACK[level],
  } as const;
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
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");

  return normalized === "indoor" ||
    normalized === "indoor_gab" ||
    normalized === "indoor_agency"
    ? "indoor_agency"
    : normalized === "outdoor" ||
        normalized === "outdoor_gab" ||
        normalized === "outdoor_agency" ||
        normalized === "outdoor_commercial" ||
        normalized === "outdoor_public_commercial" ||
        normalized === "outdoor_commercial_center" ||
        normalized === "outdoor_public_street"
      ? normalized === "outdoor_commercial_center" ||
        normalized === "outdoor_public_street"
        ? normalized
        : "outdoor_agency"
      : "unknown";
}

export function normalizeGabExposureClass(
  value: string | null | undefined
): GabExposureClass {
  const normalized = normalizeGabExposureType(value);

  if (normalized === "indoor_agency") {
    return "indoor";
  }

  if (
    value === "outdoor_agency" ||
    normalized === "outdoor_agency" ||
    normalized === "outdoor_commercial_center" ||
    normalized === "outdoor_public_street"
  ) {
    return "outdoor";
  }

  return "unknown";
}

export function isGabCidtTemplateKey(
  value: string | null | undefined
): value is GabCidtTemplateKey {
  return Boolean(value?.trim());
}

export function isDefaultGabCidtTemplateKey(
  value: string | null | undefined
): value is DefaultGabCidtTemplateKey {
  return value === "indoor_agency" || value === "outdoor_agency";
}

export function gabCidtTemplateKeyForExposure(
  value: string | null | undefined
): DefaultGabCidtTemplateKey | null {
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
    return "outdoor_agency";
  }

  return null;
}

function templateMapFromInput(templates: readonly GabCidtTemplate[] | undefined) {
  const map = new Map<GabCidtTemplateKey, GabCidtTemplate>();

  for (const template of defaultGabCidtTemplates) {
    map.set(template.templateKey, template);
  }

  for (const template of templates ?? []) {
    if (isGabCidtTemplateKey(template.templateKey) && !template.archivedAt) {
      map.set(template.templateKey, template);
    }
  }

  return map;
}

export function resolveGabCidtContext(input: {
  assetCidt?: CidtVector | null;
  cidtOverrideEnabled?: boolean | null;
  cidtTemplateKey?: string | null;
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
      templateLabel: null,
      isCustomOverride: true,
      missingContext,
    };
  }

  if (input.cidtOverrideEnabled && !hasCompleteCidt(assetCidt)) {
    missingContext.push(
      "Custom GAB CIDT override is enabled but incomplete; inherited CIDT was used."
    );
  }

  const templateMap = templateMapFromInput(input.templates);
  const selectedTemplateKey =
    input.cidtTemplateKey && isGabCidtTemplateKey(input.cidtTemplateKey)
      ? input.cidtTemplateKey
      : null;
  const templateKey =
    selectedTemplateKey ?? gabCidtTemplateKeyForExposure(input.gabExposureType);
  if (templateKey) {
    const template = templateMap.get(templateKey);

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
        source: "template",
        sourceLabel: `Inherited from ${template.label}`,
        templateKey,
        templateLabel: template.label,
        isCustomOverride: false,
        missingContext,
      };
    }

    if (selectedTemplateKey) {
      missingContext.push(
        "Selected GAB CIDT template was not found; ATM Payment Services CIDT was used."
      );
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
      templateLabel: null,
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
    templateLabel: null,
    isCustomOverride: false,
    missingContext,
  };
}

export function isOutdoorGabExposure(value: string | null | undefined) {
  return normalizeGabExposureClass(value) === "outdoor";
}

export function businessPriorityFromRiskScore(
  riskScore: number
): BusinessPriorityValue {
  if (riskScore >= 90) return "p1";
  if (riskScore >= 75) return "p2";
  if (riskScore >= 60) return "p3";
  return "p4";
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
  if (
    typeof input.cvssScore === "number" &&
    Number.isFinite(input.cvssScore) &&
    input.cvssScore > 0
  ) {
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

export function normalizeEpssScore(value: number | string | null | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(1, parsed));
}

function epssLikelihoodScore(value: number | string | null | undefined) {
  const normalized = normalizeEpssScore(value);

  return normalized == null ? 0 : Math.round(normalized * 100);
}

function effectiveExploitMaturityScore(
  exploitMaturity: string | null | undefined,
  knownExploitation: boolean
) {
  if (exploitMaturity === "active_in_wild" && !knownExploitation) {
    return exploitScores.poc_available;
  }

  return exploitScore(exploitMaturity);
}

export interface RankV2FactorScores {
  severity: number;
  threat: number;
  business: number;
  urgency: number;
}

export interface RankV2Result {
  algorithmVersion: "rank-v2";
  score: number;
  businessPriority: Exclude<BusinessPriorityValue, "p5">;
  bucketLabel: "Fix first" | "Accelerated" | "Planned" | "Routine";
  factorScores: RankV2FactorScores;
  sortKey: {
    score: number;
    cisaKev: number;
    exploitMaturity: number;
    epss: number;
    slaUrgency: number;
    slaDayBucket: number;
    exposure: number;
    maxCi: number;
    maxDt: number;
    lifecycle: number;
    scannerEvidence: number;
    sourceCoverage: number;
    firstSeenMs: number;
    stableId: string;
  };
  shortReason: string;
  explanation: string;
  missingEvidence: string[];
}

function rankBucketFromScore(
  score: number
): Pick<RankV2Result, "businessPriority" | "bucketLabel"> {
  if (score >= 90) {
    return { businessPriority: "p1", bucketLabel: "Fix first" };
  }

  if (score >= 75) {
    return { businessPriority: "p2", bucketLabel: "Accelerated" };
  }

  if (score >= 60) {
    return { businessPriority: "p3", bucketLabel: "Planned" };
  }

  return { businessPriority: "p4", bucketLabel: "Routine" };
}

export function businessPriorityLabel(value: string | null | undefined) {
  switch (normalizeBusinessPriority(value)) {
    case "p1":
      return "Fix first";
    case "p2":
      return "Accelerated";
    case "p3":
      return "Planned";
    case "p4":
    case "p5":
    default:
      return "Routine";
  }
}

function severityRankV2(input: {
  severity: string | null | undefined;
  cvssScore?: number | null;
}) {
  return normalizeSeverity({
    cvssBaseScore: input.cvssScore,
    severityLabel: input.severity,
  }).severityComponent;
}

function exploitMaturityRank(value: string | null | undefined) {
  switch (value) {
    case "active_in_wild":
      return 8;
    case "poc_available":
      return 6;
    case "theoretical":
      return 3;
    default:
      return 0;
  }
}

function threatRankV2(input: {
  knownExploitation?: boolean | null;
  exploitMaturity?: string | null;
  epssScore?: number | string | null;
}) {
  const kev = input.knownExploitation ? 14 : 0;
  const maturity = exploitMaturityRank(input.exploitMaturity);
  const epss = normalizeEpssScore(input.epssScore);
  const epssComponent = epss == null ? 0 : Math.round(epss * 8);

  return Math.min(30, kev + maturity + epssComponent);
}

function businessRankV2(input: {
  assetCidt: CidtVector;
  applicationCidt: CidtVector;
  applicationInternetExposed: boolean;
  gabExposureType: string | null | undefined;
}) {
  const assetSensitivity = calculateCidtSensitivity(
    input.assetCidt,
    DEFAULT_ASSET_CIDT_VALUE
  );
  const profile = calculateApplicationProfile({
    isInternetExposed: input.applicationInternetExposed,
    confidentiality: input.applicationCidt.confidentiality,
    integrity: input.applicationCidt.integrity,
  });
  const sensitivityScore = { 1: 2, 2: 4, 3: 7, 4: 10 }[assetSensitivity];
  const profileScore = { 1: 1, 2: 2, 3: 3, 4: 4 }[profile];
  const exposureClass = normalizeGabExposureClass(input.gabExposureType);
  const exposureScore =
    exposureClass === "outdoor" ? 4 : exposureClass === "indoor" ? 2 : 0;

  return Math.min(20, 4 + sensitivityScore + profileScore + exposureScore);
}

function daysUntil(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export type RankV2SlaState =
  | "overdue"
  | "due_today"
  | "due_soon"
  | "on_track"
  | "no_sla";

export function getRankV2SlaState(input: {
  slaDue?: Date | string | null;
  slaStatus?: string | null;
}): {
  state: RankV2SlaState;
  label: "Overdue" | "Due today" | "Due soon" | "On Track" | "No SLA";
  displayLabel: string;
  reason: string;
  remainingDays: number | null;
} {
  const status = input.slaStatus?.toLowerCase().replaceAll(" ", "_");
  const remainingDays = daysUntil(input.slaDue);

  if (status === "overdue" || (remainingDays != null && remainingDays < 0)) {
    return {
      state: "overdue",
      label: "Overdue",
      displayLabel: "Overdue",
      reason: "SLA is overdue",
      remainingDays,
    };
  }

  if (remainingDays === 0) {
    return {
      state: "due_today",
      label: "Due today",
      displayLabel: "Due today",
      reason: "SLA is due today",
      remainingDays,
    };
  }

  if (remainingDays != null && remainingDays <= 7) {
    return {
      state: "due_soon",
      label: "Due soon",
      displayLabel:
        remainingDays === 1
          ? "Due in 1 day"
          : `Due in ${remainingDays} days`,
      reason:
        remainingDays === 1
          ? "SLA is due in 1 day"
          : `SLA is due in ${remainingDays} days`,
      remainingDays,
    };
  }

  if (status === "at_risk") {
    return {
      state: "due_soon",
      label: "Due soon",
      displayLabel: "Due soon",
      reason: "SLA is marked at risk",
      remainingDays,
    };
  }

  if (remainingDays == null && (!status || status === "not_applicable")) {
    return {
      state: "no_sla",
      label: "No SLA",
      displayLabel: "No SLA",
      reason: "No SLA due date is set",
      remainingDays,
    };
  }

  return {
    state: "on_track",
    label: "On Track",
    displayLabel: "On Track",
    reason:
      remainingDays != null
        ? `SLA is on track with ${remainingDays} days remaining`
        : "SLA is on track",
    remainingDays,
  };
}

function urgencyRankV2(input: {
  slaDue?: Date | string | null;
  slaStatus?: string | null;
}) {
  const sla = getRankV2SlaState(input);
  const remainingDays = sla.remainingDays;

  if (sla.state === "overdue") {
    return 10;
  }

  if (sla.state === "due_today") {
    return 9;
  }

  if (remainingDays != null) {
    if (remainingDays <= 3) return 8;
    if (remainingDays <= 7) return 6;
    if (remainingDays <= 14) return 4;
    if (remainingDays <= 30) return 2;
  }

  if (sla.state === "due_soon") return 7;

  return sla.state === "on_track" ? 1 : 0;
}

function lifecycleRank(value: string | null | undefined) {
  switch (value) {
    case "reopened":
      return 3;
    case "new":
      return 2;
    case "open":
      return 1;
    default:
      return 0;
  }
}

function scannerEvidenceRank(input: {
  scannerEvidenceCount?: number | null;
  scannerEvidenceQuality?: number | null;
}) {
  const count = Math.min(5, Math.max(0, input.scannerEvidenceCount ?? 0));
  const quality =
    typeof input.scannerEvidenceQuality === "number" &&
    Number.isFinite(input.scannerEvidenceQuality)
      ? Math.max(0, Math.min(100, input.scannerEvidenceQuality)) / 20
      : 0;

  return Math.round(count + quality);
}

function sourceCoverageRank(input: {
  trustedSourceCount?: number | null;
  knownExploitation?: boolean | null;
  epssScore?: number | string | null;
}) {
  return Math.min(
    10,
    Math.max(0, input.trustedSourceCount ?? 0) +
      (input.knownExploitation ? 3 : 0) +
      (normalizeEpssScore(input.epssScore) != null ? 1 : 0)
  );
}

export function calculateRankV2(input: {
  severity: string | null | undefined;
  cvssScore?: number | null;
  exploitMaturity?: string | null;
  knownExploitation?: boolean | null;
  epssScore?: number | string | null;
  assetCidt: CidtVector;
  applicationCidt: CidtVector;
  applicationInternetExposed: boolean;
  gabExposureType: string | null | undefined;
  slaDue?: Date | string | null;
  slaStatus?: string | null;
  lifecycleStatus?: string | null;
  scannerEvidenceCount?: number | null;
  scannerEvidenceQuality?: number | null;
  trustedSourceCount?: number | null;
  firstSeen?: Date | string | null;
  assetCode?: string | null;
  cveId?: string | null;
  id?: string | null;
}): RankV2Result {
  const severity = severityRankV2(input);
  const threat = threatRankV2(input);
  const business = businessRankV2(input);
  const urgency = urgencyRankV2(input);
  const score = Math.max(0, Math.min(100, severity + threat + business + urgency));
  const bucket = rankBucketFromScore(score);
  const exposureClass = normalizeGabExposureClass(input.gabExposureType);
  const normalizedEpss = normalizeEpssScore(input.epssScore);
  const slaState = getRankV2SlaState({
    slaDue: input.slaDue,
    slaStatus: input.slaStatus,
  });
  const firstSeen = input.firstSeen ? new Date(input.firstSeen) : null;
  const firstSeenMs =
    firstSeen && !Number.isNaN(firstSeen.getTime())
      ? firstSeen.getTime()
      : Number.MAX_SAFE_INTEGER;
  const slaDayBucket =
    slaState.state === "due_soon" && slaState.remainingDays != null
      ? slaState.remainingDays
      : Number.MAX_SAFE_INTEGER;
  const cidt = toResolvedCidtVector(input.assetCidt, DEFAULT_ASSET_CIDT_VALUE);
  const signals = [
    input.knownExploitation ? "KEV" : null,
    exposureClass === "outdoor"
      ? "Outdoor GAB"
      : exposureClass === "indoor"
        ? "Indoor GAB"
        : null,
    normalizedEpss != null ? `EPSS ${normalizedEpss.toFixed(2)}` : null,
    slaState.state === "overdue" ||
    slaState.state === "due_today" ||
    (slaState.state === "due_soon" && urgency >= 6)
      ? slaState.displayLabel
      : null,
    severity >= 36 ? "critical severity" : null,
  ].filter(Boolean) as string[];
  const missingEvidence = [
    normalizedEpss == null ? "EPSS probability is not available yet." : null,
    !input.knownExploitation ? "No CISA KEV confirmation is linked." : null,
    !input.trustedSourceCount ? "Trusted source coverage is limited." : null,
  ].filter(Boolean) as string[];
  const shortReason =
    signals.length > 0
      ? signals.slice(0, 4).join(" + ")
      : "Deterministic severity, business, and SLA factors";

  return {
    algorithmVersion: "rank-v2",
    score,
    ...bucket,
    factorScores: {
      severity,
      threat,
      business,
      urgency,
    },
    sortKey: {
      score,
      cisaKev: input.knownExploitation ? 1 : 0,
      exploitMaturity: exploitMaturityRank(input.exploitMaturity),
      epss: normalizedEpss == null ? 0 : Math.round(normalizedEpss * 1_000_000),
      slaUrgency: urgency,
      slaDayBucket,
      exposure: exposureClass === "outdoor" ? 2 : exposureClass === "indoor" ? 1 : 0,
      maxCi: Math.max(cidt.confidentiality, cidt.integrity),
      maxDt: Math.max(cidt.availability, cidt.traceability),
      lifecycle: lifecycleRank(input.lifecycleStatus),
      scannerEvidence: scannerEvidenceRank(input),
      sourceCoverage: sourceCoverageRank(input),
      firstSeenMs,
      stableId: [input.assetCode, input.cveId, input.id].filter(Boolean).join(":"),
    },
    shortReason,
    explanation: `${bucket.bucketLabel} with score ${score}: Severity ${severity}, Threat ${threat}, Business ${business}, Urgency ${urgency}.`,
    missingEvidence,
  };
}

export function compareRankV2(
  left: Pick<RankV2Result, "sortKey">,
  right: Pick<RankV2Result, "sortKey">
) {
  const leftKey = left.sortKey;
  const rightKey = right.sortKey;
  const descendingKeys: Array<
    keyof Omit<typeof leftKey, "slaDayBucket" | "firstSeenMs" | "stableId">
  > = [
    "score",
    "cisaKev",
    "exploitMaturity",
    "epss",
    "slaUrgency",
    "exposure",
    "maxCi",
    "maxDt",
    "lifecycle",
  ];

  for (const key of descendingKeys) {
    const delta = rightKey[key] - leftKey[key];
    if (delta !== 0) {
      return delta;
    }
  }

  const slaDayDelta = leftKey.slaDayBucket - rightKey.slaDayBucket;
  if (slaDayDelta !== 0) {
    return slaDayDelta;
  }

  const firstSeenDelta = leftKey.firstSeenMs - rightKey.firstSeenMs;
  if (firstSeenDelta !== 0) {
    return firstSeenDelta;
  }

  return leftKey.stableId.localeCompare(rightKey.stableId);
}

export function recommendedFixOrderScore(input: {
  businessPriority: string | null | undefined;
  gabExposureType: string | null | undefined;
  applicationSensitivity?: string | null;
  applicationProfile?: string | number | null;
  severity: string | null | undefined;
  cvssScore?: number | null;
  exploitMaturity?: string | null;
  knownExploitation?: boolean | null;
  epssScore?: number | string | null;
  slaStatus?: string | null;
  riskScore?: number | null;
}) {
  const knownExploitation = Boolean(input.knownExploitation);
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
  const knownExploitationScore = knownExploitation ? 1 : 0;
  const epssScore = epssLikelihoodScore(input.epssScore);
  const exploitabilityScore = Math.round(
    effectiveExploitMaturityScore(input.exploitMaturity, knownExploitation) / 10
  );
  const slaScore = slaUrgencyRank(input.slaStatus);
  const riskScore =
    typeof input.riskScore === "number" && Number.isFinite(input.riskScore)
      ? clampScore(input.riskScore)
      : 0;

  return (
    priorityScore * 1_000_000_000 +
    knownExploitationScore * 100_000_000 +
    exposureScore * 10_000_000 +
    applicationImpactScore * 1_000_000 +
    epssScore * 100_000 +
    exploitabilityScore * 10_000 +
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
  knownExploitation?: boolean | null;
  epssScore?: number | string | null;
  assetCidt: CidtVector;
  applicationCidt: CidtVector;
  applicationInternetExposed: boolean;
  gabExposureType: string | null | undefined;
  slaDue?: Date | string | null;
  slaStatus?: string | null;
  lifecycleStatus?: string | null;
  scannerEvidenceCount?: number | null;
  scannerEvidenceQuality?: number | null;
  trustedSourceCount?: number | null;
  firstSeen?: Date | string | null;
  assetCode?: string | null;
  cveId?: string | null;
  id?: string | null;
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
  const gabExposureClass = normalizeGabExposureClass(input.gabExposureType);
  const severityScore = technicalSeverityScore({
    severity: input.severity,
    cvssScore: input.cvssScore,
  });
  const knownExploitation = Boolean(input.knownExploitation);
  const exploitabilityScore = effectiveExploitMaturityScore(
    input.exploitMaturity,
    knownExploitation
  );
  const knownExploitationScore = knownExploitation ? 100 : 0;
  const epssScore = epssLikelihoodScore(input.epssScore);
  const assetSensitivityScore = scoreFromSensitivity(assetSensitivity);
  const applicationSensitivityScore = scoreFromSensitivity(applicationSensitivity);
  const applicationProfileScore = scoreFromProfile(applicationProfile);
  const gabExposureScore = gabExposureScores[gabExposureType];
  const legacyRiskScore = clampScore(
    severityScore * 0.32 +
      exploitabilityScore * 0.13 +
      assetSensitivityScore * 0.15 +
      applicationSensitivityScore * 0.16 +
      applicationProfileScore * 0.12 +
      gabExposureScore * 0.12 +
      knownExploitationScore * 0.08 +
      epssScore * 0.05
  );
  const rankV2 = calculateRankV2({
    severity: input.severity,
    cvssScore: input.cvssScore,
    exploitMaturity: input.exploitMaturity,
    knownExploitation,
    epssScore: input.epssScore,
    assetCidt: input.assetCidt,
    applicationCidt: input.applicationCidt,
    applicationInternetExposed: input.applicationInternetExposed,
    gabExposureType,
    slaDue: input.slaDue,
    slaStatus: input.slaStatus,
    lifecycleStatus: input.lifecycleStatus,
    scannerEvidenceCount: input.scannerEvidenceCount,
    scannerEvidenceQuality: input.scannerEvidenceQuality,
    trustedSourceCount: input.trustedSourceCount,
    firstSeen: input.firstSeen,
    assetCode: input.assetCode,
    cveId: input.cveId,
    id: input.id,
  });
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
    riskScore: rankV2.score,
    businessPriority: rankV2.businessPriority,
    assetSensitivity,
    applicationSensitivity,
    applicationProfile,
    factors: {
      scoringVersion: "rank-v2",
      applicationLabel: ATM_PAYMENT_SERVICES_LABEL,
      summary,
      technicalSeverity: input.severity ?? "unknown",
      cvssScore:
        typeof input.cvssScore === "number" && Number.isFinite(input.cvssScore)
          ? input.cvssScore
          : null,
      exploitMaturity: input.exploitMaturity ?? "none",
      knownExploitation,
      epssScore: normalizeEpssScore(input.epssScore),
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
      gabExposureClass,
      cidtTemplateLabel:
        input.assetCidtSource === "template" ||
        input.assetCidtSource === "exposure_template"
          ? input.assetCidtSourceLabel?.replace(/^Inherited from /, "") ?? null
          : null,
      rankV2,
      businessImpact:
        "This GAB supports ATM Payment Services. CIDT describes business impact; indoor/outdoor exposure is scored separately as attack opportunity.",
      remediationUrgency: remediationUrgency(rankV2.businessPriority),
      missingContext,
      scoringInputs: {
        severityScore,
        exploitScore: exploitabilityScore,
        knownExploitationScore,
        epssScore,
        assetSensitivityScore,
        applicationSensitivityScore,
        applicationProfileScore,
        gabExposureScore,
        legacyRiskScore,
      },
    },
  };
}

export function prioritySummaryFromFactors(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Priority combines technical severity, GAB CIDT, ATM Payment Services CIDT/profile, and GAB exposure.";
  }

  const factors = value as Partial<BusinessPriorityFactors>;
  return formatPriorityFactorSummary(
    factors.summary ??
      "Priority combines technical severity, GAB CIDT, ATM Payment Services CIDT/profile, and GAB exposure."
  );
}

export function formatPriorityFactorSummary(value: string | null | undefined) {
  const normalized = simplifyGabExposureText(value).trim();

  if (!normalized) {
    return "Priority combines technical severity, GAB CIDT, ATM Payment Services CIDT/profile, and GAB exposure.";
  }

  const parts = normalized
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return normalized.endsWith(".") ? normalized : `${normalized}.`;
  }

  const readable = parts.map((part) => {
    const lower = part.toLowerCase();
    const gabSensitivity = part.match(/^S([1-4])\s+GAB\s+sensitivity$/i);
    const appSensitivity = part.match(
      /^S([1-4])\s+ATM Payment Services\s+sensitivity$/i
    );

    if (lower === "critical severity") return "Critical severity";
    if (lower === "high severity") return "High severity";
    if (lower === "medium severity") return "Medium severity";
    if (lower === "low severity") return "Low severity";
    if (gabSensitivity) {
      return `S${gabSensitivity[1]} resolved GAB sensitivity`;
    }
    if (appSensitivity) {
      return `S${appSensitivity[1]} ATM Payment Services baseline`;
    }
    if (/^Outdoor GAB$/i.test(part)) return "Outdoor GAB exposure";
    if (/^Indoor GAB$/i.test(part)) return "Indoor GAB exposure";
    if (/^Unknown$/i.test(part)) return "Unknown GAB exposure";
    if (/^Profile\s+[1-4]$/i.test(part)) return part;

    return part.charAt(0).toUpperCase() + part.slice(1);
  });

  return `${readable.join(", ")}.`;
}
