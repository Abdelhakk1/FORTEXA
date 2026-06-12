// ─── Severity & Priority ───────────────────────────────────────────
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type BusinessPriority = "P1" | "P2" | "P3" | "P4" | "P5";
export type AssetStatus = "Active" | "Inactive" | "Maintenance" | "Decommissioned";
export type RemediationStatus = "Open" | "Assigned" | "In Progress" | "Mitigated" | "Closed" | "Overdue";
export type AlertStatus = "New" | "Acknowledged" | "In Progress" | "Resolved" | "Dismissed";
export type ImportStatus = "Completed" | "Processing" | "Failed" | "Partial";
export type ExploitMaturity =
  | "Active in Wild (KEV)"
  | "Active in Wild"
  | "POC Available"
  | "Theoretical"
  | "None";
export type EnrichmentStatus = "Pending" | "Processing" | "Completed" | "Failed";
export type SlaDisplayStatus =
  | "Overdue"
  | "Due today"
  | `Due in ${number} day`
  | `Due in ${number} days`
  | "At Risk"
  | "On Track"
  | "No SLA";
export type VulnerabilityStatus =
  | "New"
  | "Open"
  | "Mitigated"
  | "Closed"
  | "Reopened"
  | "Accepted Risk"
  | "False Positive"
  | "Compensating Control";

// ─── Assets ────────────────────────────────────────────────────────
export interface CidtContext {
  confidentiality: number | null;
  integrity: number | null;
  availability: number | null;
  traceability: number | null;
  sensitivity: "S1" | "S2" | "S3" | "S4";
  isComplete: boolean;
  source?: string;
  sourceLabel?: string;
  templateKey?: string | null;
  templateLabel?: string | null;
  isCustomOverride?: boolean;
}

export interface AtmPaymentServicesContext {
  label: "ATM Payment Services";
  cidt: CidtContext;
  profile: "Profile 1" | "Profile 2" | "Profile 3" | "Profile 4";
  profileExplanation: string;
  isInternetExposed: boolean;
}

export interface Asset {
  id: string;
  name: string;
  type: "ATM" | "GAB" | "Kiosk" | "Server" | "Network Device" | "Workstation" | "Other";
  model: string;
  manufacturer: string;
  branch: string;
  region: string;
  location: string;
  ipAddress: string;
  osVersion: string;
  criticality: "Critical" | "High" | "Medium" | "Low";
  exposureLevel: "Internet-Facing" | "Internal" | "Isolated";
  gabExposureType: string;
  gabExposureTypeDb: string;
  cidtTemplateKey?: string | null;
  cidt: CidtContext;
  businessApplication: AtmPaymentServicesContext;
  status: AssetStatus;
  owner: string;
  lastScanDate: string;
  vulnerabilityCount: number;
  maxSeverity: Severity;
  contextualPriority: BusinessPriority;
  riskScore: number;
}

// ─── Vulnerabilities / CVEs ────────────────────────────────────────
export interface Vulnerability {
  id: string;
  cveId: string;
  title: string;
  description: string;
  severity: Severity;
  cvssScore: number;
  cvssVector: string;
  businessPriority: BusinessPriority;
  riskScore?: number;
  rankScore?: number;
  rankBucket?: string;
  rankAlgorithmVersion?: string;
  rankFactors?: {
    severity: number;
    threat: number;
    business: number;
    urgency: number;
  };
  samePriorityCount?: number;
  missingRankEvidence?: string[];
  recommendedFixOrder?: number;
  fixRank?: number;
  sameScoreCount?: number;
  tieBreakReason?: string;
  gabExposureType?: string;
  gabExposureTypeDb?: string;
  assetSensitivity?: string;
  applicationSensitivity?: string;
  applicationProfile?: string;
  exploitMaturity: ExploitMaturity;
  hasCisaKevSource?: boolean;
  epssScore?: number | null;
  affectedAssetsCount: number;
  patchAvailable: boolean;
  aiRemediationAvailable: boolean;
  status: VulnerabilityStatus;
  firstSeen: string;
  lastSeen: string;
  slaDue: string;
  slaStatus: SlaDisplayStatus;
  affectedProducts: string[];
  impactAnalysis: string;
  exploitConditions: string;
  trustedSources: TrustedSource[];
  primaryRemediation: string;
  compensatingControls: CompensatingControl[];
  confidenceScore: number;
  contextReason: string;
  priorityFactors?: {
    summary: string;
    businessImpact: string;
    remediationUrgency: string;
    missingContext: string[];
    applicationSensitivity?: string;
    applicationProfile?: string;
    gabExposure?: string;
  };
  aiSummary?: string;
  enrichmentStatus?: EnrichmentStatus;
  enrichmentError?: string;
  enrichmentModel?: string;
  aiEnrichedAt?: string;
  aiTags?: string[];
}

