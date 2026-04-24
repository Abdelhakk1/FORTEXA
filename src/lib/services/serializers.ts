import type {
  Alert,
  AlertStatus,
  Asset,
  AssetStatus,
  BusinessPriority,
  ExploitMaturity,
  ImportStatus,
  RemediationStatus,
  Severity,
  VulnerabilityStatus,
} from "@/lib/types";

const severityMap = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
} as const satisfies Record<string, Severity>;

const priorityMap = {
  p1: "P1",
  p2: "P2",
  p3: "P3",
  p4: "P4",
  p5: "P5",
} as const satisfies Record<string, BusinessPriority>;

const assetStatusMap = {
  active: "Active",
  inactive: "Inactive",
  maintenance: "Maintenance",
  decommissioned: "Decommissioned",
} as const satisfies Record<string, AssetStatus>;

const remediationStatusMap = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  mitigated: "Mitigated",
  closed: "Closed",
  overdue: "Overdue",
} as const satisfies Record<string, RemediationStatus>;

const alertStatusMap = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  dismissed: "Dismissed",
} as const satisfies Record<string, AlertStatus>;

const importStatusMap = {
  completed: "Completed",
  processing: "Processing",
  failed: "Failed",
  partial: "Partial",
} as const satisfies Record<string, ImportStatus>;

const vulnerabilityStatusMap = {
  new: "New",
  open: "Open",
  mitigated: "Mitigated",
  closed: "Closed",
  reopened: "Reopened",
  accepted: "Accepted Risk",
  false_positive: "False Positive",
  compensating_control: "Compensating Control",
} as const satisfies Record<string, VulnerabilityStatus>;

const exploitMaturityMap = {
  active_in_wild: "Active in Wild (KEV)",
  poc_available: "POC Available",
  theoretical: "Theoretical",
  none: "None",
} as const satisfies Record<string, ExploitMaturity>;

const scannerSourceMap = {
  nessus: "Nessus",
  openvas: "OpenVAS",
  nmap: "Nmap",
  qualys: "Qualys",
  other: "Other",
} as const;

const assetTypeMap = {
  atm: "ATM",
  gab: "GAB",
  kiosk: "Kiosk",
  server: "Server",
  network_device: "Network Device",
  workstation: "Workstation",
  other: "Other",
} as const;

const exposureLevelMap = {
  internet_facing: "Internet-Facing",
  internal: "Internal",
  isolated: "Isolated",
} as const;

const reportTypeMap = {
  compliance: "Compliance",
  risk_posture: "Risk Posture",
  executive: "Executive",
  remediation: "Remediation",
  custom: "Custom",
} as const;

const reportStatusMap = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
} as const;

const slaStatusMap = {
  on_track: "On Track",
  at_risk: "At Risk",
  overdue: "Overdue",
} as const;

const alertTypeMap = {
  critical_risk: "Critical Risk",
  exposed_asset: "Exposed ATM",
  overdue_remediation: "Overdue Remediation",
  new_critical_cve: "New Critical CVE",
  policy_violation: "Policy Violation",
  sla_breach: "SLA Breach",
  import_error: "Import Error",
} as const;

export function toUiSeverity(value: string | null | undefined): Severity {
  return severityMap[value as keyof typeof severityMap] ?? "INFO";
}

export function toUiBusinessPriority(
  value: string | null | undefined
): BusinessPriority {
  return priorityMap[value as keyof typeof priorityMap] ?? "P5";
}

export function toUiAssetStatus(value: string | null | undefined): AssetStatus {
  return assetStatusMap[value as keyof typeof assetStatusMap] ?? "Inactive";
}

export function toUiRemediationStatus(
  value: string | null | undefined
): RemediationStatus {
  return (
    remediationStatusMap[value as keyof typeof remediationStatusMap] ?? "Open"
  );
}

export function toUiAlertStatus(value: string | null | undefined): AlertStatus {
  return alertStatusMap[value as keyof typeof alertStatusMap] ?? "New";
}

export function toUiImportStatus(value: string | null | undefined): ImportStatus {
  return importStatusMap[value as keyof typeof importStatusMap] ?? "Processing";
}

export function toUiVulnerabilityStatus(
  value: string | null | undefined
): VulnerabilityStatus {
  return (
    vulnerabilityStatusMap[value as keyof typeof vulnerabilityStatusMap] ??
    "Open"
  );
}

export function toUiExploitMaturity(
  value: string | null | undefined
): ExploitMaturity {
  return (
    exploitMaturityMap[value as keyof typeof exploitMaturityMap] ?? "None"
  );
}

export function toUiScannerSource(value: string | null | undefined) {
  return scannerSourceMap[value as keyof typeof scannerSourceMap] ?? "Other";
}

export function toUiAssetType(
  value: string | null | undefined
): Asset["type"] {
  return assetTypeMap[value as keyof typeof assetTypeMap] ?? "Other";
}

export function toUiCriticality(
  value: string | null | undefined
): Asset["criticality"] {
  switch (value) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "low":
      return "Low";
    case "medium":
    default:
      return "Medium";
  }
}

export function toUiExposureLevel(
  value: string | null | undefined
): Asset["exposureLevel"] {
  return (
    exposureLevelMap[value as keyof typeof exposureLevelMap] ?? "Internal"
  );
}

export function toUiReportType(value: string | null | undefined) {
  return reportTypeMap[value as keyof typeof reportTypeMap] ?? "Custom";
}

export function toUiReportStatus(value: string | null | undefined) {
  return reportStatusMap[value as keyof typeof reportStatusMap] ?? "Draft";
}

export function toUiSlaStatus(value: string | null | undefined) {
  return slaStatusMap[value as keyof typeof slaStatusMap] ?? "On Track";
}

export function toUiAlertType(
  value: string | null | undefined
): Alert["type"] {
  return alertTypeMap[value as keyof typeof alertTypeMap] ?? "Policy Violation";
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatFileSize(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${
    units[exponent]
  }`;
}

export function formatDuration(milliseconds: number | null | undefined) {
  if (!milliseconds || milliseconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function getInitials(name: string | null | undefined) {
  if (!name) {
    return "NA";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
