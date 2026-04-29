/**
 * Fortexa Database Schema — Barrel Export
 *
 * All table definitions re-exported from a single entry point.
 * Import from "@/db/schema" in server actions, queries, and middleware.
 *
 * Table count: 18 (16 MVP + 2 late Tier 2)
 *   Tier 1 (Core): profiles, roles, regions, assets, cves, cve_enrichments,
 *                   asset_vulnerabilities, scan_imports, scan_findings,
 *                   remediation_tasks, alerts
 *   Tier 2 (Supporting): cve_source_references, cve_recommended_controls,
 *                        scoring_policies, audit_logs, report_definitions
 *   Late Tier 2 (Defined, implemented Phase 6): generated_reports
 */

// ─── Enums ──────────────────────────────────────────────────────────
export * from "./enums";

// ─── Tier 1 — MVP Core ─────────────────────────────────────────────
export { roles } from "./roles";
export { profiles } from "./profiles";
export { organizations } from "./organizations";
export { organizationMembers } from "./organization-members";
export { organizationInvites } from "./organization-invites";
export { organizationSettings } from "./organization-settings";
export { sites } from "./sites";
export { regions } from "./regions";
export { assets } from "./assets";
export { cves } from "./cves";
export { cveEnrichments } from "./cve-enrichments";
export { assetVulnerabilities } from "./asset-vulnerabilities";
export { assetVulnerabilityEvents } from "./asset-vulnerability-events";
export { assetVulnerabilityEnrichments } from "./asset-vulnerability-enrichments";
export { scanImports } from "./scan-imports";
export { scanFindings } from "./scan-findings";
export { remediationTasks } from "./remediation-tasks";
export { alerts } from "./alerts";

// ─── Tier 2 — Essential Supporting ─────────────────────────────────
export { cveSourceReferences } from "./cve-source-references";
export { cveRecommendedControls } from "./cve-recommended-controls";
export { scoringPolicies } from "./scoring-policies";
export { auditLogs } from "./audit-logs";
export { reportDefinitions } from "./report-definitions";

// ─── Late Tier 2 — Defined early, implemented Phase 6 ─────────────
export { generatedReports } from "./generated-reports";
