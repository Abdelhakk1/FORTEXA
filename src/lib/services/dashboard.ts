import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assetVulnerabilities, alerts, assets, cves, remediationTasks, scanImports } from "@/db/schema";
import type { Alert, Asset, Vulnerability } from "@/lib/types";
import {
  formatDate,
  toUiAlertStatus,
  toUiAlertType,
  toUiBusinessPriority,
  toUiCriticality,
  toUiSeverity,
  toUiSlaStatus,
  toUiAssetStatus,
  toUiAssetType,
  toUiExposureLevel,
  toUiImportStatus,
  toUiScannerSource,
} from "./serializers";

interface DashboardData {
  totals: {
    totalAssets: number;
    atmGabCount: number;
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    openAlerts: number;
    overdueTasks: number;
  };
  severityDistribution: Array<{ name: string; value: number; color: string }>;
  exposureTrend: Array<{ month: string; critical: number; high: number; medium: number; low: number }>;
  remediationTrend: Array<{ month: string; opened: number; closed: number; overdue: number }>;
  topRiskyAssets: Asset[];
  latestAlerts: Alert[];
  prioritizedVulnerabilities: Vulnerability[];
  latestScanImports: Array<{
    id: string;
    name: string;
    scannerSource: string;
    importDate: string;
    findingsFound: number;
    status: string;
  }>;
}

interface RiskyAssetSummary {
  id: string;
  name: string;
  type: Asset["type"];
  model: string;
  branch: string;
  region: string;
  exposureLevel: Asset["exposureLevel"];
  status: Asset["status"];
  criticality: Asset["criticality"];
  vulnerabilityCount: number;
  maxSeverity: "critical" | "high" | "medium" | "low" | "info";
  contextualPriority: "p1" | "p2" | "p3" | "p4" | "p5";
  riskScore: number;
}

const priorityRank = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
} as const;

const severityRank = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

function buildEmptyTrend(months: string[]) {
  return months.map((month) => ({
    month,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }));
}

function buildEmptyRemediationTrend(months: string[]) {
  return months.map((month) => ({
    month,
    opened: 0,
    closed: 0,
    overdue: 0,
  }));
}

