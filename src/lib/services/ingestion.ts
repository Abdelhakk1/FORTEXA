import "server-only";

import * as Sentry from "@sentry/nextjs";
import { XMLParser } from "fast-xml-parser";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alerts,
  assetVulnerabilities,
  assets,
  cves,
  profiles,
  regions,
  reportDefinitions,
  scanFindings,
  scanImports,
  scoringPolicies,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import { queueCveEnrichment } from "@/lib/services/cve-enrichment";
import { getFortexaStorageBuckets } from "@/lib/services/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AssetRow = typeof assets.$inferSelect;
type AssetType = typeof assets.$inferSelect.type;
type AssetCriticality = typeof assets.$inferSelect.criticality;
type ExposureLevel = typeof assets.$inferSelect.exposureLevel;
type Severity = typeof cves.$inferSelect.severity;
type ExploitMaturity = typeof cves.$inferSelect.exploitMaturity;
type BusinessPriority = typeof assetVulnerabilities.$inferSelect.businessPriority;
type MatchMethod = typeof scanFindings.$inferSelect.matchMethod;

interface ObservedAsset {
  preferredAssetCode?: string | null;
  name: string;
  type: AssetType;
  hostname: string | null;
  domain: string | null;
  url: string | null;
  ipAddress: string | null;
  regionId: string | null;
  ownerId: string | null;
  branch: string | null;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  osVersion: string | null;
  criticality: AssetCriticality;
  exposureLevel: ExposureLevel;
  status: typeof assets.$inferSelect.status;
  metadata: Record<string, unknown>;
}

interface NormalizedFinding {
  findingCode: string | null;
  title: string;
  severity: Severity;
  host: string;
  port: number | null;
  protocol: string | null;
  rawEvidence: string | null;
  description: string | null;
  solution: string | null;
  cveIds: string[];
  cvssScore: number | null;
  cvssVector: string | null;
  exploitMaturity: ExploitMaturity;
  patchAvailable: boolean;
  firstSeen: Date;
  lastSeen: Date;
}

interface NormalizedScanAsset {
  asset: ObservedAsset;
  findings: NormalizedFinding[];
}

interface AssetMatchResult {
  asset: AssetRow;
  created: boolean;
  matchMethod: MatchMethod;
}

interface ImportProcessingResult {
  id: string;
  status: typeof scanImports.$inferSelect.status;
  createdAssets: number;
  updatedAssets: number;
  createdFindings: number;
  createdVulnerabilities: number;
  warnings: string[];
  errors: string[];
}

interface CsvImportResult {
  totalRows: number;
  createdAssets: number;
  updatedAssets: number;
  errors: Array<{ rowNumber: number; message: string }>;
}

const privateIpPattern =
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|169\.254\.)/;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "value",
  parseTagValue: false,
  trimValues: true,
  isArray: (name) =>
    name === "ReportHost" ||
    name === "ReportItem" ||
    name === "tag" ||
    name === "cve",
});

const assetTypePrefixes: Record<AssetType, string> = {
  atm: "ATM",
  gab: "GAB",
  kiosk: "KIO",
  server: "SRV",
  network_device: "NET",
  workstation: "WKS",
  other: "AST",
};

const defaultReportDefinitions = [
  {
    name: "Vulnerability Summary",
    description: "Severity and exposure summary across imported vulnerabilities.",
    type: "risk_posture" as const,
    schedule: "On demand",
    status: "active" as const,
    config: {
      sections: ["severity_distribution", "top_vulnerabilities", "recent_imports"],
    },
  },
  {
    name: "Remediation Status",
    description: "Open, overdue, and progressing remediation work.",
    type: "remediation" as const,
    schedule: "On demand",
    status: "active" as const,
    config: {
      sections: ["open_tasks", "sla_status", "priority_breakdown"],
    },
  },
  {
    name: "Asset Inventory Summary",
    description: "Current asset coverage by type, exposure, and region.",
    type: "executive" as const,
    schedule: "On demand",
    status: "active" as const,
    config: {
      sections: ["inventory_totals", "region_breakdown", "high_exposure_assets"],
    },
  },
  {
    name: "Recent Scan Import Summary",
    description: "Latest ingestion runs, warnings, and created findings.",
    type: "compliance" as const,
    schedule: "On demand",
    status: "active" as const,
    config: {
      sections: ["recent_imports", "warnings", "findings_created"],
    },
  },
];

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value == null ? [] : [value];
}