export interface RemediationCampaign {
  id: string;
  representativeVulnerabilityId: string;
  title: string;
  description: string;
  cveIds: string[];
  affectedAssetCodes: string[];
  affectedAssetsCount: number;
  cveCount: number;
  findingCount: number;
  severity: Severity;
  cvssScore: number;
  businessPriority: BusinessPriority;
  riskScore: number;
  rankScore: number;
  rankBucket: string;
  recommendedFixOrder: number;
  fixRank: number;
  exploitMaturity: ExploitMaturity;
  hasCisaKevSource: boolean;
  epssScore?: number | null;
  slaDue: string;
  slaStatus: SlaDisplayStatus;
  firstSeen: string;
  lastSeen: string;
  exposureSummary: string;
  campaignRationale: string;
  tieBreakReason: string;
  groupedCvesText: string;
  rawFindingIds: string[];
}

export interface TrustedSource {
  name: string;
  url: string;
  updatedAt: string;
  icon: string;
}

export interface CompensatingControl {
  title: string;
  description: string;
  command?: string;
}

// ─── Remediation ───────────────────────────────────────────────────
export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  relatedCve: string;
  relatedAsset: string;
  assignedOwner: string;
  assignedAvatar: string;
  dueDate: string;
  slaStatus: SlaDisplayStatus;
  status: RemediationStatus;
  priority: Severity;
  businessPriority: BusinessPriority;
  affectedAssetsCount: number;
  progress: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  changeRequest?: string;
}

// ─── Scan Import ───────────────────────────────────────────────────
export interface ScanImport {
  id: string;
  name: string;
  scannerSource: "Nessus" | "OpenVAS" | "Nmap" | "Qualys" | "Other";
  importDate: string;
  importedBy: string;
  fileName: string;
  fileSize: string;
  assetsFound: number;
  findingsFound: number;
  cvesLinked: number;
  newAssets: number;
  matchedAssets: number;
  newFindings: number;
  fixedFindings: number;
  reopenedFindings: number;
  unchangedFindings: number;
  lowConfidenceMatches: number;
  newVulnerabilities: number;
  closedVulnerabilities: number;
  errors: number;
  warnings: number;
  errorDetails?: {
    message?: string;
    code?: string;
    errorName?: string;
    causeCode?: string | null;
    errors?: string[];
    warnings?: string[];
  } | null;
  status: ImportStatus;
  processingTime: string;
}

// ─── Alerts ────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  type: "Critical Risk" | "Exposed ATM" | "Overdue Remediation" | "New Critical CVE" | "Policy Violation" | "SLA Breach" | "Import Error";
  relatedAsset: string;
  relatedCve: string;
  createdAt: string;
  owner: string;
  status: AlertStatus;
}

// ─── Reports ───────────────────────────────────────────────────────
export interface Report {
  id: string;
  name: string;
  description: string;
  type: "Compliance" | "Risk Posture" | "Executive" | "Remediation" | "Custom";
  schedule: string;
  lastRun: string;
  status: "Active" | "Draft" | "Archived";
}

// ─── Dashboard KPI ─────────────────────────────────────────────────
export interface KpiData {
  label: string;
  value: string | number;
  change: string;
  changeType: "positive" | "negative" | "neutral";
  icon: string;
}

// ─── Settings ──────────────────────────────────────────────────────
export interface RoleConfig {
  name: string;
  permissions: string;
  mfaRequired: "Enforced" | "Optional" | "Not Required";
}

export interface RegionConfig {
  name: string;
  code: string;
}

export interface AtmModelConfig {
  name: string;
}
