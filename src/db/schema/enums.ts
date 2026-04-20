import { pgEnum } from "drizzle-orm/pg-core";

// ─── Severity & Priority ─────────────────────────────────────────────

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const businessPriorityEnum = pgEnum("business_priority", [
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
]);

// ─── Assets ──────────────────────────────────────────────────────────

export const assetTypeEnum = pgEnum("asset_type", [
  "atm",
  "gab",
  "kiosk",
  "server",
  "network_device",
  "workstation",
  "other",
]);

export const assetStatusEnum = pgEnum("asset_status", [
  "active",
  "inactive",
  "maintenance",
  "decommissioned",
]);

export const assetCriticalityEnum = pgEnum("asset_criticality", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const exposureLevelEnum = pgEnum("exposure_level", [
  "internet_facing",
  "internal",
  "isolated",
]);

// ─── CVE & Vulnerability ────────────────────────────────────────────

export const exploitMaturityEnum = pgEnum("exploit_maturity", [
  "active_in_wild",
  "poc_available",
  "theoretical",
  "none",
]);

export const vulnerabilityStatusEnum = pgEnum("vulnerability_status", [
  "open",
  "mitigated",
  "closed",
  "accepted",
]);

export const slaStatusEnum = pgEnum("sla_status", [
  "on_track",
  "at_risk",
  "overdue",
]);

export const enrichmentSourceEnum = pgEnum("enrichment_source", [
  "ai",
  "manual",
  "hybrid",
]);

// ─── Scan Import ────────────────────────────────────────────────────

export const importStatusEnum = pgEnum("import_status", [
  "processing",
  "completed",
  "failed",
  "partial",
]);

export const scannerSourceEnum = pgEnum("scanner_source", [
  "nessus",
  "openvas",
  "nmap",
  "qualys",
  "other",
]);

export const scanFindingStatusEnum = pgEnum("scan_finding_status", [
  "pending",
  "matched",
  "unmatched",
  "ignored",
]);

export const findingMatchMethodEnum = pgEnum("finding_match_method", [
  "ip",
  "hostname",
  "manual",
]);

// ─── Remediation ────────────────────────────────────────────────────

export const remediationStatusEnum = pgEnum("remediation_status", [
  "open",
  "assigned",
  "in_progress",
  "mitigated",
  "closed",
  "overdue",
]);

// ─── Alerts ─────────────────────────────────────────────────────────

export const alertTypeEnum = pgEnum("alert_type", [
  "critical_risk",
  "exposed_asset",
  "overdue_remediation",
  "new_critical_cve",
  "policy_violation",
  "sla_breach",
  "import_error",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "new",
  "acknowledged",
  "in_progress",
  "resolved",
  "dismissed",
]);

// ─── Users ──────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "suspended",
  "disabled",
]);

// ─── Reports ────────────────────────────────────────────────────────

export const reportTypeEnum = pgEnum("report_type", [
  "compliance",
  "risk_posture",
  "executive",
  "remediation",
  "custom",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "active",
  "draft",
  "archived",
]);

export const reportFormatEnum = pgEnum("report_format", [
  "pdf",
  "csv",
  "xlsx",
]);

// ─── CVE Source References ──────────────────────────────────────────

export const sourceTypeEnum = pgEnum("source_type", [
  "nvd",
  "vendor",
  "cisa_kev",
  "internal",
  "other",
]);