function asText(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof value.value === "string"
  ) {
    const trimmed = value.value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeEnumValue(value: string | null | undefined) {
  return normalizeValue(value).replace(/[\s-]+/g, "_");
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeMultiValue(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const text = asText(value);

  if (!text) {
    return [];
  }

  return text
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseLooseDate(value: unknown, fallback: Date) {
  const text = asText(value);

  if (!text) {
    return fallback;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toInteger(value: unknown) {
  const text = asText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toNumber(value: unknown) {
  const text = asText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function isIpAddress(value: string | null | undefined) {
  return Boolean(value && /^(\d{1,3}\.){3}\d{1,3}$/.test(value));
}

function isPrivateIp(value: string | null | undefined) {
  return Boolean(value && privateIpPattern.test(value));
}

function metadataValue(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function guessAssetType(name: string, tags: Record<string, string>) {
  const haystack = `${name} ${tags["device-type"] ?? ""} ${tags["operating-system"] ?? ""}`.toLowerCase();

  if (haystack.includes("atm")) return "atm";
  if (haystack.includes("gab")) return "gab";
  if (haystack.includes("kiosk")) return "kiosk";
  if (
    haystack.includes("router") ||
    haystack.includes("switch") ||
    haystack.includes("firewall") ||
    haystack.includes("cisco") ||
    haystack.includes("juniper")
  ) {
    return "network_device";
  }
  if (
    haystack.includes("windows") ||
    haystack.includes("linux") ||
    haystack.includes("server")
  ) {
    return "server";
  }
  if (haystack.includes("workstation") || haystack.includes("desktop")) {
    return "workstation";
  }

  return "other";
}

function guessCriticality(type: AssetType): AssetCriticality {
  switch (type) {
    case "atm":
    case "gab":
      return "critical";
    case "server":
    case "network_device":
      return "high";
    case "workstation":
    case "kiosk":
      return "medium";
    default:
      return "low";
  }
}

function guessExposureLevel(input: {
  ipAddress: string | null;
  domain: string | null;
  url: string | null;
}): ExposureLevel {
  if (input.ipAddress && !isPrivateIp(input.ipAddress)) {
    return "internet_facing";
  }

  if (input.url || input.domain) {
    return "internet_facing";
  }

  return "internal";
}

function severityFromNessus(
  severity: unknown,
  riskFactor: unknown
): Severity {
  const risk = normalizeValue(asText(riskFactor));
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "medium" || risk === "moderate") return "medium";
  if (risk === "low") return "low";
  if (risk === "none" || risk === "info" || risk === "informational") {
    return "info";
  }

  switch (String(severity ?? "")) {
    case "4":
      return "critical";
    case "3":
      return "high";
    case "2":
      return "medium";
    case "1":
      return "low";
    default:
      return "info";
  }
}

function exploitMaturityFromFinding(finding: {
  severity: Severity;
  patchAvailable: boolean;
  title: string;
}) {
  const title = finding.title.toLowerCase();

  if (
    title.includes("zero-day") ||
    title.includes("actively exploited") ||
    finding.severity === "critical"
  ) {
    return "active_in_wild" as const;
  }

  if (finding.severity === "high" || finding.patchAvailable) {
    return "poc_available" as const;
  }

  return "theoretical" as const;
}

function riskWeight(value: number, weight: number) {
  return value * (weight / 100);
}

function calculateRiskScore(input: {
  severity: Severity;
  exploitMaturity: ExploitMaturity;
  criticality: AssetCriticality;
  exposureLevel: ExposureLevel;
  policy: typeof scoringPolicies.$inferSelect | null;
}) {
  const severityScore = {
    critical: 100,
    high: 82,
    medium: 58,
    low: 30,
    info: 10,
  }[input.severity];
  const exploitScore = {
    active_in_wild: 100,
    poc_available: 75,
    theoretical: 45,
    none: 10,
  }[input.exploitMaturity];
  const criticalityScore = {
    critical: 100,
    high: 78,
    medium: 55,
    low: 28,
  }[input.criticality];
  const exposureScore = {
    internet_facing: 100,
    internal: 60,
    isolated: 20,
  }[input.exposureLevel];

  const policy = input.policy ?? {
    severityWeight: 30,
    exploitabilityWeight: 25,
    assetCriticalityWeight: 25,
    exposureWeight: 20,
  };

  return Math.round(
    riskWeight(severityScore, policy.severityWeight) +
      riskWeight(exploitScore, policy.exploitabilityWeight) +
      riskWeight(criticalityScore, policy.assetCriticalityWeight) +
      riskWeight(exposureScore, policy.exposureWeight)
  );
}

function businessPriorityFromRisk(riskScore: number): BusinessPriority {
  if (riskScore >= 90) return "p1";
  if (riskScore >= 75) return "p2";
  if (riskScore >= 60) return "p3";
  if (riskScore >= 40) return "p4";
  return "p5";
}

function buildSlaDueDate(severity: Severity) {
  const days =
    severity === "critical"
      ? 7
      : severity === "high"
        ? 14
        : severity === "medium"
          ? 30
          : 90;

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function buildSlaStatus(slaDue: Date | null) {
  if (!slaDue) {
    return "on_track" as const;
  }

  const diff = slaDue.getTime() - Date.now();
  if (diff <= 0) return "overdue" as const;
  if (diff <= 3 * 24 * 60 * 60 * 1000) return "at_risk" as const;
  return "on_track" as const;
}

function buildRawEvidence(item: Record<string, unknown>) {
  const sections = [
    ["Synopsis", asText(item.synopsis)],
    ["Description", asText(item.description)],
    ["Plugin Output", asText(item.plugin_output)],
    ["Solution", asText(item.solution)],
  ].filter(([, value]) => Boolean(value));

  if (sections.length === 0) {
    return null;
  }

  return sections.map(([label, value]) => `${label}: ${value}`).join("\n\n");
}

function shouldIgnoreFinding(item: Record<string, unknown>, severity: Severity) {
  const title = normalizeValue(asText(item.pluginName) ?? asText(item.plugin_name));
  const family = normalizeValue(asText(item.pluginFamily) ?? asText(item.plugin_family));
  const cveIds = normalizeMultiValue(item.cve);

  if (family === "settings") {
    return true;
  }

  if (title.includes("nessus scan information")) {
    return true;
  }

  if (severity === "info" && cveIds.length === 0) {
    return true;
  }

  return false;
}

function parseNessusXml(xml: string): {
  assets: NormalizedScanAsset[];
  warnings: string[];
} {
  const parsed = xmlParser.parse(xml);
  const reportHosts = asArray(
    parsed?.NessusClientData_v2?.Report?.ReportHost ??
      parsed?.NessusClientData_v2?.ReportHost
  );
  const warnings: string[] = [];
  const assetsData: NormalizedScanAsset[] = [];

  for (const hostEntry of reportHosts) {
    if (!hostEntry || typeof hostEntry !== "object") {
      continue;
    }

    const host = hostEntry as Record<string, unknown>;
    const tags = asArray(host.HostProperties && (host.HostProperties as Record<string, unknown>).tag)
      .reduce<Record<string, string>>((acc, entry) => {
        if (!entry || typeof entry !== "object") {
          return acc;
        }

        const tag = entry as Record<string, unknown>;
        const tagName = asText(tag.name);
        const tagValue = asText(tag.value);

        if (tagName && tagValue) {
          acc[tagName] = tagValue;
        }

        return acc;
      }, {});

    const reportHostName = asText(host.name);
    const ipAddress =
      tags["host-ip"] ??
      (reportHostName && isIpAddress(reportHostName) ? reportHostName : null);
    const hostname =
      tags["host-fqdn"] ??
      tags["hostname"] ??
      tags["netbios-name"] ??
      (reportHostName && !isIpAddress(reportHostName) ? reportHostName : null);
    const domain =
      tags["host-fqdn"] ??
      (hostname?.includes(".") ? hostname : null);
    const importStartedAt = parseLooseDate(tags["HOST_START"], new Date());
    const importEndedAt = parseLooseDate(tags["HOST_END"], importStartedAt);
    const assetName = hostname ?? ipAddress ?? "Imported Asset";
    const assetType = guessAssetType(assetName, tags);
    const findings = asArray(host.ReportItem).flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const item = entry as Record<string, unknown>;
      const severity = severityFromNessus(item.severity, item.risk_factor);

      if (shouldIgnoreFinding(item, severity)) {
        return [];
      }

      const title =
        asText(item.pluginName) ??
        asText(item.plugin_name) ??
        asText(item.synopsis) ??
        "Scanner finding";

      return [
        {
          findingCode: asText(item.pluginID) ?? asText(item.plugin_id),
          title,
          severity,
          host: ipAddress ?? hostname ?? assetName,
          port: toInteger(item.port),
          protocol: asText(item.protocol),
          rawEvidence: buildRawEvidence(item),
          description: asText(item.description),
          solution: asText(item.solution),
          cveIds: normalizeMultiValue(item.cve).filter((value: string) =>
            /^CVE-\d{4}-\d+/i.test(value)
          ),
          cvssScore:
            toNumber(item.cvss3_base_score) ?? toNumber(item.cvss_base_score),
          cvssVector:
            asText(item.cvss3_vector) ?? asText(item.cvss_vector),
          exploitMaturity: exploitMaturityFromFinding({
            severity,
            patchAvailable: Boolean(asText(item.solution)),
            title,
          }),
          patchAvailable: Boolean(asText(item.solution)),
          firstSeen: importStartedAt,
          lastSeen: importEndedAt,
        } satisfies NormalizedFinding,
      ];
    });

    if (!ipAddress && !hostname && !domain) {
      warnings.push(`Skipped one Nessus host with no hostname or IP address.`);
      continue;
    }

    assetsData.push({
      asset: {
        name: assetName,
        type: assetType,
        hostname,
        domain,
        url: null,
        ipAddress,
        regionId: null,
        ownerId: null,
        branch: null,
        location: null,
        manufacturer: null,
        model: null,
        osVersion: tags["operating-system"] ?? tags["os"] ?? null,
        criticality: guessCriticality(assetType),
        exposureLevel: guessExposureLevel({
          ipAddress,
          domain,
          url: null,
        }),
        status: "active",
        metadata: {
          source: "nessus",
          hostname,
          domain,
          macAddress: tags["mac-address"] ?? null,
          operatingSystem: tags["operating-system"] ?? tags["os"] ?? null,
          externalScannerAssetId:
            tags["host-uuid"] ?? tags["bios-uuid"] ?? null,
          hostProperties: tags,
        },
      },
      findings,
    });
  }

  return {
    assets: assetsData,
    warnings,
  };
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows
    .map((entry) => entry.map((cell) => cell.trim()))
    .filter((entry) => entry.some((cell) => cell.length > 0));
}

function normalizeHostnameForMatch(input: {
  name: string;
  hostname: string | null;
  metadata: Record<string, unknown>;
}) {
  return normalizeValue(
    input.hostname ??
      metadataValue(input.metadata, "hostname") ??
      input.name
  );
}

function normalizeDomainForMatch(input: {
  domain: string | null;
  url: string | null;
  metadata: Record<string, unknown>;
}) {
  return normalizeValue(
    input.domain ??
      input.url ??
      metadataValue(input.metadata, "domain") ??
      metadataValue(input.metadata, "url")
  );
}

function createAssetCodeGenerator(existingAssets: AssetRow[]) {
  const counters = new Map<string, number>();
  const used = new Set(existingAssets.map((asset) => asset.assetCode));

  for (const asset of existingAssets) {
    const match = asset.assetCode.match(/^([A-Z]+)-(\d+)$/);

    if (!match) {
      continue;
    }

    const current = counters.get(match[1]) ?? 0;
    counters.set(match[1], Math.max(current, Number.parseInt(match[2], 10)));
  }

  return (type: AssetType) => {
    const prefix = assetTypePrefixes[type];
    let next = (counters.get(prefix) ?? 0) + 1;
    let code = `${prefix}-${String(next).padStart(3, "0")}`;

    while (used.has(code)) {
      next += 1;
      code = `${prefix}-${String(next).padStart(3, "0")}`;
    }

    counters.set(prefix, next);
    used.add(code);
    return code;
  };
}

function mergeMetadata(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
) {
  return {
    ...(existing ?? {}),
    ...incoming,
    importHistory: [
      ...asArray((existing?.importHistory as string[] | undefined) ?? []),
      new Date().toISOString(),
    ].slice(-10),
  };
}

function findMatchingAsset(existingAssets: AssetRow[], asset: ObservedAsset) {
  const preferredAssetCode = normalizeValue(asset.preferredAssetCode ?? null);

  if (preferredAssetCode) {
    const direct = existingAssets.find(
      (row) => normalizeValue(row.assetCode) === preferredAssetCode
    );
    if (direct) {
      return { asset: direct, matchMethod: "manual" as const };
    }
  }

  const externalScannerAssetId = normalizeValue(
    metadataValue(asset.metadata, "externalScannerAssetId")
  );

  if (externalScannerAssetId) {
    const direct = existingAssets.find(
      (row) =>
        normalizeValue(metadataValue(row.metadata, "externalScannerAssetId")) ===
        externalScannerAssetId
    );

    if (direct) {
      return { asset: direct, matchMethod: "manual" as const };
    }
  }

  const hostname = normalizeValue(asset.hostname);
  const ipAddress = normalizeValue(asset.ipAddress);

  if (hostname && ipAddress) {
    const direct = existingAssets.find(
      (row) =>
        normalizeHostnameForMatch({
          name: row.name,
          hostname: metadataValue(row.metadata, "hostname"),
          metadata: row.metadata ?? {},
        }) === hostname &&
        normalizeValue(row.ipAddress) === ipAddress
    );

    if (direct) {
      return { asset: direct, matchMethod: "hostname" as const };
    }
  }

  if (hostname) {
    const direct = existingAssets.find(
      (row) =>
        normalizeHostnameForMatch({
          name: row.name,
          hostname: metadataValue(row.metadata, "hostname"),
          metadata: row.metadata ?? {},
        }) === hostname
    );

    if (direct) {
      return { asset: direct, matchMethod: "hostname" as const };
    }
  }

  if (ipAddress) {
    const direct = existingAssets.find(
      (row) => normalizeValue(row.ipAddress) === ipAddress
    );

    if (direct) {
      return { asset: direct, matchMethod: "ip" as const };
    }
  }

  const domain = normalizeDomainForMatch(asset);

  if (domain) {
    const direct = existingAssets.find(
      (row) =>
        normalizeDomainForMatch({
          domain: metadataValue(row.metadata, "domain"),
          url: metadataValue(row.metadata, "url"),
          metadata: row.metadata ?? {},
        }) === domain
    );

    if (direct) {
      return { asset: direct, matchMethod: "manual" as const };
    }
  }

  return null;
}

export async function ensureDefaultReportDefinitions(createdBy: string | null) {
  const db = getDb();

  if (!db) {
    return;
  }

  const [existing] = await db
    .select({ id: reportDefinitions.id })
    .from(reportDefinitions)
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(reportDefinitions).values(
    defaultReportDefinitions.map((definition) => ({
      ...definition,
      createdBy,
    }))
  );
}

async function fetchStorageText(bucket: string, path: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new AppError(
      "service_unavailable",
      "SUPABASE_SERVICE_ROLE_KEY is missing. Import processing cannot read stored files."
    );
  }

  const { data, error } = await admin.storage.from(bucket).download(path);

  if (error || !data) {
    throw new AppError(
      "server_error",
      error?.message ?? "We could not read the uploaded file from storage."
    );
  }

  return data.text();
}

async function ensureCveRows(
  cveIds: string[],
  finding: NormalizedFinding
) {
  const db = getDb();

  if (!db || cveIds.length === 0) {
    return new Map<string, typeof cves.$inferSelect>();
  }

  const uniqueIds = Array.from(new Set(cveIds));
  const existingRows = await db
    .select()
    .from(cves)
    .where(inArray(cves.cveId, uniqueIds));
  const existingMap = new Map(existingRows.map((row) => [row.cveId, row]));

  for (const cveId of uniqueIds) {
    if (existingMap.has(cveId)) {
      continue;
    }

    const [inserted] = await db
      .insert(cves)
      .values({
        cveId,
        title: finding.title,
        description: finding.description ?? finding.rawEvidence,
        severity: finding.severity,
        cvssScore:
          finding.cvssScore != null ? finding.cvssScore.toFixed(1) : null,
        cvssVector: finding.cvssVector,
        exploitMaturity: finding.exploitMaturity,
        patchAvailable: finding.patchAvailable,
        affectedProducts: [],
      })
      .returning();

    existingMap.set(cveId, inserted);
  }

  return existingMap;
}

async function upsertObservedAsset(params: {
  existingAssets: AssetRow[];
  observedAsset: ObservedAsset;
  assetCodeGenerator: (type: AssetType) => string;
}) {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Asset ingestion cannot continue."
    );
  }

  const matched = findMatchingAsset(params.existingAssets, params.observedAsset);

  if (matched) {
    const [updated] = await db
      .update(assets)
      .set({
        type:
          matched.asset.type === "other" && params.observedAsset.type !== "other"
            ? params.observedAsset.type
            : matched.asset.type,
        ipAddress: params.observedAsset.ipAddress ?? matched.asset.ipAddress,
        location: params.observedAsset.location ?? matched.asset.location,
        manufacturer:
          params.observedAsset.manufacturer ?? matched.asset.manufacturer,
        model: params.observedAsset.model ?? matched.asset.model,
        branch: params.observedAsset.branch ?? matched.asset.branch,
        regionId: params.observedAsset.regionId ?? matched.asset.regionId,
        osVersion: params.observedAsset.osVersion ?? matched.asset.osVersion,
        criticality: matched.asset.criticality ?? params.observedAsset.criticality,
        exposureLevel:
          matched.asset.exposureLevel ?? params.observedAsset.exposureLevel,
        ownerId: matched.asset.ownerId ?? params.observedAsset.ownerId,
        status: matched.asset.status,
        lastScanDate: new Date(),
        metadata: mergeMetadata(matched.asset.metadata, params.observedAsset.metadata),
        updatedAt: new Date(),
      })
      .where(eq(assets.id, matched.asset.id))
      .returning();

    const index = params.existingAssets.findIndex(
      (row) => row.id === matched.asset.id
    );
    if (index >= 0) {
      params.existingAssets[index] = updated;
    }

    return {
      asset: updated,
      created: false,
      matchMethod: matched.matchMethod,
    } satisfies AssetMatchResult;
  }

  const assetCode =
    params.observedAsset.preferredAssetCode ??
    params.assetCodeGenerator(params.observedAsset.type);

  const [created] = await db
    .insert(assets)
    .values({
      assetCode,
      name: params.observedAsset.name,
      type: params.observedAsset.type,
      model: params.observedAsset.model,
      manufacturer: params.observedAsset.manufacturer,
      branch: params.observedAsset.branch,
      regionId: params.observedAsset.regionId,
      location: params.observedAsset.location,
      ipAddress: params.observedAsset.ipAddress,
      osVersion: params.observedAsset.osVersion,
      criticality: params.observedAsset.criticality,
      exposureLevel: params.observedAsset.exposureLevel,
      status: params.observedAsset.status,
      ownerId: params.observedAsset.ownerId,
      lastScanDate: new Date(),
      metadata: mergeMetadata(null, params.observedAsset.metadata),
    })
    .returning();

  params.existingAssets.push(created);

  return {
    asset: created,
    created: true,
    matchMethod: params.observedAsset.hostname ? "hostname" : "ip",
  } satisfies AssetMatchResult;
}

async function createImportFailureAlert(params: {
  scanImportId: string;
  importedBy: string | null;
  message: string;
}) {
  const db = getDb();

  if (!db) {
    return;
  }

  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.relatedScanImportId, params.scanImportId),
        eq(alerts.type, "import_error")
      )
    )
    .limit(1);

  if (existing) {
    return;
  }

  await db.insert(alerts).values({
    title: "Scan import failed",
    description: params.message,
    type: "import_error",
    severity: "high",
    status: "new",
    relatedScanImportId: params.scanImportId,
    ownerId: params.importedBy,
  });
}

