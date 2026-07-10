import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const selfCheck = args.has("--self-check");
const allowExisting = args.has("--allow-existing");
const demoMode = process.env.DEMO_MODE?.trim() === "true";
const databaseUrl = process.env.DATABASE_URL?.trim();
const organizationId = process.env.FORTEXA_DEMO_ORGANIZATION_ID?.trim();
const organizationSlug = process.env.FORTEXA_DEMO_ORGANIZATION_SLUG?.trim();
const explicitProfileId = process.env.FORTEXA_DEMO_PROFILE_ID?.trim();

const DAY_MS = 86_400_000;
const SEED_VERSION = 1;
const scanOffsets = [-76, -61, -46, -31, -16, -1];

const cveSpecs = [
  { cveId: "CVE-2021-34527", title: "Windows Print Spooler Remote Code Execution", severity: "critical", cvssScore: 9.8, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Microsoft Windows Print Spooler"], publishedDate: "2021-07-01", port: 445 },
  { cveId: "CVE-2021-44228", title: "Apache Log4j Remote Code Execution", severity: "critical", cvssScore: 10, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Apache Log4j 2"], publishedDate: "2021-12-10", port: 8080 },
  { cveId: "CVE-2024-3400", title: "PAN-OS GlobalProtect Command Injection", severity: "critical", cvssScore: 10, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Palo Alto PAN-OS"], publishedDate: "2024-04-12", port: 443 },
  { cveId: "CVE-2019-0708", title: "Remote Desktop Services Remote Code Execution", severity: "critical", cvssScore: 9.8, exploitMaturity: "poc_available", knownExploitation: true, patchAvailable: true, products: ["Microsoft Remote Desktop Services"], publishedDate: "2019-05-16", port: 3389 },
  { cveId: "CVE-2023-23397", title: "Microsoft Outlook Privilege Escalation", severity: "high", cvssScore: 9.8, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Microsoft Outlook"], publishedDate: "2023-03-14", port: 445 },
  { cveId: "CVE-2022-30190", title: "Microsoft Support Diagnostic Tool Remote Code Execution", severity: "high", cvssScore: 7.8, exploitMaturity: "poc_available", knownExploitation: true, patchAvailable: true, products: ["Microsoft Windows MSDT"], publishedDate: "2022-06-01", port: 80 },
  { cveId: "CVE-2023-34362", title: "MOVEit Transfer SQL Injection", severity: "high", cvssScore: 9.8, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Progress MOVEit Transfer"], publishedDate: "2023-06-02", port: 443 },
  { cveId: "CVE-2021-26855", title: "Microsoft Exchange Server-Side Request Forgery", severity: "high", cvssScore: 9.1, exploitMaturity: "active_in_wild", knownExploitation: true, patchAvailable: true, products: ["Microsoft Exchange Server"], publishedDate: "2021-03-03", port: 443 },
  { cveId: "CVE-2023-44487", title: "HTTP/2 Rapid Reset Denial of Service", severity: "medium", cvssScore: 7.5, exploitMaturity: "theoretical", knownExploitation: false, patchAvailable: true, products: ["HTTP/2 services"], publishedDate: "2023-10-10", port: 443 },
  { cveId: "CVE-2021-3156", title: "Sudo Heap-Based Buffer Overflow", severity: "medium", cvssScore: 7.8, exploitMaturity: "poc_available", knownExploitation: false, patchAvailable: true, products: ["Sudo"], publishedDate: "2021-01-26", port: 22 },
  { cveId: "CVE-2020-1472", title: "Netlogon Elevation of Privilege", severity: "medium", cvssScore: 10, exploitMaturity: "poc_available", knownExploitation: false, patchAvailable: true, products: ["Microsoft Netlogon"], publishedDate: "2020-08-17", port: 445 },
  { cveId: "CVE-2021-36368", title: "OpenSSH Observable Discrepancy", severity: "low", cvssScore: 3.7, exploitMaturity: "theoretical", knownExploitation: false, patchAvailable: true, products: ["OpenSSH"], publishedDate: "2021-07-30", port: 22 },
  { cveId: "CVE-2020-14145", title: "OpenSSH Host Key Information Exposure", severity: "low", cvssScore: 5.9, exploitMaturity: "theoretical", knownExploitation: false, patchAvailable: true, products: ["OpenSSH client"], publishedDate: "2020-06-29", port: 22 },
  { cveId: "CVE-2019-6111", title: "OpenSSH SCP Client File Validation", severity: "low", cvssScore: 5.9, exploitMaturity: "theoretical", knownExploitation: false, patchAvailable: true, products: ["OpenSSH SCP client"], publishedDate: "2019-01-31", port: 22 },
];

const assetSpecs = [
  { code: "DEMO-GAB-001", name: "Algiers Central Outdoor GAB", ip: "10.40.10.11", branch: "Algiers Central", location: "Didouche Mourad, Algiers", criticality: "critical", exposure: "internet_facing", gabExposure: "outdoor_public_street", template: "outdoor_agency", cidt: [4, 4, 4, 4], manufacturer: "NCR", model: "SelfServ 84", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-002", name: "Bab Ezzouar Commercial Centre GAB", ip: "10.40.10.12", branch: "Bab Ezzouar", location: "Bab Ezzouar, Algiers", criticality: "critical", exposure: "internet_facing", gabExposure: "outdoor_commercial_center", template: "outdoor_agency", cidt: [4, 4, 4, 4], manufacturer: "Diebold Nixdorf", model: "DN Series 200", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-003", name: "Oran Waterfront Outdoor GAB", ip: "10.40.20.11", branch: "Oran Waterfront", location: "Front de Mer, Oran", criticality: "critical", exposure: "internet_facing", gabExposure: "outdoor_public_street", template: "outdoor_agency", cidt: [4, 4, 4, 3], manufacturer: "NCR", model: "SelfServ 22e", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-004", name: "Constantine Station Outdoor GAB", ip: "10.40.30.11", branch: "Constantine Station", location: "Constantine", criticality: "high", exposure: "internet_facing", gabExposure: "outdoor_agency", template: "outdoor_agency", cidt: [4, 4, 3, 3], manufacturer: "Diebold Nixdorf", model: "CINEO C2550", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-005", name: "Algiers Head Office Lobby GAB", ip: "10.40.10.21", branch: "Head Office", location: "Hydra, Algiers", criticality: "high", exposure: "internal", gabExposure: "indoor_agency", template: "indoor_agency", cidt: [3, 4, 4, 3], manufacturer: "NCR", model: "SelfServ 80", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-006", name: "Oran Es Senia Agency GAB", ip: "10.40.20.21", branch: "Es Senia", location: "Es Senia, Oran", criticality: "high", exposure: "internal", gabExposure: "indoor_agency", template: "indoor_agency", cidt: [3, 3, 4, 3], manufacturer: "Diebold Nixdorf", model: "DN Series 100", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-007", name: "Setif Agency Lobby GAB", ip: "10.40.40.21", branch: "Setif Centre", location: "Setif", criticality: "medium", exposure: "internal", gabExposure: "indoor_agency", template: "indoor_agency", cidt: [3, 3, 3, 3], manufacturer: "NCR", model: "SelfServ 26", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-008", name: "Annaba Agency Lobby GAB", ip: "10.40.50.21", branch: "Annaba Centre", location: "Annaba", criticality: "medium", exposure: "internal", gabExposure: "indoor_agency", template: "indoor_agency", cidt: [3, 3, 3, 2], manufacturer: "Diebold Nixdorf", model: "CINEO C2590", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-009", name: "Tlemcen Backup GAB", ip: "10.40.60.31", branch: "Tlemcen", location: "Tlemcen", criticality: "medium", exposure: "isolated", gabExposure: "indoor_agency", template: null, cidt: [2, 2, 3, 2], manufacturer: "NCR", model: "SelfServ 22", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-010", name: "Bejaia Agency Backup GAB", ip: "10.40.70.31", branch: "Bejaia", location: "Bejaia", criticality: "low", exposure: "isolated", gabExposure: "indoor_agency", template: null, cidt: [2, 2, 2, 2], manufacturer: "Diebold Nixdorf", model: "Opteva 522", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-011", name: "Ghardaia Agency GAB", ip: "10.40.80.21", branch: "Ghardaia", location: "Ghardaia", criticality: "medium", exposure: "internal", gabExposure: "indoor_agency", template: "indoor_agency", cidt: [3, 3, 3, 3], manufacturer: "NCR", model: "SelfServ 34", os: "Windows 10 IoT Enterprise" },
  { code: "DEMO-GAB-012", name: "Ouargla New Agency GAB", ip: "10.40.90.21", branch: "Ouargla", location: "Ouargla", criticality: "low", exposure: "isolated", gabExposure: "indoor_agency", template: null, cidt: [2, 2, 2, 1], manufacturer: "Diebold Nixdorf", model: "Opteva 720", os: "Windows 10 IoT Enterprise" },
];

const siteSpecs = [
  { code: "DEMO-ALG", name: "Algiers Regional Fleet", region: "North Centre", location: "Algiers" },
  { code: "DEMO-ORN", name: "Oran Regional Fleet", region: "West", location: "Oran" },
  { code: "DEMO-CST", name: "Constantine Regional Fleet", region: "East", location: "Constantine" },
  { code: "DEMO-SUD", name: "Southern Regional Fleet", region: "South", location: "Ouargla" },
];

// Each bit is whether the asset/CVE finding appeared in one of the six scans.
const exposureSpecs = [
  [0, 0, "111111"], [1, 1, "111111"], [2, 2, "110111"], [3, 3, "111000"],
  [4, 0, "011111"], [5, 1, "000111"], [6, 2, "100011"], [7, 3, "111110"],
  [8, 0, "001111"], [9, 1, "111011"], [0, 4, "111111"], [1, 5, "111000"],
  [2, 6, "011111"], [3, 7, "111101"], [4, 4, "001111"], [5, 5, "111110"],
  [6, 6, "000111"], [7, 7, "110011"], [10, 4, "111111"], [0, 8, "111111"],
  [1, 9, "111100"], [2, 10, "011111"], [8, 8, "001111"], [9, 9, "110111"],
  [10, 10, "111111"], [11, 8, "000011"], [3, 11, "111111"], [4, 12, "111000"],
  [5, 13, "011111"], [8, 11, "001111"], [9, 12, "110011"], [11, 13, "000111"],
];

const taskStatuses = [
  "closed", "closed", "mitigated", "overdue", "open", "in_progress",
  "closed", "assigned", "overdue", "mitigated", "open", "closed",
  "in_progress", "overdue", "assigned", "open", "closed", "mitigated",
];

const { calculateBusinessPriority } = await import(
  "../src/lib/services/business-priority.ts"
);

function seededUuid(organization, namespace, index) {
  const hex = createHash("sha256")
    .update(`${organization}:${namespace}:${index}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function atUtcDay(now, dayOffset, hour = 9) {
  const date = new Date(now);
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date;
}

function buildSeedModel({ organization, now, cves, application }) {
  const scanDates = scanOffsets.map((offset) => atUtcDay(now, offset));
  const scans = scanDates.map((date, index) => ({
    id: seededUuid(organization, "scan", index),
    date,
    name: `Fortexa demonstration Nessus scan ${index + 1}`,
    fileName: `fortexa-demo-${date.toISOString().slice(0, 10)}.nessus`,
  }));
  const assets = assetSpecs.map((asset, index) => ({
    ...asset,
    id: seededUuid(organization, "asset", index),
  }));

  const exposures = exposureSpecs.map(([assetIndex, cveIndex, presence], index) => {
    const asset = assets[assetIndex];
    const cve = cves[cveIndex];
    const firstScanIndex = presence.indexOf("1");
    const lastScanIndex = presence.lastIndexOf("1");
    const wasReopened = presence.includes("01", firstScanIndex + 1);
    const isOpen = presence.endsWith("1");
    const slaVariant = index % 4;
    const slaDue = isOpen
      ? atUtcDay(now, slaVariant === 0 ? -8 : slaVariant === 1 ? 4 : slaVariant === 2 ? 22 : 55)
      : atUtcDay(now, -12);
    const slaStatus = isOpen
      ? slaVariant === 0 ? "overdue" : slaVariant === 1 ? "at_risk" : "on_track"
      : "on_track";
    const status = isOpen ? (wasReopened ? "reopened" : "open") : "closed";
    const assetCidt = {
      confidentiality: asset.cidt[0],
      integrity: asset.cidt[1],
      availability: asset.cidt[2],
      traceability: asset.cidt[3],
    };
    const applicationCidt = {
      confidentiality: application.cidtConfidentiality,
      integrity: application.cidtIntegrity,
      availability: application.cidtAvailability,
      traceability: application.cidtTraceability,
    };
    const priority = calculateBusinessPriority({
      severity: cve.severity,
      cvssScore: Number(cve.cvssScore),
      exploitMaturity: cve.exploitMaturity,
      knownExploitation: cve.knownExploitation,
      epssScore: null,
      assetCidt,
      assetCidtSource: "custom_override",
      assetCidtSourceLabel: "Demonstration asset CIDT",
      applicationCidt,
      applicationInternetExposed: application.isInternetExposed,
      gabExposureType: asset.gabExposure,
      slaDue,
      slaStatus,
      lifecycleStatus: status,
      scannerEvidenceCount: Array.from(presence).filter((value) => value === "1").length,
      scannerEvidenceQuality: 97,
      trustedSourceCount: cve.knownExploitation ? 1 : 0,
      firstSeen: scanDates[firstScanIndex],
      assetCode: asset.code,
      cveId: cve.cveId,
      id: seededUuid(organization, "asset-vulnerability", index),
    });

    return {
      id: seededUuid(organization, "asset-vulnerability", index),
      assetIndex,
      cveIndex,
      asset,
      cve,
      presence,
      firstScanIndex,
      lastScanIndex,
      firstSeen: scanDates[firstScanIndex],
      lastSeen: scanDates[lastScanIndex],
      status,
      slaDue,
      slaStatus,
      riskScore: priority.riskScore,
      businessPriority: priority.businessPriority,
      priorityFactors: priority.factors,
    };
  });

  const findings = [];
  const events = [];
  const everSeen = new Set();
  let previous = new Set();
  let eventIndex = 0;

  for (let scanIndex = 0; scanIndex < scans.length; scanIndex += 1) {
    const active = new Set(
      exposures
        .map((exposure, index) => exposure.presence[scanIndex] === "1" ? index : -1)
        .filter((index) => index >= 0)
    );
    const newFindings = Array.from(active).filter((index) => !everSeen.has(index));
    const reopenedFindings = Array.from(active).filter(
      (index) => everSeen.has(index) && !previous.has(index)
    );
    const fixedFindings = Array.from(previous).filter((index) => !active.has(index));
    const unchangedFindings = Array.from(active).filter((index) => previous.has(index));
    const activeAssets = new Set(Array.from(active, (index) => exposures[index].assetIndex));
    const priorAssets = new Set(
      Array.from(everSeen, (index) => exposures[index].assetIndex)
    );
    const newAssets = Array.from(activeAssets).filter((index) => !priorAssets.has(index)).length;
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const exposureIndex of active) {
      const exposure = exposures[exposureIndex];
      if (exposure.cve.severity in severityCounts) {
        severityCounts[exposure.cve.severity] += 1;
      }
      findings.push({
        id: seededUuid(organization, "finding", scanIndex * 100 + exposureIndex),
        scanIndex,
        exposureIndex,
        firstSeen: exposure.firstSeen,
        lastSeen: scans[scanIndex].date,
      });
    }

    for (const exposureIndex of newFindings) {
      const exposure = exposures[exposureIndex];
      events.push({
        id: seededUuid(organization, "event", eventIndex++),
        exposureIndex,
        scanIndex,
        type: "introduced",
        beforeStatus: null,
        afterStatus: "open",
        createdAt: scans[scanIndex].date,
        details: { source: "nessus", severity: exposure.cve.severity },
      });
    }
    for (const exposureIndex of reopenedFindings) {
      events.push({
        id: seededUuid(organization, "event", eventIndex++),
        exposureIndex,
        scanIndex,
        type: "reopened",
        beforeStatus: "closed",
        afterStatus: "reopened",
        createdAt: scans[scanIndex].date,
        details: { source: "nessus", reason: "Finding returned after an absent scan" },
      });
    }
    for (const exposureIndex of fixedFindings) {
      events.push({
        id: seededUuid(organization, "event", eventIndex++),
        exposureIndex,
        scanIndex,
        type: "fixed",
        beforeStatus: exposures[exposureIndex].status === "reopened" ? "reopened" : "open",
        afterStatus: "closed",
        createdAt: scans[scanIndex].date,
        details: { source: "nessus", reason: "Finding absent from the current in-scope scan" },
      });
    }
    for (const exposureIndex of unchangedFindings) {
      const status = exposures[exposureIndex].presence.slice(0, scanIndex).includes("01")
        ? "reopened"
        : "open";
      events.push({
        id: seededUuid(organization, "event", eventIndex++),
        exposureIndex,
        scanIndex,
        type: "unchanged",
        beforeStatus: status,
        afterStatus: status,
        createdAt: scans[scanIndex].date,
        details: { source: "nessus" },
      });
    }

    Object.assign(scans[scanIndex], {
      assetsFound: activeAssets.size,
      findingsFound: active.size,
      cvesLinked: active.size,
      newAssets,
      matchedAssets: activeAssets.size - newAssets,
      newFindings: newFindings.length,
      fixedFindings: fixedFindings.length,
      reopenedFindings: reopenedFindings.length,
      unchangedFindings: unchangedFindings.length,
      newVulnerabilities: newFindings.length,
      closedVulnerabilities: fixedFindings.length,
      severityCounts,
    });
    active.forEach((index) => everSeen.add(index));
    previous = active;
  }

  const tasks = taskStatuses.map((status, index) => {
    const exposureIndex = index;
    const exposure = exposures[exposureIndex];
    const createdAt = atUtcDay(now, scanOffsets[index % scanOffsets.length] + 2, 11);
    const finished = status === "closed" || status === "mitigated";
    const updatedAt = finished
      ? new Date(Math.min(createdAt.getTime() + (6 + (index % 6)) * DAY_MS, now.getTime() - DAY_MS))
      : atUtcDay(now, -Math.max(1, 12 - index), 14);
    const dueDate = status === "overdue"
      ? atUtcDay(now, -(3 + index), 17)
      : finished
        ? new Date(updatedAt.getTime() + DAY_MS)
        : atUtcDay(now, 8 + index, 17);
    const task = {
      id: seededUuid(organization, "remediation-task", index),
      exposureIndex,
      title: `Remediate ${exposure.cve.cveId} on ${exposure.asset.code}`,
      description: `Apply the vendor remediation for ${exposure.cve.title}, validate service health, and attach change evidence.`,
      status,
      progress: finished ? 100 : status === "in_progress" ? 55 : status === "assigned" ? 20 : 0,
      priority: exposure.cve.severity,
      businessPriority: exposure.businessPriority,
      slaStatus: status === "overdue" ? "overdue" : finished ? "on_track" : index % 3 === 0 ? "at_risk" : "on_track",
      createdAt,
      updatedAt,
      dueDate,
      changeRequest: `CHG-DEMO-${String(index + 1).padStart(4, "0")}`,
    };

    events.push({
      id: seededUuid(organization, "event", eventIndex++),
      exposureIndex,
      scanIndex: null,
      type: "task_linked",
      beforeStatus: null,
      afterStatus: exposure.status,
      createdAt,
      actor: true,
      details: { remediationTaskId: task.id, status },
    });
    if (finished) {
      events.push({
        id: seededUuid(organization, "event", eventIndex++),
        exposureIndex,
        scanIndex: null,
        type: "task_completed",
        beforeStatus: exposure.status,
        afterStatus: status === "closed" ? "closed" : "mitigated",
        createdAt: updatedAt,
        actor: true,
        details: { remediationTaskId: task.id, status },
      });
    }
    return task;
  });

  return {
    scans,
    assets,
    exposures,
    findings,
    events,
    tasks,
    sites: siteSpecs.map((site, index) => ({
      ...site,
      id: seededUuid(organization, "site", index),
    })),
  };
}

function validateModel(model) {
  assert.equal(model.scans.length, 6, "demo seed must contain six scans");
  assert.ok(model.scans.every((scan) =>
    ["critical", "high", "medium", "low"].every(
      (severity) => scan.severityCounts[severity] > 0
    )
  ), "every scan must contain all four dashboard severities");
  assert.ok(model.scans.some((scan) => scan.fixedFindings > 0), "scan history needs fixed findings");
  assert.ok(model.scans.some((scan) => scan.reopenedFindings > 0), "scan history needs reopened findings");
  assert.deepEqual(
    new Set(model.exposures.map((exposure) => exposure.priorityFactors.rankV2?.bucketLabel)),
    new Set(["Fix first", "Accelerated", "Planned", "Routine"]),
    "Rank v2 demonstration data must cover every bucket"
  );
  assert.ok(model.events.some((event) => event.type === "task_completed"));
  assert.ok(model.tasks.some((task) => task.status === "overdue"));
  assert.ok(model.tasks.some((task) => task.status === "closed" || task.status === "mitigated"));
}

function displayCounts(model) {
  return {
    scans: model.scans.length,
    assets: model.assets.length,
    findings: model.findings.length,
    assetVulnerabilities: model.exposures.length,
    events: model.events.length,
    remediationTasks: model.tasks.length,
    rankV2Buckets: Object.fromEntries(
      ["Fix first", "Accelerated", "Planned", "Routine"].map((bucket) => [
        bucket,
        model.exposures.filter(
          (exposure) => exposure.priorityFactors.rankV2?.bucketLabel === bucket
        ).length,
      ])
    ),
  };
}

const defaultApplication = {
  cidtConfidentiality: 4,
  cidtIntegrity: 4,
  cidtAvailability: 4,
  cidtTraceability: 4,
  isInternetExposed: false,
};
const selfCheckCves = cveSpecs.map((cve, index) => ({
  ...cve,
  id: seededUuid("00000000-0000-4000-8000-000000000000", "cve", index),
}));
const checkedModel = buildSeedModel({
  organization: "00000000-0000-4000-8000-000000000000",
  now: new Date(),
  cves: selfCheckCves,
  application: defaultApplication,
});
validateModel(checkedModel);

if (selfCheck) {
  console.log(JSON.stringify({ result: "passed", ...displayCounts(checkedModel) }, null, 2));
  process.exit(0);
}

function fail(message) {
  throw new Error(message);
}

if (!demoMode) {
  fail("Refusing to seed: set the server-only DEMO_MODE=true environment variable.");
}
if (!databaseUrl) {
  fail("Missing required environment variable: DATABASE_URL");
}
if (Boolean(organizationId) === Boolean(organizationSlug)) {
  fail("Set exactly one of FORTEXA_DEMO_ORGANIZATION_ID or FORTEXA_DEMO_ORGANIZATION_SLUG.");
}
if (!execute && allowExisting) {
  fail("--allow-existing is only valid with --execute.");
}
if ((process.env.CI || process.env.VERCEL) && execute && process.env.FORTEXA_ALLOW_AUTOMATED_DEMO_SEED !== "true") {
  fail("Refusing to seed from CI/Vercel without FORTEXA_ALLOW_AUTOMATED_DEMO_SEED=true.");
}

const sql = postgres(databaseUrl, {
  prepare: false,
  max: 1,
  connect_timeout: 8,
  idle_timeout: 5,
});

function ids(model, key) {
  return model[key].map((row) => row.id);
}

async function deleteSeedRows(tx, organization, model) {
  await tx`delete from public.asset_vulnerability_events where organization_id = ${organization} and id = any(${tx.array(ids(model, "events"))}::uuid[])`;
  await tx`delete from public.remediation_tasks where organization_id = ${organization} and id = any(${tx.array(ids(model, "tasks"))}::uuid[])`;
  await tx`delete from public.scan_findings where organization_id = ${organization} and id = any(${tx.array(ids(model, "findings"))}::uuid[])`;
  await tx`delete from public.asset_vulnerabilities where organization_id = ${organization} and id = any(${tx.array(ids(model, "exposures"))}::uuid[])`;
  await tx`delete from public.scan_imports where organization_id = ${organization} and id = any(${tx.array(ids(model, "scans"))}::uuid[])`;
  await tx`delete from public.assets where organization_id = ${organization} and id = any(${tx.array(ids(model, "assets"))}::uuid[])`;
  await tx`delete from public.sites where organization_id = ${organization} and id = any(${tx.array(ids(model, "sites"))}::uuid[])`;
}

async function insertSeedRows(tx, organization, profileId, application, cves, model, now) {
  for (const site of model.sites) {
    await tx`
      insert into public.sites (
        id, organization_id, name, code, site_type, region_name, country,
        location, timezone, vendor_managed, created_at, updated_at
      ) values (
        ${site.id}, ${organization}, ${site.name}, ${site.code}, 'atm_fleet',
        ${site.region}, 'Algeria', ${site.location}, 'Africa/Algiers', false,
        ${model.scans[0].date}, ${now}
      )
    `;
  }

  for (const [index, asset] of model.assets.entries()) {
    const assetScanDates = model.exposures
      .filter((exposure) => exposure.assetIndex === index)
      .flatMap((exposure) => Array.from(exposure.presence)
        .map((present, scanIndex) => present === "1" ? model.scans[scanIndex].date : null)
        .filter(Boolean));
    const firstSeen = new Date(Math.min(...assetScanDates.map((date) => date.getTime())));
    const lastSeen = new Date(Math.max(...assetScanDates.map((date) => date.getTime())));
    await tx`
      insert into public.assets (
        id, organization_id, asset_code, name, type, model, manufacturer, branch,
        location, ip_address, os_version, criticality, exposure_level,
        gab_exposure_type, cidt_template_key, cidt_override_enabled,
        cidt_confidentiality, cidt_integrity, cidt_availability, cidt_traceability,
        business_application_id, status, last_scan_date, metadata, created_at, updated_at
      ) values (
        ${asset.id}, ${organization}, ${asset.code}, ${asset.name}, 'gab', ${asset.model},
        ${asset.manufacturer}, ${asset.branch}, ${asset.location}, ${asset.ip}, ${asset.os},
        ${asset.criticality}, ${asset.exposure}, ${asset.gabExposure}, ${asset.template}, true,
        ${asset.cidt[0]}, ${asset.cidt[1]}, ${asset.cidt[2]}, ${asset.cidt[3]},
        ${application.id}, 'active', ${lastSeen},
        ${tx.json({ fortexaDemonstrationData: true, scanner: "Nessus", hostname: `${asset.code.toLowerCase()}.fortexa.demo` })},
        ${new Date(firstSeen.getTime() - DAY_MS)}, ${lastSeen}
      )
    `;
  }

  for (const scan of model.scans) {
    await tx`
      insert into public.scan_imports (
        id, organization_id, name, scanner_source, import_date, imported_by,
        file_name, file_size, status, assets_found, findings_found, cves_linked,
        new_assets, matched_assets, new_findings, fixed_findings, reopened_findings,
        unchanged_findings, low_confidence_matches, new_vulnerabilities,
        closed_vulnerabilities, errors, warnings, processing_time_ms, created_at, updated_at
      ) values (
        ${scan.id}, ${organization}, ${scan.name}, 'nessus', ${scan.date}, ${profileId},
        ${scan.fileName}, ${48_000 + scan.findingsFound * 1_140}, 'completed',
        ${scan.assetsFound}, ${scan.findingsFound}, ${scan.cvesLinked}, ${scan.newAssets},
        ${scan.matchedAssets}, ${scan.newFindings}, ${scan.fixedFindings},
        ${scan.reopenedFindings}, ${scan.unchangedFindings}, 0,
        ${scan.newVulnerabilities}, ${scan.closedVulnerabilities}, 0, 0,
        ${2_200 + scan.findingsFound * 37}, ${scan.date}, ${scan.date}
      )
    `;
  }

  for (const exposure of model.exposures) {
    await tx`
      insert into public.asset_vulnerabilities (
        id, organization_id, asset_id, cve_id, first_seen, last_seen, status,
        business_priority, risk_score, priority_factors, sla_due, sla_status,
        source_scan_import_id, notes, created_at, updated_at
      ) values (
        ${exposure.id}, ${organization}, ${exposure.asset.id}, ${cves[exposure.cveIndex].id},
        ${exposure.firstSeen}, ${exposure.lastSeen}, ${exposure.status},
        ${exposure.businessPriority}, ${exposure.riskScore}, ${tx.json(exposure.priorityFactors)},
        ${exposure.slaDue}, ${exposure.slaStatus}, ${model.scans[exposure.firstScanIndex].id},
        'Demonstration record derived from historical Nessus scans.',
        ${exposure.firstSeen}, ${exposure.lastSeen}
      )
    `;
  }

  for (const finding of model.findings) {
    const exposure = model.exposures[finding.exposureIndex];
    const cve = cves[exposure.cveIndex];
    await tx`
      insert into public.scan_findings (
        id, organization_id, scan_import_id, finding_code, title, severity, host,
        port, protocol, raw_evidence, first_seen, last_seen, matched_asset_id,
        matched_cve_id, match_confidence, match_method, match_notes, status, created_at
      ) values (
        ${finding.id}, ${organization}, ${model.scans[finding.scanIndex].id},
        ${`NESSUS-DEMO-${String(exposure.cveIndex + 1).padStart(5, "0")}`},
        ${cve.title}, ${cve.severity}, ${exposure.asset.ip}, ${cve.port}, 'tcp',
        ${`Nessus verified ${cve.cveId} on ${exposure.asset.code}; vendor patch validation required.`},
        ${finding.firstSeen}, ${finding.lastSeen}, ${exposure.asset.id}, ${cve.id},
        97, 'ip', 'Matched by exact scanner IP within the demonstration workspace.',
        'matched', ${model.scans[finding.scanIndex].date}
      )
    `;
  }

  for (const task of model.tasks) {
    const exposure = model.exposures[task.exposureIndex];
    await tx`
      insert into public.remediation_tasks (
        id, organization_id, title, description, asset_vulnerability_id, cve_id,
        assigned_to, created_by, due_date, sla_status, status, priority,
        business_priority, progress, notes, change_request, created_at, updated_at
      ) values (
        ${task.id}, ${organization}, ${task.title}, ${task.description}, ${exposure.id},
        ${cves[exposure.cveIndex].id}, ${profileId}, ${profileId}, ${task.dueDate},
        ${task.slaStatus}, ${task.status}, ${task.priority}, ${task.businessPriority},
        ${task.progress}, 'Coordinate with branch operations and retain validation evidence.',
        ${task.changeRequest}, ${task.createdAt}, ${task.updatedAt}
      )
    `;
  }

  for (const event of model.events) {
    const exposure = model.exposures[event.exposureIndex];
    await tx`
      insert into public.asset_vulnerability_events (
        id, organization_id, asset_vulnerability_id, event_type, before_status,
        after_status, risk_score, business_priority, scan_import_id,
        actor_profile_id, details, note, created_at
      ) values (
        ${event.id}, ${organization}, ${exposure.id}, ${event.type}, ${event.beforeStatus},
        ${event.afterStatus}, ${exposure.riskScore}, ${exposure.businessPriority},
        ${event.scanIndex == null ? null : model.scans[event.scanIndex].id},
        ${event.actor ? profileId : null}, ${tx.json(event.details)},
        ${event.type === "task_completed" ? "Remediation completion recorded for demonstration history." : null},
        ${event.createdAt}
      )
    `;
  }
}

try {
  const organizations = organizationId
    ? await sql`select id, name, slug, metadata from public.organizations where id = ${organizationId}::uuid`
    : await sql`select id, name, slug, metadata from public.organizations where slug = ${organizationSlug}`;
  const organization = organizations[0];
  if (!organization) {
    fail("The selected demonstration organization does not exist.");
  }

  const members = explicitProfileId
    ? await sql`
        select p.id
        from public.organization_members member
        join public.profiles p on p.id = member.profile_id
        where member.organization_id = ${organization.id}
          and member.profile_id = ${explicitProfileId}::uuid
          and member.status = 'active' and p.status = 'active'
        limit 1
      `
    : await sql`
        select p.id
        from public.organization_members member
        join public.profiles p on p.id = member.profile_id
        where member.organization_id = ${organization.id}
          and member.status = 'active' and p.status = 'active'
        order by case member.role when 'owner' then 0 when 'admin' then 1 else 2 end,
          member.created_at
        limit 1
      `;
  const profileId = members[0]?.id;
  if (!profileId) {
    fail("The selected workspace needs an active member profile to own remediation tasks.");
  }

  const [existing] = await sql`
    select
      (select count(*)::int from public.assets where organization_id = ${organization.id}) as assets,
      (select count(*)::int from public.scan_imports where organization_id = ${organization.id}) as scans,
      (select count(*)::int from public.asset_vulnerabilities where organization_id = ${organization.id}) as vulnerabilities,
      (select count(*)::int from public.remediation_tasks where organization_id = ${organization.id}) as remediation_tasks
  `;
  const existingOperationalRows = Object.values(existing).reduce(
    (sum, value) => sum + Number(value ?? 0),
    0
  );
  const alreadyDemo = organization.metadata?.fortexaDemonstrationData === true;

  if (!execute) {
    console.log(JSON.stringify({
      result: "dry_run",
      message: "No data was written. Re-run with --execute after reviewing this target.",
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      alreadyDemo,
      existing,
      requiresAllowExisting: !alreadyDemo && existingOperationalRows > 0,
      seed: displayCounts(checkedModel),
    }, null, 2));
    process.exit(0);
  }

  if (!alreadyDemo && existingOperationalRows > 0 && !allowExisting) {
    fail("Refusing to mix demonstration rows into a non-empty workspace. Review the dry run, then pass --allow-existing explicitly if this is the jury workspace.");
  }

  const now = new Date();
  const result = await sql.begin(async (tx) => {
    const placeholderModel = buildSeedModel({
      organization: organization.id,
      now,
      cves: selfCheckCves,
      application: defaultApplication,
    });
    await deleteSeedRows(tx, organization.id, placeholderModel);

    const applicationSeedId = seededUuid(organization.id, "business-application", 0);
    await tx`
      insert into public.business_applications (
        id, organization_id, key, label, cidt_confidentiality, cidt_integrity,
        cidt_availability, cidt_traceability, is_internet_exposed
      ) values (
        ${applicationSeedId}, ${organization.id}, 'monetique', 'ATM Payment Services',
        4, 4, 4, 4, false
      ) on conflict (organization_id, key) do nothing
    `;
    const [application] = await tx`
      select id, cidt_confidentiality, cidt_integrity, cidt_availability,
        cidt_traceability, is_internet_exposed
      from public.business_applications
      where organization_id = ${organization.id} and key = 'monetique'
      limit 1
    `;

    const resolvedCves = [];
    for (const cve of cveSpecs) {
      await tx`
        insert into public.cves (
          cve_id, title, description, severity, cvss_score, exploit_maturity,
          patch_available, affected_products, published_date, last_modified_date
        ) values (
          ${cve.cveId}, ${cve.title}, ${`${cve.title}. Vendor remediation and validation are recommended.`},
          ${cve.severity}, ${cve.cvssScore}, ${cve.exploitMaturity}, ${cve.patchAvailable},
          ${tx.json(cve.products)}, ${new Date(`${cve.publishedDate}T00:00:00Z`)}, ${now}
        ) on conflict (cve_id) do nothing
      `;
      const [resolved] = await tx`
        select id, cve_id, title, severity, cvss_score, exploit_maturity, patch_available
        from public.cves where cve_id = ${cve.cveId}
      `;
      resolvedCves.push({ ...cve, ...resolved, cveId: resolved.cve_id, cvssScore: resolved.cvss_score, exploitMaturity: resolved.exploit_maturity });

      if (cve.knownExploitation) {
        await tx`
          insert into public.cve_source_references (
            cve_id, name, url, source_type, retrieved_at, supported_facts,
            retrieval_metadata, updated_at
          ) select
            ${resolved.id}, 'CISA Known Exploited Vulnerabilities Catalog',
            'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
            'cisa_kev', ${now}, ${tx.json(["Known exploitation is confirmed by CISA KEV."])},
            ${tx.json({ retrievalMethod: "fortexa_demo_seed_reference" })}, ${now}
          where not exists (
            select 1 from public.cve_source_references existing
            where existing.cve_id = ${resolved.id} and existing.source_type = 'cisa_kev'
          )
        `;
      }
    }

    const model = buildSeedModel({
      organization: organization.id,
      now,
      cves: resolvedCves,
      application: {
        cidtConfidentiality: application.cidt_confidentiality,
        cidtIntegrity: application.cidt_integrity,
        cidtAvailability: application.cidt_availability,
        cidtTraceability: application.cidt_traceability,
        isInternetExposed: application.is_internet_exposed,
      },
    });
    validateModel(model);

    await insertSeedRows(tx, organization.id, profileId, application, resolvedCves, model, now);
    await tx`
      update public.organizations
      set metadata = coalesce(metadata, '{}'::jsonb) || ${tx.json({
        fortexaDemonstrationData: true,
        fortexaDemoSeedVersion: SEED_VERSION,
        fortexaDemoSeededAt: now.toISOString(),
      })}, updated_at = ${now}
      where id = ${organization.id}
    `;

    const [persisted] = await tx`
      select
        (select count(*)::int from public.assets where organization_id = ${organization.id} and id = any(${tx.array(ids(model, "assets"))}::uuid[])) as assets,
        (select count(*)::int from public.scan_imports where organization_id = ${organization.id} and id = any(${tx.array(ids(model, "scans"))}::uuid[])) as scans,
        (select count(*)::int from public.scan_findings where organization_id = ${organization.id} and id = any(${tx.array(ids(model, "findings"))}::uuid[])) as findings,
        (select count(*)::int from public.asset_vulnerabilities where organization_id = ${organization.id} and id = any(${tx.array(ids(model, "exposures"))}::uuid[])) as vulnerabilities,
        (select count(*)::int from public.remediation_tasks where organization_id = ${organization.id} and id = any(${tx.array(ids(model, "tasks"))}::uuid[])) as remediation_tasks
    `;
    assert.equal(persisted.assets, model.assets.length);
    assert.equal(persisted.scans, model.scans.length);
    assert.equal(persisted.findings, model.findings.length);
    assert.equal(persisted.vulnerabilities, model.exposures.length);
    assert.equal(persisted.remediation_tasks, model.tasks.length);
    return { model, persisted };
  });

  console.log(JSON.stringify({
    result: "demo_seed_complete",
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    metadataKey: "fortexaDemonstrationData",
    preservedUnrelatedRows: true,
    ...displayCounts(result.model),
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    result: "failed",
    message: error instanceof Error ? error.message : "Unknown demonstration seed failure.",
  }, null, 2));
  process.exitCode = 1;
} finally {
  await sql.end();
}
