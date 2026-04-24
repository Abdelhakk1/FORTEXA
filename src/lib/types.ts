// ─── Severity & Priority ───────────────────────────────────────────
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type BusinessPriority = "P1" | "P2" | "P3" | "P4" | "P5";
export type AssetStatus = "Active" | "Inactive" | "Maintenance" | "Decommissioned";
export type RemediationStatus = "Open" | "Assigned" | "In Progress" | "Mitigated" | "Closed" | "Overdue";
export type AlertStatus = "New" | "Acknowledged" | "In Progress" | "Resolved" | "Dismissed";
export type ImportStatus = "Completed" | "Processing" | "Failed" | "Partial";
export type ExploitMaturity = "Active in Wild (KEV)" | "POC Available" | "Theoretical" | "None";
export type EnrichmentStatus = "Pending" | "Processing" | "Completed" | "Failed";
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
  exploitMaturity: ExploitMaturity;
  affectedAssetsCount: number;
  patchAvailable: boolean;
  aiRemediationAvailable: boolean;
  status: VulnerabilityStatus;
  firstSeen: string;
  lastSeen: string;
  slaDue: string;
  slaStatus: "On Track" | "At Risk" | "Overdue";
  affectedProducts: string[];
  impactAnalysis: string;
  exploitConditions: string;
  trustedSources: TrustedSource[];
  primaryRemediation: string;
  compensatingControls: CompensatingControl[];
  confidenceScore: number;
  contextReason: string;
  aiSummary?: string;
  enrichmentStatus?: EnrichmentStatus;
  enrichmentError?: string;
  enrichmentModel?: string;
  aiEnrichedAt?: string;
  aiTags?: string[];
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
  slaStatus: "On Track" | "At Risk" | "Overdue";
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