async function createFindingAlerts(params: {
  asset: AssetRow;
  cveId: string | null;
  assetVulnerabilityId: string;
  scanImportId: string;
  severity: Severity;
  riskScore: number;
}) {
  const db = getDb();

  if (!db || params.severity === "medium" || params.severity === "low" || params.severity === "info") {
    return;
  }

  const baseTitle =
    params.severity === "critical"
      ? "New critical vulnerability imported"
      : "High-risk vulnerability imported";
  const type =
    params.severity === "critical" ? "new_critical_cve" : "critical_risk";
  const title = params.cveId
    ? `${baseTitle}: ${params.cveId}`
    : `${baseTitle}: ${params.asset.assetCode}`;

  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.relatedAssetVulnerabilityId, params.assetVulnerabilityId),
        eq(alerts.type, type)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(alerts).values({
      title,
      description: `Imported vulnerability on ${params.asset.assetCode} with contextual risk score ${params.riskScore}.`,
      type,
      severity: params.severity,
      status: "new",
      relatedAssetId: params.asset.id,
      relatedCveId: params.cveId,
      relatedAssetVulnerabilityId: params.assetVulnerabilityId,
      relatedScanImportId: params.scanImportId,
      ownerId: params.asset.ownerId,
    });
  }

  if (
    params.asset.exposureLevel === "internet_facing" &&
    params.severity === "critical"
  ) {
    const [exposed] = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.relatedAssetVulnerabilityId, params.assetVulnerabilityId),
          eq(alerts.type, "exposed_asset")
        )
      )
      .limit(1);

    if (!exposed) {
      await db.insert(alerts).values({
        title: `Internet-facing critical asset: ${params.asset.assetCode}`,
        description: `${params.asset.assetCode} is internet-facing and now has an open critical vulnerability.`,
        type: "exposed_asset",
        severity: "critical",
        status: "new",
        relatedAssetId: params.asset.id,
        relatedCveId: params.cveId,
        relatedAssetVulnerabilityId: params.assetVulnerabilityId,
        relatedScanImportId: params.scanImportId,
        ownerId: params.asset.ownerId,
      });
    }
  }
}