export async function getDashboardData(): Promise<DashboardData> {
  const db = getDb();
  const monthLabels = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];

  if (!db) {
    return {
      totals: {
        totalAssets: 0,
        atmGabCount: 0,
        totalVulnerabilities: 0,
        criticalVulnerabilities: 0,
        openAlerts: 0,
        overdueTasks: 0,
      },
      severityDistribution: [
        { name: "Critical", value: 0, color: "#EF4444" },
        { name: "High", value: 0, color: "#F59E0B" },
        { name: "Medium", value: 0, color: "#3B82F6" },
        { name: "Low", value: 0, color: "#10B981" },
      ],
      exposureTrend: buildEmptyTrend(monthLabels),
      remediationTrend: buildEmptyRemediationTrend(monthLabels),
      topRiskyAssets: [],
      latestAlerts: [],
      prioritizedVulnerabilities: [],
      latestScanImports: [],
    };
  }

  let assetRows;
  let avRows;
  let alertRows;
  let remediationRows;
  let importRows;

  try {
    [assetRows, avRows, alertRows, remediationRows, importRows] = await Promise.all([
      db.select().from(assets),
      db
        .select({
          av: assetVulnerabilities,
          assetName: assets.name,
          assetCode: assets.assetCode,
          assetType: assets.type,
          model: assets.model,
          branch: assets.branch,
          region: assets.regionId,
          exposureLevel: assets.exposureLevel,
          assetStatus: assets.status,
          criticality: assets.criticality,
          cveCode: cves.cveId,
          title: cves.title,
          description: cves.description,
          severity: cves.severity,
          cvssScore: cves.cvssScore,
          cvssVector: cves.cvssVector,
          exploitMaturity: cves.exploitMaturity,
          patchAvailable: cves.patchAvailable,
          affectedProducts: cves.affectedProducts,
        })
        .from(assetVulnerabilities)
        .leftJoin(assets, eq(assetVulnerabilities.assetId, assets.id))
        .leftJoin(cves, eq(assetVulnerabilities.cveId, cves.id)),
      db.select().from(alerts),
      db.select().from(remediationTasks),
      db.select().from(scanImports),
    ]);
  } catch {
    return {
      totals: {
        totalAssets: 0,
        atmGabCount: 0,
        totalVulnerabilities: 0,
        criticalVulnerabilities: 0,
        openAlerts: 0,
        overdueTasks: 0,
      },
      severityDistribution: [
        { name: "Critical", value: 0, color: "#EF4444" },
        { name: "High", value: 0, color: "#F59E0B" },
        { name: "Medium", value: 0, color: "#3B82F6" },
        { name: "Low", value: 0, color: "#10B981" },
      ],
      exposureTrend: buildEmptyTrend(monthLabels),
      remediationTrend: buildEmptyRemediationTrend(monthLabels),
      topRiskyAssets: [],
      latestAlerts: [],
      prioritizedVulnerabilities: [],
      latestScanImports: [],
    };
  }

  const topRiskyAssets = Array.from(
    avRows.reduce<Map<string, RiskyAssetSummary>>((map, row) => {
      if (!row.assetCode || !row.assetName) {
        return map;
      }

      const current = map.get(row.av.assetId) ?? {
        id: row.assetCode,
        name: row.assetName,
        type: toUiAssetType(row.assetType),
        model: row.model ?? "—",
        branch: row.branch ?? "—",
        region: row.region ?? "Unassigned",
        exposureLevel: toUiExposureLevel(row.exposureLevel),
        status: toUiAssetStatus(row.assetStatus),
        criticality: toUiCriticality(row.criticality),
        vulnerabilityCount: 0,
        maxSeverity: "info",
        contextualPriority: "p5",
        riskScore: 0,
      };

      current.vulnerabilityCount += 1;
      current.riskScore = Math.max(current.riskScore, row.av.riskScore);

      const nextSeverity = row.severity as keyof typeof severityRank | null;
      if (
        nextSeverity &&
        severityRank[nextSeverity] > severityRank[current.maxSeverity]
      ) {
        current.maxSeverity = nextSeverity;
      }

      const nextPriority =
        row.av.businessPriority as keyof typeof priorityRank | null;
      if (
        nextPriority &&
        priorityRank[nextPriority] < priorityRank[current.contextualPriority]
      ) {
        current.contextualPriority = nextPriority;
      }

      map.set(row.av.assetId, current);
      return map;
    }, new Map()).values()
  )
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, 5)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      model: asset.model,
      manufacturer: "—",
      branch: asset.branch,
      region: asset.region,
      location: "—",
      ipAddress: "—",
      osVersion: "—",
      criticality: asset.criticality,
      exposureLevel: asset.exposureLevel,
      status: asset.status,
      owner: "Unassigned",
      lastScanDate: "—",
      vulnerabilityCount: asset.vulnerabilityCount,
      maxSeverity: toUiSeverity(asset.maxSeverity),
      contextualPriority: toUiBusinessPriority(asset.contextualPriority),
      riskScore: asset.riskScore,
    }));

  const latestAlerts = alertRows
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 5)
    .map((alert) => ({
      id: alert.id,
      title: alert.title,
      description: alert.description ?? "",
      severity: toUiSeverity(alert.severity),
      type: toUiAlertType(alert.type),
      relatedAsset: "Linked entity",
      relatedCve: "N/A",
      createdAt: formatDate(alert.createdAt),
      owner: "Unassigned",
      status: toUiAlertStatus(alert.status),
    }));

  const vulnerabilityMap = new Map<string, Vulnerability>();

  for (const row of avRows) {
    if (!row.cveCode) {
      continue;
    }

    const current = vulnerabilityMap.get(row.cveCode) ?? {
      id: row.cveCode,
      cveId: row.cveCode,
      title: row.title ?? row.cveCode,
      description: row.description ?? "",
      severity: toUiSeverity(row.severity),
      cvssScore: row.cvssScore ? Number(row.cvssScore) : 0,
      cvssVector: row.cvssVector ?? "—",
      businessPriority: toUiBusinessPriority(row.av.businessPriority),
      exploitMaturity: "None",
      affectedAssetsCount: 0,
      patchAvailable: row.patchAvailable ?? false,
      aiRemediationAvailable: false,
      status: "Open",
      firstSeen: formatDate(row.av.firstSeen),
      lastSeen: formatDate(row.av.lastSeen),
      slaDue: formatDate(row.av.slaDue),
      slaStatus: toUiSlaStatus(row.av.slaStatus),
      affectedProducts: row.affectedProducts ?? [],
      impactAnalysis: "",
      exploitConditions: "",
      trustedSources: [],
      primaryRemediation: "",
      compensatingControls: [],
      confidenceScore: 0,
      contextReason: "",
      aiSummary: "",
      enrichmentStatus: "Pending",
      enrichmentError: "",
      enrichmentModel: "",
      aiEnrichedAt: "—",
      aiTags: [],
    } satisfies Vulnerability;

    current.affectedAssetsCount += 1;
    vulnerabilityMap.set(row.cveCode, current);
  }

  const prioritizedVulnerabilities = Array.from(vulnerabilityMap.values())
    .sort((left, right) => right.cvssScore - left.cvssScore)
    .slice(0, 5);

  return {
    totals: {
      totalAssets: assetRows.length,
      atmGabCount: assetRows.filter((asset) => asset.type === "atm" || asset.type === "gab").length,
      totalVulnerabilities: avRows.length,
      criticalVulnerabilities: avRows.filter((row) => row.severity === "critical").length,
      openAlerts: alertRows.filter((alert) => alert.status === "new" || alert.status === "acknowledged").length,
      overdueTasks: remediationRows.filter((task) => task.slaStatus === "overdue").length,
    },
    severityDistribution: [
      {
        name: "Critical",
        value: avRows.filter((row) => row.severity === "critical").length,
        color: "#EF4444",
      },
      {
        name: "High",
        value: avRows.filter((row) => row.severity === "high").length,
        color: "#F59E0B",
      },
      {
        name: "Medium",
        value: avRows.filter((row) => row.severity === "medium").length,
        color: "#3B82F6",
      },
      {
        name: "Low",
        value: avRows.filter((row) => row.severity === "low").length,
        color: "#10B981",
      },
    ],
    exposureTrend: buildEmptyTrend(monthLabels),
    remediationTrend: buildEmptyRemediationTrend(monthLabels),
    topRiskyAssets,
    latestAlerts,
    prioritizedVulnerabilities,
    latestScanImports: importRows
      .slice()
      .sort((left, right) => right.importDate.getTime() - left.importDate.getTime())
      .slice(0, 5)
      .map((scanImport) => ({
        id: scanImport.id,
        name: scanImport.name,
        scannerSource: toUiScannerSource(scanImport.scannerSource),
        importDate: formatDate(scanImport.importDate),
        findingsFound: scanImport.findingsFound,
        status: toUiImportStatus(scanImport.status),
      })),
  };
}