export async function processScanImport(
  scanImportId: string
): Promise<ImportProcessingResult> {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. Scan import processing is disabled."
    );
  }

  const startedAt = Date.now();
  const [scanImport] = await db
    .select()
    .from(scanImports)
    .where(eq(scanImports.id, scanImportId))
    .limit(1);

  if (!scanImport) {
    throw new AppError("not_found", "Scan import not found.");
  }

  const [existingFindings] = await db
    .select({ id: scanFindings.id })
    .from(scanFindings)
    .where(eq(scanFindings.scanImportId, scanImportId))
    .limit(1);

  if (
    existingFindings &&
    (scanImport.status === "completed" || scanImport.status === "partial")
  ) {
    return {
      id: scanImport.id,
      status: scanImport.status,
      createdAssets: scanImport.newAssets,
      updatedAssets: Math.max(scanImport.assetsFound - scanImport.newAssets, 0),
      createdFindings: scanImport.findingsFound,
      createdVulnerabilities: scanImport.newVulnerabilities,
      warnings: [],
      errors: [],
    };
  }

  if (scanImport.scannerSource !== "nessus") {
    const message =
      "Only Nessus (.nessus) files are enabled for the Fortexa MVP importer.";

    await db
      .update(scanImports)
      .set({
        status: "failed",
        errors: 1,
        warnings: 0,
        errorDetails: {
          message,
          canonicalImporter: "nessus",
        },
        processingTimeMs: Date.now() - startedAt,
      })
      .where(eq(scanImports.id, scanImportId));
    await createImportFailureAlert({
      scanImportId,
      importedBy: scanImport.importedBy ?? null,
      message,
    });

    throw new AppError("validation_error", message);
  }

  try {
    if (!scanImport.storagePath) {
      throw new AppError(
        "validation_error",
        "The scan import record does not have a stored file path."
      );
    }

    const xml = await fetchStorageText(
      getFortexaStorageBuckets().scanImports,
      scanImport.storagePath
    );
    const parsed = parseNessusXml(xml);

    if (parsed.assets.length === 0) {
      throw new AppError(
        "validation_error",
        "The uploaded Nessus file did not contain any importable hosts."
      );
    }

    const [existingAssets, existingAssetVulnerabilities, activePolicy] =
      await Promise.all([
        db.select().from(assets),
        db.select().from(assetVulnerabilities),
        db
          .select()
          .from(scoringPolicies)
          .where(eq(scoringPolicies.isActive, true))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);

    const assetCodeGenerator = createAssetCodeGenerator(existingAssets);
    const avMap = new Map(
      existingAssetVulnerabilities.map((row) => [`${row.assetId}:${row.cveId}`, row])
    );
    const warnings = [...parsed.warnings];
    const errors: string[] = [];
    let createdAssets = 0;
    let updatedAssets = 0;
    let createdFindings = 0;
    let createdVulnerabilities = 0;
    let linkedCves = 0;
    const processedAssetIds = new Set<string>();
    const enrichmentCveIds = new Set<string>();

    for (const entry of parsed.assets) {
      try {
        const matched = await upsertObservedAsset({
          existingAssets,
          observedAsset: entry.asset,
          assetCodeGenerator,
        });

        if (matched.created) {
          createdAssets += 1;
        } else {
          updatedAssets += 1;
        }

        processedAssetIds.add(matched.asset.id);

        for (const finding of entry.findings) {
          const cveMap = await ensureCveRows(finding.cveIds, finding);
          const primaryCve =
            finding.cveIds.find((cveId) => cveMap.has(cveId)) ?? null;

          await db.insert(scanFindings).values({
            scanImportId,
            findingCode: finding.findingCode,
            title: finding.title,
            severity: finding.severity,
            host: finding.host,
            port: finding.port,
            protocol: finding.protocol,
            rawEvidence: finding.rawEvidence,
            firstSeen: finding.firstSeen,
            lastSeen: finding.lastSeen,
            matchedAssetId: matched.asset.id,
            matchedCveId: primaryCve ? cveMap.get(primaryCve)?.id ?? null : null,
            matchConfidence: matched.matchMethod === "hostname" ? 90 : 80,
            matchMethod: matched.matchMethod,
            matchNotes:
              finding.cveIds.length > 1
                ? `Imported with ${finding.cveIds.length} candidate CVEs.`
                : null,
            status: "matched",
          });
          createdFindings += 1;

          for (const cveId of finding.cveIds) {
            const cveRow = cveMap.get(cveId);

            if (!cveRow) {
              continue;
            }

            enrichmentCveIds.add(cveRow.id);
            linkedCves += 1;
            const key = `${matched.asset.id}:${cveRow.id}`;
            const riskScore = calculateRiskScore({
              severity: finding.severity,
              exploitMaturity: finding.exploitMaturity,
              criticality: matched.asset.criticality,
              exposureLevel: matched.asset.exposureLevel,
              policy: activePolicy,
            });
            const businessPriority = businessPriorityFromRisk(riskScore);
            const slaDue = buildSlaDueDate(finding.severity);
            const existing = avMap.get(key);

            if (existing) {
              const [updated] = await db
                .update(assetVulnerabilities)
                .set({
                  lastSeen: finding.lastSeen,
                  riskScore,
                  businessPriority,
                  slaDue,
                  slaStatus: buildSlaStatus(slaDue),
                  scoringPolicyId: activePolicy?.id ?? existing.scoringPolicyId,
                  sourceScanImportId: scanImportId,
                  notes: finding.solution ?? existing.notes,
                  updatedAt: new Date(),
                })
                .where(eq(assetVulnerabilities.id, existing.id))
                .returning();

              avMap.set(key, updated);
              await createFindingAlerts({
                asset: matched.asset,
                cveId: cveRow.id,
                assetVulnerabilityId: updated.id,
                scanImportId,
                severity: finding.severity,
                riskScore,
              });
              continue;
            }

            const [created] = await db
              .insert(assetVulnerabilities)
              .values({
                assetId: matched.asset.id,
                cveId: cveRow.id,
                firstSeen: finding.firstSeen,
                lastSeen: finding.lastSeen,
                status: "open",
                businessPriority,
                riskScore,
                slaDue,
                slaStatus: buildSlaStatus(slaDue),
                scoringPolicyId: activePolicy?.id ?? null,
                sourceScanImportId: scanImportId,
                notes: finding.solution,
              })
              .returning();

            avMap.set(key, created);
            createdVulnerabilities += 1;
            await createFindingAlerts({
              asset: matched.asset,
              cveId: cveRow.id,
              assetVulnerabilityId: created.id,
              scanImportId,
              severity: finding.severity,
              riskScore,
            });
          }
        }
      } catch (error) {
        Sentry.captureException(error);
        errors.push(
          error instanceof Error
            ? error.message
            : "A host entry could not be processed."
        );
      }
    }

    const status =
      errors.length > 0 && createdFindings + createdAssets + updatedAssets > 0
        ? "partial"
        : errors.length > 0
          ? "failed"
          : "completed";

    await db
      .update(scanImports)
      .set({
        status,
        assetsFound: processedAssetIds.size,
        findingsFound: createdFindings,
        cvesLinked: linkedCves,
        newAssets: createdAssets,
        newVulnerabilities: createdVulnerabilities,
        closedVulnerabilities: 0,
        errors: errors.length,
        warnings: warnings.length,
        processingTimeMs: Date.now() - startedAt,
        errorDetails:
          warnings.length || errors.length
            ? {
                warnings,
                errors,
                canonicalImporter: "nessus",
              }
            : null,
      })
      .where(eq(scanImports.id, scanImportId));

    await ensureDefaultReportDefinitions(scanImport.importedBy ?? null);

    for (const cveId of enrichmentCveIds) {
      try {
        const queued = await queueCveEnrichment(cveId);
        if (!queued.ok) {
          warnings.push(`AI enrichment queue skipped for one CVE: ${queued.message}`);
        }
      } catch (error) {
        Sentry.captureException(error);
        warnings.push("AI enrichment queue skipped for one CVE.");
      }
    }

    if (warnings.length !== parsed.warnings.length) {
      await db
        .update(scanImports)
        .set({
          warnings: warnings.length,
          errorDetails:
            warnings.length || errors.length
              ? {
                  warnings,
                  errors,
                  canonicalImporter: "nessus",
                }
              : null,
        })
        .where(eq(scanImports.id, scanImportId));
    }

    return {
      id: scanImportId,
      status,
      createdAssets,
      updatedAssets,
      createdFindings,
      createdVulnerabilities,
      warnings,
      errors,
    };
  } catch (error) {
    Sentry.captureException(error);
    const message =
      error instanceof AppError
        ? error.message
        : "The Nessus file could not be processed.";

    await db
      .update(scanImports)
      .set({
        status: "failed",
        errors: 1,
        warnings: 0,
        processingTimeMs: Date.now() - startedAt,
        errorDetails: {
          message,
          canonicalImporter: "nessus",
        },
      })
      .where(eq(scanImports.id, scanImportId));
    await createImportFailureAlert({
      scanImportId,
      importedBy: scanImport.importedBy ?? null,
      message,
    });

    throw error instanceof AppError
      ? error
      : new AppError("server_error", message);
  }
}

export async function importAssetsFromCsv(params: {
  file: File;
  importedBy: string | null;
}): Promise<CsvImportResult> {
  const db = getDb();

  if (!db) {
    throw new AppError(
      "service_unavailable",
      "DATABASE_URL is missing. CSV asset import is disabled."
    );
  }

  const text = await params.file.text();
  const rows = parseCsv(text);

  if (rows.length < 2) {
    throw new AppError(
      "validation_error",
      "The asset CSV must include a header row and at least one asset row."
    );
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = headerRow.map(normalizeCsvHeader);

  if (!headers.includes("name") && !headers.includes("hostname")) {
    throw new AppError(
      "validation_error",
      "The asset CSV must include at least a name or hostname column."
    );
  }

  const [existingAssets, regionRows, ownerRows] = await Promise.all([
    db.select().from(assets),
    db.select().from(regions),
    db
      .select({
        id: profiles.id,
        email: profiles.email,
      })
      .from(profiles),
  ]);

  const assetCodeGenerator = createAssetCodeGenerator(existingAssets);
  const regionByCode = new Map(
    regionRows.map((row) => [normalizeValue(row.code), row.id])
  );
  const ownerByEmail = new Map(
    ownerRows.map((row) => [normalizeValue(row.email), row.id])
  );

  let createdAssets = 0;
  let updatedAssets = 0;
  const errors: Array<{ rowNumber: number; message: string }> = [];

  for (const [index, values] of bodyRows.entries()) {
    const rowNumber = index + 2;
    const record = headers.reduce<Record<string, string>>((acc, header, cellIndex) => {
      acc[header] = values[cellIndex] ?? "";
      return acc;
    }, {});

    try {
      const regionCode = normalizeValue(record.region_code || record.region);
      const regionId = regionCode ? regionByCode.get(regionCode) ?? null : null;

      if (regionCode && !regionId) {
        throw new AppError(
          "validation_error",
          `Row ${rowNumber}: region code "${record.region_code}" is not seeded in Supabase.`
        );
      }

      const ownerId =
        normalizeValue(record.owner_id) ||
        ownerByEmail.get(normalizeValue(record.owner_email)) ||
        null;

      if (record.owner_email && !ownerId) {
        throw new AppError(
          "validation_error",
          `Row ${rowNumber}: owner_email "${record.owner_email}" does not match a profile.`
        );
      }

      const typeValue = normalizeEnumValue(record.type);
      const type: AssetType =
        typeValue === "atm" ||
        typeValue === "gab" ||
        typeValue === "kiosk" ||
        typeValue === "server" ||
        typeValue === "network_device" ||
        typeValue === "workstation"
          ? typeValue
          : "other";
      const ipAddress = asText(record.ip_address);
      const hostname = asText(record.hostname);
      const domain = asText(record.domain);
      const url = asText(record.url);
      const assetName =
        asText(record.name) ??
        hostname ??
        domain ??
        ipAddress ??
        asText(record.asset_code) ??
        null;

      if (!assetName) {
        throw new AppError(
          "validation_error",
          `Row ${rowNumber}: each asset needs a name, hostname, domain, or ip_address.`
        );
      }

      const observedAsset: ObservedAsset = {
        preferredAssetCode: asText(record.asset_code),
        name: assetName,
        type,
        hostname,
        domain,
        url,
        ipAddress,
        regionId,
        ownerId,
        branch: asText(record.branch),
        location: asText(record.location),
        manufacturer: asText(record.manufacturer),
        model: asText(record.model),
        osVersion: asText(record.os_version),
        criticality:
          normalizeEnumValue(record.criticality) === "critical" ||
          normalizeEnumValue(record.criticality) === "high" ||
          normalizeEnumValue(record.criticality) === "low"
            ? (normalizeEnumValue(record.criticality) as AssetCriticality)
            : guessCriticality(type),
        exposureLevel:
          normalizeEnumValue(record.exposure_level) === "internet_facing" ||
          normalizeEnumValue(record.exposure_level) === "isolated"
            ? (normalizeEnumValue(record.exposure_level) as ExposureLevel)
            : guessExposureLevel({ ipAddress, domain, url }),
        status:
          normalizeEnumValue(record.status) === "inactive" ||
          normalizeEnumValue(record.status) === "maintenance" ||
          normalizeEnumValue(record.status) === "decommissioned"
            ? (normalizeEnumValue(record.status) as typeof assets.$inferSelect.status)
            : "active",
        metadata: {
          source: "csv",
          hostname,
          domain,
          url,
          csvRowNumber: rowNumber,
        },
      };

      const matched = await upsertObservedAsset({
        existingAssets,
        observedAsset,
        assetCodeGenerator,
      });

      if (matched.created) {
        createdAssets += 1;
      } else {
        updatedAssets += 1;
      }
    } catch (error) {
      errors.push({
        rowNumber,
        message:
          error instanceof Error
            ? error.message.replace(/^Row \d+:\s*/, "")
            : "The row could not be imported.",
      });
    }
  }

  if (createdAssets + updatedAssets > 0) {
    await ensureDefaultReportDefinitions(params.importedBy);
  }

  return {
    totalRows: bodyRows.length,
    createdAssets,
    updatedAssets,
    errors,
  };
}
